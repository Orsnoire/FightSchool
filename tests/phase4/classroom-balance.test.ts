import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, initialCombatState, scaleEncounter, startQuestion, applyAnswer, selectAction, advancePhase, baseDamage } from "../../worker/combat/engine.ts";
import { availableAbilities } from "../../shared/combat/abilities.ts";
import { fight, student, started } from "./fixtures.ts";

test("classroom HP follows quiz length and real damage for 1, 20 and 30 participants", () => {
  for (const count of [1, 20, 30]) {
    const quiz = { ...fight, questions: Array.from({ length: 10 }, () => fight.questions[0]), enemies: [{ ...fight.enemies[0], difficultyMultiplier: 5 }] };
    let s = initialCombatState("BALANCE", quiz);
    for (let i = 0; i < count; i++) s = addStudent(s, student(i % 2 ? "wizard" : "warrior", `p${i}`));
    const damage = Object.values(s.players).reduce((sum, p) => sum + baseDamage(p), 0);
    const scaled = scaleEncounter(s, quiz);
    assert.equal(scaled.enemies[0].health, damage * 9);
    assert.equal(scaled.enemies[0].health / damage, 9, "perfect basic attacks take 90% of questions");
    assert.equal(scaled.enemies[0].health / (damage * 0.72), 12.5, "72% accuracy targets 125% of questions");
    assert.equal(s.enemies[0].health, 50, "scaling is pure");
    const active = startQuestion(scaled);
    assert.deepEqual(scaleEncounter(active, quiz), active, "reconnect cannot rescale an active fight");
    const multiple = scaleEncounter({ ...s, enemies: [s.enemies[0], { ...s.enemies[0], id: "e2" }] }, quiz);
    assert.ok(multiple.enemies.reduce((sum, e) => sum + e.health, 0) <= damage * 9 + 1, "enemies share the budget");
  }
});

test("perfect solo play can finish with each base job before unavoidable counterattacks defeat it", () => {
  for (const job of ["warrior", "wizard", "scout", "herbalist"] as const) {
    for (const enemyCount of [1, 2]) for (const mode of ["consecutive", "simultaneous"] as const) {
      const quiz = { ...fight, questions: Array.from({ length: 10 }, () => fight.questions[0]), enemyDisplayMode: mode,
        enemies: [{ ...fight.enemies[0], difficultyMultiplier: 5 }, { ...fight.enemies[0], id: "e2", difficultyMultiplier: 5 }].slice(0, enemyCount) };
      let s = startQuestion(scaleEncounter(addStudent(initialCombatState("SOLO", quiz), student(job)), quiz, true));
      for (let i = 0; i < 30 && s.currentPhase !== "game_over"; i++) {
        s = applyAnswer(s, student().id, "4", quiz.questions[0]);
        for (let phase = 0; phase < 4; phase++) s = advancePhase(s, quiz);
      }
      assert.equal(s.victory, true, `${job} ${mode}`);
    }
  }
});

test("Block includes current wizard damage, transfers once, preserves total threat, and survives storage", () => {
  let s = addStudent(initialCombatState("THREAT", fight), student("warrior", "tank"), { levels: { warrior: 4 } });
  s = addStudent(s, student("wizard", "mage"));
  s.players.mage.threat = 20;
  s.enemies[0].health = s.enemies[0].maxHealth = 1000;
  s = startQuestion(s);
  for (const id of ["tank", "mage"]) s = applyAnswer(s, id, "4", fight.questions[0]);
  s = selectAction(s, "mage", "fireball", "e1");
  s = advancePhase(s, fight, 100);
  assert.equal(s.phaseDeadline, 20100);
  s = selectAction(s, "tank", "warrior_block", "mage");
  s = selectAction(s, "tank", "shield_bash", "mage");
  const before = structuredClone(s);
  s = advancePhase(JSON.parse(JSON.stringify(s)), fight);
  assert.equal(s.players.mage.threat, 13, "Fireball adds six once, then transfers thirteen");
  assert.equal(s.players.tank.threat, baseDamage(before.players.tank) + 13);
  assert.equal(s.threatLeaderId, "tank");
  assert.equal(s.events.filter(e => e.message.includes("took 13 threat")).length, 1);
  const self = selectAction({ ...before, players: { ...before.players, tank: { ...before.players.tank, supportActions: [] } } }, "tank", "warrior_block", "tank");
  const resolved = advancePhase(self, fight);
  assert.equal(resolved.players.mage.threat, 26);
  assert.equal(resolved.players.tank.threat, baseDamage(before.players.tank));
});

test("empty level-one and cross-class potion users can create exactly one without healing", () => {
  assert.ok(availableAbilities("warrior", { warrior: 1, herbalist: 8 }, ["healing_potion_crossclass"]).includes("craft_healing_potion"));
  for (const correct of [true, false]) {
    let s = started("herbalist");
    const p = s.players[student().id];
    p.healingPotions = 0;
    p.health = p.maxHealth - 3;
    s = applyAnswer(s, p.studentId, correct ? "4" : "wrong", fight.questions[0]);
    s = selectAction(s, p.studentId, "craft_healing_potion", p.studentId);
    s = advancePhase(advancePhase(s, fight), fight);
    assert.equal(s.players[p.studentId].healingPotions, correct ? 1 : 0);
    assert.equal(s.players[p.studentId].totals.healingDone, 0);
    assert.equal(s.players[p.studentId].totals.damageDealt, 0);
  }
});
