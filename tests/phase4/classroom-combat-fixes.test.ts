import assert from "node:assert/strict";
import { test } from "node:test";
import { advancePhase, resurrectPlayer } from "../../worker/combat/engine.ts";
import { fight, started, student } from "./fixtures.ts";

test("low damage settings do not one-shot full-health casters or healers at difficulty 15", () => {
  for (const job of ["wizard", "warlock", "priest", "herbalist"] as const) {
    for (const difficulty of [1, 10, 15, 30, 60, 100]) {
      const s = started(job);
      s.currentPhase = "question_resolution";
      s.enemies[0].difficultyMultiplier = difficulty;
      const p = s.players[student().id];
      p.threat = 100;
      const after = advancePhase(s, { ...fight, baseEnemyDamage: 1 });
      assert.equal(after.players[p.studentId].isDead, false, `${job} at +1/difficulty ${difficulty}`);
      assert.ok(after.players[p.studentId].health < p.health);
      assert.equal(s.players[p.studentId].health, p.maxHealth, "damage calculation is pure");
      if (difficulty === 15) {
        assert.equal(after.players[p.studentId].health, p.health - 1, "2 raw minus starter armor, minimum 1");
        const lethal = advancePhase(s, { ...fight, baseEnemyDamage: 10 });
        assert.equal(lethal.players[p.studentId].isDead, true, "+10 retains lethal attacks");
      }
    }
  }
});

test("damage rises with both sliders and still respects tank defenses and block", () => {
  const s = started("wizard");
  s.currentPhase = "question_resolution";
  s.players[student().id].health = s.players[student().id].maxHealth = 1000;
  for (const damage of [1, 3, 6, 10]) {
    let previous = 0;
    for (const difficulty of [1, 10, 15, 30, 60, 100]) {
      s.enemies[0].difficultyMultiplier = difficulty;
      const after = advancePhase(s, { ...fight, baseEnemyDamage: damage });
      const taken = after.players[student().id].totals.damageTaken;
      assert.ok(taken >= previous);
      previous = taken;
    }
  }
  s.enemies[0].difficultyMultiplier = 15;
  const normal = advancePhase(s, { ...fight, baseEnemyDamage: 4 });
  const defended = structuredClone(s);
  defended.players[student().id].stats.def += 3;
  const tank = advancePhase(defended, { ...fight, baseEnemyDamage: 4 });
  assert.ok(tank.players[student().id].health > normal.players[student().id].health);
  const guarded = structuredClone(s);
  guarded.players[student().id].buffs[`guard:${student().id}`] = { amount: 3, rounds: 1 };
  const block = advancePhase(guarded, { ...fight, baseEnemyDamage: 4 });
  assert.ok(block.players[student().id].health > normal.players[student().id].health);
});

test("host resurrection works through active phases without replaying answers or reopening finished fights", () => {
  for (const phase of ["question", "actions", "abilities", "question_resolution", "enemy_ai"] as const) {
    const s = started("wizard");
    s.currentPhase = phase;
    s.players[student().id].health = 0;
    s.players[student().id].isDead = true;
    const before = structuredClone(s);
    const revived = resurrectPlayer(s, student().id);
    assert.equal(revived.players[student().id].health, 1);
    assert.equal(revived.players[student().id].isDead, false);
    assert.equal(revived.currentPhase, phase);
    assert.equal(revived.phaseDeadline, s.phaseDeadline);
    assert.deepEqual(revived.players[student().id].totals, s.players[student().id].totals);
    assert.deepEqual(s, before);
    assert.throws(() => resurrectPlayer(revived, student().id), /already alive/);
    assert.throws(() => resurrectPlayer(s, "unknown"), /not in this fight/);
    for (const closed of ["waiting", "game_over"] as const)
      assert.throws(() => resurrectPlayer({ ...s, currentPhase: closed }, student().id), /not active/);
    if (phase === "abilities") assert.doesNotThrow(() => advancePhase(revived, fight));
  }
});
