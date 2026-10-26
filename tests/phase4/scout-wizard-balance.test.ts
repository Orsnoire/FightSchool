import { advanceTo } from "./fixtures.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, initialCombatState, startQuestion, applyAnswer, selectAction, advancePhase } from "../../worker/combat/engine.ts";
import { fight, student, started } from "./fixtures.ts";
import type { CombatSnapshot } from "../../shared/combat/model.ts";
import { baseDamage } from "../../worker/combat/engine.ts";
import { abilityDamage } from "../../shared/combat/abilityValues.ts";
import { ABILITY_DISPLAYS } from "../../shared/abilityUI.ts";
import { referenceParty, performance } from "../../shared/combat/encounters.ts";
import { createLobbyPreview } from "../../client/src/features/lobby/preview.ts";

const id = student().id;
function round(state: CombatSnapshot, ability: string, answer: string | null = "4") {
  // A fixed non-critical roll isolates the approved damage curve from critical hits.
  state.seed = 1;
  let s = answer === null ? state : applyAnswer(state, id, answer, fight.questions[0]);
  if (answer !== null) s = selectAction(s, id, ability, "e1");
  s = advanceTo(s, "question_resolution");
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
      const ability = job === "scout" ? (p.comboPoints >= 3 ? "headshot" : "attack") : (p.mp >= 2 ? "fireball" : "attack");
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

test("missed and unanswered Scout questions clear CP, reset the streak, and cannot refund Headshot", () => {
  for (const answer of ["wrong", null]) {
    let s = durableFight("scout");
    s.players[id].comboPoints = 3;
    s.players[id].consecutiveCorrectAnswers = 8;
    s = round(s, "headshot", answer);
    assert.equal(s.players[id].comboPoints, 0);
    assert.equal(s.players[id].consecutiveCorrectAnswers, 0);
    assert.equal(s.players[id].totals.damageDealt, 0);
    for (let correct = 1; correct <= 3; correct++) {
      s = round(next(s), "attack");
      assert.equal(s.players[id].comboPoints, correct);
    }
    s = round(next(s), "headshot");
    assert.equal(s.players[id].totals.damageDealt, 17, "recovery requires three basic hits before an 8-damage Headshot");
    assert.equal(s.players[id].comboPoints, 2);
  }
  const empty = round(durableFight("scout"), "attack", "wrong");
  assert.equal(empty.players[id].comboPoints, 0);
});

test("Wizard starts at full derived MP; new fights reset streaks and older snapshots default safely", () => {
  assert.equal(started("wizard").players[id].mp, 6);
  assert.equal(started("wizard").players[id].maxMp, 6);
  assert.equal(started("priest").players[id].mp, 9);
  const odd = addStudent(initialCombatState("ODDMP", fight), student("wizard"), { levels: { wizard: 2 } }).players[id];
  assert.equal(odd.maxMp, 9);
  assert.equal(odd.mp, 9);
  assert.equal(started("scout").players[id].consecutiveCorrectAnswers, 0);
  const old = durableFight("scout");
  delete old.players[id].consecutiveCorrectAnswers;
  assert.equal(round(old, "attack").players[id].consecutiveCorrectAnswers, 1);
});

test("Wizard basic attacks use MAT plus INT in previews and resolved combat", () => {
  let s = durableFight("wizard");
  const p = s.players[id];
  assert.equal(baseDamage(p), 3, "starter staff MAT 1 plus base INT 2");
  p.stats.mat = 7;
  p.stats.int = 5;
  p.stats.atk = 100;
  assert.equal(abilityDamage(p, "attack"), 12);
  s = round(s, "attack");
  assert.equal(s.players[id].totals.damageDealt, 12);
});

test("Fireball costs two MP for Wizard and cross-class users, including affordability", () => {
  for (const job of ["wizard", "priest"] as const) {
    let s = startQuestion(addStudent(initialCombatState("FIREBALL", fight), student(job), {
      levels: { wizard: 8, priest: 1 }, crossClass: job === "priest" ? ["fireball_crossclass"] : [],
    }));
    s.enemies[0].health = s.enemies[0].maxHealth = 1000;
    s = applyAnswer(s, id, "4", fight.questions[0]);
    s.players[id].mp = 1;
    assert.throws(() => selectAction(s, id, "fireball", "e1"), /MP/);
    s.players[id].mp = 2;
    s = advanceTo(selectAction(s, id, "fireball", "e1"), "question_resolution");
    assert.equal(s.players[id].mp, 0);
    assert.equal(s.players[id].totals.damageDealt, 3 * s.players[id].stats.int);
  }
  for (const key of ["fireball", "fireball_crossclass"]) {
    assert.equal(ABILITY_DISPLAYS[key].mpCost, 2);
    assert.match(ABILITY_DISPLAYS[key].description, /2 MP/);
  }
});

test("lobby and reference Wizards start at full MP and Fireblast spends its entire reference reserve once", () => {
  const preview = createLobbyPreview(student("wizard") as Parameters<typeof createLobbyPreview>[0], [], []);
  assert.equal(preview.previewPlayer.mp, 6);
  for (const tier of [1, 2, 3, 4]) {
    const p = referenceParty(tier).find(p => p.characterClass === "wizard")!;
    assert.equal(p.mp, p.stats.maxMp);
    assert.equal(p.mp, 3 * (p.stats.int + p.stats.mnd));
  }
  const p = referenceParty(4).find(p => p.characterClass === "wizard")!;
  const before = structuredClone(p);
  const blast = p.stats.int * p.mp * 3;
  assert.equal(performance(p, 1).damage, blast);
  assert.equal(performance(p, 30).damage, blast + 29 * baseDamage(p));
  assert.deepEqual(p, before, "reference simulation does not spend actual player MP");
});

test("equipped cross-class Headshot shares its formula; every class loses all unprotected CP on a miss", () => {
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
  assert.equal(round(s, "headshot", "wrong").players[id].comboPoints, 0);
  const ranger = started("ranger");
  ranger.players[id].comboPoints = 3;
  assert.equal(round(ranger, "attack", "wrong").players[id].comboPoints, 0);
});
