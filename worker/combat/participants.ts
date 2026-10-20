import { type CombatPlayer, type CombatSnapshot } from "../../shared/combat/model.ts";
import { type AvatarAppearance } from "../../shared/avatar/appearance.ts";
import { type CharacterClass, type EquipmentStats, getStartingEquipment, calculateCharacterStats, calculateLoadoutEquipmentStats } from "../../shared/schema.ts";
import { type StudentRecord } from "../db/schema.ts";
import { CombatRuleError } from "../../shared/combat/errors";
import { getTotalPassiveBonuses, getTotalMechanicUpgrades } from "../../shared/jobSystem.ts";
import { availableAbilities } from "../../shared/combat/abilities.ts";
import { leader } from "./state-events";

export interface CombatProfile {
  campaignPlayer?: CombatPlayer;
  questGuildId?: string | null;
  limitTier?: number;
  equipmentLoadout?: CombatPlayer["equipmentLoadout"];
  equipmentVisuals?: CombatPlayer["equipmentVisuals"];
  weaponKind?: string;
  equipmentEffects?: CombatPlayer["equipmentEffects"];
  appearance?: AvatarAppearance | null;
  levels: Partial<Record<CharacterClass, number>>;
  equipment?: EquipmentStats;
  crossClass?: string[];
}

export function addStudent(
  state: CombatSnapshot,
  student: StudentRecord,
  profile: CombatProfile = { levels: {} },
): CombatSnapshot {
  if (state.players[student.id]) return state;
  if (state.pendingPlayers?.[student.id]) return state;
  if (state.currentPhase === "game_over") throw new CombatRuleError("Fight has ended");
  const returning = state.departedPlayers?.[student.id];
  if (returning) return admitStudent(state, structuredClone(returning));
  if (profile.campaignPlayer) {
    if (profile.campaignPlayer.studentId !== student.id) throw new CombatRuleError('Campaign participant mismatch');
    return admitStudent(state, structuredClone(profile.campaignPlayer));
  }
  const job = (student.characterClass || "warrior") as CharacterClass;
  const levels = { ...profile.levels, [job]: profile.levels[job] || 1 };
  const starting = getStartingEquipment(job);
  const stats = calculateCharacterStats(
    job,
    profile.equipment ||
      calculateLoadoutEquipmentStats(starting),
    getTotalPassiveBonuses(levels as Record<CharacterClass, number>),
    getTotalMechanicUpgrades(levels as Record<CharacterClass, number>),
  );
  const p: CombatPlayer = {
    ...(profile.questGuildId!==undefined?{questGuildId:profile.questGuildId}:{}),
    ...(profile.limitTier!==undefined?{limitTier:profile.limitTier}:{}), correctQuestionKeys: [],
    ...(profile.equipmentLoadout ? {equipmentLoadout:{...profile.equipmentLoadout}} : {}),
    ...(profile.equipmentVisuals?{equipmentVisuals:profile.equipmentVisuals}:{}),
    ...(profile.weaponKind?{weaponKind:profile.weaponKind}:{}),
    equipmentEffects: {...profile.equipmentEffects, healingBonus:profile.equipmentEffects?.healingBonus || 0, potionAttackBonus:profile.equipmentEffects?.potionAttackBonus || 0},
    roundsParticipated: 0,
    joinOrder: Object.values({...state.departedPlayers,...state.pendingPlayers,...state.players}).reduce((n,p)=>Math.max(n,p.joinOrder??-1),-1)+1,
    studentId: student.id,
    nickname: student.nickname,
    characterClass: job,
    gender: student.gender === "B" ? "B" : "A",
    appearance: profile.appearance ? { ...profile.appearance } : null,
    health: stats.maxHp,
    maxHealth: stats.maxHp,
    mp: stats.maxMp,
    maxMp: stats.maxMp,
    comboPoints: 0,
    consecutiveCorrectAnswers: 0,
    maxComboPoints: stats.maxComboPoints,
    threat: 0,
    isDead: false,
    hasAnswered: false,
    currentAnswer: null,
    stats,
    jobLevels: levels,
    availableAbilities: availableAbilities(job, levels, profile.crossClass),
    questionAction: null,
    supportActions: [],
    ready: false,
    cooldowns: {},
    ultimatesUsed: [],
    healingPotions: 5,
    shieldPotions: 0,
    buffs: {},
    totals: {
      questionsAnswered: 0,
      questionsCorrect: 0,
      questionsIncorrect: 0,
      damageDealt: 0,
      damageBlocked: 0,
      healingDone: 0,
      bonusDamage: 0,
      damageTaken: 0,
      deaths: 0,
    },
  };
  return admitStudent(state, p);
}

/** New/returning participants enter only at a question boundary. */
function admitStudent(state: CombatSnapshot, player: CombatPlayer): CombatSnapshot {
  const next = structuredClone(state);
  delete next.departedPlayers?.[player.studentId];
  player.hasAnswered = false;
  player.currentAnswer = null;
  delete player.lastAnswerCorrect;
  player.questionAction = null;
  player.supportActions = [];
  player.ready = false;
  // Block links refer to participation in one turn, not a reusable resource.
  for (const key of Object.keys(player.buffs)) if (key.startsWith("guard:")) delete player.buffs[key];
  if (state.currentPhase === "waiting") next.players[player.studentId] = player;
  else (next.pendingPlayers ||= {})[player.studentId] = player;
  next.revision++;
  leader(next);
  return next;
}

export function completedRounds(state: CombatSnapshot): number {
  return Math.max(state.completedRounds || 0, state.round - 1,
    ...Object.values({ ...state.departedPlayers, ...state.pendingPlayers, ...state.players })
      .map(p => Math.max(p.totals.questionsAnswered, p.totals.questionsCorrect + p.totals.questionsIncorrect)));
}

export function participatedRounds(state: CombatSnapshot, player: CombatPlayer): number {
  return Math.min(completedRounds(state), Math.max(player.roundsParticipated ?? completedRounds(state), player.totals.questionsAnswered, player.totals.questionsCorrect + player.totals.questionsIncorrect));
}

/** An intentional departure removes participation; a dropped socket never does. */
export function removeStudent(state: CombatSnapshot, id: string): CombatSnapshot {
  if ((!state.players[id] && !state.pendingPlayers?.[id]) || state.currentPhase === "game_over") return state;
  const next = structuredClone(state);
  const player = next.players[id] || next.pendingPlayers![id];
  player.roundsParticipated = participatedRounds(state, player);
  (next.departedPlayers ||= {})[id] = player;
  delete next.pendingPlayers?.[id];
  delete next.players[id];
  for (const player of Object.values(next.players)) {
    if (player.questionAction?.targetId === id) player.questionAction = null;
    player.supportActions = player.supportActions.filter(action => action.targetId !== id);
    delete player.buffs[`guard:${id}`];
  }
  leader(next);
  if (next.currentPhase !== "waiting" && !Object.keys(next.players).length && !Object.keys(next.pendingPlayers || {}).length) {
    next.currentPhase = "game_over";
    next.victory = false;
    next.endReason = "All players left the fight";
    next.phaseDeadline = null;
  }
  return next;
}
