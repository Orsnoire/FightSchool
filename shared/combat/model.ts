import type { EquipmentLoadout } from '../equipment-catalog';
import type { AvatarAppearance } from "../avatar/appearance";
import type { CharacterClass, Gender, CharacterStats } from "../schema";
export type CombatPhase =
  | "waiting"
  | "question"
  | "actions"
  | "abilities"
  | "question_resolution"
  | "enemy_ai"
  | "wave_break"
  | "game_over";
export interface CombatTotals {
  questionsAnswered: number;
  questionsCorrect: number;
  questionsIncorrect: number;
  damageDealt: number;
  damageBlocked: number;
  healingDone: number;
  bonusDamage: number;
  damageTaken: number;
  deaths: number;
}
export interface CombatAction {
  ability: string;
  targetId: string;
}
export interface CombatPlayer {
  joinOrder?: number;
  questGuildId?: string | null;
  limitTier?: number;
  correctQuestionKeys?: string[];
  equipmentLoadout?: EquipmentLoadout;
  equipmentEffects?: { healingBonus:number; potionAttackBonus:number };
  roundsParticipated?: number;
  appearance?: AvatarAppearance | null;
  studentId: string;
  nickname: string;
  characterClass: CharacterClass;
  gender: Gender;
  health: number;
  maxHealth: number;
  mp: number;
  maxMp: number;
  comboPoints: number;
  maxComboPoints: number;
  consecutiveCorrectAnswers?: number;
  threat: number;
  isDead: boolean;
  hasAnswered: boolean;
  currentAnswer: string | null;
  lastAnswerCorrect?: boolean;
  stats: CharacterStats;
  jobLevels: Partial<Record<CharacterClass, number>>;
  availableAbilities: string[];
  questionAction: CombatAction | null;
  supportActions: CombatAction[];
  ready: boolean;
  cooldowns: Record<string, number>;
  ultimatesUsed: string[];
  healingPotions: number;
  shieldPotions: number;
  buffs: Record<string, { rounds: number; amount: number }>;
  totals: CombatTotals;
}
export interface CombatEnemy {
  role?: import("../encounter-tiers").EnemyRole;
  templateId?: string;
  quantity?: number;
  wave?: number;
  species?: "goblin" | "other";
  id: string;
  name: string;
  image: string;
  difficultyMultiplier: number;
  health: number;
  maxHealth: number;
  effects: Array<{
    ownerId: string;
    type: string;
    rounds: number;
    damage: number;
  }>;
}
export interface CombatEvent {
  id: string;
  round: number;
  phase?: "question_resolution" | "enemy_ai";
  type: "damage" | "heal" | "block" | "answer" | "enemy_attack" | "ability";
  actorId: string;
  targetId: string;
  amount: number;
  message: string;
}
export interface CombatSnapshot {
  encounterRules?: 2;
  autoAdvanceWaves?: boolean;
  activeWave?: number;
  encounterAttendance?: number;
  entryPerformance?: Record<string,{damage:number;healing:number;health:number;mitigation:number}>;
  referenceDamage?: number;
  enemyRoundBudget?: number;
  encounterXpFraction?: number;
  goblinAttackCursor?: number;
  healerAttackCounts?: Record<string,number>;
  questionOrder?: number[];
  questionCursor?: number;
  enemyDisplayMode: "simultaneous" | "consecutive";
  schemaVersion: 2;
  revision: number;
  sessionId: string;
  fightId: string;
  currentQuestionIndex: number;
  round: number;
  currentPhase: CombatPhase;
  players: Record<string, CombatPlayer>;
  pendingPlayers?: Record<string, CombatPlayer>;
  /** Server-only saved participants; stripped from public snapshots. */
  departedPlayers?: Record<string, CombatPlayer>;
  completedRounds?: number;
  damageLeaderId?: string | null;
  endedByHost?: boolean;
  enemies: CombatEnemy[];
  questionStartTime: number | null;
  phaseStartTime: number;
  phaseDeadline: number | null;
  threatLeaderId: string | null;
  events: CombatEvent[];
  victory: boolean | null;
  endReason: string | null;
  seed: number;
  soloEnemyDamageCap?: number;
}
export type PublicQuestion = {
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  timeLimit: number;
};
