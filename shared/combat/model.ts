import type { CharacterClass, Gender, CharacterStats } from "../schema";
export type CombatPhase =
  | "waiting"
  | "question"
  | "abilities"
  | "question_resolution"
  | "enemy_ai"
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
  enemyDisplayMode: "simultaneous" | "consecutive";
  schemaVersion: 2;
  revision: number;
  sessionId: string;
  fightId: string;
  currentQuestionIndex: number;
  round: number;
  currentPhase: CombatPhase;
  players: Record<string, CombatPlayer>;
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
