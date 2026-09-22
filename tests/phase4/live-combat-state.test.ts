import assert from "node:assert/strict";
import test from "node:test";
import { addStudent, applyAnswer, createCombatState, startQuestion } from "../../worker/combat-state.ts";

const question = {
  id: "q1",
  type: "multiple_choice" as const,
  question: "2 + 2?",
  options: ["3", "4"],
  correctAnswer: "4",
  timeLimit: 30,
};

const fight = {
  id: "00000000-0000-4000-8000-000000000001",
  teacherId: "00000000-0000-4000-8000-000000000002",
  title: "Milestone",
  guildCode: null,
  questions: [question],
  enemies: [{ id: "e1", name: "Slime", image: "/objects/slime.png", difficultyMultiplier: 1 }],
  baseXP: 10,
  baseEnemyDamage: 1,
  enemyDisplayMode: "consecutive",
  lootTable: [],
  randomizeQuestions: false,
  shuffleOptions: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const student = {
  id: "00000000-0000-4000-8000-000000000003",
  nickname: "Scholar",
  nicknameNormalized: "scholar",
  passwordHash: "unused",
  characterClass: "wizard",
  gender: "A",
  guildCode: null,
  createdAt: new Date(0),
};

test("first answer atomically mutates only the authenticated player", () => {
  let state = createCombatState("ABC234", fight);
  state = addStudent(state, student);
  state = startQuestion(state, 1000);
  state = applyAnswer(state, student.id, "4", question);
  assert.equal(state.players[student.id].currentAnswer, "4");
  assert.equal(state.players[student.id].hasAnswered, true);
});

test("retries, late answers, and client-supplied identities cannot apply twice", () => {
  let state = startQuestion(addStudent(createCombatState("ABC234", fight), student), 1000);
  state = applyAnswer(state, student.id, "4", question);
  assert.equal(applyAnswer(state, student.id, "different", question), state);
  assert.equal(applyAnswer(state, "00000000-0000-4000-8000-999999999999", "4", question), state);
});
