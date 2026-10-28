import { campaignQuestionBanks } from './question-banks';
import { and, eq, inArray } from 'drizzle-orm';
import { restoreLoadout } from '../../shared/job-loadouts';
import { aaTier } from '../../shared/aa';
import { EQUIPMENT_ITEMS, type CharacterClass } from '../../shared/schema';
import { EQUIPMENT_SLOTS } from '../../shared/equipment-slots';
import { ownedEquipment, snapshotEquipmentLoadout } from '../../shared/equipment-catalog';
import { equipmentUnavailable } from '../../shared/equipment-rules';
import { effectiveLevels } from '../../shared/quests';
import { getUnlockedJobs } from '../../shared/jobSystem';
import { combatProfile } from '../db/game-repository';
import { addStudent } from '../combat/participants';
import { initialCombatState } from '../combat/encounter-setup';
import { healingActions, normalizeResources } from '../../shared/campaign/resources';
import { dungeonAccessible, pointKey, type CampaignProgress, type CampaignView } from '../../shared/campaign/model';
import { safeStudent } from '../projections/student';
import { GameError } from '../services/errors';
import type { GameDatabase } from '../db/database';
import * as s from '../db/schema';

export type CampaignRecord = typeof s.campaigns.$inferSelect;
export async function campaignPlayer(db: GameDatabase, campaign: CampaignRecord, student: s.StudentRecord, job: CharacterClass) {
  const jobs = await db.select().from(s.studentJobLevels).where(eq(s.studentJobLevels.studentId, student.id));
  const earned = Object.fromEntries(jobs.map(j => [j.jobClass, j.level]));
  const [guild] = await db.select().from(s.guilds).where(eq(s.guilds.id, campaign.guildId));
  const power = { guildId: campaign.guildId, guildTier: guild.limitTier, campaignTier: 1 };
  const levels = effectiveLevels(earned, aaTier(power));
  const saved = job === student.characterClass ? student : student.jobLoadouts[job];
  const owned = ownedEquipment([...student.inventory, ...EQUIPMENT_SLOTS.map(slot => student[slot]).filter((id): id is string => !!id)]);
  const ids = owned.filter(id => !EQUIPMENT_ITEMS[id]);
  const custom = ids.length ? await db.select().from(s.equipmentItems).where(inArray(s.equipmentItems.id, ids)) : [];
  const catalog = { ...EQUIPMENT_ITEMS, ...Object.fromEntries(custom.map(item => [item.id, item])) };
  // Validate permanent selections at earned power. The encounter projection below
  // suppresses unavailable gear/abilities without erasing any of the five saved slots.
  const savedLoadout = restoreLoadout(job, saved, owned, earned, catalog, student.aaRanks);
  const actor = { ...student, ...savedLoadout, characterClass: job };
  const profile = await combatProfile(db, actor, undefined, power);
  const loadout = { ...savedLoadout, ...profile.equipmentLoadout };
  const player = addStudent(initialCombatState('campaign-preview', campaign.fightSnapshot), actor, profile).players[student.id];
  return { player, loadout, savedLoadout, catalog, owned, levels, loadoutRevision: student.loadoutRevision, aaRevision: student.aaRevision,
    unlockedJobs: getUnlockedJobs(earned as Record<CharacterClass, number>, student.grantedJobs || []) };
}

export async function getCampaignProgress(db: GameDatabase, campaign: CampaignRecord, student: s.StudentRecord) {
  let [record] = await db.select().from(s.campaignPlayers).where(and(eq(s.campaignPlayers.campaignId, campaign.id), eq(s.campaignPlayers.studentId, student.id)));
  if (!record) {
    const job = student.characterClass || 'warrior';
    const { player } = await campaignPlayer(db, campaign, student, job);
    const state: CampaignProgress = { version: 1, zone: 'overworld', position: campaign.layout.overworld.spawn, job,
      health: player.maxHealth, maxHealth: player.maxHealth, mp: player.maxMp, maxMp: player.maxMp,
      healingPotions: 5, shieldPotions: 0, consumables: {}, itemProtections: {}, steps: 0, claimedUnlocks: [], explored: [pointKey('overworld', campaign.layout.overworld.spawn)],
      cleared: false, activeSessionId: null, lastCommandId: null };
    await db.insert(s.campaignPlayers).values({ campaignId: campaign.id, studentId: student.id, state }).onConflictDoNothing();
    [record] = await db.select().from(s.campaignPlayers).where(and(eq(s.campaignPlayers.campaignId, campaign.id), eq(s.campaignPlayers.studentId, student.id)));
  }
  return record;
}

export async function campaignView(db: GameDatabase, campaign: CampaignRecord, student: s.StudentRecord, prepared?: Awaited<ReturnType<typeof campaignPlayer>>): Promise<CampaignView> {
  const record = await getCampaignProgress(db, campaign, student);
  const context = prepared?.loadoutRevision === student.loadoutRevision && prepared.aaRevision === student.aaRevision && prepared.player.characterClass === record.state.job
    ? prepared : await campaignPlayer(db, campaign, student, record.state.job);
  const { unlockedJobs, loadout, catalog, owned, levels } = context;
  const frozen = record.state.activeSessionId
    ? (await combatProfile(db, student, record.state.activeSessionId)).campaignPlayer : undefined;
  const player = frozen ? structuredClone(frozen) : context.player;
  const progress = normalizeResources(record.state, player);
  Object.assign(player, { health: progress.health, mp: progress.mp, healingPotions: progress.healingPotions, shieldPotions: progress.shieldPotions, consumables: progress.consumables, itemProtections: progress.itemProtections, isDead: progress.health <= 0 });
  const [guild] = await db.select().from(s.guilds).where(eq(s.guilds.id, campaign.guildId));
  const questionBank = progress.questionBankFightId ? (await campaignQuestionBanks(db, campaign, progress.questionBankFightId))[0] || null : null;
  return { questionBank, questionBankRequired: !questionBank, id: campaign.id, name: campaign.name, dungeonName: campaign.dungeonName, theme: 'normal_cave', guildId: campaign.guildId, guildName: guild.name,
    gates: campaign.gates, revision: campaign.revision, layout: campaign.layout, progress, progressRevision: record.revision,
    equipment: { loadout: snapshotEquipmentLoadout(loadout), items: owned.flatMap(id => {
      const item = catalog[id];
      if (!item || equipmentUnavailable(progress.job, item, levels[progress.job] || 1, catalog[loadout.weapon || ''] || null, catalog[loadout.offhand || ''] || null, player.advancement?.ranks)) return [];
      return [{ id: item.id, name: item.name, slot: item.slot, tier: item.tier ?? 1, stats: item.stats }];
    }) },
    player, unlockedJobs, gold: student.gold, inventory: safeStudent(student).inventory,
    healingActions: healingActions(player), eligibleQuestionCount: dungeonAccessible(campaign.gates, progress) ? questionBank?.questionCount || 0 : 0 };
}

export async function requireCampaign(db: GameDatabase, id: string, actor: { actorId: string; actorType: string }) {
  const [row] = await db.select({ campaign: s.campaigns, guild: s.guilds }).from(s.campaigns).innerJoin(s.guilds, eq(s.guilds.id, s.campaigns.guildId)).where(eq(s.campaigns.id, id));
  if (!row || row.guild.isArchived) throw new GameError('Campaign unavailable', 404);
  if (actor.actorType === 'teacher') {
    if (row.campaign.teacherId !== actor.actorId) throw new GameError('Forbidden', 403);
  } else {
    const [member] = await db.select().from(s.guildMemberships).where(and(eq(s.guildMemberships.guildId, row.guild.id), eq(s.guildMemberships.studentId, actor.actorId)));
    if (!member) throw new GameError('Join this campaign’s guild first.', 403);
  }
  return row.campaign;
}
