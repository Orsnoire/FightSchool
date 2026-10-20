import assert from "node:assert/strict";
import { test } from "node:test";
import { encounterTierForLevels } from "../../shared/encounter-tiers";
import { swarmCounts } from "../../shared/combat/swarm";
import { encounterHpPool, ROLE_SHARES } from "../../shared/combat/encounters";
import { addStudent, advancePhase, initialCombatState, removeStudent, scaleEncounter, startQuestion } from "../../worker/combat/engine";
import { publicSnapshot } from "../../worker/combat/public-snapshot";
import type { FightRecord } from "../../worker/db/schema";
import { fight, student } from "./fixtures";

const template: FightRecord = { ...fight, encounterTier: 1, baseEnemyDamage: 1,
  questions: Array.from({ length: 10 }, (_, i) => ({ ...fight.questions[0], id: `q${i}` })),
  enemies: [{ ...fight.enemies[0], enemyType: "goblin", role: "trash", quantity: 5, wave: 1, swarm: { enemiesPerFourPlayers: 3 } },
    { ...fight.enemies[0], id: "boss", enemyType: "samhain", role: "boss", quantity: 1, wave: 2 }],
};
function waiting(levels: number[], authored = template) {
  return levels.reduce((s, level, i) => addStudent(s, student("wizard", `p${i}`), { levels: { wizard: level, warrior: 15 } }), initialCombatState("TIERUP", authored));
}

test("automatic tier uses the exact average at 2/6/10, with authored minimum and tier-4 ceiling", () => {
  for (const [levels, expected] of [
    [[], 1], [[1, 1, 3], 1], [[1, 3], 2], [[5, 6], 2], [[5, 7], 3], [[9, 10], 3], [[9, 11], 4], [[15, 15], 4],
  ] as Array<[number[], number]>) assert.equal(encounterTierForLevels(levels), expected);
  assert.equal(encounterTierForLevels([1, 1], 3), 3);
  assert.equal(encounterTierForLevels([], 4), 4);
  assert.equal(encounterTierForLevels([NaN, 1]), 1);
});

test("swarm tier multiplies only starting quantity, with unchanged attendance increments and fixed groups", () => {
  for (const tier of [1, 2, 3, 4]) for (const [players, extra] of [[0,0],[1,0],[4,0],[7,0],[8,3],[11,3],[12,6],[16,9]]) {
    assert.deepEqual(swarmCounts([{ quantity: 5, swarm: { enemiesPerFourPlayers: 3 } }, { quantity: 2 }], players, tier), [5 * tier + extra, 2]);
  }
  const groups = [{ quantity: 50, swarm: { enemiesPerFourPlayers: 5 } }, { quantity: 50, swarm: { enemiesPerFourPlayers: 5 } }, { quantity: 5 }];
  assert.deepEqual(swarmCounts(groups, 4, 4), [58, 57, 5], "tier growth shares remaining capacity after authored quantities");
  assert.deepEqual(swarmCounts([{ quantity: 30, swarm: { enemiesPerFourPlayers: 5 } }], 60, 4), [60]);
});

test("automatic tier preview and start agree on HP, headcount, MDF and Samhain stats without mutating the template", () => {
  const original = structuredClone(template);
  for (const [level, tier] of [[1,1],[2,2],[6,3],[10,4]]) {
    const s = waiting(Array(8).fill(level)), before = structuredClone(s);
    const preview = publicSnapshot(s, template);
    const scaled = scaleEncounter(s, template);
    assert.equal(scaled.encounterTier, tier);
    assert.equal(preview.encounterTier, tier);
    assert.deepEqual(preview.enemies, publicSnapshot(startQuestion(scaled), template).enemies);
    assert.equal(scaled.enemies.length, 5 * tier + 3 + 1);
    assert.equal(scaled.encounterHpPool, encounterHpPool(8, tier, 10));
    assert.ok(scaled.enemies.every(e => e.magicDefense === 2 * (tier - 1)));
    const boss = scaled.enemies.find(e => e.templateId === "boss")!;
    assert.equal(boss.defense, tier); assert.equal(boss.attackPower, tier);
    for (const role of ["trash", "boss"] as const) {
      const group = scaled.enemies.filter(e => e.role === role);
      assert.ok(group.every(e => e.maxHealth === Math.max(1, Math.floor(Math.floor(scaled.encounterHpPool! * ROLE_SHARES[role]) / group.length))));
    }
    assert.deepEqual(s, before);
    assert.deepEqual(scaleEncounter(scaled, template), scaled, "previewing twice never multiplies count again");
  }
  assert.deepEqual(template, original);
  const noSwarm = { ...template, enemies: template.enemies.map(e => ({ ...e, swarm: undefined })) };
  assert.equal(scaleEncounter(waiting([10], noSwarm), noSwarm).enemies.length, 6);
});

test("the lobby can recalculate, but late arrivals and JSON recovery preserve the started tier and counts", () => {
  const lobby = waiting([1, 11]);
  assert.equal(publicSnapshot(lobby, template).encounterTier, 3);
  assert.equal(publicSnapshot(removeStudent(lobby, "p1"), template).encounterTier, 1);
  let s = startQuestion(scaleEncounter(lobby, template));
  const count = s.enemies.length, pool = s.encounterHpPool!;
  s.enemies[0].health = 0;
  s.currentPhase = "enemy_ai";
  s = addStudent(s, student("wizard", "late"), { levels: { wizard: 15 } });
  s = advancePhase(JSON.parse(JSON.stringify(s)), template, 1000);
  assert.equal(s.encounterTier, 3); assert.equal(s.enemies.length, count);
  assert.equal(s.encounterHpPool, pool + 1); assert.equal(s.enemies[0].health, 0);
  assert.deepEqual(scaleEncounter(s, template), s);
});

test("already-running half-reference rooms retain their coefficient when a late participant joins", () => {
  let s = startQuestion(scaleEncounter(waiting([1, 1]), template));
  delete s.encounterTier;
  s.encounterHpPool = encounterHpPool(2, 1, 10, 0.5);
  s.currentPhase = "enemy_ai";
  s = addStudent(s, student("wizard", "late"), { levels: { wizard: 15 } });
  const next = advancePhase(JSON.parse(JSON.stringify(s)), template, 1000);
  assert.equal(next.encounterTier, undefined);
  assert.equal(next.encounterHpPool, encounterHpPool(3, 1, 10, 0.5));
  assert.equal(next.enemies.length, s.enemies.length);
});
