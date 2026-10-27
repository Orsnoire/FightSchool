import type { CombatPlayer } from '../combat/model';

export const CONSUMABLE_IDS = ['potion', 'antivenom', 'ennervator', 'psychic_needle', 'sticky_shoes', 'stun_ward', 'psychic_crown', 'silver_knife'] as const;
export type ConsumableId = typeof CONSUMABLE_IDS[number];
export type ConsumableBag = Partial<Record<ConsumableId, number>>;
export type ItemProtection = 'trip' | 'stun' | 'hypnosis';
export type ItemProtections = Partial<Record<ItemProtection, number>>;
export const CONSUMABLES: Record<ConsumableId, { name: string; description: string; price: number; weight: number; protection?: ItemProtection }> = {
  potion: { name: 'Potion', description: 'Restore 5 HP. Cannot revive.', price: 10, weight: 1 },
  antivenom: { name: 'Antivenom', description: 'Cure poison.', price: 10, weight: 1 },
  ennervator: { name: 'Ennervator', description: 'Cure stun.', price: 12, weight: 1 },
  psychic_needle: { name: 'Psychic Needle', description: 'Lose 1 HP to cure hypnosis or Hypnotic Stare. Requires at least 2 HP.', price: 10, weight: 1 },
  sticky_shoes: { name: 'Sticky Shoes', description: 'Prevent trip for the next 5 enemy turns. Does not cure an existing trip.', price: 20, weight: 1, protection: 'trip' },
  stun_ward: { name: 'Stun protection (name TBD)', description: 'Prevent stun for the next 5 enemy turns. Does not cure existing stun.', price: 20, weight: 1, protection: 'stun' },
  psychic_crown: { name: 'Psychic Crown', description: 'Prevent hypnosis and Hypnotic Stare for the next 5 enemy turns.', price: 20, weight: 1, protection: 'hypnosis' },
  silver_knife: { name: 'Silver Knife', description: 'Cure webbed. Consumed on use.', price: 10, weight: 1 },
};
export function normalizeBag(bag: ConsumableBag = {}): ConsumableBag {
  return Object.fromEntries(CONSUMABLE_IDS.flatMap(id => {
    const count = bag[id];
    return Number.isSafeInteger(count) && count! > 0 ? [[id, count]] : [];
  }));
}
export function normalizeProtections(protections: ItemProtections = {}): ItemProtections {
  return Object.fromEntries((['trip', 'stun', 'hypnosis'] as const).flatMap(id => {
    const turns = protections[id];
    return Number.isInteger(turns) && turns! > 0 ? [[id, Math.min(5, turns!)]] : [];
  }));
}
export function bagWeight(bag: ConsumableBag = {}) {
  return CONSUMABLE_IDS.reduce((weight, id) => weight + (bag[id] || 0) * CONSUMABLES[id].weight, 0);
}
export const potionHealing = (p: Pick<CombatPlayer, 'advancement'>) => 5 + (p.advancement?.flat.healing || 0);
export function consumableProblem(p: Pick<CombatPlayer, 'consumables' | 'health' | 'maxHealth' | 'statuses' | 'actionBlocked' | 'buffs' | 'itemProtections'>, id: ConsumableId): string | undefined {
  if (!(p.consumables?.[id]! > 0)) return 'None in your bag';
  if (p.health <= 0) return 'Cannot use while knocked out';
  const statuses = p.statuses || [];
  if (id === 'potion' && p.health >= p.maxHealth) return 'HP is full';
  if (id === 'antivenom' && !statuses.some(x => x.type === 'poison') && !p.buffs.poison) return 'Not poisoned';
  if (id === 'ennervator' && !statuses.some(x => x.type === 'stun')) return 'Not stunned';
  if (id === 'silver_knife' && !statuses.some(x => x.type === 'web') && p.actionBlocked?.reason !== 'web') return 'Not webbed';
  if (id === 'psychic_needle') {
    if (!statuses.some(x => x.type === 'hypnosis' || x.type === 'stare')) return 'Not hypnotized';
    if (p.health <= 1) return 'Requires at least 2 HP';
  }
  const protection = CONSUMABLES[id].protection;
  if (protection && (p.itemProtections?.[protection] || 0) >= 5) return 'Already protected for 5 turns';
}
/** Caller validates timing/identity and checkpoints the result. Items never grant answer credit. */
export function consumeItem(p: CombatPlayer, id: ConsumableId) {
  const problem = consumableProblem(p, id);
  if (problem) throw new Error(problem);
  p.consumables = normalizeBag({ ...p.consumables, [id]: p.consumables![id]! - 1 });
  const cured = id === 'antivenom' ? ['poison'] : id === 'ennervator' ? ['stun'] : id === 'psychic_needle' ? ['hypnosis', 'stare'] : id === 'silver_knife' ? ['web'] : [];
  p.statuses = (p.statuses || []).filter(x => !cured.includes(x.type));
  if (id === 'antivenom') delete p.buffs.poison;
  if (p.actionBlocked && cured.includes(p.actionBlocked.reason)) delete p.actionBlocked;
  if (!p.statuses.some(x => x.type === 'stun' || x.type === 'paralysis')) p.recoveryCorrectAnswers = 0;
  if (id === 'potion') p.health = Math.min(p.maxHealth, p.health + potionHealing(p));
  if (id === 'psychic_needle') p.health -= 1;
  const protection = CONSUMABLES[id].protection;
  if (protection) p.itemProtections = { ...p.itemProtections, [protection]: 5 };
}
export function tickItemProtections(p: CombatPlayer) {
  if (p.itemProtections) p.itemProtections = normalizeProtections(Object.fromEntries(Object.entries(p.itemProtections).map(([id, turns]) => [id, turns - 1])));
}
