import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, initialCombatState, startQuestion, applyAnswer, selectAction, advancePhase, resurrectPlayer, scaleEncounter, baseDamage, upgradePriestActions } from "../../worker/combat/engine.ts";
import { availableAbilities, abilityProblem, actionCost, hasOffensiveAbility } from "../../shared/combat/abilities.ts";
import { fight, student, started } from "./fixtures.ts";
const id = student().id;
const resolve = (s: ReturnType<typeof started>) => advancePhase(advancePhase(advancePhase(s, fight), fight), fight);

test("Priest replaces Attack at all levels while Mend and other jobs retain their behavior", () => {
  for (const level of [1, 8, 15]) {
    const abilities = availableAbilities("priest", { priest: level });
    assert.ok(abilities.includes("first_aid") && abilities.includes("mend"));
    assert.equal(abilities.includes("attack"), false);
    assert.equal(hasOffensiveAbility(abilities), false);
  }
  assert.ok(availableAbilities("paladin", { paladin: 1 }).includes("attack"));
  assert.ok(availableAbilities("warrior", { warrior: 1, priest: 8 }, ["mend_crossclass"]).includes("attack"));
  assert.equal(availableAbilities("warrior", { warrior: 1, priest: 8 }, ["mend_crossclass"]).includes("first_aid"), false);
  const p = started("priest").players[id];
  assert.equal(abilityProblem(p, "attack"), "Priests use First Aid instead of Attack");
  assert.deepEqual(actionCost(p, "first_aid"), {mp: 0, combo: 0, healing: 0, shield: 0});
});

test("First Aid heals one third of Mend, rounds down with minimum one, costs nothing and records only actual healing", () => {
  for (const mnd of [1, 2, 3, 5, 6, 8, 12]) for (const missing of [0, 1, 9]) {
    let s = started("priest");
    s.players.ally = {...structuredClone(s.players[id]), studentId: "ally"};
    s.players[id].stats.mnd = mnd;
    s.players[id].mp = 0;
    Object.assign(s.players.ally, {maxHealth: 20, health: 20 - missing, hasAnswered: true,
      lastAnswerCorrect: true, availableAbilities: ["craft_healing_potion"], healingPotions: 0,
      questionAction: {ability: "craft_healing_potion", targetId: "ally"}});
    s = applyAnswer(s, id, "4", fight.questions[0]);
    assert.deepEqual(s.players[id].questionAction, {ability: "first_aid", targetId: id});
    s = selectAction(s, id, "first_aid", "ally");
    const before = structuredClone(s);
    s = resolve(JSON.parse(JSON.stringify(s)));
    const expected = Math.min(missing, Math.max(1, Math.floor(mnd / 3)));
    assert.equal(s.players.ally.health - before.players.ally.health, expected);
    assert.equal(s.players[id].totals.healingDone, expected);
    assert.equal(s.players[id].threat, expected);
    assert.equal(s.players[id].mp, 0);
    assert.equal(s.players[id].totals.damageDealt, 0);
    assert.equal(s.enemies[0].health, before.enemies[0].health);
    assert.equal(s.players[id].healingPotions, 5);
  }
  let mend = started("priest");
  mend.players[id].health--;
  const mp = mend.players[id].mp;
  mend = applyAnswer(mend, id, "4", fight.questions[0]);
  mend = resolve(selectAction(mend, id, "mend", id));
  assert.equal(mend.players[id].mp, mp - 1);
  assert.equal(mend.players[id].totals.healingDone, 1);
});

test("First Aid requires correct answers and living allies; missing choices, timeouts and resurrection cannot attack", () => {
  let s = started("priest");
  s.players[id].health--;
  s = applyAnswer(s, id, "4", fight.questions[0]);
  assert.throws(() => selectAction(s, id, "first_aid", "e1"), /living ally/);
  assert.throws(() => selectAction(s, id, "first_aid", "missing"), /living ally/);
  assert.throws(() => selectAction(s, id, "attack", "e1"), /Priests use First Aid/);
  s.players.dead = {...structuredClone(s.players[id]), studentId: "dead", isDead: true, health: 0};
  assert.throws(() => selectAction(s, id, "first_aid", "dead"), /living ally/);
  const healed = resolve(s);
  assert.equal(healed.players[id].totals.healingDone, 1);
  assert.equal(healed.players.dead.health, 0);
  for (const answer of ["wrong", null]) {
    let missed = started("priest");
    missed.players[id].health--;
    if (answer) missed = applyAnswer(missed, id, answer, fight.questions[0]);
    missed = resolve(missed);
    assert.equal(missed.players[id].questionAction?.ability, "first_aid");
    assert.equal(missed.players[id].totals.healingDone, 0);
    assert.equal(missed.players[id].totals.damageDealt, 0);
    assert.equal(missed.players[id].totals.questionsIncorrect, 1);
    assert.ok(missed.players[id].totals.damageTaken > 0);
  }
  s.currentPhase = "actions";
  Object.assign(s.players[id], {isDead: true, health: 0, hasAnswered: false});
  assert.deepEqual(resurrectPlayer(s, id).players[id].questionAction, {ability: "first_aid", targetId: id});
});

test("pure healers add no encounter damage; legitimate offensive cross-class loadouts suppress the solo warning", () => {
  const quiz = {...fight, questions: Array.from({length: 10}, () => fight.questions[0])};
  let s = addStudent(initialCombatState("ABC234", quiz), student("warrior", "tank"));
  const baseline = scaleEncounter(s, quiz).enemies[0].health;
  s = addStudent(s, student("priest"));
  assert.equal(scaleEncounter(s, quiz).enemies[0].health, baseline);
  const allHealer = addStudent(initialCombatState("ABC234", quiz), student("priest"));
  assert.equal(scaleEncounter(allHealer, quiz).enemies[0].health, 1);
  assert.equal(hasOffensiveAbility(availableAbilities("priest", {priest: 1}, ["fireball_crossclass"])), false, "locked equipped IDs do not count");
  const profile = {levels: {priest: 1, wizard: 8}, crossClass: ["fireball_crossclass"]};
  const offensive = addStudent(initialCombatState("ABC234", quiz), student("priest"), profile);
  assert.equal(hasOffensiveAbility(offensive.players[id].availableAbilities), true);
  assert.equal(scaleEncounter(offensive, quiz).enemies[0].health, Math.ceil(9 * baseDamage(offensive.players[id])));
  let active = startQuestion(offensive);
  active = applyAnswer(active, id, "4", fight.questions[0]);
  active = resolve(selectAction(active, id, "fireball", "e1"));
  assert.ok(active.players[id].totals.damageDealt > 0);
  assert.equal(hasOffensiveAbility(availableAbilities("priest", {priest: 1, warrior: 8}, ["block_crossclass"])), false);
});

test("saved active, pending and departed Priests upgrade once while preserving combat resources and finished rooms", () => {
  const s = started("priest");
  s.players[id].availableAbilities = ["attack", "mend", "fireball"];
  s.players[id].questionAction = {ability: "attack", targetId: "e1"};
  s.players[id].mp = 2;
  s.pendingPlayers = {queued: {...structuredClone(s.players[id]), studentId: "queued"}};
  s.departedPlayers = {left: {...structuredClone(s.players[id]), studentId: "left"}};
  const before = structuredClone(s);
  const upgraded = upgradePriestActions(JSON.parse(JSON.stringify(s)));
  for (const p of [upgraded.players[id], upgraded.pendingPlayers!.queued, upgraded.departedPlayers!.left]) {
    assert.deepEqual(p.availableAbilities, ["first_aid", "mend", "fireball"]);
    assert.deepEqual(p.questionAction, {ability: "first_aid", targetId: p.studentId});
    assert.equal(p.mp, 2);
    assert.deepEqual(p.totals, before.players[id].totals);
    assert.equal(p.health, before.players[id].health);
  }
  assert.deepEqual(upgraded.enemies, before.enemies);
  assert.equal(upgraded.phaseDeadline, before.phaseDeadline);
  assert.equal(upgraded.revision, before.revision + 1);
  assert.equal(upgradePriestActions(upgraded), upgraded);
  assert.deepEqual(s, before, "upgrade is pure");
  s.currentPhase = "game_over";
  assert.equal(upgradePriestActions(s), s);
});
