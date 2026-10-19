import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_CHARACTER_CLASSES, type CharacterClass } from "../../shared/schema";
import { encounterBudget, encounterBudgetFromEntries, encounterEntry, encounterHpWeight, referenceOutput } from "../../shared/combat/encounters";
import { addStudent, advancePhase, initialCombatState, removeStudent, scaleEncounter, startQuestion } from "../../worker/combat/engine";
import { publicSnapshot } from "../../worker/combat/public-snapshot";
import type { CombatSnapshot } from "../../shared/combat/model";
import type { FightRecord } from "../../worker/db/schema";
import { fight, student } from "./fixtures";

const expectedWeights: Record<CharacterClass, number> = {
  warrior: 0.33, monk: 0.33, herbalist: 0.25, paladin: 0.25, priest: 0,
  blood_knight: 1, dark_knight: 1, wizard: 1, scout: 1, warlock: 1, ranger: 1, bard: 1,
};
// Frozen raw reference rotation totals: tier selects stats/gear/abilities once.
const output: Record<number, Record<number, number>> = {
  1: { 1: 15, 10: 171, 11: 190, 20: 386, 30: 651 },
  2: { 1: 46, 10: 550, 11: 606, 20: 991, 30: 1381 },
  3: { 1: 81, 10: 963, 11: 1061, 20: 1943, 30: 2743 },
  4: { 1: 4808, 10: 5681, 11: 5778, 20: 6651, 30: 7621 },
};
function template(tier = 1, questions = 10): FightRecord {
  return { ...fight, encounterTier: tier,
    questions: Array.from({ length: questions }, (_, i) => ({ ...fight.questions[0], id: `q${i}` })),
    enemies: (["boss", "leader", "normal", "trash"] as const).map((role, i) => ({
      ...fight.enemies[0], id: `e${i}`, enemyType: "slime", role, quantity: 2, wave: i + 1,
    })),
  };
}
function waiting(jobs: CharacterClass[], f = template()) {
  return jobs.reduce((s, job, i) => addStudent(s, student(job, `p${i}`)), initialCombatState("WEIGHT", f, 1000));
}
const hp = (s: CombatSnapshot) => s.enemies.map(e => [e.id, e.health, e.maxHealth]);

test("every job has the requested HP contribution, independent of its attacks or cross-class abilities", () => {
  for (const job of ALL_CHARACTER_CLASSES) {
    assert.equal(encounterHpWeight(job), expectedWeights[job], job);
    const players = Object.values(waiting(["wizard", "scout", "ranger", job]).players);
    const expected = Math.floor(3 + expectedWeights[job] + 171 / 2);
    assert.equal(encounterBudget(players, 1, 10).hp, expected);
    players[3].availableAbilities = ["fireball", "attack"];
    players[3].stats.mat += 100;
    assert.equal(encounterBudget(players, 1, 10).hp, expected);
  }
});

test("HP adds weighted players to half reference output, with tier included exactly once", () => {
  const compositions: CharacterClass[][] = [
    ["priest"], ["warrior"], ["wizard", "priest"], ["priest", "priest", "priest"],
    ["wizard", "scout", "ranger", "warlock", "warrior", "paladin", "priest"],
    Array.from({ length: 60 }, () => "warrior"),
  ];
  for (const tier of [1, 2, 3, 4]) for (const questions of [1, 10, 20]) for (const jobs of compositions) {
    const f = template(tier, questions);
    const s = waiting(jobs, f);
    const weight = Math.round(jobs.reduce((n, job) => n + expectedWeights[job], 0) * 100) / 100;
    const expected = Math.floor(weight + output[tier][questions] / 2);
    assert.equal(referenceOutput(tier, questions), output[tier][questions] / questions);
    assert.equal(encounterBudget(Object.values(s.players), tier, questions).hp, expected);
    const scaled = scaleEncounter(s, f);
    assert.equal(scaled.encounterHpPool, expected);
    for (const e of scaled.enemies) assert.ok(Number.isInteger(e.maxHealth) && e.maxHealth >= 1);
    const minimumException = scaled.enemies.filter(e => e.maxHealth === 1).length;
    assert.ok(scaled.enemies.reduce((n, e) => n + e.maxHealth, 0) <= expected + minimumException);
    assert.deepEqual(hp(publicSnapshot(s, f) as CombatSnapshot), hp(scaled));
    assert.equal((publicSnapshot(scaled, f) as CombatSnapshot).encounterHpPool, undefined);
  }
});

test("question contribution does not multiply attendance; a DPS adds one HP before allocation", () => {
  for (const tier of [1, 4]) for (const count of [1, 2, 3, 30]) {
    const players = Object.values(waiting(Array.from({ length: count }, () => "wizard")).players);
    const base = encounterBudget(players, tier, 10).hp;
    assert.equal(encounterBudget(players, tier, 11).hp - base, Math.floor(output[tier][11] / 2) - Math.floor(output[tier][10] / 2));
    for (const job of ALL_CHARACTER_CLASSES) {
      const extra = Object.values(waiting([job]).players)[0];
      assert.equal(encounterBudget([...players, extra], tier, 10).hp, Math.floor(count + expectedWeights[job] + output[tier][10] / 2));
    }
  }
});

test("every role shares one budget across all waves, leaves missing roles unused and floors each maximum", () => {
  const f = template(2);
  f.enemies = f.enemies.flatMap(e => Array.from({ length: 5 }, (_, i) => ({ ...e, id: `${e.id}-${i}`, wave: i + 1 })));
  const s = scaleEncounter(waiting(["wizard", "scout", "ranger", "warlock", "warrior", "paladin", "priest"], f), f);
  assert.equal(s.encounterHpPool, 279);
  for (const [role, share] of Object.entries({ boss: 0.5, leader: 0.25, normal: 0.15, trash: 0.1 })) {
    const enemies = s.enemies.filter(e => e.role === role);
    assert.equal(enemies.length, 10);
    for (const e of enemies) assert.equal(e.maxHealth, Math.floor(279 * share / 10));
    assert.ok(enemies.reduce((n, e) => n + e.maxHealth, 0) <= Math.floor(279 * share));
  }
  assert.ok(s.enemies.reduce((n, e) => n + e.maxHealth, 0) <= 279);
  const normals = { ...f, enemies: f.enemies.filter(e => e.role === "normal") };
  const onlyNormal = scaleEncounter(waiting(["wizard"], normals), normals);
  assert.equal(onlyNormal.enemies.reduce((n, e) => n + e.maxHealth, 0), 40);
});

test("20 players and 30 questions give 25 swarmers 1 HP each, independent of waves and without goblin bonuses", () => {
  const jobs = Array.from({ length: 20 }, () => "wizard" as const);
  for (const waves of [1, 5]) {
    const f = template(1, 30);
    f.enemies = Array.from({ length: waves }, (_, i) => ({ ...f.enemies[0], id: `swarm${i}`, enemyType: "goblin", species: "goblin", role: "trash", quantity: 25 / waves, wave: i + 1 }));
    const s = startQuestion(scaleEncounter(waiting(jobs, f), f));
    assert.equal(s.encounterHpPool, 345);
    assert.equal(s.enemies.length, 25);
    assert.ok(s.enemies.every(e => e.health === 1 && e.maxHealth === 1));
  }
  const tiny = template(1, 1);
  tiny.enemies = [{ ...tiny.enemies[0], role: "trash", quantity: 60 }];
  const s = startQuestion(scaleEncounter(waiting(["priest"], tiny), tiny));
  assert.equal(s.encounterHpPool, 7);
  assert.equal(s.enemies.reduce((sum, e) => sum + e.maxHealth, 0), 60, "explicit 1 HP floor is the budget exception");
});

test("HP discounts do not change outgoing pressure or swarm headcount", () => {
  for (const jobs of [["warrior"], ["wizard", "priest"], ALL_CHARACTER_CLASSES] as CharacterClass[][]) {
    const entries = Object.values(waiting(jobs).players).map(p => encounterEntry(p, 10));
    assert.equal(encounterBudgetFromEntries(entries, 2, 10).rawPressure,
      encounterBudgetFromEntries(entries.map(({ hpWeight, ...entry }) => entry), 2, 10).rawPressure);
  }
  const f = template();
  f.enemies = [{ ...f.enemies[0], quantity: 1, swarm: { enemiesPerFourPlayers: 3 } }];
  const seven = scaleEncounter(waiting(Array.from({ length: 7 }, () => "wizard"), f), f);
  const eight = scaleEncounter(waiting([...Array.from({ length: 7 }, () => "wizard" as const), "priest"], f), f);
  assert.equal(seven.encounterHpPool, eight.encounterHpPool);
  assert.equal(seven.enemies.length, 1);
  assert.equal(eight.enemies.length, 4);
});

test("late jobs add their weight once, ceil rescaled current HP, preserve deaths and survive departure/JSON recovery", () => {
  const f = template(2);
  for (const job of ALL_CHARACTER_CLASSES) {
    let s = startQuestion(scaleEncounter(waiting(["wizard", "scout"], f), f), 2000);
    s.enemies[0].health = 0;
    s.enemies[1].health = Math.ceil(s.enemies[1].maxHealth / 2);
    const before = structuredClone(s);
    s = addStudent(s, student(job, "late"));
    s.currentPhase = "enemy_ai";
    s = advancePhase(JSON.parse(JSON.stringify(s)), f, 5000);
    assert.equal(s.encounterHpPool, Math.floor(277 + expectedWeights[job]));
    assert.equal(s.encounterAttendance, 3);
    assert.equal(s.enemies[0].health, 0);
    assert.equal(s.enemies[1].health, Math.ceil(before.enemies[1].health / before.enemies[1].maxHealth * s.enemies[1].maxHealth));
    assert.equal(s.enemies.length, before.enemies.length);
    if (job === "priest") assert.deepEqual(hp(s), hp(before));
    const allocated = hp(s);
    s = removeStudent(s, "late");
    s = addStudent(s, student("wizard", "late"));
    s.currentPhase = "enemy_ai";
    s = advancePhase(JSON.parse(JSON.stringify(s)), f, 6000);
    assert.deepEqual(hp(s), allocated);
    assert.equal(s.encounterAttendance, 3);
    assert.deepEqual(scaleEncounter(s, f), s);
  }
});

test("legacy definitions use the same reference pool and floor proportional difficulty allocation", () => {
  for (const tier of [undefined, 1, 2, 4]) {
    const f = { ...fight, encounterTier: tier, questions: template().questions,
      enemies: [{ ...fight.enemies[0], difficultyMultiplier: 1 }, { ...fight.enemies[0], id: "e2", difficultyMultiplier: 3 }],
    };
    const s = scaleEncounter(waiting(["wizard", "warrior", "paladin", "priest"], f), f);
    assert.equal(s.encounterHpPool, Math.floor(1.58 + output[tier || 1][10] / 2));
    assert.equal(s.enemies[0].maxHealth, Math.floor(s.encounterHpPool! / 4));
    assert.equal(s.enemies[1].maxHealth, Math.floor(s.encounterHpPool! * 3 / 4));
  }
});
