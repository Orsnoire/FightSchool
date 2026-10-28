import { normalizeBag, normalizeProtections } from './consumables';
import type { CombatPlayer } from '../combat/model';
import { abilityHealing } from '../combat/abilityValues';
import { actionCost } from '../combat/abilities';
import { pointKey, type CampaignLayout, type CampaignProgress } from './model';

// Direct restorative actions whose complete outside-combat effect is defined.
// Combat ultimates/cooldown actions are intentionally not reset by a menu visit.
const FIELD_HEALS: Record<string, string> = { first_aid: 'First Aid', mend: 'Mend', healing_potion: 'Healing Potion', holy_light: 'Holy Light', healing_guard: 'Healing Guard', cleansing_chorus: 'Cleansing Chorus' };
export function healingActions(player: CombatPlayer) {
  return player.availableAbilities.filter(id => FIELD_HEALS[id]).map(id => {
    const cost = actionCost(player, id);
    return { id, name: FIELD_HEALS[id], amount: Math.max(0, abilityHealing(player, id) || 0), mp: cost.mp, potions: cost.healing };
  });
}
export function normalizeResources(progress: CampaignProgress, player: CombatPlayer): CampaignProgress {
  return { ...progress, consumables: normalizeBag(progress.consumables), itemProtections: normalizeProtections(progress.itemProtections), maxHealth: player.maxHealth, maxMp: player.maxMp,
    health: Math.max(0, Math.min(progress.health, player.maxHealth)), mp: Math.max(0, Math.min(progress.mp, player.maxMp)),
    healingPotions: Math.max(0, Math.min(5, progress.healingPotions)), shieldPotions: Math.max(0, Math.min(3, progress.shieldPotions)) };
}
export function fieldHeal(progress: CampaignProgress, player: CombatPlayer, ability: string): CampaignProgress {
  const action = healingActions(player).find(a => a.id === ability);
  if (!action) throw new Error('This healing action is not available outside combat.');
  if (progress.health <= 0) throw new Error('Rest at the inn to recover from defeat.');
  if (progress.health >= progress.maxHealth) throw new Error('HP is already full.');
  if (progress.mp < action.mp || progress.healingPotions < action.potions) throw new Error('Not enough MP or healing potions.');
  return { ...progress, health: Math.min(progress.maxHealth, progress.health + action.amount), mp: progress.mp - action.mp, healingPotions: progress.healingPotions - action.potions };
}

/** Explicit personal restart. Purchased inventory and permanent reward history survive. */
export function resetCampaignProgress(progress: CampaignProgress, layout: CampaignLayout): CampaignProgress {
  if (progress.activeSessionId) throw new Error('Finish or leave the active encounter first.');
  return { ...progress, zone: 'overworld', position: { ...layout.overworld.spawn },
    health: progress.maxHealth, mp: progress.maxMp, healingPotions: 5, shieldPotions: 0,
    itemProtections: {}, steps: 0, claimedUnlocks: [],
    explored: [pointKey('overworld', layout.overworld.spawn)], cleared: false };
}
