import type { CharacterClass } from '../schema';
import type { CombatPlayer } from '../combat/model';
import type { EquipmentLoadout } from '../equipment-catalog';
import type { EquipmentSlot, EquipmentStats } from '../schema';

export type CampaignZone = 'overworld' | 'dungeon';
export type CampaignTile = 'grass' | 'water' | 'mountain' | 'path' | 'floor' | 'wall';
export interface CampaignPoint { x: number; y: number }
export interface CampaignMap { width: number; height: number; tiles: CampaignTile[]; spawn: CampaignPoint }
export interface CampaignGate { id: string; name: string; open: boolean }
export interface CampaignNpc extends CampaignPoint { id: string; name: string; service: 'inn' | 'weapons' | 'armor' | 'items' | 'quest'; gateId?: string }
export interface CampaignLayout {
  version: 1; seed: string; overworld: CampaignMap; dungeon: CampaignMap;
  entrance: CampaignPoint; dungeonExit: CampaignPoint; objective: CampaignPoint; npcs: CampaignNpc[];
}
export interface CampaignProgress {
  consumables?: import('./consumables').ConsumableBag;
  itemProtections?: import('./consumables').ItemProtections;
  version: 1; zone: CampaignZone; position: CampaignPoint; job: CharacterClass;
  health: number; maxHealth: number; mp: number; maxMp: number;
  healingPotions: number; shieldPotions: number; steps: number;
  claimedUnlocks: string[]; explored: string[]; cleared: boolean;
  activeSessionId: string | null; lastCommandId: string | null;
}
export interface CampaignSummary { id: string; name: string; guildId: string; guildName: string; dungeonName: string; gates: CampaignGate[]; theme: 'normal_cave'; revision: number }
export interface CampaignView extends CampaignSummary {
  layout: CampaignLayout; progress: CampaignProgress; progressRevision: number;
  player: CombatPlayer; unlockedJobs: CharacterClass[]; gold: number; inventory: string[];
  healingActions: Array<{ id: string; name: string; amount: number; mp: number; potions: number }>;
  eligibleQuestionCount: number;
  equipment: { loadout: EquipmentLoadout; items: Array<{ id: string; name: string; slot: EquipmentSlot; tier: number; stats: Partial<EquipmentStats> }> };
}
export const samePoint = (a: CampaignPoint, b: CampaignPoint) => a.x === b.x && a.y === b.y;
export const pointKey = (zone: CampaignZone, p: CampaignPoint) => `${zone}:${p.x}:${p.y}`;
export const dungeonAccessible = (gates: CampaignGate[], progress: CampaignProgress) => gates.every(g => g.open && progress.claimedUnlocks.includes(g.id));
export function walkable(map: CampaignMap, p: CampaignPoint) {
  return Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height && !['wall', 'water', 'mountain'].includes(map.tiles[p.y * map.width + p.x]);
}
export const near = (a: CampaignPoint, b: CampaignPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
