import type { CharacterClass, EquipmentSlot, WeaponType } from './schema';
import { SLOT_DEFINITIONS } from './equipment-slots';

/** Economy v1 is fixed: changing the class XP curve must not revalue earned points. */
export const AA_XP_PER_POINT = 60;
export const AA_CATALOG_VERSION = 1;
export type AARanks = Record<string, number>;
export type PrimaryStat = 'str' | 'int' | 'agi' | 'mnd' | 'vit';
export type FlatStat = 'atk' | 'mat' | 'rtk' | 'def' | 'healing' | 'maxHp' | 'maxMp';
export type AACategory = 'Primary stats' | 'Combat' | 'Weapons' | 'Armor proficiencies' | 'Utility';
export interface AAUpgrade {
  id: string;
  name: string;
  category: AACategory;
  description: string;
  costs: readonly number[];
  values: readonly number[];
  unit: string;
  kind: 'primary' | 'flat' | 'specialization' | 'weapon' | 'armor' | 'slots' | 'combo' | 'potion' | 'dodge' | 'agility' | 'cosmetic';
  stat?: PrimaryStat | FlatStat;
  weapon?: WeaponType;
  armor?: 'heavy_armor' | 'leather_armor';
  slot?: EquipmentSlot;
}
export const AA_WEAPONS: Record<WeaponType, { label: string; stat: 'atk' | 'mat' | 'rtk' }> = {
  sword: { label: 'Sword', stat: 'atk' }, 'two-handed-sword': { label: 'Two-handed sword', stat: 'atk' },
  fist: { label: 'Fist wraps', stat: 'atk' }, claws: { label: 'Claws', stat: 'atk' },
  wand: { label: 'Wand', stat: 'mat' }, staff: { label: 'Staff', stat: 'mat' }, herbs: { label: 'Herbs', stat: 'mat' },
  bow: { label: 'Bow', stat: 'rtk' }, harp: { label: 'Harp', stat: 'rtk' }, spoon: { label: 'Spoon', stat: 'rtk' },
};
export const weaponProficiencyId = (weapon: string) => `weapon:${weapon}`;
export const armorProficiencyId = (armor: string, slot: string) => `armor:${armor}:${slot}`;
const range = (n: number, step = 1) => Array.from({ length: n }, (_, i) => (i + 1) * step);
const threeCosts = [2, 3, 8] as const;
const primary = ['str', 'int', 'agi', 'mnd', 'vit'] as const;
const naturals = [['toughness', 'DEF', 'def'], ['aggression', 'ATK', 'atk'], ['wisdom', 'healing', 'healing'],
  ['arcane-knowledge', 'MAT', 'mat'], ['accuracy', 'RTK', 'rtk']] as const;
export const AA_CATALOG: readonly AAUpgrade[] = [
  ...primary.map(stat => ({ id: `stat:${stat}`, name: stat.toUpperCase(), category: 'Primary stats' as const,
    description: `Increase ${stat.toUpperCase()}; abilities and derived resources use the increased stat.`,
    costs: range(10, 2), values: range(10), unit: stat.toUpperCase(), kind: 'primary' as const, stat })),
  ...naturals.map(([id, label, stat]) => ({ id: `natural:${id}`, name: `Natural ${id.replace('-', ' ').replace(/^./, c => c.toUpperCase())}`,
    category: 'Combat' as const, description: stat === 'healing' ? 'Add healing to explicit healing abilities and potions; excludes lifesteal, full heals and fixed revives.' : `Increase ${label}.`,
    costs: range(5, 5), values: range(5), unit: label, kind: 'flat' as const, stat })),
  ...(['maxHp', 'maxMp'] as const).map(stat => ({ id: stat === 'maxHp' ? 'health' : 'mana', name: stat === 'maxHp' ? 'Maximum HP' : 'Maximum MP',
    category: 'Combat' as const, description: 'Increase the maximum without refilling resources in an existing encounter.',
    costs: threeCosts, values: range(3, 10), unit: stat === 'maxHp' ? 'HP' : 'MP', kind: 'flat' as const, stat })),
  { id: 'cross-class-slots', name: 'Cross-class slots', category: 'Utility', description: 'Add slots to your two base slots. Abilities still require their class unlock and encounter tier.',
    costs: [10, 20, 30], values: [1, 2, 3], unit: 'extra slots', kind: 'slots' },
  { id: 'combo-preservation', name: 'Combo preservation', category: 'Combat', description: 'A wrong or unanswered question clears all combo points. Retain up to this many existing points instead; never creates points or protects the correct-answer streak.',
    costs: threeCosts, values: [1, 2, 3], unit: 'protected CP', kind: 'combo' },
  { id: 'potion-preservation', name: 'Potion preservation', category: 'Combat', description: 'Chance to retain a charge when using a combat potion, including Herbalist potions. A charge is still required.',
    costs: threeCosts, values: [10, 25, 50], unit: '% chance', kind: 'potion' },
  { id: 'dodging', name: 'Dodging', category: 'Combat', description: 'Avoid direct incorrect-answer or monster attack damage. Does not avoid damage over time, self-costs, or status effects; grants no blocked-damage EXP.',
    costs: [2, 3, 8, 12], values: [10, 20, 30, 40], unit: '% chance', kind: 'dodge' },
  { id: 'natural:agility', name: 'Natural Agility', category: 'Combat', description: 'On a correct answer, a chance for one basic damaging attack despite stun or hypnosis. Does not cure status, allow abilities, or enable Priest First Aid.',
    costs: threeCosts, values: [25, 50, 75], unit: '% chance', kind: 'agility' },
  ...Object.entries(AA_WEAPONS).flatMap(([weapon, { label, stat }]): AAUpgrade[] => [
    { id: `specialization:${weapon}`, name: `${label} specialization`, category: 'Weapons',
      description: `Add ${stat.toUpperCase()} while this weapon type is equipped. Does not change your class's attack formula.`,
      costs: range(6, 3), values: range(6), unit: stat.toUpperCase(), kind: 'specialization', stat, weapon: weapon as WeaponType },
    { id: weaponProficiencyId(weapon), name: `${label} proficiency`, category: 'Weapons',
      description: 'Use this weapon type on any class. Ownership, level and compatible off-hand requirements still apply.',
      costs: [5], values: [1], unit: 'license', kind: 'weapon', weapon: weapon as WeaponType },
  ]),
  ...(['heavy_armor', 'leather_armor'] as const).flatMap(armor => Object.entries(SLOT_DEFINITIONS)
    .filter(([, definition]) => definition.armor).map(([slot, definition]): AAUpgrade => ({
      id: armorProficiencyId(armor, slot), name: `${armor === 'heavy_armor' ? 'Heavy' : 'Leather'} · ${definition.label}`,
      category: 'Armor proficiencies', description: 'Use this armor category in this slot on any class. Ownership and level requirements still apply. Light armor is already universal.',
      costs: [5], values: [1], unit: 'license', kind: 'armor', armor, slot: slot as EquipmentSlot,
    }))),
  { id: 'recustomization', name: 'Character recustomization', category: 'Utility',
    description: 'Change character name, body model and colors together. Login name stays unchanged. Preview and cancellation are free.',
    costs: [5], values: [1], unit: 'change', kind: 'cosmetic' },
];
const byId = new Map(AA_CATALOG.map(upgrade => [upgrade.id, upgrade]));
export const aaUpgrade = (id: string) => byId.get(id);
export const aaRankTier = (rank: number) => rank <= 1 ? 1 : rank === 2 ? 2 : rank <= 4 ? 3 : 4;
/** The caller supplies an authoritative power limit, never an adaptive enemy or shop tier. */
export function aaTier(context: { guildTier?: number; campaignTier?: number } = {}): number {
  const tiers = [context.guildTier, context.campaignTier].filter((n): n is number => n !== undefined);
  return tiers.length ? Math.min(...tiers.map(n => Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1)) : 1;
}
export function ownedAARank(ranks: AARanks | null | undefined, upgrade: AAUpgrade): number {
  const rank = ranks?.[upgrade.id];
  return upgrade.kind !== 'cosmetic' && Number.isInteger(rank) && rank! > 0 ? Math.min(rank!, upgrade.costs.length) : 0;
}
export function effectiveAARank(ranks: AARanks | null | undefined, upgrade: AAUpgrade, tier: number): number {
  const cap = [0, 1, 2, 4, 10][aaTier({ guildTier: tier })];
  return Math.min(ownedAARank(ranks, upgrade), cap);
}
export function aaWallet(experience = 0, spent = 0) {
  const total = Math.floor(experience / AA_XP_PER_POINT);
  return { total, spent, available: Math.max(0, total - spent), xpTowardNext: experience % AA_XP_PER_POINT, xpPerPoint: AA_XP_PER_POINT };
}
export interface AAEffects {
  version: 1;
  tier: number;
  ranks: AARanks;
  primary: Record<PrimaryStat, number>;
  flat: Record<FlatStat, number>;
  extraSlots: number;
  comboFloor: number;
  potionChance: number;
  dodgeChance: number;
  agilityChance: number;
}
export function resolveAAEffects(ranks: AARanks | null | undefined, tier: number, weapon?: string | null): AAEffects {
  const result: AAEffects = { version: 1, tier: aaTier({ guildTier: tier }), ranks: {},
    primary: { str: 0, int: 0, agi: 0, mnd: 0, vit: 0 }, flat: { atk: 0, mat: 0, rtk: 0, def: 0, healing: 0, maxHp: 0, maxMp: 0 },
    extraSlots: 0, comboFloor: 0, potionChance: 0, dodgeChance: 0, agilityChance: 0 };
  for (const upgrade of AA_CATALOG) {
    const rank = effectiveAARank(ranks, upgrade, result.tier);
    if (!rank) continue;
    result.ranks[upgrade.id] = rank;
    const value = upgrade.values[rank - 1];
    switch (upgrade.kind) {
      case 'primary': result.primary[upgrade.stat as PrimaryStat] += value; break;
      case 'flat': result.flat[upgrade.stat as FlatStat] += value; break;
      case 'specialization': if (weapon === upgrade.weapon) result.flat[upgrade.stat as FlatStat] += value; break;
      case 'slots': result.extraSlots = value; break;
      case 'combo': result.comboFloor = value; break;
      case 'potion': result.potionChance = value / 100; break;
      case 'dodge': result.dodgeChance = value / 100; break;
      case 'agility': result.agilityChance = value / 100; break;
    }
  }
  return result;
}
export function preserveCombo(before: number, protectedPoints: number) {
  return Math.min(before, protectedPoints);
}
/** Informational relevance only; never determines purchase or combat eligibility. */
export function aaRelevant(upgrade: AAUpgrade, job: CharacterClass, weapon?: string | null): boolean {
  if (upgrade.weapon) return upgrade.kind === 'weapon' || upgrade.weapon === weapon;
  if (upgrade.kind === 'agility') return job !== 'priest';
  return true;
}
