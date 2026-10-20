import { and, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { campaignAction } from '../../shared/contracts/campaigns';
import { dungeonAccessible, near, pointKey, samePoint, walkable } from '../../shared/campaign/model';
import { fieldHeal, normalizeResources } from '../../shared/campaign/resources';
import { builtinShopItems } from '../../shared/equipment-shop';
import { calculateTierPrice } from '../../shared/schema';
import { GameError } from '../services/errors';
import type { GameDatabase } from '../db/database';
import * as s from '../db/schema';
import { campaignPlayer, campaignView, getCampaignProgress, type CampaignRecord } from './state';

export async function campaignShop(db: GameDatabase, campaign: CampaignRecord) {
  const [guild] = await db.select().from(s.guilds).where(eq(s.guilds.id, campaign.guildId));
  const authored = await db.select().from(s.equipmentItems).where(and(eq(s.equipmentItems.teacherId, campaign.teacherId), eq(s.equipmentItems.isPurchasable, true)));
  return [...builtinShopItems(), ...authored].filter(i => i.tier <= Math.min(1, guild.unlockedTier)).map(i => ({
    id: i.id, name: i.name, slot: i.slot, tier: i.tier, price: i.shopPrice || calculateTierPrice(i.tier, i.quality),
    shop: i.slot === 'weapon' || i.slot === 'offhand' ? 'weapons' : 'armor',
  }));
}

export async function applyCampaignAction(db: GameDatabase, campaign: CampaignRecord, student: s.StudentRecord, input: z.infer<typeof campaignAction>) {
  const row = await getCampaignProgress(db, campaign, student);
  if (row.state.lastCommandId === input.commandId) return campaignView(db, campaign, student);
  if (row.revision !== input.revision) throw new GameError('Adventure changed. Refresh and try again.', 409);
  if (row.state.activeSessionId) throw new GameError('Finish or leave the active encounter first.', 409);
  let { player, unlockedJobs } = await campaignPlayer(db, campaign, student, row.state.job);
  let next = normalizeResources(row.state, player);
  const action = input.action;
  const service = (kind: string) => {
    if (next.zone !== 'overworld' || !campaign.layout.npcs.some(n => n.service === kind && near(n, next.position)))
      throw new GameError('Walk to this service in town first.');
  };
  const open = () => dungeonAccessible(campaign.gates, next);
  let startEncounter = false, objective = false;
  let purchase: { id: string; price: number; tier: number } | undefined;
  switch (action.type) {
    case 'move': {
      if (Math.abs(action.dx) + Math.abs(action.dy) !== 1) throw new GameError('Move one tile at a time.');
      const position = { x: next.position.x + action.dx, y: next.position.y + action.dy };
      if (!walkable(campaign.layout[next.zone], position)) throw new GameError('That route is blocked.');
      const inTown = next.zone === 'overworld' && position.x <= 7 && position.y >= 3 && position.y <= 9;
      if (next.health <= 0 && !inTown) throw new GameError('Rest at the inn before adventuring.');
      next = { ...next, position, steps: next.steps + 1 };
      next.explored = [...new Set([...next.explored, pointKey(next.zone, position)])];
      // Stable pseudo-random checks cannot be rerolled by refreshing; town is safe.
      const roll = Array.from(`${campaign.id}:${next.steps}`).reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
      startEncounter = !inTown && next.health > 0 && open() && roll % 7 === 0;
      break;
    }
    case 'enter':
      if (next.zone !== 'overworld' || !near(next.position, campaign.layout.entrance)) throw new GameError('Walk to the dungeon entrance first.');
      if (!open()) throw new GameError('Collect the required keys after your teacher opens their gates.');
      if (next.health <= 0) throw new GameError('Rest at the inn first.');
      next = { ...next, zone: 'dungeon', position: campaign.layout.dungeon.spawn }; break;
    case 'exit':
      if (next.zone !== 'dungeon' || !near(next.position, campaign.layout.dungeonExit)) throw new GameError('Walk to the cave exit first.');
      next = { ...next, zone: 'overworld', position: campaign.layout.entrance }; break;
    case 'return_to_town': next = { ...next, zone: 'overworld', position: campaign.layout.overworld.spawn }; break;
    case 'quest': {
      const giver = campaign.layout.npcs.find(n => n.gateId === action.gateId);
      const gate = campaign.gates.find(g => g.id === action.gateId);
      if (next.zone !== 'overworld' || !giver || !near(giver, next.position)) throw new GameError('Talk to this quest giver in town.');
      if (!gate?.open) throw new GameError('Your teacher has not opened this unlock yet.');
      next = { ...next, claimedUnlocks: [...new Set([...next.claimedUnlocks, gate.id])] }; break;
    }
    case 'heal':
      try { next = fieldHeal(next, player, action.ability); } catch (e) { throw new GameError((e as Error).message); } break;
    case 'rest': service('inn'); next = { ...next, health: next.maxHealth, mp: next.maxMp, healingPotions: 5, shieldPotions: 0 }; break;
    case 'job': {
      service('inn');
      if (!unlockedJobs.includes(action.job)) throw new GameError('This job is not unlocked.');
      ({ player } = await campaignPlayer(db, campaign, student, action.job));
      next = normalizeResources({ ...next, job: action.job }, player); break;
    }
    case 'buy': {
      service(action.shop);
      const item = (await campaignShop(db, campaign)).find(i => i.id === action.itemId && i.shop === action.shop);
      if (!item) throw new GameError('Item unavailable.');
      purchase = { id: item.id, price: item.price, tier: item.tier }; break;
    }
    case 'encounter':
      if (next.zone !== 'dungeon' || !near(next.position, campaign.layout.objective)) throw new GameError('Reach the dungeon guardian first.');
      if (next.cleared) throw new GameError('You have already cleared this dungeon.');
      if (!open() || next.health <= 0) throw new GameError('This encounter is not currently available.');
      startEncounter = true; objective = true; break;
  }
  next.explored = [...new Set([...next.explored, pointKey(next.zone, next.position)])];
  let encounter;
  if (startEncounter) {
    const id = `CP${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`;
    // The pilot has one unlocked quiz. Freeze a small sample per encounter; the
    // combat engine cycles it until the encounter ends, never adds locked content.
    const pool = campaign.fightSnapshot.questions;
    const count = Math.min(objective ? 5 : 2, pool.length);
    const offset = next.steps % pool.length;
    const fight: s.FightRecord = { ...campaign.fightSnapshot, encounterTier: 1,
      questions: Array.from({ length: count }, (_, i) => pool[(offset + i) % pool.length]),
      enemies: [{ id: 'campaign-slime', name: objective ? 'Cave Guardian' : 'Wild Slime', image: '/enemies/slime-v2.png', enemyType: 'slime', quantity: 1, role: objective ? 'boss' : 'normal', difficultyMultiplier: objective ? 1.5 : 1 }],
      enemyDisplayMode: 'consecutive', lootTable: [],
      campaignContext: { campaignId: campaign.id, studentId: student.id, objective, fixedTier: 1 } };
    Object.assign(player, { health: next.health, mp: next.mp, healingPotions: next.healingPotions, shieldPotions: next.shieldPotions, isDead: false });
    encounter = { id, fight, player };
    next = { ...next, activeSessionId: id };
  }
  const result = await db.execute(sql`SELECT apply_campaign_action(${JSON.stringify({ campaign: campaign.id, student: student.id,
    revision: input.revision, campaignRevision: campaign.revision, loadoutRevision: student.loadoutRevision,
    command: input.commandId, state: next, ...(purchase ? { purchase } : {}), ...(encounter ? { encounter } : {}) })}::jsonb) AS result`);
  const outcome = result.rows[0].result as { error?: string };
  if (outcome.error) throw new GameError(outcome.error, 409);
  const [fresh] = await db.select().from(s.students).where(eq(s.students.id, student.id));
  return campaignView(db, campaign, fresh);
}
