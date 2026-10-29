import assert from 'node:assert/strict';
import { test } from 'node:test';
import { and, eq } from 'drizzle-orm';
import { dataCostFixture } from '../support/data-costs';
import * as s from '../../worker/db/schema';
import { createIdentityRepository } from '../../worker/db/repository';
import { studentCanAccessSession } from '../../worker/services/combat-access';
import { newCampaignSessionId } from '../../worker/combat/session-kind';
import { generateCampaignLayout } from '../../shared/campaign/generation';
import { addStudent, initialCombatState } from '../../worker/combat/engine';

test('student join reads only its encounter context and preserves admission, caps and frozen resources', async t => {
  const f = await dataCostFixture(2, 0);
  const { db, pg, calls } = f;
  const repository = createIdentityRepository('unused-in-isolated-test', db);
  try {
    const [actor, peer] = await db.select().from(s.students).orderBy(s.students.id);
    await db.update(s.studentJobLevels).set({ level: 15 }).where(eq(s.studentJobLevels.studentId, actor.id));
    await db.update(s.guilds).set({ limitTier: 4 }).where(eq(s.guilds.id, f.guildId));
    const [classroom] = await db.insert(s.liveCombatSessions).values({ sessionId: 'CPAB23', fightId: f.bank.id,
      teacherId: f.bank.teacherId, guildId: f.guildId, guildLimitTier: 2 }).returning();

    await t.test('ordinary hosted fight ignores campaign storage and reuses the loaded session', async () => {
      // Make any accidental campaign lookup fail, including a six-character CP code.
      await pg.exec('ALTER TABLE campaign_encounters RENAME TO unavailable_campaign_encounters');
      try {
        calls.length = 0;
        assert.equal((await repository.findCombatFight!(classroom.sessionId, f.bank.id))!.id, f.bank.id);
        const profile = await repository.getCombatProfile!(actor, classroom);
        assert.equal(profile.levels.warrior, 8, 'frozen tier 2 overrides current guild tier 4');
        assert.equal(profile.limitTier, 2);
        assert.equal(profile.advancement!.tier, 2);
        assert.equal(profile.questGuildId, f.guildId, 'reward/quest attribution retains the hosting guild');
        assert.ok(!calls.some(c => /campaign|live_combat_sessions/.test(c.sql)));
        assert.equal(calls.filter(c => /guild_memberships/.test(c.sql)).length, 1);
        const byId = await repository.getCombatProfile!(actor, classroom.sessionId);
        assert.deepEqual(byId, profile, 'recovery by ID retains the same power context');
      } finally { await pg.exec('ALTER TABLE unavailable_campaign_encounters RENAME TO campaign_encounters'); }
    });

    await t.test('unassigned fights never load guild or campaign context', async () => {
      const [room] = await db.insert(s.liveCombatSessions).values({ sessionId: 'ABC234', fightId: f.bank.id, teacherId: f.bank.teacherId }).returning();
      calls.length = 0;
      const profile = await repository.getCombatProfile!(actor, room);
      assert.equal(profile.levels.warrior, 4);
      assert.equal(profile.questGuildId, null);
      assert.ok(!calls.some(c => /guilds|guild_memberships|campaign|live_combat_sessions/.test(c.sql)));
    });

    await t.test('student-created guild fights check membership without loading a fight or campaign', async () => {
      calls.length = 0;
      assert.equal(await studentCanAccessSession(repository, { ...classroom, soloStudentId: actor.id }, peer.id), true);
      assert.ok(!calls.some(c => /campaign|"fights"/.test(c.sql)));
    });

    const [campaign] = await db.insert(s.campaigns).values({ teacherId: f.bank.teacherId, guildId: f.guildId,
      fightId: f.bank.id, name: 'Context test', dungeonName: 'Cave', gates: [],
      layout: generateCampaignLayout('context', []), fightSnapshot: f.bank }).returning();
    const sessionId = newCampaignSessionId();
    const [campaignRoom] = await db.insert(s.liveCombatSessions).values({ sessionId, fightId: f.bank.id,
      teacherId: f.bank.teacherId, guildId: f.guildId, guildLimitTier: 1, soloStudentId: actor.id }).returning();
    const authored = { ...f.bank, campaignContext: { campaignId: campaign.id, studentId: actor.id, objective: false, fixedTier: 1 } };
    const frozen = addStudent(initialCombatState(sessionId, authored), actor).players[actor.id];
    Object.assign(frozen, { health: 2, mp: 1, healingPotions: 2, consumables: { potion: 1 } });
    await db.insert(s.campaignEncounters).values({ sessionId, campaignId: campaign.id, studentId: actor.id,
      fightSnapshot: authored, playerSnapshot: frozen });

    await t.test('campaign joins use the frozen player without rereading current levels, equipment or avatar', async () => {
      calls.length = 0;
      assert.equal(await studentCanAccessSession(repository, campaignRoom, peer.id), false);
      assert.equal(await studentCanAccessSession(repository, campaignRoom, actor.id), true);
      assert.equal(calls.length, 0, 'campaign admission uses the authoritative session owner');
      const profile = await repository.getCombatProfile!(actor, campaignRoom);
      assert.deepEqual(profile.campaignPlayer, frozen);
      assert.ok(!calls.some(c => /student_job_levels|equipment_items|student_avatars|live_combat_sessions/.test(c.sql)));
      assert.equal(calls.filter(c => /campaign_encounters/.test(c.sql)).length, 1);
      assert.deepEqual((await repository.findCombatFight!(sessionId, f.bank.id))!.campaignContext, authored.campaignContext);
      await assert.rejects(repository.getCombatProfile!(peer, campaignRoom), /Campaign encounter unavailable/);
      await db.update(s.campaignEncounters).set({ settled: true }).where(eq(s.campaignEncounters.sessionId, sessionId));
      await assert.rejects(repository.getCombatProfile!(actor, campaignRoom), /Campaign encounter unavailable/);
    });

    await t.test('missing campaign snapshots cannot fall back to an ordinary fight', async () => {
      const missingId = newCampaignSessionId();
      assert.equal(await repository.findCombatFight!(missingId, f.bank.id), null);
      await assert.rejects(repository.getCombatProfile!(actor, { ...campaignRoom, sessionId: missingId }), /Campaign encounter unavailable/);
    });

    await t.test('ordinary joins still reject archived guilds and removed membership', async () => {
      await db.update(s.guilds).set({ isArchived: true }).where(eq(s.guilds.id, f.guildId));
      await assert.rejects(repository.getCombatProfile!(actor, classroom), /hosting guild/);
      await db.update(s.guilds).set({ isArchived: false }).where(eq(s.guilds.id, f.guildId));
      await db.delete(s.guildMemberships).where(and(eq(s.guildMemberships.guildId, f.guildId), eq(s.guildMemberships.studentId, actor.id)));
      await assert.rejects(repository.getCombatProfile!(actor, classroom), /hosting guild/);
    });
  } finally { await pg.close(); }
});
