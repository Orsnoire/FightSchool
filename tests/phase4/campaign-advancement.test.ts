import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as s from '../../worker/db/schema';
import { ALL_CHARACTER_CLASSES, getStartingEquipment } from '../../shared/schema';
import { captureLoadout } from '../../shared/job-loadouts';
import { resolveAAEffects } from '../../shared/aa';
import { generateCampaignLayout } from '../../shared/campaign/generation';
import { fieldHeal } from '../../shared/campaign/resources';
import { abilityDamage, abilityDot, abilityHealing } from '../../shared/combat/abilityValues';
import { campaignPlayer, campaignView } from '../../worker/campaign/state';
import { applyCampaignAction } from '../../worker/campaign/actions';
import { combatProfile, persistCombatResults } from '../../worker/db/game-repository';
import { purchaseAdvancement } from '../../worker/services/advancement';
import { studentCanAccessSession } from '../../worker/services/combat-access';
import { initialCombatState, addStudent } from '../../worker/combat/engine';
import { useCombatItem } from '../../worker/combat/consumables';
import { consumeItem } from '../../shared/campaign/consumables';
import { fight, student, started } from './fixtures';

test('campaign AA cap, licensed equipment, five saved slots, resources, frozen encounters and overflow rewards agree', async () => {
  const pg = new PGlite(), db = drizzle(pg, { schema: s }) as any;
  try {
    const journal = JSON.parse(readFileSync('migrations/cloudflare/meta/_journal.json', 'utf8'));
    for (const { tag } of journal.entries) await pg.exec(readFileSync(`migrations/cloudflare/${tag}.sql`, 'utf8'));
    await db.insert(s.teachers).values({ id: fight.teacherId, firstName: 'Campaign', lastName: 'AA', email: 'campaign-aa@example.invalid', emailNormalized: 'campaign-aa@example.invalid', passwordHash: 'unused', guildCode: 'CAMPAA', billingAddress: 'Test', schoolDistrict: 'Test', school: 'Test', subject: 'Math', gradeLevel: '5' });
    await db.insert(s.fights).values({ ...fight, encounterTier: 4 });
    const [guild] = await db.insert(s.guilds).values({ teacherId: fight.teacherId, name: 'Advanced guild', code: 'CAA001', limitTier: 4 }).returning();
    const choices = ['fireball_crossclass', 'healing_potion_crossclass', 'hex_crossclass', 'mend_crossclass', 'fortify_crossclass'];
    const highGearId = crypto.randomUUID();
    await db.insert(s.equipmentItems).values({ id: highGearId, teacherId: fight.teacherId, name: 'High tier test armor', itemType: 'armor', quality: 'common', tier: 4, slot: 'armor', armorCategory: 'heavy_armor', stats: { def: 99 } });
    const saved = { ...captureLoadout(getStartingEquipment('warrior')), offhand: null, crossClassAbilities: choices,
      crossClassAbility1: choices[0], crossClassAbility2: choices[1] };
    await db.insert(s.students).values({ ...student(), ...saved, aaExperience: 12000,
      aaRanks: { 'cross-class-slots': 3, 'stat:int': 10, 'natural:wisdom': 5, health: 3, mana: 3, 'weapon:staff': 1, 'specialization:staff': 6 },
      jobLoadouts: { warrior: saved }, inventory: ['basic_staff', highGearId] });
    await db.insert(s.studentJobLevels).values(ALL_CHARACTER_CLASSES.map(jobClass => ({ studentId: student().id, jobClass, level: 15, experience: 630 })));
    await db.insert(s.guildMemberships).values({ guildId: guild.id, studentId: student().id });
    const current = async () => (await db.select().from(s.students).where(eq(s.students.id, student().id)))[0];
    const [campaign] = await db.insert(s.campaigns).values({ teacherId: fight.teacherId, guildId: guild.id, fightId: fight.id, name: 'AA expedition', dungeonName: 'Capped cave', gates: [], layout: generateCampaignLayout('aa-campaign', []), fightSnapshot: { ...fight, encounterTier: 4 } }).returning();
    const path = async () => campaignView(db, campaign, await current());
    let view = await path();
    assert.equal(view.player.advancement?.tier, 1, 'campaign cap beats guild and authored enemy tiers');
    assert.equal(view.player.advancement?.primary.int, 1);
    assert.equal(view.player.advancement?.flat.maxHp, 10);
    assert.equal(view.player.advancement?.flat.maxMp, 10);
    assert.equal(view.player.advancement?.extraSlots, 1);
    assert.ok(Object.values(view.player.jobLevels).every(n => n === 4));
    assert.ok(choices.every(id => !view.player.availableAbilities.includes(id)), 'tier-1 effective levels cannot unlock borrowed abilities');
    assert.ok(view.equipment.items.some(i => i.id === 'basic_staff'), 'AA proficiency exposes licensed gear');
    assert.ok(!view.equipment.items.some(i => i.id === highGearId), 'license cannot bypass effective level');

    const action = async (action: any, record?: s.StudentRecord) => {
      record ||= await current();
      const result = await applyCampaignAction(db, campaign, record, { action, revision: view.progressRevision, commandId: crypto.randomUUID() });
      view = result; return result;
    };
    // Persist wounded resources; neither equipment, AA purchases nor class changes refill them.
    await db.update(s.campaignPlayers).set({ state: { ...view.progress, health: 2, mp: 1, consumables: { potion: 2 } } });
    view = await path();
    await action({ type: 'equip', slot: 'weapon', itemId: 'basic_staff' });
    assert.equal(view.player.advancement?.flat.mat, 1, 'specialization uses projected weapon and capped rank');
    assert.equal(view.progress.health, 2); assert.equal(view.progress.mp, 1);
    let actor = await current();
    assert.deepEqual(actor.crossClassAbilities, choices);
    assert.deepEqual(actor.jobLoadouts.warrior.crossClassAbilities, choices, 'equipment does not save suppressed choices');
    const stale = actor;
    await purchaseAdvancement(db, actor.id, { upgradeId: 'stat:vit', rank: 1, requestId: crypto.randomUUID(), catalogVersion: 1 });
    await assert.rejects(action({ type: 'move', dx: 1, dy: 0 }, stale), /Adventure changed/, 'AA revision guards stale resource projections');
    view = await path(); assert.equal(view.progress.health, 2); assert.equal(view.progress.mp, 1);

    const warlock = (await campaignPlayer(db, campaign, await current(), 'warlock')).player;
    assert.equal(abilityDamage(warlock, 'hex'), warlock.stats.mat + warlock.stats.int);
    assert.equal(abilityDot(warlock, 'hex')!.damage, warlock.stats.mat + warlock.stats.int - 1);
    assert.equal(abilityDot(warlock, 'hex')!.rounds, 3, 'tier-capped multiclass levels govern Hex duration');

    const priest = (await campaignPlayer(db, campaign, await current(), 'priest')).player;
    assert.equal(priest.advancement?.flat.healing, 1);
    const injured = { ...view.progress, job: 'priest' as const, health: 1, maxHealth: priest.maxHealth, mp: priest.maxMp, maxMp: priest.maxMp };
    const healed = fieldHeal(injured, priest, 'mend');
    assert.equal(healed.health, Math.min(priest.maxHealth, 1 + abilityHealing(priest, 'mend')!));
    assert.equal(healed.mp, injured.mp - 1);
    assert.throws(() => fieldHeal(view.progress, view.player, choices[3]), /not available/, 'suppressed borrowed healing cannot be invoked from the field');

    // Real campaign admission persists the capped profile before room construction.
    await db.update(s.campaignPlayers).set({ state: { ...view.progress, zone: 'dungeon', position: campaign.layout.objective } });
    view = await path(); await action({ type: 'encounter' });
    const sessionId = view.progress.activeSessionId!;
    const [encounter] = await db.select().from(s.campaignEncounters).where(eq(s.campaignEncounters.sessionId, sessionId));
    assert.equal(encounter.playerSnapshot.advancement.tier, 1);
    assert.equal(encounter.playerSnapshot.health, 2);
    assert.equal(encounter.fightSnapshot.campaignContext.fixedTier, 1);
    await purchaseAdvancement(db, student().id, { upgradeId: 'stat:str', rank: 1, requestId: crypto.randomUUID(), catalogVersion: 1 });
    const frozen = await combatProfile(db, await current(), sessionId);
    assert.deepEqual(frozen.campaignPlayer, encounter.playerSnapshot);
    assert.deepEqual((await path()).player.advancement, encounter.playerSnapshot.advancement, 'active adventure view keeps frozen power');
    await assert.rejects(combatProfile(db, { ...await current(), id: crypto.randomUUID() }, sessionId));
    const [live] = await db.select().from(s.liveCombatSessions).where(eq(s.liveCombatSessions.sessionId, sessionId));
    const accessRepo: any = { isActiveGuildMember: async () => true, findCombatFight: async () => encounter.fightSnapshot };
    assert.equal(await studentCanAccessSession(accessRepo, live, student().id), true);
    assert.equal(await studentCanAccessSession(accessRepo, live, crypto.randomUUID()), false, 'guild joining does not make pilot multiplayer');

    let state = addStudent(initialCombatState(sessionId, encounter.fightSnapshot, 0), await current(), frozen);
    const p = state.players[student().id];
    state.currentPhase = 'game_over'; state.victory = true; state.completedRounds = 1;
    p.roundsParticipated = 1; p.totals.questionsAnswered = 1; p.totals.questionsCorrect = 1;
    p.totals.damageDealt = 7; p.totals.bonusDamage = 3; p.totals.damageBlocked = 2; p.totals.healingDone = 4;
    const before = await current();
    const results = await persistCombatResults(db, state, encounter.fightSnapshot);
    assert.equal(results[0].baseXp, 24, 'shared EXP: base 10 + correct 1 + total damage 7 + block 2 + healing 4');
    assert.ok(results[0].staminaRestored > 0 && results[0].staminaRestored <= .2);
    actor = await current();
    assert.equal(actor.aaExperience, before.aaExperience + results[0].xpEarned, 'capped job overflows through the existing AA bank');
    assert.equal(actor.aaPointsSpent, before.aaPointsSpent);
    await persistCombatResults(db, JSON.parse(JSON.stringify(state)), encounter.fightSnapshot);
    assert.deepEqual(await current(), actor, 'result retry cannot duplicate AA, gold or stamina recovery');
    view = await path(); assert.equal(view.progress.health, 2); assert.deepEqual(view.progress.consumables, { potion: 2 });
    assert.equal(view.progress.cleared, true);
  } finally { await pg.close(); }
});

test('AA potion retention draws once for successful combat potions; field/cures/invalid uses keep their costs', () => {
  for (const [seed, retained] of [[1972, true], [1, false]] as const) {
    const state = started(), id = student().id, p = state.players[id];
    state.seed = seed; p.health = 1; p.consumables = { potion: 1, antivenom: 1 };
    p.advancement = resolveAAEffects({ 'potion-preservation': 3, 'natural:wisdom': 5 }, 1);
    const used = useCombatItem(state, id, 'potion');
    assert.equal(used.players[id].health, 7, 'base 5 plus one active wisdom rank');
    assert.equal(used.players[id].consumables?.potion || 0, retained ? 1 : 0);
    assert.equal(used.seed, (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    assert.deepEqual(useCombatItem(JSON.parse(JSON.stringify(state)), id, 'potion'), used, 'JSON restoration preserves roll');
    assert.throws(() => useCombatItem(used, id, 'potion'), /One item/);
    assert.equal(used.players[id].totals.healingDone, 0, 'bag potions do not create academic contribution credit');
    consumeItem(p, 'potion'); assert.equal(p.consumables?.potion, undefined, 'field potions always spend the bag charge');
    assert.throws(() => useCombatItem(state, id, 'potion'), /None/);
    p.statuses = [{ type: 'poison', sourceId: 'enemy', appliedRound: 0 }];
    assert.equal(useCombatItem(state, id, 'antivenom').seed, seed, 'cures do not draw a preservation roll');
  }
});
