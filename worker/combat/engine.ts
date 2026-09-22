import type { FightEnemy, FightQuestion, FightRecord, StudentRecord } from "../db/schema.ts";

export type CombatPhase = "waiting" | "question" | "game_over";

export interface CombatPlayer {
  studentId: string;
  nickname: string;
  characterClass: string;
  gender: string;
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
}

export interface CombatEnemy extends FightEnemy {
  health: number;
  maxHealth: number;
}

export interface CombatSnapshot {
  sessionId: string;
  fightId: string;
  currentQuestionIndex: number;
  currentPhase: CombatPhase;
  players: Record<string, CombatPlayer>;
  enemies: CombatEnemy[];
  questionStartTime: number | null;
  phaseStartTime: number;
  threatLeaderId: string | null;
}

export function initialCombatState(sessionId: string, fight: FightRecord, now = Date.now()): CombatSnapshot {
  return {
    sessionId,
    fightId: fight.id,
    currentQuestionIndex: 0,
    currentPhase: "waiting",
    players: {},
    enemies: fight.enemies.map(enemy => {
      const maxHealth = Math.max(1, Math.round(10 * enemy.difficultyMultiplier));
      return { ...enemy, health: maxHealth, maxHealth };
    }),
    questionStartTime: null,
    phaseStartTime: now,
    threatLeaderId: null,
  };
}

export function addStudent(state: CombatSnapshot, student: StudentRecord): CombatSnapshot {
  if (state.players[student.id]) return state;
  return {
    ...state,
    players: {
      ...state.players,
      [student.id]: {
        studentId: student.id,
        nickname: student.nickname,
        characterClass: student.characterClass || "warrior",
        gender: student.gender || "A",
        health: 10,
        maxHealth: 10,
        mp: 0,
        maxMp: 0,
        comboPoints: 0,
        maxComboPoints: 0,
        threat: 0,
        isDead: false,
        hasAnswered: false,
        currentAnswer: null,
      },
    },
  };
}

export function startQuestion(state: CombatSnapshot, now = Date.now()): CombatSnapshot {
  if (state.currentPhase !== "waiting") return state;
  return {
    ...state,
    currentPhase: "question",
    questionStartTime: now,
    phaseStartTime: now,
  };
}

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function applyAnswer(
  state: CombatSnapshot,
  studentId: string,
  answer: string,
  question: FightQuestion,
): CombatSnapshot {
  if (state.currentPhase !== "question") return state;
  const player = state.players[studentId];
  if (!player || player.isDead || player.hasAnswered) return state;
  const correct = normalized(answer) === normalized(question.correctAnswer);
  return {
    ...state,
    players: {
      ...state.players,
      [studentId]: {
        ...player,
        currentAnswer: answer,
        hasAnswered: true,
        lastAnswerCorrect: correct,
        threat: player.threat + (correct ? 1 : 0),
      },
    },
  };
}

export function allLivingPlayersAnswered(state: CombatSnapshot): boolean {
  const living = Object.values(state.players).filter(player => !player.isDead);
  return living.length > 0 && living.every(player => player.hasAnswered);
}

export function advanceAfterQuestion(
  state: CombatSnapshot,
  questions: FightQuestion[],
  now = Date.now(),
): CombatSnapshot {
  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex >= questions.length) {
    return { ...state, currentPhase: "game_over", phaseStartTime: now };
  }
  return {
    ...state,
    currentQuestionIndex: nextIndex,
    currentPhase: "question",
    questionStartTime: now,
    phaseStartTime: now,
    players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [
      id,
      { ...player, hasAnswered: false, currentAnswer: null },
    ])),
  };
}
