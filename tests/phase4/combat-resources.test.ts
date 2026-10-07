import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, initialCombatState, startQuestion, applyAnswer, selectAction, advancePhase } from "../../worker/combat/engine.ts";
import { selectionProblem } from "../../shared/combat/abilities.ts";
import { fight, student } from "./fixtures.ts";
import type { CharacterClass } from "../../shared/schema.ts";
const id = student().id;
function answered(job: CharacterClass, level = 1, answer = "4") {
  let s = startQuestion(addStudent(initialCombatState("ABC234", fight, 0), student(job), { levels: { [job]: level } }), 100);
  s.enemies[0].health = s.enemies[0].maxHealth = 10000;
  return applyAnswer(s, id, answer, fight.questions[0]);
}
const resolve = (s: ReturnType<typeof answered>) => advancePhase(advancePhase(advancePhase(s, fight, 150), fight, 200), fight, 300);

test("Fireball queues without spending, spends exactly one MP on a correct answer, and survives storage", () => {
  const s = answered("wizard");
  const mp = s.players[id].mp;
  const selected = selectAction(s, id, "fireball", "e1");
  assert.equal(selected.players[id].mp, mp);
  const resolved = resolve(JSON.parse(JSON.stringify(selected)));
  assert.equal(resolved.players[id].mp, mp - 1);
  assert.equal(resolved.players[id].totals.damageDealt, s.players[id].stats.int * 3);
  assert.equal(advancePhase(resolved, fight, 400).players[id].mp, mp - 1);
  assert.equal(s.players[id].questionAction?.ability, "attack");
});
test("wrong-answer question actions do not spend MP or potions or craft potions", () => {
  for (const [job, action] of [["wizard", "fireball"], ["herbalist", "healing_potion"], ["herbalist", "craft_healing_potion"]] as const) {
    let s = answered(job, 4, "wrong");
    s.players[id].healingPotions = 2;
    const before = { mp: s.players[id].mp, potions: s.players[id].healingPotions };
    s = resolve(selectAction(s, id, action, job === "herbalist" ? id : "e1"));
    assert.equal(s.players[id].mp, before.mp);
    assert.equal(s.players[id].healingPotions, before.potions);
  }
});
test("Fireblast consumes all MP and cannot be queued with a competing Frost Bolt", () => {
  let s = answered("wizard", 12);
  s.players[id].mp = 1;
  s = selectAction(s, id, "fireblast", "e1");
  s = advancePhase(advancePhase(s, fight, 150), fight, 200);
  assert.throws(() => selectAction(s, id, "frostbolt", "e1"), /MP reserved/);
  s = advancePhase(s, fight, 300);
  assert.equal(s.players[id].mp, 0);
  assert.equal(s.players[id].totals.damageDealt, s.players[id].stats.int * 3);
});
test("Frost Bolt spends one MP, while replacing a question choice does not charge twice", () => {
  let s = answered("wizard", 4);
  const mp = s.players[id].mp;
  s = selectAction(s, id, "fireball", "e1");
  s = selectAction(s, id, "attack", "e1");
  s = advancePhase(advancePhase(s, fight, 150), fight, 200);
  s = selectAction(s, id, "frostbolt", "e1");
  s = advancePhase(s, fight, 300);
  assert.equal(s.players[id].mp, mp - 1);
});
test("healing potions are consumed once; crafting respects bonuses and the cap", () => {
  let s = answered("herbalist", 6);
  s.players[id].health -= 3;
  s = resolve(selectAction(s, id, "healing_potion", id));
  assert.equal(s.players[id].healingPotions, 4);
  assert.ok(s.players[id].totals.healingDone > 0);
  for (const [count, expected] of [[0, 1], [1, 3], [4, 5]]) {
    let c = answered("herbalist", 6);
    c.players[id].healingPotions = count;
    c = resolve(selectAction(c, id, "craft_healing_potion", id));
    assert.equal(c.players[id].healingPotions, expected);
  }
});
test("full inventories reject crafting without wasting a question action", () => {
  const s = answered("herbalist", 10);
  assert.throws(() => selectAction(s, id, "craft_healing_potion", id), /full/);
  s.players[id].shieldPotions = 3;
  assert.throws(() => selectAction(s, id, "craft_shield_potion", id), /full/);
});
test("shield potions craft up to three, then one is spent to protect the target", () => {
  let s = answered("herbalist", 10);
  s.players[id].shieldPotions = 2;
  s = resolve(selectAction(s, id, "craft_shield_potion", id));
  assert.equal(s.players[id].shieldPotions, 3);
  let use = advancePhase(advancePhase(answered("herbalist", 10), fight, 150), fight, 200);
  use.players[id].shieldPotions = 1;
  use = advancePhase(selectAction(use, id, "shield_potion", id), fight, 300);
  assert.equal(use.players[id].shieldPotions, 0);
  assert.ok(use.players[id].buffs.shield);
});
test("the last healing potion cannot fund both a question heal and a diffuser", () => {
  let s = answered("herbalist", 12);
  s.players[id].healingPotions = 1;
  s = selectAction(s, id, "healing_potion", id);
  s = advancePhase(advancePhase(s, fight, 150), fight, 200);
  assert.throws(() => selectAction(s, id, "potion_diffuser", id), /Healing potions reserved/);
  s.players[id].healingPotions = 0;
  assert.equal(selectionProblem(s.players[id], "potion_diffuser"), "No healing potions");
});
test("support actions share a budget and resolution events identify their phase", () => {
  let s = advancePhase(advancePhase(answered("priest", 15), fight, 150), fight, 200);
  s.players[id].mp = 5;
  s = selectAction(s, id, "purify", id);
  assert.throws(() => selectAction(s, id, "divine_grace", id), /MP reserved/);
  s = advancePhase(s, fight, 300);
  assert.ok(s.events.every((e) => e.phase === "question_resolution"));
  s = advancePhase(s, fight, 400);
  assert.ok(s.events.some((e) => e.phase === "enemy_ai"));
});

test("a failed question action releases its reservation for support spells", () => {
  let s = answered("wizard", 12, "wrong");
  s.players[id].mp = 1;
  s = selectAction(s, id, "fireblast", "e1");
  s = advancePhase(advancePhase(s, fight, 150), fight, 200);
  s = selectAction(s, id, "frostbolt", "e1");
  s = advancePhase(s, fight, 300);
  assert.equal(s.players[id].mp, 0);
  assert.equal(s.players[id].totals.damageDealt, s.players[id].stats.int);
});
