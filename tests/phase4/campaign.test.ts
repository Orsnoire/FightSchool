import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq, sql } from 'drizzle-orm';
import * as s from '../../worker/db/schema';
import { generateCampaignLayout, validateCampaignLayout } from '../../shared/campaign/generation';
import { fieldHeal, normalizeResources } from '../../shared/campaign/resources';
import { campaignPath } from '../../shared/campaign/movement';
import type { CampaignProgress } from '../../shared/campaign/model';
import { addStudent } from '../../worker/combat/participants';
import { initialCombatState, scaleEncounter } from '../../worker/combat/encounter-setup';
import { combatProfile, persistCombatResults } from '../../worker/db/game-repository';
import { handleGame } from '../../worker/routes/game';
import { issueSession } from '../../worker/auth/session';
import { CombatSessionObject } from '../../worker/combat/session-object';
import { removeStudent } from '../../worker/combat/participants';
import { startQuestion } from '../../worker/combat/engine';
import { fight, student, fightSummary } from './fixtures';

test('campaign generation is repeatable, connected, and creates one keeper per unlock', () => {
  const gates = ['Cave Key', 'Science Seal', 'Library Key'].map(name => ({ id: name, name, open: false }));
  for (let seed = 0; seed < 100; seed++) {
    const map = generateCampaignLayout(String(seed), gates);
    validateCampaignLayout(map);
    assert.deepEqual(map, generateCampaignLayout(String(seed), gates));
    assert.equal(map.npcs.filter(n => n.service === 'quest').length, gates.length);
  }
  assert.notDeepEqual(generateCampaignLayout('one', gates), generateCampaignLayout('two', gates));
});

test('field healing spends saved resources; job normalization cannot grant HP or MP', () => {
  const p = addStudent(initialCombatState('test', fight), student('priest')).players[student().id];
  const progress = { health: 1, maxHealth: p.maxHealth, mp: 3, maxMp: p.maxMp, healingPotions: 2, shieldPotions: 0 } as CampaignProgress;
  const healed = fieldHeal(progress, p, 'mend');
  assert.ok(healed.health > 1); assert.equal(healed.mp, 2);
  assert.throws(() => fieldHeal({ ...progress, mp: 0 }, p, 'mend'), /Not enough/);
  assert.throws(() => fieldHeal(progress, p, 'inner_peace'), /not available/);
  assert.throws(() => fieldHeal({ ...progress, health: 0 }, p, 'first_aid'), /inn/);
  const larger = normalizeResources(progress, { ...p, maxHealth: 999, maxMp: 999 });
  assert.equal(larger.health, 1); assert.equal(larger.mp, 3);
  const herbalist = addStudent(initialCombatState('test', fight), student('herbalist')).players[student().id];
  assert.equal(fieldHeal(progress, herbalist, 'healing_potion').healingPotions, 1);
  assert.throws(() => fieldHeal({ ...progress, healingPotions: 0 }, herbalist, 'healing_potion'), /Not enough/);
});

test('campaign HTTP, atomic shops, gates, frozen combat handoff and retry-safe settlement', async () => {
  const pg = new PGlite(), db = drizzle(pg, { schema: s });
  try {
    const journal = JSON.parse(readFileSync(new URL('../../migrations/cloudflare/meta/_journal.json', import.meta.url), 'utf8'));
    for (const { tag } of journal.entries) await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), 'utf8'));
    const outsider = crypto.randomUUID();
    for (const [i, id] of [fight.teacherId, outsider].entries()) await db.insert(s.teachers).values({ id, firstName: 'Campaign', lastName: 'Test', email: `campaign${i}@example.invalid`, emailNormalized: `campaign${i}@example.invalid`, passwordHash: 'unused', guildCode: `CAMP0${i}`, billingAddress: 'Test', schoolDistrict: 'Test', school: 'Test', subject: 'Math', gradeLevel: '5' });
    await db.insert(s.fights).values(fight);
    const [guild] = await db.insert(s.guilds).values({ teacherId: fight.teacherId, name: 'Adventurers', code: 'CAMP01', unlockedTier: 1 }).returning();
    await db.insert(s.students).values({ ...student(), gold: 1000 });
    await db.insert(s.studentJobLevels).values({ studentId: student().id, jobClass: 'warrior', level: 4 });
    await db.insert(s.studentJobLevels).values({ studentId: student().id, jobClass: 'herbalist', level: 2 });
    await db.insert(s.guildMemberships).values({ guildId: guild.id, studentId: student().id });
    const sessions = new Map();
    const repository: any = { createSession: async (r: any) => sessions.set(r.tokenHash, r), findActiveSession: async (key: string) => sessions.get(key) || null,
      findFightById: async (id: string) => (await db.select().from(s.fights).where(eq(s.fights.id, id)))[0], listTeacherFightSummaries: async () => [fightSummary()] };
    const config = { cookieName: 'test_session', secret: 'test-only-secret-not-deployed-1234567890', ttlSeconds: 300 };
    const teacherCookie = (await issueSession(repository, config, 'teacher', fight.teacherId)).split(';')[0];
    const studentCookie = (await issueSession(repository, config, 'student', student().id)).split(';')[0];
    const otherCookie = (await issueSession(repository, config, 'teacher', outsider)).split(';')[0];
    const call = async (path: string, method = 'GET', body?: unknown, cookie = studentCookie) => {
      const url = new URL('https://qa.example' + path);
      const response = await handleGame(new Request(url, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), url, repository, config, db as any);
      assert.ok(response); return { status: response.status, body: await response.json() as any };
    };
    const create = { name: 'Test expedition', guildId: guild.id, fightId: fight.id, dungeonName: 'Echo Cave', gates: [{ name: 'Cave Key', open: false }] };
    assert.equal((await call('/api/campaigns', 'POST', create)).status, 403);
    assert.equal((await call('/api/campaigns', 'POST', create, otherCookie)).status, 403);
    const created = await call('/api/campaigns', 'POST', create, teacherCookie);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const path = `/api/campaigns/${created.body.id}`;
    let view = (await call(path)).body;
    const initialLayout = view.layout;
    assert.equal(view.eligibleQuestionCount, 0);
    assert.equal(JSON.stringify(view).includes('correctAnswer'), false);
    assert.equal(JSON.stringify((await call('/api/campaigns')).body).includes('correctAnswer'), false);
    assert.equal((await call(path, 'GET', undefined, otherCookie)).status, 403);
    const action = async (action: any, revision = view.progressRevision, commandId = crypto.randomUUID()) => {
      const r = await call(`${path}/actions`, 'POST', { action, revision, commandId });
      if (r.status === 200) view = r.body;
      return r;
    };
    const move = async (dx: number, dy: number) => { const r = await action({ type: 'move', dx, dy }); assert.equal(r.status, 200, JSON.stringify(r.body)); };
    assert.equal((await action({ type: 'move', dx: 1, dy: 1 })).status, 400);
    const start = view.progress.position, startSteps = view.progress.steps;
    const pathCommand = crypto.randomUUID(), pathRevision = view.progressRevision;
    const pathAction = { type: 'move_path', steps: [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }] };
    assert.equal((await action(pathAction, pathRevision, pathCommand)).status, 200);
    assert.deepEqual(view.progress.position, start); assert.equal(view.progress.steps, startSteps + 2);
    assert.equal((await action(pathAction, pathRevision, pathCommand)).status, 200);
    assert.equal(view.progress.steps, startSteps + 2, 'retry cannot duplicate a path');
    assert.equal((await action({ type: 'move_path', steps: Array(9).fill({ dx: 1, dy: 0 }) })).status, 400);
    const beforeBlocked = view.progressRevision;
    assert.equal((await action({ type: 'move_path', steps: Array(8).fill({ dx: 0, dy: -1 }) })).status, 400);
    assert.equal((await call(path)).body.progressRevision, beforeBlocked, 'a blocked path is not partially committed');
    assert.equal(view.equipment.items.some((i: any) => i.id === 't1_fighter_armor'), false, 'unowned equipment hidden');
    assert.equal(view.equipment.items.some((i: any) => i.id === 'basic_staff'), false, 'wrong-job weapons hidden');
    assert.equal((await action({ type: 'equip', slot: 'weapon', itemId: 'basic_staff' })).status, 400);
    assert.equal((await action({ type: 'equip', slot: 'armor', itemId: 't1_fighter_armor' })).status, 400);

    assert.equal((await action({ type: 'job', job: 'priest' })).status, 400, 'remote inn rejected');
    assert.equal((await action({ type: 'rest', health: 999 })).status, 400, 'browser health rejected');
    // Reach a keeper while the teacher gate is closed.
    await move(0, 1); await move(-1, 0);
    const gateId = view.gates[0].id;
    assert.equal((await action({ type: 'quest', gateId })).status, 400);
    const gateInput = { revision: 0, gates: [{ id: gateId, open: true }] };
    assert.equal((await call(`${path}/gates`, 'PUT', gateInput)).status, 403);
    assert.equal((await call(`${path}/gates`, 'PUT', gateInput, teacherCookie)).status, 200);
    assert.equal((await call(`${path}/gates`, 'PUT', gateInput, teacherCookie)).status, 409);
    assert.equal((await action({ type: 'quest', gateId })).status, 200);
    assert.equal(view.eligibleQuestionCount, 1, 'uncleared unlocked dungeon contributes questions');
    assert.equal(view.progress.cleared, false);
    // Navigate to armor shop. Duplicate command and competing purchases charge once.
    await move(1, 0); await move(1, 0); await move(0, 1);
    const stock = (await call(`${path}/shop`)).body;
    const item = stock.find((i: any) => i.id === 't1_fighter_armor'); assert.ok(item);
    const revision = view.progressRevision, commandId = crypto.randomUUID();
    const buy = () => call(`${path}/actions`, 'POST', { revision, commandId, action: { type: 'buy', shop: 'armor', itemId: item.id } });
    const purchases = await Promise.all([buy(), buy()]);
    assert.ok(purchases.every(r => r.status === 200));
    view = (await call(path)).body;
    assert.equal(view.gold, 1000 - item.price); assert.equal(view.inventory.filter((id: string) => id === item.id).length, 1);
    assert.equal((await action({ type: 'buy', shop: 'weapons', itemId: item.id })).status, 400);
    assert.equal((await action({ type: 'buy', shop: 'armor', itemId: item.id })).status, 409);
    const stale = await action({ type: 'move', dx: 0, dy: -1 }, revision); assert.equal(stale.status, 409);
    assert.ok(view.equipment.items.some((i: any) => i.id === item.id));
    const hpBeforeEquip = view.progress.health;
    assert.equal((await action({ type: 'equip', slot: 'armor', itemId: item.id })).status, 200);
    assert.equal(view.equipment.loadout.armor, item.id); assert.equal(view.player.equipmentLoadout.armor, item.id);
    assert.ok(view.progress.health <= hpBeforeEquip, 'equipping cannot heal');
    assert.equal((await call(path)).body.equipment.loadout.armor, item.id, 'gear persists across reload');
    const [equippedStudent] = await db.select().from(s.students).where(eq(s.students.id, student().id));
    assert.equal(equippedStudent.armor, item.id); assert.equal(equippedStudent.jobLoadouts.warrior?.armor, item.id);
    // Level caps and current hand pair filter otherwise-owned gear as well.
    await db.update(s.students).set({ inventory: [...equippedStudent.inventory, 't1_healer_herbs', 't1_fighter_claymore', 't1_healer_armor'] }).where(eq(s.students.id, student().id));
    view = (await call(path)).body;
    assert.equal(view.equipment.items.some((i: any) => i.id === 't1_fighter_claymore'), false, 'shield blocks two-handed weapon');
    assert.equal((await action({ type: 'equip', slot: 'weapon', itemId: 't1_fighter_claymore' })).status, 400);
    assert.equal((await action({ type: 'equip', slot: 'offhand', itemId: null })).status, 200);
    assert.equal(view.equipment.items.some((i: any) => i.id === 't1_fighter_claymore'), false, 'warrior cannot use two-handed swords');
    assert.equal((await action({ type: 'equip', slot: 'weapon', itemId: null })).status, 200);
    assert.equal((await action({ type: 'equip', slot: 'offhand', itemId: 'basic_shield' })).status, 400);
    assert.equal((await action({ type: 'equip', slot: 'weapon', itemId: 'basic_sword' })).status, 200);

    // Seed injury as a server-side prior result; changing jobs at the inn does not heal.
    await db.update(s.campaignPlayers).set({ state: { ...view.progress, position: { x: 2, y: 5 }, health: 2, mp: 1 } }).where(eq(s.campaignPlayers.campaignId, created.body.id));
    view = (await call(path)).body;
    assert.equal((await action({ type: 'job', job: 'priest' })).status, 200);
    assert.equal(view.equipment.items.some((i: any) => i.id === item.id), false, 'heavy armor hidden for priest');
    assert.equal(view.equipment.items.some((i: any) => i.id === 't1_healer_armor'), false, 'level-one priest cannot equip owned tier-one gear');
    assert.equal((await action({ type: 'equip', slot: 'armor', itemId: 't1_healer_armor' })).status, 400);
    assert.equal((await action({ type: 'equip', slot: 'armor', itemId: item.id })).status, 400);
    assert.equal((await action({ type: 'equip', slot: 'headgear', itemId: 'basic_wizard_cap' })).status, 200);
    const [separateJob] = await db.select().from(s.students).where(eq(s.students.id, student().id));
    assert.equal(separateJob.characterClass, 'warrior'); assert.equal(separateJob.headgear, equippedStudent.headgear);
    assert.equal(separateJob.jobLoadouts.priest?.headgear, 'basic_wizard_cap', 'campaign job loadout saved without changing classroom job');

    assert.equal(view.progress.health, 2); assert.equal(view.progress.mp, 0, 'MP cannot grow when changing from a job with no MP');
    assert.equal((await action({ type: 'job', job: 'paladin' })).status, 400, 'locked job');
    await db.update(s.campaignPlayers).set({ state: { ...view.progress, mp: 1 } }).where(eq(s.campaignPlayers.campaignId, created.body.id));
    view = (await call(path)).body;
    assert.equal((await action({ type: 'heal', ability: 'mend' })).status, 200);
    assert.equal(view.progress.mp, 0); assert.ok(view.progress.health > 2);
    assert.equal((await action({ type: 'rest' })).status, 200);
    assert.equal(view.progress.health, view.progress.maxHealth);
    // Shop quantities are real inventory, purchased atomically; failed/duplicate writes cannot charge twice.
    assert.equal((await action({ type: 'buy_item', itemId: 'potion' })).status, 400, 'remote item shop rejected');
    await db.update(s.campaignPlayers).set({ state: { ...view.progress, position: { x: 6, y: 6 }, health: 1 } }).where(eq(s.campaignPlayers.campaignId, created.body.id));
    view = (await call(path)).body;
    const itemGold = view.gold, itemRevision = view.progressRevision, itemCommand = crypto.randomUUID();
    const buyItems = () => call(`${path}/actions`, 'POST', { revision: itemRevision, commandId: itemCommand, action: { type: 'buy_item', itemId: 'potion', quantity: 2 } });
    const itemBuys = await Promise.all([buyItems(), buyItems()]); assert.ok(itemBuys.every(r => r.status === 200));
    view = (await call(path)).body;
    assert.equal(view.gold, itemGold - 20); assert.equal(view.progress.consumables.potion, 2);
    assert.equal(view.inventory.includes('potion'), false, 'consumables are separate from permanent equipment');
    assert.equal((await action({ type: 'buy_item', itemId: 'potion', quantity: 0 })).status, 400);
    assert.equal((await action({ type: 'buy_item', itemId: 'forged', quantity: 1 })).status, 400);
    assert.equal((await action({ type: 'use_item', itemId: 'potion' })).status, 200);
    assert.equal(view.progress.health, 6); assert.equal(view.progress.consumables.potion, 1);
    assert.equal((await action({ type: 'buy_item', itemId: 'sticky_shoes', quantity: 1 })).status, 200);
    assert.equal((await action({ type: 'use_item', itemId: 'sticky_shoes' })).status, 200);
    assert.equal(view.progress.itemProtections.trip, 5);
    assert.equal((await action({ type: 'use_item', itemId: 'antivenom' })).status, 400);
    const savedGold = view.gold;
    await db.update(s.students).set({ gold: 0 }).where(eq(s.students.id, student().id));
    assert.equal((await action({ type: 'buy_item', itemId: 'potion' })).status, 409);
    assert.equal((await call(path)).body.progress.consumables.potion, 1);
    await db.update(s.students).set({ gold: savedGold }).where(eq(s.students.id, student().id));
    // Start a guardian from server-prepared reachable progress; client cannot supply HP.
    const injured = { ...view.progress, zone: 'dungeon' as const, position: view.layout.objective, health: 3, mp: 1, healingPotions: 2 };
    await db.update(s.campaignPlayers).set({ state: injured }).where(eq(s.campaignPlayers.campaignId, created.body.id));
    view = (await call(path)).body;
    assert.equal((await action({ type: 'encounter' })).status, 200);
    const sessionId = view.progress.activeSessionId; assert.ok(sessionId);
    assert.equal((await action({ type: 'return_to_town' })).status, 409);
    assert.equal((await action({ type: 'rest' })).status, 409);
    assert.equal((await action({ type: 'equip', slot: 'armor', itemId: null })).status, 409, 'equipment frozen during encounter');
    const [encounter] = await db.select().from(s.campaignEncounters).where(eq(s.campaignEncounters.sessionId, sessionId));
    const [actor] = await db.select().from(s.students).where(eq(s.students.id, student().id));
    const profile = await combatProfile(db as any, actor, sessionId);
    let state = addStudent(initialCombatState(sessionId, encounter.fightSnapshot), actor, profile);
    assert.equal(state.players[actor.id].health, 3); assert.equal(state.players[actor.id].mp, 1);
    assert.equal(state.players[actor.id].characterClass, 'priest'); assert.equal(state.players[actor.id].healingPotions, 2);
    state = scaleEncounter(state, encounter.fightSnapshot, true);
    assert.equal(state.encounterTier, 1); assert.equal(state.players[actor.id].health, 3);
    // Classroom entry retains its ordinary full starting resources.
    const classroom = addStudent(initialCombatState('CLASS', fight), actor);
    assert.equal(classroom.players[actor.id].health, classroom.players[actor.id].maxHealth);
    await db.update(s.fights).set({ questions: [] }).where(eq(s.fights.id, fight.id));
    assert.equal(encounter.fightSnapshot.questions.length, 1, 'authored edits cannot mutate active pool');
    // Exercise the actual result pipeline, twice. Settlement preserves reduced resources.
    state.currentPhase = 'game_over'; state.victory = true; state.completedRounds = 1;
    assert.equal(state.players[actor.id].consumables?.potion, 1);
    assert.equal(state.players[actor.id].itemProtections?.trip, 5);
    state.players[actor.id].consumables = {}; state.players[actor.id].itemProtections = { trip: 3 };
    state.players[actor.id].health = 1; state.players[actor.id].mp = 0; state.players[actor.id].healingPotions = 1;
    state.players[actor.id].totals.questionsAnswered = 1; state.players[actor.id].totals.questionsCorrect = 1;
    state.players[actor.id].roundsParticipated = 1;
    await persistCombatResults(db as any, state, encounter.fightSnapshot);
    const settled = (await call(path)).body;
    assert.deepEqual(settled.progress.consumables, {}); assert.equal(settled.progress.itemProtections.trip, 3);
    assert.equal(settled.progress.health, 1); assert.equal(settled.progress.healingPotions, 1);
    assert.equal(settled.progress.activeSessionId, null); assert.equal(settled.progress.cleared, true);
    await persistCombatResults(db as any, state, encounter.fightSnapshot);
    view = (await call(path)).body;
    assert.equal(view.gold, settled.gold); assert.equal(view.progressRevision, settled.progressRevision);
    assert.deepEqual(view.layout, initialLayout);
    // A subsequent failed/abandoned run returns at zero HP. Departed solo players
    // still settle resources, although they receive no victory reward.
    await db.update(s.campaignPlayers).set({ state: { ...view.progress, cleared: false } }).where(eq(s.campaignPlayers.campaignId, created.body.id));
    view = (await call(path)).body;
    assert.equal((await action({ type: 'encounter' })).status, 200);
    const [failedEncounter] = await db.select().from(s.campaignEncounters).where(eq(s.campaignEncounters.sessionId, view.progress.activeSessionId));
    let failed = startQuestion(addStudent(initialCombatState(failedEncounter.sessionId, failedEncounter.fightSnapshot), actor, { levels: {}, campaignPlayer: failedEncounter.playerSnapshot }), Date.now(), 30);
    failed.players[actor.id].health = 0; failed.players[actor.id].isDead = true;
    failed = removeStudent(failed, actor.id);
    await persistCombatResults(db as any, failed, failedEncounter.fightSnapshot);
    view = (await call(path)).body;
    assert.equal(view.progress.health, 0); assert.equal(view.progress.zone, 'overworld');
    assert.deepEqual(view.progress.position, view.layout.overworld.spawn);
    assert.equal((await action({ type: 'heal', ability: 'first_aid' })).status, 400);
    await move(-1, 0); await move(0, -1);
    assert.equal((await action({ type: 'rest' })).status, 200);
    assert.equal(view.progress.health, view.progress.maxHealth);
    assert.deepEqual(view.progress.consumables, {}, 'inn cannot refill bought items');
    // Re-closing a gate removes its questions immediately, including after completion.
    assert.equal((await call(`${path}/gates`, 'PUT', { revision: 1, gates: [{ id: gateId, open: false }] }, teacherCookie)).status, 200);
    assert.equal((await call(path)).body.eligibleQuestionCount, 0);
    // Existing saved maps gain only a shop; progress and all tiles survive migration.
    const beforeUpgrade = (await call(path)).body;
    const oldLayout = { ...beforeUpgrade.layout, npcs: beforeUpgrade.layout.npcs.filter((n: any) => n.service !== 'items') };
    await db.update(s.campaigns).set({ layout: oldLayout }).where(eq(s.campaigns.id, created.body.id));
    const upgrade = readFileSync(new URL('../../migrations/cloudflare/0020_campaign_consumables.sql', import.meta.url), 'utf8');
    await pg.exec(upgrade);
    const upgraded = (await call(path)).body;
    assert.deepEqual(upgraded.progress, beforeUpgrade.progress);
    assert.deepEqual(upgraded.layout.overworld, oldLayout.overworld);
    assert.deepEqual(upgraded.layout.dungeon, oldLayout.dungeon);
    assert.equal(upgraded.layout.npcs.filter((n: any) => n.service === 'items').length, 1);
    await pg.exec(upgrade);
    assert.equal((await call(path)).body.revision, upgraded.revision, 'upgrade is idempotent');
    await db.update(s.guilds).set({ isArchived: true }).where(eq(s.guilds.id, guild.id));
    assert.equal((await call(path)).status, 404);
  } finally { await pg.close(); }
});

test('campaign room joins use frozen resources; eviction and reconnect do not refill them', async () => {
  const actor = student(), sessionId = 'CPTESTROOM';
  const campaignFight = { ...fight, campaignContext: { campaignId: crypto.randomUUID(), studentId: actor.id, objective: false, fixedTier: 1 } };
  const player = addStudent(initialCombatState(sessionId, campaignFight), actor).players[actor.id];
  player.health = 2; player.healingPotions = 1;
  const data = new Map<string, any>(), messages: any[] = [], persisted: any[] = [];
  let profileReads = 0;
  const socket = { send: (value: string) => messages.push(JSON.parse(value)), close() {}, serializeAttachment() {},
    deserializeAttachment: () => ({ actorId: actor.id, role: 'student', sessionId, tokenHash: 'campaign-test' }) };
  const durable = { storage: { get: async (key: string) => structuredClone(data.get(key)), put: async (key: string, value: any) => { data.set(key, structuredClone(value)); }, setAlarm: async () => {}, deleteAlarm: async () => {} }, getWebSockets: () => [socket] };
  const restore = () => {
    const room = new CombatSessionObject(durable as any, { DATABASE_URL: 'unused' });
    room.setRepository({ findActiveSession: async () => ({ actorId: actor.id, actorType: 'student' }), findStudentById: async () => actor,
      findLiveCombatSession: async () => ({ sessionId, fightId: fight.id, soloStudentId: actor.id, teacherId: fight.teacherId, status: 'active' }),
      findFightById: async () => { throw new Error('Must use campaign snapshot'); }, findCombatFight: async () => structuredClone(campaignFight),
      getCombatProfile: async () => { profileReads++; return { levels: {}, campaignPlayer: player }; }, updateLiveCombatSessionStatus: async () => {},
      persistResults: async (state: any) => { persisted.push(structuredClone(state)); return []; } } as any);
    return room;
  };
  await restore().webSocketMessage(socket as any, JSON.stringify({ type: 'join', commandId: 'campaign-join-1' }));
  assert.equal(messages.some(m => m.type === 'protocol_error'), false, JSON.stringify(messages));
  assert.equal(data.get('room').snapshot.players[actor.id].health, 2);
  assert.equal(data.get('room').snapshot.players[actor.id].healingPotions, 1);
  assert.equal(data.get('room').fight.lootTable.length, 0, 'no fallback classroom loot injected');
  data.get('room').snapshot.players[actor.id].health = 1;
  await restore().webSocketMessage(socket as any, JSON.stringify({ type: 'join', commandId: 'campaign-rejoin-2' }));
  assert.equal(data.get('room').snapshot.players[actor.id].health, 1); assert.equal(profileReads, 1);
  await restore().webSocketMessage(socket as any, JSON.stringify({ type: 'leave_fight', commandId: 'campaign-leave-3' }));
  assert.equal(persisted.length, 1); assert.equal(persisted[0].departedPlayers[actor.id].health, 1);
});
