import { consumeItem, CONSUMABLES, type ConsumableId } from '../../shared/campaign/consumables';
import { CombatRuleError } from '../../shared/combat/errors';
import type { CombatSnapshot } from '../../shared/combat/model';
import { event } from './state-events';

export function useCombatItem(state: CombatSnapshot, actorId: string, itemId: ConsumableId): CombatSnapshot {
  const p = state.players[actorId];
  if (!p?.consumables || !['question', 'actions', 'abilities'].includes(state.currentPhase) || p.ready)
    throw new CombatRuleError('Use items before confirming your choices');
  if (p.itemUsedRound === state.round) throw new CombatRuleError('One item per round');
  const next = structuredClone(state), player = next.players[actorId], before = player.health;
  try { consumeItem(player, itemId); } catch (e) { throw new CombatRuleError((e as Error).message); }
  player.itemUsedRound = state.round;
  // Item recovery is an explicit exception to status action locks, including self-use.
  const amount = Math.abs(player.health - before);
  event(next, player.health > before ? 'heal' : player.health < before ? 'damage' : 'ability', actorId, actorId, amount,
    `${player.nickname} used ${CONSUMABLES[itemId].name}`, { healthBefore: before, healthAfter: player.health });
  return next;
}
