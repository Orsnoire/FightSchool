import assert from "node:assert/strict";
import { test } from "node:test";
import { PASCAL_TEMPLATES, drawQuizQuestions, pascalVariants, planQuiz, selectedTemplates } from "../../shared/math/templates/pascal";
import { estimatedQuizSeconds } from "../../shared/combat/round-timing";
import { allocateQuizHP, performance, referenceRotationDamage } from "../../shared/combat/encounters";
import { createCombatRoom } from "../../worker/combat/room-state";
import { addStudent, advancePhase, applyAnswer, scaleEncounter, startQuestion } from "../../worker/combat/engine";
import { snapshotMessage } from "../../worker/combat/room-messages";
import { masteryQuestionKey, questionKey } from "../../worker/progression/question-key";
import { fight, student } from "./fixtures";

test("all three Pascal families match independent repeated polynomial multiplication", () => {
  for (const template of PASCAL_TEMPLATES) {
    const pool = pascalVariants(template.id);
    assert.equal(pool.length, template.id === "scaled-binomial-v1" ? 160 : 28);
    assert.equal(new Set(pool.map(q => q.question)).size, pool.length);
    for (const q of pool) {
      let n: number, k: number, a = 1, b = 1;
      if (template.id === "pascal-row-v1") {
        const match = /row (\d+).*entry (\d+) from/.exec(q.question)!;
        n = Number(match[1]); k = Number(match[2]) - 1;
      } else {
        const term = /coefficient of \\\(x(?:\^\{(\d+)\})?y(?:\^\{(\d+)\})?/.exec(q.question)!;
        const base = /\((\d*)x([+-])(\d*)y\)\^\{(\d+)\}/.exec(q.question)!;
        n = Number(base[4]); k = Number(term[2] || 1);
        assert.equal(Number(term[1] || 1) + k, n);
        a = Number(base[1] || 1); b = Number(base[3] || 1) * (base[2] === "-" ? -1 : 1);
        assert.equal(a === 1 && b === 1, template.id === "binomial-coefficient-v1");
      }
      let coefficients = [1];
      for (let i = 0; i < n; i++) {
        const next = Array(coefficients.length + 1).fill(0);
        coefficients.forEach((value, j) => { next[j] += a * value; next[j + 1] += b * value; });
        coefficients = next;
      }
      assert.equal(q.correctAnswer, String(coefficients[k]));
    }
  }
});

test("rounds, selected skills, timers and fixed questions survive save/edit, draw and pool exhaustion", () => {
  const specs = PASCAL_TEMPLATES.map(({ id, timeLimit }) => ({ id, timeLimit }));
  const deck = planQuiz(fight.questions, specs, 10);
  assert.deepEqual(selectedTemplates(deck), specs);
  assert.deepEqual(deck, planQuiz(fight.questions, selectedTemplates(deck), deck.length));
  assert.deepEqual(deck.filter(q => !q.quizTemplate), fight.questions);
  assert.equal(new Set(deck.map(q => q.id)).size, 10);
  assert.equal(estimatedQuizSeconds(deck), 30 + 3 * (30 + 45 + 60) + 10 * (3 + 4 + 20 + 20 + 30));
  const longDeck = planQuiz([], [specs[0]], 60);
  const drawn = drawQuizQuestions(longDeck, "A");
  assert.deepEqual(drawn, drawQuizQuestions(longDeck, "A"));
  assert.notDeepEqual(drawn, drawQuizQuestions(longDeck, "B"));
  for (const start of [0, 28]) assert.equal(new Set(drawn.slice(start, start + 28).map(q => q.question)).size, 28);
});

test("rooms freeze quiz variants, conceal keys and record the exact attempt while preserving mastery", () => {
  const source = { ...fight, questions: planQuiz([], [PASCAL_TEMPLATES[0]], 8) };
  const room = createCombatRoom(source, "pascal");
  const saved = structuredClone(room.fight.questions);
  room.snapshot = startQuestion(addStudent(room.snapshot, student()));
  const q = room.fight.questions[0];
  const who = Object.keys(room.snapshot.players)[0];
  assert.equal(masteryQuestionKey(q), masteryQuestionKey(source.questions[0]));
  assert.equal(snapshotMessage(room).question?.correctAnswer, undefined);
  assert.equal(applyAnswer(room.snapshot, who, String(+q.correctAnswer + 1), q).players[who].lastAnswerCorrect, false);
  const answered = applyAnswer(room.snapshot, who, " +0" + q.correctAnswer + " ", q);
  assert.equal(answered.players[who].lastAnswerCorrect, true);
  assert.equal(answered.pendingAttempts?.[0].questionVersion, questionKey(q));
  assert.deepEqual(snapshotMessage(JSON.parse(JSON.stringify(room))).question, snapshotMessage(room).question);
  assert.deepEqual(room.fight.questions, saved);
  const feedback = advancePhase(answered, room.fight);
  assert.equal(snapshotMessage({ ...room, snapshot: feedback }).question?.correctAnswer, q.correctAnswer);
});

test("projected damage over target rounds reaches actual enemy HP in lobby, at start and on later admission", () => {
  for (const rounds of [3, 12]) for (const attendance of [1, 2, 4, 12]) {
    const source = { ...fight, encounterTier: 1, questions: planQuiz([], [PASCAL_TEMPLATES[1]], rounds),
      enemies: [{ ...fight.enemies[0], role: "normal" as const, quantity: 3 }] };
    const room = createCombatRoom(source, "pascal");
    for (let i = 0; i < attendance; i++) room.snapshot = addStudent(room.snapshot, student("wizard", "s" + i));
    const lobby = snapshotMessage(room).state;
    const started = scaleEncounter(room.snapshot, room.fight);
    const damage = attendance <= 2 ? Object.values(room.snapshot.players).reduce((s, p) => s + performance(p, rounds).damage, 0)
      : referenceRotationDamage(started.encounterTier!, rounds) * attendance / 4;
    assert.equal(started.encounterHpPool, Math.max(3, Math.floor(damage)));
    assert.equal(started.enemies.reduce((s, e) => s + e.maxHealth, 0), started.encounterHpPool);
    assert.deepEqual(lobby.enemies.map(e => e.maxHealth), started.enemies.map(e => e.maxHealth));
    assert.deepEqual(allocateQuizHP(started.enemies, 0).map(e => e.maxHealth), [1, 1, 1]);
    const active = startQuestion(started);
    active.currentPhase = "enemy_ai";
    active.enemies[0].health = 0;
    const next = advancePhase(addStudent(active, student("wizard", "late")), room.fight);
    assert.equal(next.enemies[0].health, 0);
    assert.equal(next.enemies.reduce((s, e) => s + e.maxHealth, 0), next.encounterHpPool);
  }
});
