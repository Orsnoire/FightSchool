import { type CombatSnapshot, type CombatPlayer } from "../../shared/combat/model.ts";
import { type FightQuestion } from "../db/schema.ts";
import { CombatRuleError } from "../../shared/combat/errors";
import { answersMatch } from "../../shared/combat/phaseRules.ts";
import { recordAttempt } from "../../shared/combat/attempts";
import { combatActionBlock, actionBlockLabel } from "../../shared/combat/status-effects";
import { SUPPORT, hasOffensiveAbility, selectionProblem, ALLIES, defaultQuestionAbility, availableAbilities } from "../../shared/combat/abilities.ts";
import { abilityDamage } from "../../shared/combat/abilityValues.ts";
import { activeEnemies } from "../../shared/combat/encounters";

export function applyAnswer(
  state: CombatSnapshot,
  id: string,
  answer: string,
  q: FightQuestion,
): CombatSnapshot {
  const p = state.players[id];
  if (state.currentPhase !== "question" || !p || p.isDead || p.hasAnswered)
    throw new CombatRuleError("Answer is unavailable in this round");
  const next = structuredClone(state);
  const player = next.players[id];
  player.hasAnswered = true;
  player.currentAnswer = answer;
  player.lastAnswerCorrect = answersMatch(answer, q.correctAnswer, "trimmed");
  player.questionAction ||= defaultQuestionAction(player, next);
  recordAttempt(next, player, q, true);
  return next;
}

export function allLivingPlayersAnswered(state: CombatSnapshot): boolean {
  const p = Object.values(state.players).filter((p) => !p.isDead);
  return p.length > 0 && p.every((p) => {
    const lock = combatActionBlock(state, p);
    return p.hasAnswered && (state.currentPhase === "question" || p.ready || !!lock && !lock.attacksOnly);
  });
}

export function selectAction(
  state: CombatSnapshot,
  id: string,
  ability: string,
  targetId: string,
): CombatSnapshot {
  const p = state.players[id];
  if (!p || p.isDead || !p.hasAnswered)
    throw new CombatRuleError("Submit an answer first");
  const support = state.currentPhase === "abilities";
  // Accept early selections from clients opened before the independent action phase shipped.
  if (!support && !["question", "actions"].includes(state.currentPhase))
    throw new CombatRuleError("Actions are closed");
  if (SUPPORT.has(ability) !== support)
    throw new CombatRuleError("Ability belongs to another phase");
  const lock = combatActionBlock(state, p);
  if (lock && (!lock.attacksOnly || hasOffensiveAbility([ability]) || abilityDamage(p, ability) !== undefined))
    throw new CombatRuleError(`${actionBlockLabel(lock.reason)} — cannot use this action`);
  const error = selectionProblem(p, ability);
  if (error) throw new CombatRuleError(error);
  if (ALLIES.has(ability)) {
    if (!state.players[targetId] || state.players[targetId].isDead)
      throw new CombatRuleError("Choose a living ally");
  } else if (
    !SUPPORT.has(ability) &&
    !["craft_healing_potion", "craft_shield_potion", "pact_surge"].includes(
      ability,
    ) &&
    !state.enemies.some((e) => e.id === targetId && e.health > 0)
  )
    throw new CombatRuleError("Choose a living enemy");
  if (
    state.enemyDisplayMode === "consecutive" &&
    state.enemies.some((e) => e.id === targetId) &&
    !activeEnemies(state).some(e=>e.id===targetId)
  )
    throw new CombatRuleError("That enemy is not active yet");
  const next = structuredClone(state);
  const player = next.players[id];
  if (support) {
    if (player.supportActions.some((a) => a.ability === ability))
      throw new CombatRuleError("Ability already selected");
    if (player.supportActions.length >= 3)
      throw new CombatRuleError("Maximum three support actions");
    player.supportActions.push({ ability, targetId });
  } else player.questionAction = { ability, targetId };
  player.ready = false;
  return next;
}

export function setReady(state: CombatSnapshot, id: string): CombatSnapshot {
  const p = state.players[id];
  if (
    !p ||
    p.isDead ||
    !p.hasAnswered ||
    !["question", "actions", "abilities"].includes(state.currentPhase)
  )
    throw new CombatRuleError("Cannot finish actions now");
  return {
    ...state,
    players: { ...state.players, [id]: { ...p, ready: true } },
  };
}

export function defaultQuestionAction(p: CombatPlayer, state: CombatSnapshot) {
  return { ability: defaultQuestionAbility(p.characterClass),
    targetId: p.characterClass === "priest" ? p.studentId : activeEnemies(state)[0]?.id || "" };
}

/** Upgrade saved Priest loadouts and obsolete default choices without resetting combat. */
export function upgradePriestActions(state: CombatSnapshot): CombatSnapshot {
  if (state.currentPhase === "game_over") return state;
  const players = [...Object.values(state.players), ...Object.values(state.pendingPlayers || {}), ...Object.values(state.departedPlayers || {})];
  if (!players.some(p => p.characterClass === "priest" && (
    p.availableAbilities.includes("attack") || !p.availableAbilities.includes("first_aid") || p.questionAction?.ability === "attack"
  ))) return state;
  const next = structuredClone(state);
  for (const p of [...Object.values(next.players), ...Object.values(next.pendingPlayers || {}), ...Object.values(next.departedPlayers || {})]) {
    if (p.characterClass !== "priest") continue;
    p.availableAbilities = [...new Set(["first_aid", ...p.availableAbilities.filter(id => id !== "attack")])];
    if (p.questionAction?.ability === "attack") p.questionAction = defaultQuestionAction(p, next);
  }
  next.revision++;
  return next;
}
