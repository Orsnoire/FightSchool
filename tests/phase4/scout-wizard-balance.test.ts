import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, initialCombatState, startQuestion, applyAnswer, selectAction, advancePhase } from "../../worker/combat/engine.ts";
import { fight, student, started } from "./fixtures.ts";
import type { CombatSnapshot } from "../../shared/combat/model.ts";

const id = student().id;
function round(state: CombatSnapshot, ability: string, answer: string | null = "4") {
  // A fixed non-critical roll isolates the approved damage curve from critical hits.
  state.seed = 1;
  let s = answer === null ? state : applyAnswer(state, id, answer, fight.questions[0]);
  if (answer !== null) s = selectAction(s, id, ability, "e1");
  s = advancePhase(advancePhase(s, fight), fight);
  return JSON.parse(JSON.stringify(s)) as CombatSnapshot;
}
const next = (s: CombatSnapshot) => advancePhase(advancePhase(s, fight), fight);
function durableFight(job: "scout" | "wizard") {
  const s = started(job);
  s.enemies[0].health = s.enemies[0].maxHealth = 10000;
  s.players[id].health = s.players[id].maxHealth = 1000;
  return s;
}

test("starter Scout overtakes Wizard on question six and clears the 1.25x minimum by question eight", () => {
  const totals: Record<string, number[]> = { scout: [], wizard: [] };
  for (const job of ["scout", "wizard"] as const) {
    let s = durableFight(job);
    for (let question = 1; question <= 10; question++) {
      const p = s.players[id];
      const ability = job === "scout" ? (p.comboPoints >= 3 ? "headshot" : "attack") : (p.mp > 0 ? "fireball" : "attack");
      s = round(s, ability);
      totals[job].push(s.players[id].totals.damageDealt);
      assert.equal(s.players[id].consecutiveCorrectAnswers, question);
      if (job === "scout" && ability === "headshot") assert.equal(s.players[id].comboPoints, 2, "Headshot returns two CP total, not three");
      s = next(s);
    }
  }
  assert.deepEqual(totals.scout, [3, 6, 9, 17, 20, 29, 32, 42, 45, 56]);
  assert.deepEqual(totals.wizard, [6, 12, 18, 21, 24, 27, 30, 33, 36, 39]);
  assert.equal(totals.scout.findIndex((n, i) => n > totals.wizard[i]) + 1, 6);
  assert.equal(totals.scout.findIndex((n, i) => n >= 1.25 * totals.wizard[i]) + 1, 8);
  assert.ok(totals.scout[9] >= 1.25 * totals.wizard[9]);
});

test("missed and unanswered Scout questions lose only one CP, reset the streak, and cannot refund Headshot", () => {
  for (const answer of ["wrong", null]) {
    let s = durableFight("scout");
    s.players[id].comboPoints = 3;
    s.players[id].consecutiveCorrectAnswers = 8;
    s = round(s, "headshot", answer);
    assert.equal(s.players[id].comboPoints, 2);
    assert.equal(s.players[id].consecutiveCorrectAnswers, 0);
    assert.equal(s.players[id].totals.damageDealt, 0);
    s = round(next(s), "attack");
    assert.equal(s.players[id].comboPoints, 3);
    s = round(next(s), "headshot");
    assert.equal(s.players[id].totals.damageDealt, 10, "recovery is a 3-damage attack followed by a 7-damage Headshot");
    assert.equal(s.players[id].comboPoints, 2);
  }
  const empty = round(durableFight("scout"), "attack", "wrong");
  assert.equal(empty.players[id].comboPoints, 0);
});

test("only Wizard starts at half MP; new fights reset streaks and older saved snapshots default safely", () => {
  assert.equal(started("wizard").players[id].mp, 3);
  assert.equal(started("wizard").players[id].maxMp, 6);
  assert.equal(started("priest").players[id].mp, 9);
  const odd = addStudent(initialCombatState("ODDMP", fight), student("wizard"), { levels: { wizard: 2 } }).players[id];
  assert.equal(odd.maxMp, 9);
  assert.equal(odd.mp, 4);
  assert.equal(started("scout").players[id].consecutiveCorrectAnswers, 0);
  const old = durableFight("scout");
  delete old.players[id].consecutiveCorrectAnswers;
  assert.equal(round(old, "attack").players[id].consecutiveCorrectAnswers, 1);
});

test("equipped cross-class Headshot shares its formula and miss penalty without changing other combo jobs", () => {
  let s = startQuestion(addStudent(initialCombatState("CROSS", fight), student("warrior"), {
    levels: { warrior: 1, scout: 8 }, crossClass: ["headshot_crossclass"],
  }));
  const p = s.players[id];
  assert.ok(p.availableAbilities.includes("headshot"));
  p.comboPoints = p.maxComboPoints = 4;
  p.stats.rtk = 2;
  p.stats.agi = 3;
  p.consecutiveCorrectAnswers = 4;
  s.enemies[0].health = 1000;
  const hit = round(s, "headshot");
  assert.equal(hit.players[id].totals.damageDealt, 12, "equipment scales the base; half-point totals round down");
  assert.equal(hit.players[id].comboPoints, 3);
  assert.equal(round(s, "headshot", "wrong").players[id].comboPoints, 3);
  const ranger = started("ranger");
  ranger.players[id].comboPoints = 3;
  assert.equal(round(ranger, "attack", "wrong").players[id].comboPoints, 3);
});
