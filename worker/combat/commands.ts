import { combatCommandSchema, type CombatCommand } from '../../shared/contracts/combat';
import { CombatRuleError } from '../../shared/combat/errors';
import type { CombatSnapshot } from '../../shared/combat/model';
import type { FightRecord } from '../db/schema';
import { applyAnswer, selectAction, setReady } from './choices';
import { useCombatItem } from './consumables';

/** Keep frame validation separate so expiry, rate limits and authentication retain their order. */
export function assertCommandText(message: string | ArrayBuffer): asserts message is string {
  if (typeof message !== 'string' || new TextEncoder().encode(message).byteLength > 16000)
    throw new CombatRuleError('Text command up to 16KB required');
}
export function decodeCommandText(message: string): unknown {
  try { return JSON.parse(message); }
  catch { throw new CombatRuleError('Invalid combat command'); }
}
export function parseCombatCommand(raw: unknown): CombatCommand {
  const parsed = combatCommandSchema.safeParse(raw);
  if (!parsed.success) throw new CombatRuleError('Invalid combat command');
  return parsed.data;
}

/** The room authority checks identity, round, deadline and receipts before applying these rules. */
export function applyStudentCommand(state: CombatSnapshot, fight: FightRecord, actorId: string, command: CombatCommand, now: number): CombatSnapshot {
  if (command.type === 'answer') {
    if (state.questionStartTime && now < state.questionStartTime)
      throw new CombatRuleError('Question is opening');
    if (typeof command.answer !== 'string' || command.answer.length > 5000 || command.questionId !== fight.questions[state.currentQuestionIndex].id)
      throw new CombatRuleError('Invalid or stale answer');
    return applyAnswer(state, actorId, command.answer, fight.questions[state.currentQuestionIndex]);
  }
  if (command.type === 'action') {
    if (typeof command.ability !== 'string' || typeof command.targetId !== 'string')
      throw new CombatRuleError('Invalid action');
    const selected = selectAction(state, actorId, command.ability, command.targetId);
    return command.ready === true ? setReady(selected, actorId) : selected;
  }
  if (command.type === 'use_item') {
    if (!fight.campaignContext) throw new CombatRuleError('Campaign items are unavailable in this encounter');
    return useCombatItem(state, actorId, command.itemId);
  }
  if (command.type === 'ready') return setReady(state, actorId);
  throw new CombatRuleError('Unsupported command');
}
