import type { CharacterClass } from "../../shared/schema.ts";
import type { FightRecord, StudentRecord } from "../../worker/db/schema.ts";
import {
  addStudent,
  initialCombatState,
  startQuestion,
} from "../../worker/combat/engine.ts";
export const fight = {
  id: "00000000-0000-4000-8000-000000000001",
  teacherId: "00000000-0000-4000-8000-000000000002",
  title: "Review",
  guildCode: null,
  questions: [
    {
      id: "q1",
      type: "short_answer",
      question: "2+2",
      correctAnswer: "4",
      timeLimit: 30,
    },
  ],
  enemies: [{ id: "e1", name: "Slime", image: "", difficultyMultiplier: 1 }],
  baseXP: 10,
  baseEnemyDamage: 3,
  enemyDisplayMode: "consecutive",
  lootTable: [],
  randomizeQuestions: false,
  shuffleOptions: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} as FightRecord;
export const student = (
  job: CharacterClass = "warrior",
  id = "00000000-0000-4000-8000-000000000003",
) =>
  ({
    id,
    nickname: job,
    nicknameNormalized: job,
    passwordHash: "unused",
    characterClass: job,
    gender: "A",
    guildCode: null,
    guildId: null,
    weapon: null,
    headgear: null,
    armor: null,
    crossClassAbility1: null,
    crossClassAbility2: null,
    inventory: [],
    gold: 0,
    createdAt: new Date(0),
  }) as StudentRecord;
export const started = (job: CharacterClass = "warrior") =>
  startQuestion(
    addStudent(initialCombatState("ABC234", fight, 0), student(job)),
    100,
    30,
  );
