import type { FightRecord, StudentRecord } from "./db/schema.ts";

export interface CombatPlayer {
  studentId: string;
  nickname: string;
  characterClass: NonNullable<StudentRecord["characterClass"]>;
  gender: NonNullable<StudentRecord["gender"]>;
  health: number;
  maxHealth: number;
  mp: number;
  maxMp: number;
  comboPoints: number;
  maxComboPoints: number;
  threat: number;
  isDead: boolean;
  hasAnswered: boolean;
  currentAnswer?: string;
  currentStreak: number;
  fireballChargeRounds: number;
  fireballCooldown: number;
  questionsAnswered: number;
  questionsCorrect: number;
  questionsIncorrect: number;
  damageDealt: number;
  damageBlocked: number;
  bonusDamage: number;
  healingDone: number;
  damageTaken: number;
  deaths: number;
  lastActionDamage: number;
  fightCount: number;
  lastUltimatesUsed: Record<string, number>;
  crossClassAbility1?: string;
  crossClassAbility2?: string;
}

export interface DurableCombatState {
  sessionId: string;
  fightId: string;
  teacherId: string;
  currentQuestionIndex: number;
  currentPhase: "waiting" | "question" | "abilities" | "game_over";
  players: Record<string, CombatPlayer>;
  enemies: Array<{ id: string; name: string; image: string; health: number; maxHealth: number }>;
  questionStartTime?: number;
  phaseStartTime?: number;
  questionOrder: number[];
  threatLeaderId?: string;
  isFirstQuestionOfSession: boolean;
}

const CLASS_HEALTH: Record<NonNullable<StudentRecord["characterClass"]>, number> = {
  warrior: 16,
  wizard: 7,
  scout: 7,
  herbalist: 11,
};

export function createCombatState(
  sessionId: string,
  fight: FightRecord,
): DurableCombatState {
  const questionOrder = Array.from({ length: fight.questions.length }, (_, index) => index);
  if (fight.randomizeQuestions) {
    for (let index = questionOrder.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [questionOrder[index], questionOrder[swap]] = [questionOrder[swap], questionOrder[index]];
    }
  }
  return {
    sessionId,
    fightId: fight.id,
    teacherId: fight.teacherId,
    currentQuestionIndex: 0,
    currentPhase: "waiting",
    players: {},
    enemies: fight.enemies.map((enemy) => {
      const maxHealth = Math.max(1, Math.round(enemy.difficultyMultiplier * 10));
      return { id: enemy.id, name: enemy.name, image: enemy.image, health: maxHealth, maxHealth };
    }),
    questionOrder,
    isFirstQuestionOfSession: true,
  };
}

export function addStudent(
  state: DurableCombatState,
  student: StudentRecord,
): DurableCombatState {
  if (state.players[student.id]) return state;
  if (!student.characterClass || !student.gender) {
    throw new Error("CHARACTER_REQUIRED");
  }
  const maxHealth = CLASS_HEALTH[student.characterClass];
  const maxMp = student.characterClass === "wizard" || student.characterClass === "herbalist" ? 6 : 0;
  return {
    ...state,
    players: {
      ...state.players,
      [student.id]: {
        studentId: student.id,
        nickname: student.nickname,
        characterClass: student.characterClass,
        gender: student.gender,
        health: maxHealth,
        maxHealth,
        mp: maxMp,
        maxMp,
        comboPoints: 0,
        maxComboPoints: student.characterClass === "scout" ? 4 : 0,
        threat: 1,
        isDead: false,
        hasAnswered: false,
        currentStreak: 0,
        fireballChargeRounds: 0,
        fireballCooldown: 0,
        questionsAnswered: 0,
        questionsCorrect: 0,
        questionsIncorrect: 0,
        damageDealt: 0,
        damageBlocked: 0,
        bonusDamage: 0,
        healingDone: 0,
        damageTaken: 0,
        deaths: 0,
        lastActionDamage: 0,
        fightCount: 0,
        lastUltimatesUsed: {},
      },
    },
  };
}

export function startQuestion(state: DurableCombatState, now = Date.now()): DurableCombatState {
  if (state.currentPhase !== "waiting") return state;
  const players = Object.fromEntries(Object.entries(state.players).map(([id, player]) => [
    id,
    { ...player, hasAnswered: false, currentAnswer: undefined },
  ]));
  return {
    ...state,
    currentPhase: "question",
    questionStartTime: now,
    phaseStartTime: now,
    players,
  };
}

export function applyAnswer(
  state: DurableCombatState,
  studentId: string,
  answer: string,
): { state: DurableCombatState; accepted: boolean; allAnswered: boolean } {
  const player = state.players[studentId];
  if (state.currentPhase !== "question" || !player || player.isDead || player.hasAnswered) {
    return { state, accepted: false, allAnswered: false };
  }
  const players = {
    ...state.players,
    [studentId]: {
      ...player,
      currentAnswer: answer,
      hasAnswered: true,
      questionsAnswered: player.questionsAnswered + 1,
    },
  };
  const alive = Object.values(players).filter((candidate) => !candidate.isDead);
  return {
    state: { ...state, players },
    accepted: true,
    allAnswered: alive.length > 0 && alive.every((candidate) => candidate.hasAnswered),
  };
}
