export type AnswerNormalization = "case-insensitive" | "trimmed";

export interface PendingCombatAction {
  abilityId: string;
  targetId?: string;
  targetType?: "enemy" | "ally";
}

export interface PhaseRulePlayer {
  characterClass: string;
  isDead: boolean;
  threat: number;
  hasAnswered: boolean;
  currentAnswer?: string | null;
  hasSelectedAbility: boolean;
  isHealing: boolean;
  healTarget?: string;
  blockTarget?: string;
  pendingAction?: PendingCombatAction;
  lastTargetId?: string;
}

export interface TargetableEnemy {
  id: string;
  health: number;
}

export interface QuestionResetPatch {
  hasAnswered: false;
  currentAnswer: undefined;
  answeredCurrentQuestionCorrectly: false;
  hasSelectedAbility: false;
  isHealing: false;
  healTarget: undefined;
  blockTarget: undefined;
  isCreatingPotion: false;
}

export interface SelectionProgress {
  allComplete: boolean;
  completedCount: number;
  totalPlayers: number;
  tanksComplete: boolean;
  healersComplete: boolean;
  offensiveComplete: boolean;
}

const TANK_CLASSES = new Set(["warrior", "paladin", "dark_knight", "blood_knight", "monk"]);
const HEALER_CLASSES = new Set(["herbalist", "priest", "paladin"]);

function normalizeAnswer(value: string, mode: AnswerNormalization): string {
  const lower = value.toLocaleLowerCase("en-US");
  return mode === "trimmed" ? lower.trim().replace(/\s+/g, " ") : lower;
}

export function answersMatch(
  submitted: string,
  expected: string,
  mode: AnswerNormalization = "trimmed",
): boolean {
  return normalizeAnswer(submitted, mode) === normalizeAnswer(expected, mode);
}

export function questionResetPatch(): QuestionResetPatch {
  return {
    hasAnswered: false,
    currentAnswer: undefined,
    answeredCurrentQuestionCorrectly: false,
    hasSelectedAbility: false,
    isHealing: false,
    healTarget: undefined,
    blockTarget: undefined,
    isCreatingPotion: false,
  };
}

export function findThreatLeader<T extends Pick<PhaseRulePlayer, "isDead" | "threat">>(
  players: Record<string, T>,
): string | null {
  let highestThreat = 0;
  let leaderId: string | null = null;

  for (const [playerId, player] of Object.entries(players)) {
    if (!player.isDead && player.threat > highestThreat) {
      highestThreat = player.threat;
      leaderId = playerId;
    }
  }

  return leaderId;
}

function abilitySelectionComplete(
  player: PhaseRulePlayer,
  abilityRequiresTarget: (abilityId: string) => boolean,
): boolean {
  if (!player.hasSelectedAbility || !player.pendingAction) return false;
  if (!abilityRequiresTarget(player.pendingAction.abilityId)) return true;
  return player.pendingAction.targetId !== undefined && player.pendingAction.targetId !== null;
}

export function selectionProgress(
  players: Record<string, PhaseRulePlayer>,
  abilityRequiresTarget: (abilityId: string) => boolean,
): SelectionProgress {
  const living = Object.values(players).filter(player => !player.isDead);
  const isComplete = (player: PhaseRulePlayer): boolean => {
    if (TANK_CLASSES.has(player.characterClass)) {
      return player.blockTarget !== undefined && player.blockTarget !== null;
    }
    if (HEALER_CLASSES.has(player.characterClass) && player.isHealing) {
      return player.healTarget !== undefined && player.healTarget !== null;
    }
    return abilitySelectionComplete(player, abilityRequiresTarget);
  };

  const tanks = living.filter(player => TANK_CLASSES.has(player.characterClass));
  const healers = living.filter(player => HEALER_CLASSES.has(player.characterClass));
  const offensive = living.filter(player =>
    !TANK_CLASSES.has(player.characterClass) && !HEALER_CLASSES.has(player.characterClass));

  const tanksComplete = tanks.every(isComplete);
  const healersComplete = healers.every(isComplete);
  const offensiveComplete = offensive.every(isComplete);

  return {
    allComplete: tanksComplete && healersComplete && offensiveComplete,
    completedCount: living.filter(isComplete).length,
    totalPlayers: living.length,
    tanksComplete,
    healersComplete,
    offensiveComplete,
  };
}

export function defaultActionForPlayer(
  player: Pick<PhaseRulePlayer, "isDead" | "pendingAction" | "lastTargetId">,
  enemies: TargetableEnemy[],
): PendingCombatAction | null {
  if (player.isDead || player.pendingAction?.targetId != null) return null;

  const living = enemies.filter(enemy => enemy.health > 0);
  if (living.length === 0) return null;

  const highestHpEnemy = living.reduce((highest, enemy) =>
    enemy.health > highest.health ? enemy : highest);
  const lastTarget = living.find(enemy => enemy.id === player.lastTargetId);
  const targetId = lastTarget?.id ?? highestHpEnemy.id;

  if (player.pendingAction?.abilityId) {
    return {
      ...player.pendingAction,
      targetId,
      targetType: player.pendingAction.targetType || "enemy",
    };
  }

  return { abilityId: "base_attack", targetId, targetType: "enemy" };
}
