import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { campaignPreviewBridgeSQL, legacyPreviewLedger, canonicalCampaignLedger } from '../../scripts/campaign-preview-migration-bridge.mjs';
import { campaignSchemaFingerprintSQL } from '../../scripts/campaign-preview-schema.mjs';
import { productionCampaignMigrationSQL } from '../../scripts/production-campaign-migration.mjs';
import * as s from '../../worker/db/schema';
import { generateCampaignLayout } from '../../shared/campaign/generation';
import { initialCombatState, addStudent } from '../../worker/combat/engine';
import { fight, student } from './fixtures';

const root = 'migrations/cloudflare';
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');
const journal = JSON.parse(read('meta/_journal.json'));
const legacy = JSON.parse(read('legacy-campaign-preview/_journal.json'));
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const contract = JSON.parse(read('legacy-campaign-preview/schema-contract.json'));
const currentContract = JSON.parse(read('campaign-question-bank-contract.json'));
const fingerprint = async (pg: PGlite) => {
  await pg.exec('SET search_path TO public, pg_catalog');
  return (await pg.query(campaignSchemaFingerprintSQL)).rows[0].fingerprint;
};

// Exercise Drizzle's real timestamp-based ledger, not only a loop over SQL files.
async function migrateHistory(pg: PGlite, preview: boolean, c12 = false, withRoster = false) {
  // Historical 0008 contains multi-statement chunks supported by the deployment
  // driver but not PGlite prepared queries. Seed those exact bytes/ledger rows via
  // exec; the forward upgrade and no-op below use the actual Drizzle migrator.
  await pg.exec('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)');
  const selected = preview ? legacy.entries : journal.entries.slice(0, c12 ? 18 : withRoster ? 20 : 19);
  for (const entry of selected) {
    const source = read(`${preview && entry.idx >= 18 ? 'legacy-campaign-preview/' : ''}${entry.tag}.sql`);
    await pg.exec(source);
    await pg.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)', [hash(source), entry.when]);
  }
}

const ledger = async (pg: PGlite) => (await pg.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows;
const snapshot = async (pg: PGlite, table: string) => (await pg.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;

test('guarded production upgrade preserves populated records, is atomic and rejects preview history', async () => {
  const pg=new PGlite();
  try {
    await migrateHistory(pg,false,false,true);await seed(pg,false);
    const tables=['students','aa_purchases','student_job_levels','combat_results','student_activity_samples'];
    const before=await Promise.all(tables.map(t=>snapshot(pg,t))), oldLedger=await ledger(pg);
    const sql=productionCampaignMigrationSQL();
    await assert.rejects(pg.exec(sql.replace('END $production_campaign$;', "RAISE EXCEPTION 'late failure'; END $production_campaign$;")),/late failure/);
    await pg.exec('ROLLBACK');assert.deepEqual(await Promise.all(tables.map(t=>snapshot(pg,t))),before);assert.deepEqual(await ledger(pg),oldLedger);
    await pg.exec(sql);const after=await Promise.all(tables.map(t=>snapshot(pg,t)));
    for(const item of after[0] as any[]){assert.equal(item.row.stamina_recovery,0);delete item.row.stamina_recovery;}
    for(const item of after[3] as any[]){assert.equal(item.row.stamina_restored,0);delete item.row.stamina_restored;}
    assert.deepEqual(after,before);assert.deepEqual((await ledger(pg)).slice(0,20),oldLedger);assert.equal((await ledger(pg)).length,25);
    const once=await Promise.all(tables.map(t=>snapshot(pg,t)));await pg.exec(sql);assert.deepEqual(await Promise.all(tables.map(t=>snapshot(pg,t))),once);
  } finally {await pg.close();}
  const preview=new PGlite();try {await migrateHistory(preview,true);await assert.rejects(preview.exec(productionCampaignMigrationSQL()),/canonical 20-row/);await preview.exec('ROLLBACK');assert.equal((await ledger(preview)).length,22);}finally{await preview.close();}
});

async function seed(pg: PGlite, preview: boolean) {
  const db = drizzle(pg, { schema: s });
  await db.insert(s.teachers).values({ id: fight.teacherId, firstName: 'Migration', lastName: 'Test', email: 'migration@example.invalid', emailNormalized: 'migration@example.invalid', passwordHash: 'unused', guildCode: 'MIGRAT', billingAddress: 'Test', schoolDistrict: 'Test', school: 'Test', subject: 'Math', gradeLevel: '5' });
  await db.insert(s.fights).values(fight);
  const [guild] = await db.insert(s.guilds).values({ teacherId: fight.teacherId, name: 'Saved guild', code: 'MIG001' }).returning();
  await pg.query(`INSERT INTO students(id,nickname,nickname_normalized,password_hash,character_class,gender,aa_experience,xp_remainder,gold,daily_combats,inventory,cross_class_ability_1,cross_class_ability_2,job_loadouts)
    VALUES($1,'Saved','saved','unused','warrior','A',1234,0.625,321,4,'["basic_sword"]','hex_crossclass','mend_crossclass','{"warrior":{"crossClassAbility1":"hex_crossclass","crossClassAbility2":"mend_crossclass"}}')`, [student().id]);
  await db.insert(s.guildMemberships).values({ guildId: guild.id, studentId: student().id });
  await db.insert(s.studentJobLevels).values({ studentId: student().id, jobClass: 'warrior', level: 4, experience: 36 });
  if (!preview) {
    await pg.query(`SELECT purchase_aa($1,$2,'stat:str',1,2,1,60,'{"request":"saved"}')`, [student().id, crypto.randomUUID()]);
    await pg.query(`UPDATE students SET cross_class_abilities='["a","b","c","d","e"]',character_name='Paid Name' WHERE id=$1`, [student().id]);
  }
  await db.insert(s.liveCombatSessions).values({ sessionId: 'MIG-DONE', fightId: fight.id, teacherId: fight.teacherId, status: 'completed' });
  // A durable result proves that migration never re-awards XP or rewrites receipts.
  await pg.query(`SELECT award_combat_results_with_stamina($1::jsonb)`, [JSON.stringify([{
    session_id: 'MIG-DONE', student_id: student().id, fight_id: fight.id, guild_id: guild.id,
    character_class: 'warrior', victory: true, survived: true, is_solo_mode: true,
    totals: {}, base_xp: 10.5, gold_reward: 5, loot_table: [], reward_claim: 'automatic',
    participated: true, level_cap: 4, eligible_progression: true, campaign_boss: preview,
  }])]);
  if (preview) {
    const id = crypto.randomUUID(), layout = generateCampaignLayout('saved', []);
    await db.insert(s.campaigns).values({ id, teacherId: fight.teacherId, guildId: guild.id, fightId: fight.id, name: 'Keep my run', dungeonName: 'Saved cave', gates: [], layout, fightSnapshot: fight });
    await db.insert(s.liveCombatSessions).values({ sessionId: 'CP-SAVED', fightId: fight.id, teacherId: fight.teacherId, soloStudentId: student().id, guildId: guild.id, guildLimitTier: 1, status: 'active' });
    const player = addStudent(initialCombatState('CP-SAVED', fight), student()).players[student().id];
    player.health = 2; player.mp = 1; player.consumables = { potion: 3 }; player.healingPotions = 1;
    await db.insert(s.campaignPlayers).values({ campaignId: id, studentId: student().id, revision: 17, state: {
      version: 1, zone: 'dungeon', position: layout.dungeon.spawn, job: 'warrior', health: 2, maxHealth: player.maxHealth, mp: 1, maxMp: player.maxMp,
      healingPotions: 1, shieldPotions: 0, consumables: { potion: 3 }, itemProtections: { stun: 2 }, steps: 27,
      claimedUnlocks: ['saved-key'], explored: ['dungeon:1,1'], cleared: false, activeSessionId: 'CP-SAVED', lastCommandId: 'saved-command',
    } });
    await db.insert(s.campaignEncounters).values({ sessionId: 'CP-SAVED', campaignId: id, studentId: student().id, fightSnapshot: { ...fight, campaignContext: { campaignId: id, studentId: student().id, objective: true, fixedTier: 1 } }, playerSnapshot: player });
  }
}

test('production SQL/journal through roster 0019 and archived preview SQL are immutable', () => {
  const history = JSON.parse(readFileSync('tests/phase4/fixtures/migration-history-production-oct28.json', 'utf8'));
  assert.deepEqual(journal.entries.slice(0, 20), history.entries);
  for (const [name, digest] of Object.entries(history.sha256)) assert.equal(hash(read(name)), digest, name);
  for (let i = 18; i <= 21; i++) assert.equal(hash(read(`legacy-campaign-preview/${legacy.entries[i].tag}.sql`)), canonicalCampaignLedger[i + 2].hash);
  assert.equal(new Set(journal.entries.map((e: any) => e.idx)).size, journal.entries.length);
  assert.ok(journal.entries.every((e: any, i: number) => !i || e.when > journal.entries[i - 1].when));
});

test('production history upgrades forward without altering AA purchases, saved slots, XP or old results', async () => {
  const pg = new PGlite();
  try {
    await migrateHistory(pg, false); await seed(pg, false);
    const tables = ['students', 'aa_purchases', 'student_job_levels', 'combat_results'];
    const before = await Promise.all(tables.map(t => snapshot(pg, t))), oldLedger = await ledger(pg);
    await migrate(drizzle(pg), { migrationsFolder: root });
    const after = await Promise.all(tables.map(t => snapshot(pg, t)));
    for (const item of after[0] as any[]) { assert.equal(item.row.stamina_recovery, 0); delete item.row.stamina_recovery; }
    for (const item of after[3] as any[]) { assert.equal(item.row.stamina_restored, 0); delete item.row.stamina_restored; }
    assert.deepEqual(after, before);
    assert.deepEqual((await ledger(pg)).slice(0, 19), oldLedger);
    assert.equal((await ledger(pg)).length, 26);
    assert.equal((await snapshot(pg, 'campaign_players')).length, 0, 'no playtest records seeded');
    assert.deepEqual(await fingerprint(pg), currentContract, 'current contract matches independently migrated canonical history');
  } finally { await pg.close(); }
});

test('legacy preview bridges atomically, retains playtest/active snapshots and ledgers, then a normal forward migration preserves progress', async () => {
  const pg = new PGlite();
  try {
    await migrateHistory(pg, true); await seed(pg, true);
    assert.deepEqual(await fingerprint(pg), contract.legacy);
    const tables = ['students', 'student_job_levels', 'combat_results', 'campaigns', 'campaign_players', 'campaign_encounters', 'live_combat_sessions'];
    const before = await Promise.all(tables.map(t => snapshot(pg, t))), oldLedger = await ledger(pg);
    // Normal Drizzle cannot safely infer divergent histories. Its transaction rolls back.
    await assert.rejects(migrate(drizzle(pg), { migrationsFolder: root }));
    assert.deepEqual(await ledger(pg), oldLedger);
    assert.equal((await pg.query(`SELECT to_regclass('public.aa_purchases') AS name`)).rows[0].name, null);
    await pg.exec(campaignPreviewBridgeSQL());
    const after = await Promise.all(tables.map(t => snapshot(pg, t)));
    for (const item of after[0] as any[]) {
      assert.equal(item.row.aa_points_spent, 0); assert.deepEqual(item.row.aa_ranks, {});
      assert.deepEqual(item.row.cross_class_abilities, ['hex_crossclass', 'mend_crossclass']);
      for (const key of ['aa_points_spent', 'aa_ranks', 'aa_revision', 'character_name', 'cross_class_abilities']) delete item.row[key];
    }
    assert.deepEqual(after, before, 'all existing state, including active resources, is preserved');
    const bridged = await ledger(pg);
    assert.deepEqual(await fingerprint(pg), contract.canonical, 'bridge and normal forward path have identical tables/routines/triggers');
    assert.deepEqual(bridged.slice(0, 22), oldLedger, 'never renumber, replace or delete preview ledger rows');
    assert.equal(bridged.length, 29, '22 old rows + AA + roster + four aliases + compatibility migration');
    // A retry after the new runtime has been used must preserve paid AA state.
    await pg.query(`SELECT purchase_aa($1,$2,'stat:str',1,2,1,60,'{"request":"post-bridge"}')`, [student().id, crypto.randomUUID()]);
    await pg.query(`UPDATE students SET cross_class_abilities='["a","b","c","d","e"]',character_name='Paid Name' WHERE id=$1`, [student().id]);
    const paidTables = [...tables, 'aa_purchases'];
    const paidState = await Promise.all(paidTables.map(t => snapshot(pg, t)));
    assert.equal((paidState.at(-1) as any[]).length, 1);
    await pg.exec(campaignPreviewBridgeSQL());
    await migrate(drizzle(pg), { migrationsFolder: root });
    const upgraded = await ledger(pg);
    assert.deepEqual(upgraded.slice(0,bridged.length),bridged,'all bridge ledger rows are retained');
    assert.equal(upgraded.length,30);
    await migrate(drizzle(pg), { migrationsFolder: root });
    assert.deepEqual(await ledger(pg),upgraded,'normal migration is idempotent');
    assert.deepEqual(await fingerprint(pg),currentContract);
    assert.deepEqual(await Promise.all(paidTables.map(t => snapshot(pg, t))), paidState, 'retry preserves AA wallet/receipt, slots, appearance and campaign progress');
  } finally { await pg.close(); }
});

test('merged roster history upgrades without changing activity samples, retry receipts or AA/player data', async () => {
  const pg = new PGlite();
  try {
    await migrateHistory(pg, false, false, true); await seed(pg, false);
    const id = student().id, pulse = crypto.randomUUID();
    await pg.query('INSERT INTO student_activity_tracking(student_id,started_at) VALUES($1,30000)', [id]);
    await pg.query('INSERT INTO student_activity_samples(student_id,bucket_start,pulse_id) VALUES($1,60000,$2)', [id, pulse]);
    await pg.query('INSERT INTO student_activity_receipts(student_id,bucket_start,pulse_id) VALUES($1,60000,$2)', [id, pulse]);
    const tables = ['students', 'aa_purchases', 'combat_results', 'student_activity_tracking', 'student_activity_samples', 'student_activity_receipts'];
    const before = await Promise.all(tables.map(t => snapshot(pg, t))), oldLedger = await ledger(pg);
    await migrate(drizzle(pg), { migrationsFolder: root });
    const after = await Promise.all(tables.map(t => snapshot(pg, t)));
    for (const item of after[0] as any[]) { assert.equal(item.row.stamina_recovery, 0); delete item.row.stamina_recovery; }
    for (const item of after[2] as any[]) { assert.equal(item.row.stamina_restored, 0); delete item.row.stamina_restored; }
    assert.deepEqual(after, before);
    assert.deepEqual((await ledger(pg)).slice(0, 20), oldLedger);
    assert.equal((await ledger(pg)).length, 26);
    assert.deepEqual(await fingerprint(pg), currentContract);
    await assert.rejects(pg.exec(campaignPreviewBridgeSQL()), /Unrecognized/);
    await pg.exec('ROLLBACK');
    assert.deepEqual(await fingerprint(pg), currentContract);
  } finally { await pg.close(); }
});

test('bridge rejects production, unknown or corrupt history and rolls back an interrupted schema upgrade', async () => {
  for (const scenario of ['production', 'roster', 'c12', 'corrupt', 'partial-ddl', 'missing-row', 'extra-row', 'wrong-time', 'duplicate-row']) {
    const pg = new PGlite();
    try {
      await migrateHistory(pg, !['production', 'roster', 'c12'].includes(scenario), scenario === 'c12', scenario === 'roster');
      if (scenario === 'corrupt') await pg.exec(`UPDATE drizzle.__drizzle_migrations SET hash='tampered' WHERE created_at=${legacyPreviewLedger.at(-1)!.created_at}`);
      if (scenario === 'partial-ddl') await pg.exec('ALTER TABLE students ADD COLUMN aa_ranks jsonb');
      if (scenario === 'missing-row') await pg.exec('DELETE FROM drizzle.__drizzle_migrations WHERE id=22');
      if (scenario === 'extra-row') await pg.exec("INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES('unknown',9999999999999)");
      if (scenario === 'wrong-time') await pg.exec('UPDATE drizzle.__drizzle_migrations SET created_at=created_at+1 WHERE id=22');
      if (scenario === 'duplicate-row') await pg.exec('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) SELECT hash,created_at FROM drizzle.__drizzle_migrations WHERE id=22');
      const before = await ledger(pg);
      const schemaBefore = await fingerprint(pg);
      await assert.rejects(pg.exec(campaignPreviewBridgeSQL()));
      await pg.exec('ROLLBACK');
      assert.deepEqual(await ledger(pg), before);
      assert.deepEqual(await fingerprint(pg), schemaBefore);
      if (!['production', 'roster'].includes(scenario)) assert.equal((await pg.query(`SELECT to_regclass('public.aa_purchases') AS name`)).rows[0].name, null);
    } finally { await pg.close(); }
  }
});

test('bridge rejects schema drift before aliasing and on completed-history retries', async () => {
  for (const [complete, damage] of [
    [false, 'ALTER TABLE campaign_players DROP COLUMN state'],
    [false, 'ALTER TABLE campaign_encounters ALTER COLUMN player_snapshot DROP NOT NULL'],
    [false, 'DROP FUNCTION settle_campaign_encounter(jsonb)'],
    [false, 'ALTER TABLE students DROP CONSTRAINT students_stamina_recovery_check'],
    [true, 'DROP FUNCTION purchase_aa(uuid,uuid,text,integer,integer,integer,integer,jsonb)'],
    [true, 'ALTER TABLE students DISABLE TRIGGER students_cross_class_sync'],
  ] as const) {
    const pg = new PGlite();
    try {
      await migrateHistory(pg, true); await seed(pg, true);
      if (complete) await pg.exec(campaignPreviewBridgeSQL());
      await pg.exec(damage);
      const before = await ledger(pg), schemaBefore = await fingerprint(pg);
      const playersBefore = await snapshot(pg, 'campaign_players');
      await assert.rejects(pg.exec(campaignPreviewBridgeSQL()), /schema differs/);
      await pg.exec('ROLLBACK');
      assert.deepEqual(await ledger(pg), before);
      assert.deepEqual(await fingerprint(pg), schemaBefore);
      assert.deepEqual(await snapshot(pg, 'campaign_players'), playersBefore);
    } finally { await pg.close(); }
  }
});

test('failure after all bridge DDL/backfills/aliases rolls back rows and routines; retry succeeds', async () => {
  const pg = new PGlite();
  try {
    await migrateHistory(pg, true); await seed(pg, true);
    const tables = ['students', 'student_job_levels', 'combat_results', 'campaigns', 'campaign_players', 'campaign_encounters', 'live_combat_sessions'];
    const before = await Promise.all(tables.map(t => snapshot(pg, t)));
    const oldLedger = await ledger(pg), schemaBefore = await fingerprint(pg);
    const interrupted = campaignPreviewBridgeSQL().replace('END $campaign_bridge$;', "RAISE EXCEPTION 'injected after final compatibility migration';\nEND $campaign_bridge$;");
    await assert.rejects(pg.exec(interrupted), /injected after final/);
    await pg.exec('ROLLBACK');
    assert.deepEqual(await ledger(pg), oldLedger);
    assert.deepEqual(await fingerprint(pg), schemaBefore);
    assert.deepEqual(await Promise.all(tables.map(t => snapshot(pg, t))), before);
    await pg.exec(campaignPreviewBridgeSQL());
    assert.equal((await ledger(pg)).length, 29);
    assert.deepEqual((await ledger(pg)).slice(0, 22), oldLedger);
    assert.deepEqual(await fingerprint(pg), contract.canonical);
  } finally { await pg.close(); }
});
