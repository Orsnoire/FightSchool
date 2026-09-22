import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addStudent,
  advanceAfterQuestion,
  allLivingPlayersAnswered,
  applyAnswer,
  initialCombatState,
  startQuestion,
} from "../../worker/combat/engine.ts";
import type { FightRecord, StudentRecord } from "../../worker/db/schema.ts";

const fight = {
  id: "00000000-0000-4000-8000-000000000001",
  teacherId: "00000000-0000-4000-8000-000000000002",
  title: "Integer review",
  guildCode: null,
  questions: [
    { id: "q1", type: "short_answer", question: "2 + 2", correctAnswer: "4", timeLimit: 30 },
    { id: "q2", type: "true_false", question: "5 is prime", correctAnswer: "true", timeLimit: 30 },
  ],
  enemies: [{ id: "e1", name: "Practice Dummy", image: "", difficultyMultiplier: 1 }],
  baseXP: 10,
  baseEnemyDamage: 1,
  enemyDisplayMode: "consecutive",
  lootTable: [],
  randomizeQuestions: false,
  shuffleOptions: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies FightRecord;

const student = {
  id: "00000000-0000-4000-8000-000000000003",
  nickname: "Aster",
  nicknameNormalized: "aster",
  passwordHash: "not-used",
  characterClass: "wizard",
  gender: "A",
  guildCode: null,
  createdAt: new Date(0),
} satisfies StudentRecord;

test("answer mutation is deterministic and keeps identity server-selected", () => {
  let state = initialCombatState("ABC234", fight, 100);
  state = addStudent(state, student);
  state = startQuestion(state, 200);
  state = applyAnswer(state, student.id, " 4 ", fight.questions[0]);
  assert.equal(state.players[student.id].currentAnswer, " 4 ");
  assert.equal(state.players[student.id].hasAnswered, true);
  assert.equal(state.players[student.id].lastAnswerCorrect, true);
  assert.equal(allLivingPlayersAnswered(state), true);
});

test("duplicate and late answers do not mutate authoritative state", () => {
  let state = startQuestion(addStudent(initialCombatState("ABC234", fight), student));
  const first = applyAnswer(state, student.id, "4", fight.questions[0]);
  assert.deepEqual(applyAnswer(first, student.id, "wrong", fight.questions[0]), first);
  const ended = advanceAfterQuestion(advanceAfterQuestion(first, fight.questions), fight.questions);
  assert.equal(ended.currentPhase, "game_over");
  assert.deepEqual(applyAnswer(ended, student.id, "4", fight.questions[0]), ended);
});

test("question advance resets per-question answer state", () => {
  let state = startQuestion(addStudent(initialCombatState("ABC234", fight), student));
  state = applyAnswer(state, student.id, "4", fight.questions[0]);
  state = advanceAfterQuestion(state, fight.questions, 300);
  assert.equal(state.currentQuestionIndex, 1);
  assert.equal(state.players[student.id].hasAnswered, false);
  assert.equal(state.players[student.id].currentAnswer, null);
});
