import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as s from '../../worker/db/schema';
import { mountainDay, xpMultiplier, CAMPAIGN_BOSS_STAMINA_RESTORE } from '../../shared/combat/stamina';
import { persistCombatResults } from '../../worker/db/game-repository';
import { publicResults } from '../../worker/combat/room-messages';
import { addStudent, initialCombatState } from '../../worker/combat/engine';
import { fight, student } from './fixtures';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('campaign boss stamina preserves migrated data and awards each participating winner once, including repeats', async () => {
  const pg = new PGlite(), db = drizzle(pg, { schema: s });
  try {
    const journal = JSON.parse(readFileSync(new URL('../../migrations/cloudflare/meta/_journal.json', import.meta.url), 'utf8'));
    const migration = (tag: string) => readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), 'utf8');
    for (const { tag } of journal.entries.filter((e: any) => e.idx < 22)) await pg.exec(migration(tag));
    // A populated pre-migration character retains every existing field, including today's stamina.
    await pg.query("INSERT INTO students(id,nickname,nickname_normalized,password_hash,daily_combats,stamina_day,gold,xp_remainder) VALUES($1,'existing','existing','unused',7,$2,321,0.75)", [student().id, mountainDay(Date.now())]);
    const before = (await pg.query('SELECT * FROM students')).rows[0] as any;
    for (const { tag } of journal.entries.filter((e: any) => e.idx >= 22)) await pg.exec(migration(tag));
    const { stamina_recovery, ...after } = (await pg.query('SELECT * FROM students')).rows[0] as any;
    assert.deepEqual(after, before); assert.equal(stamina_recovery, 0);
    await db.insert(s.teachers).values({ id: fight.teacherId, firstName: 'Test', lastName: 'Teacher', email: 'boss-stamina@example.invalid', emailNormalized: 'boss-stamina@example.invalid', passwordHash: 'unused', guildCode: 'BOSSTA', billingAddress: 'Test', schoolDistrict: 'Test', school: 'Test', subject: 'Math', gradeLevel: '5' });
    await db.insert(s.fights).values(fight);
    const ids = [student().id, ...Array.from({ length: 7 }, () => crypto.randomUUID())];
    for (const [i, id] of ids.entries()) {
      if (i) await db.insert(s.students).values({ ...student('warrior', id), nickname: `boss-${i}`, nicknameNormalized: `boss-${i}` });
      await db.update(s.students).set({ dailyCombats: i + 2, staminaDay: mountainDay(Date.now()) }).where(eq(s.students.id, id));
    }
    const bossFight = { ...fight, campaignContext: { campaignId: crypto.randomUUID(), studentId: ids[0], objective: true, fixedTier: 1 } };
    let sequence = 0;
    const finish = async (roster = ids, victory = true, participated = true) => {
      const sessionId = `BOSSSTA${sequence++}`;
      await db.insert(s.liveCombatSessions).values({ sessionId, fightId: fight.id, teacherId: fight.teacherId });
      let state = initialCombatState(sessionId, bossFight);
      for (const id of roster) state = addStudent(state, student('warrior', id));
      state.currentPhase = 'game_over'; state.victory = victory; state.completedRounds = 1;
      for (const p of Object.values(state.players)) {
        p.roundsParticipated = participated ? 1 : 0;
        p.totals.questionsAnswered = participated ? 1 : 0;
        p.totals.questionsCorrect = participated ? 1 : 0;
      }
      return state;
    };
    const rows = () => db.select().from(s.students).orderBy(s.students.id);
    const own = async () => (await db.select().from(s.students).where(eq(s.students.id, ids[0])))[0];
    const state = await finish();
    state.players[ids[6]].isDead = true; state.players[ids[6]].health = 0;
    state.players[ids[7]].roundsParticipated = 0; state.players[ids[7]].totals.questionsAnswered = 0; state.players[ids[7]].totals.questionsCorrect = 0;
    const [first, retry] = await Promise.all([persistCombatResults(db as any, state, bossFight), persistCombatResults(db as any, structuredClone(state), bossFight)]);
    assert.deepEqual(first, retry);
    for (const [i, id] of ids.entries()) {
      const reward = first.find(r => r.studentId === id)!;
      const actor = (await rows()).find(r => r.id === id)!;
      close(reward.xpMultiplier, xpMultiplier(i + 2));
      close(reward.staminaRestored, i === 7 ? 0 : CAMPAIGN_BOSS_STAMINA_RESTORE);
      assert.equal(actor.dailyCombats, i + 2 + (i === 7 ? 0 : 1));
      close(xpMultiplier(actor.dailyCombats, actor.staminaRecovery), i === 7 ? xpMultiplier(i + 2) : Math.min(1, xpMultiplier(i + 3) + .2));
    }
    assert.equal(publicResults({ results: first } as any)?.[0].staminaRestored, .2);
    const saved = await rows();
    await persistCombatResults(db as any, state, bossFight);
    assert.deepEqual(await rows(), saved, 'retry does not restore stamina or change XP/gold again');

    const repeated = await finish([ids[0]]);
    const old = await own();
    const [repeatResult] = await persistCombatResults(db as any, repeated, bossFight);
    close(repeatResult.staminaRestored, .2);
    close(repeatResult.xpMultiplier, xpMultiplier(old.dailyCombats, old.staminaRecovery));
    let actor = await own();
    close(xpMultiplier(actor.dailyCombats, actor.staminaRecovery), Math.min(1, xpMultiplier(old.dailyCombats + 1, old.staminaRecovery) + .2));

    // Ordinary rooms and campaign wild fights cannot restore stamina, even on victory.
    for (const normal of [fight, { ...bossFight, campaignContext: { ...bossFight.campaignContext, objective: false } }]) {
      const prior = await own();
      const [result] = await persistCombatResults(db as any, await finish([ids[0]]), normal);
      assert.equal(result.staminaRestored, 0);
      actor = await own(); assert.equal(actor.staminaRecovery, prior.staminaRecovery);
      close(result.xpMultiplier, xpMultiplier(prior.dailyCombats, prior.staminaRecovery));
    }
    for (const [victory, participated] of [[false, true], [true, false]]) {
      const prior = await own();
      const [result] = await persistCombatResults(db as any, await finish([ids[0]], victory, participated), bossFight);
      assert.equal(result.staminaRestored, 0);
      assert.equal((await own()).staminaRecovery, prior.staminaRecovery);
    }
    const ineligible = await finish([ids[0]]);
    ineligible.players[ids[0]].questGuildId = null;
    assert.equal((await persistCombatResults(db as any, ineligible, bossFight))[0].staminaRestored, 0);

    // Concurrent independent rooms share the same recovered position and actual count.
    const prior = await own();
    const simultaneous = await Promise.all([finish([ids[0]]), finish([ids[0]])]);
    const receipts = (await Promise.all(simultaneous.map(snap => persistCombatResults(db as any, snap, bossFight)))).flat().sort((a, b) => a.staminaFightNumber! - b.staminaFightNumber!);
    assert.deepEqual(receipts.map(r => r.staminaFightNumber), [prior.dailyCombats + 1, prior.dailyCombats + 2]);
    close(receipts[1].xpMultiplier, Math.min(1, xpMultiplier(prior.dailyCombats + 1, prior.staminaRecovery) + .2));

    // Midnight discards the day's recovery. Old receipts cannot alter the new date.
    await db.update(s.students).set({ staminaDay: '2000-01-01' }).where(eq(s.students.id, ids[0]));
    const expired = await own();
    await persistCombatResults(db as any, repeated, bossFight);
    assert.deepEqual(await own(), expired);
    const [fresh] = await persistCombatResults(db as any, await finish([ids[0]]), bossFight);
    assert.equal(fresh.xpMultiplier, 1); assert.equal(fresh.staminaFightNumber, 1);
    close(fresh.staminaRestored, .1); // Normal first-fight cost is 10%; the award caps at full.
    actor = await own(); assert.equal(actor.dailyCombats, 1);
    close(xpMultiplier(actor.dailyCombats, actor.staminaRecovery), 1);
    const [next] = await persistCombatResults(db as any, await finish([ids[0]]), fight);
    assert.equal(next.xpMultiplier, 1);
    actor = await own(); close(xpMultiplier(actor.dailyCombats, actor.staminaRecovery), .9);
  } finally { await pg.close(); }
});
