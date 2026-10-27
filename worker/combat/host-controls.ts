import { type CombatSnapshot } from "../../shared/combat/model.ts";
import { type FightRecord } from "../db/schema.ts";
import { canAdvanceWave, activeEnemies } from "../../shared/combat/encounters";
import { CombatRuleError } from "../../shared/combat/errors";
import { advancePhase } from "./phases";
import { releaseInvalidStatuses } from "../../shared/combat/status-effects";
import { event, leader } from "./state-events";
import { defaultQuestionAction } from "./choices";

/** Teacher endings and solo-host departures share completion and reward semantics. */
export function endFight(state: CombatSnapshot, reason = "Fight ended by teacher"): CombatSnapshot {
  if (state.currentPhase === "game_over") return state;
  return { ...state, currentPhase: "game_over", victory: false,
    endedByHost: true, endReason: reason, phaseDeadline: null };
}

/** Skip the current wave without inventing player damage or answer credit. */
export function nextWave(state: CombatSnapshot, fight: FightRecord, now = Date.now()): CombatSnapshot {
  if (!canAdvanceWave(state)) throw new CombatRuleError("No next wave is available");
  if (state.currentPhase === "wave_break") return advancePhase(state, fight, now);
  const next = structuredClone(state);
  for (const enemy of activeEnemies(next)) {
    enemy.health = 0;
    enemy.effects = [];
  }
  releaseInvalidStatuses(next);
  event(next, "ability", "host", "", 0, `Host skipped wave ${next.activeWave || 1}`);
  // Reuse round cleanup, late admissions and wave selection, then open its question.
  next.currentPhase = "enemy_ai";
  const between = advancePhase(next, fight, now);
  return between.currentPhase === "wave_break" ? advancePhase(between, fight, now) : between;
}

/** Host intervention defeats one active enemy without attributing damage to a player. */
export function eliminateEnemy(state: CombatSnapshot, id: string): CombatSnapshot {
  if (["waiting", "game_over"].includes(state.currentPhase))
    throw new CombatRuleError("Fight is not active");
  if (!activeEnemies(state).some(e => e.id === id))
    throw new CombatRuleError("Choose a living enemy in the active wave");
  const next = structuredClone(state);
  const enemy = next.enemies.find(e => e.id === id)!;
  enemy.health = 0;
  enemy.effects = [];
  releaseInvalidStatuses(next);
  event(next, "ability", "host", id, 0, `Host eliminated ${enemy.name}`);
  if (next.enemies.every(e => e.health <= 0)) {
    next.currentPhase = "game_over";
    next.victory = true;
    next.endReason = "All enemies defeated";
    next.phaseDeadline = null;
  }
  return next;
}

export function resurrectPlayer(state: CombatSnapshot, id: string): CombatSnapshot {
  if (["waiting", "game_over"].includes(state.currentPhase))
    throw new CombatRuleError("Fight is not active");
  const player = state.players[id];
  if (!player) throw new CombatRuleError("Player is not in this fight");
  if (!player.isDead) throw new CombatRuleError("Player is already alive");
  const next = structuredClone(state);
  const revived = next.players[id];
  revived.health = 1;
  revived.isDead = false;
  // Death can leave an unanswered player behind after the question has closed.
  if (next.currentPhase !== "question" && !revived.hasAnswered) {
    revived.hasAnswered = true;
    revived.currentAnswer = "";
    revived.lastAnswerCorrect = false;
    revived.questionAction = defaultQuestionAction(revived, next);
  }
  event(next, "heal", "host", id, 1, `Host resurrected ${revived.nickname} with 1 HP`);
  leader(next);
  return next;
}
