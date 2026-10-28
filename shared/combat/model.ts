import type { EquipmentLoadout } from '../equipment-catalog';
import type { AvatarAppearance } from "../avatar/appearance";
import type { CharacterClass, Gender, CharacterStats } from "../schema";
import type { EnemyAI, EnemyMove, EnemyType } from "./enemy-ai";
export type StatusType = "stun" | "paralysis" | "web" | "poison" | "bleed" | "hypnosis" | "stare" | "fear" | "corrosion" | "suffocate" | "trip";
export interface CombatStatus {
  type: StatusType;
  sourceId: string;
  appliedRound: number;
  throughRound?: number;
  amount?: number;
  carry?: number;
  chance?: number;
  actionFailure?: { round: number; skip: boolean };
  correctAnswers?: number;
}
export interface EnemyAIState {
  readyRounds: Partial<Record<EnemyMove, number>>;
  buffs: Array<{ type: "defense" | "attack" | "fade" | "flatten"; throughRound: number }>;
  lastMove?: EnemyMove;
}
export type CombatPhase =
  | "waiting"
  | "question"
  | "answer_feedback"
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
  consumables?: import('../campaign/consumables').ConsumableBag;
  itemProtections?: import('../campaign/consumables').ItemProtections;
  itemUsedRound?: number;
  /** Frozen effective ranks and effects; missing means a historical room with no AA. */
  advancement?: import('../aa').AAEffects;
  /** Persisted one-round roll; does not cure the underlying control effect. */
  agilityAttack?: { round: number; allowed: boolean };
  /** Server-only marker: answer recovery is prepared once before choices. */
  statusPreparedRound?: number;
  statuses?: CombatStatus[];
  recoveryCorrectAnswers?: number;
  controlImmuneThroughRound?: number;
  actionBlocked?: { round: number; reason: string; attacksOnly?: boolean };
  joinOrder?: number;
  questGuildId?: string | null;
  limitTier?: number;
  correctQuestionKeys?: string[];
  equipmentLoadout?: EquipmentLoadout;
  weaponKind?: string;
  equipmentVisuals?: import("../avatar/visuals").EquipmentVisuals;
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
  buffs: Record<string, { rounds: number; amount: number; hpAmount?: number }>;
  totals: CombatTotals;
}
export interface CombatEnemy {
  palette?: import("../avatar/visuals").SpritePalette;
  enemyType?: EnemyType;
  ai?: EnemyAI;
  aiState?: EnemyAIState;
  attackPower?: number;
  defense?: number;
  /** Absent in historical active rooms; present (including zero) in new fights. */
  magicDefense?: number;
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
    /** New DoTs tick on subsequent rounds; absent in historical saved effects. */
    appliedRound?: number;
  }>;
}
export interface CombatEvent {
  actionId?: string;
  abilityId?: string;
  effect?: import("./presentation").AttackEffect;
  healthBefore?: number;
  healthAfter?: number;
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
  /** Presentation only; absent in older saved rooms. */
  battleEnvironment?: "grassland" | "normal_cave";
  playback?: import("./presentation").PlaybackBatch;
  /** Server-only durable reporting outbox, removed after confirmed projection. */
  pendingAttempts?: import("./attempts").QuestionAttempt[];
  encounterRules?: 2;
  /** Effective tier locked at Start Fight; also marks full-reference HP scaling.
   * Absent in older active rooms, which retain their original tier/coefficient. */
  encounterTier?: number;
  autoAdvanceWaves?: boolean;
  activeWave?: number;
  encounterAttendance?: number;
  /** Full additive HP pool, before enemy-role allocation; absent in older running rooms. */
  encounterHpPool?: number;
  /** Entry estimates are retained across departures; absent hpWeight means pre-role-scaling rules. */
  entryPerformance?: Record<string,{damage:number;healing:number;health:number;mitigation:number;hpWeight?:number}>;
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
  soloHostId?: string;
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
  /** Sent only after the question is closed to submissions. */
  correctAnswer?: string;
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  timeLimit: number;
};
