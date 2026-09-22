import assert from "node:assert/strict";
import test from "node:test";
import { addStudent, applyAnswer, createCombatState, startQuestion } from "../../worker/combat-state.ts";

const fight = {
  id: "00000000-0000-4000-8000-000000000001",
  teacherId: "00000000-0000-4000-8000-000000000002",
  title: "Milestone",
  guildCode: null,
  questions: [{
    id: "q1",
    type: "multiple_choice" as const,
    question: "2 + 2?",
    options: ["3", "4"],
    correctAnswer: "4",
    timeLimit: 30,
  }],
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
  characterClass: "wizard" as const,
  gender: "A" as const,
  guildCode: null,
  createdAt: new Date(0),
};

test("first answer atomically mutates only the authenticated player", () => {
  let state = createCombatState("ABC234", fight);
  state = addStudent(state, student);
  state = startQuestion(state, 1000);
  const result = applyAnswer(state, student.id, "4");
  assert.equal(result.accepted, true);
  assert.equal(result.allAnswered, true);
  assert.equal(result.state.players[student.id].currentAnswer, "4");
  assert.equal(result.state.players[student.id].hasAnswered, true);
});

test("retries, late answers, and client-supplied identities cannot apply twice", () => {
  let state = startQuestion(addStudent(createCombatState("ABC234", fight), student), 1000);
  state = applyAnswer(state, student.id, "4").state;
  const retry = applyAnswer(state, student.id, "different");
  assert.equal(retry.accepted, false);
  assert.equal(retry.state.players[student.id].currentAnswer, "4");
  const stranger = applyAnswer(state, "00000000-0000-4000-8000-999999999999", "4");
  assert.equal(stranger.accepted, false);
});
