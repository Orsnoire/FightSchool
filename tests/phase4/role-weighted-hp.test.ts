import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_CHARACTER_CLASSES, type CharacterClass } from "../../shared/schema";
import { encounterBudget, encounterBudgetFromEntries, encounterEntry, encounterHpWeight, roundHP } from "../../shared/combat/encounters";
import { addStudent, advancePhase, initialCombatState, removeStudent, scaleEncounter, startQuestion } from "../../worker/combat/engine";
import { publicSnapshot } from "../../worker/combat/public-snapshot";
import type { CombatSnapshot } from "../../shared/combat/model";
import type { FightRecord } from "../../worker/db/schema";
import { fight, student } from "./fixtures";

const expectedWeights: Record<CharacterClass, number> = {
  warrior: 0.33, monk: 0.33, herbalist: 0.25, paladin: 0.25, priest: 0,
  blood_knight: 1, dark_knight: 1, wizard: 1, scout: 1, warlock: 1, ranger: 1, bard: 1,
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
const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("every job has the requested HP contribution, independent of its attacks or cross-class abilities", () => {
  for (const job of ALL_CHARACTER_CLASSES) assert.equal(encounterHpWeight(job), expectedWeights[job], job);
  for (const job of ALL_CHARACTER_CLASSES) {
    const s = waiting(["wizard", "scout", "ranger", job]);
    const players = Object.values(s.players);
    const expected = 3 + expectedWeights[job] + 5;
    near(encounterBudget(players, 1, 10).hp, expected);
    players[3].availableAbilities = ["fireball", "attack"];
    players[3].stats.mat += 100;
    near(encounterBudget(players, 1, 10).hp, expected, 1e-9);
  }
});

test("HP is exactly tier times weighted players plus half the questions, including solo and all-Priest rooms", () => {
  const compositions: CharacterClass[][] = [
    ["priest"], ["warrior"], ["wizard", "priest"], ["priest", "priest", "priest"],
    ["wizard", "scout", "ranger", "warlock", "warrior", "paladin", "priest"],
    Array.from({ length: 60 }, () => "warrior"),
  ];
  for (const tier of [1, 2, 3, 4]) for (const questions of [1, 10, 20]) for (const jobs of compositions) {
    const f = template(tier, questions);
    const s = waiting(jobs, f);
    const weight = Math.round(jobs.reduce((n, job) => n + expectedWeights[job], 0) * 100) / 100;
    const expected = tier * (weight + questions / 2);
    near(encounterBudget(Object.values(s.players), tier, questions).hp, expected);
    const scaled = scaleEncounter(s, f);
    near(scaled.encounterHpPool!, expected);
    near(scaled.enemies.reduce((n, e) => n + e.maxHealth, 0), expected, 0.0041);
    assert.deepEqual(hp(publicSnapshot(s, f) as CombatSnapshot), hp(scaled));
    assert.equal((publicSnapshot(scaled, f) as CombatSnapshot).encounterHpPool, undefined, "entry accounting stays server-only");
  }
});

test("one question adds half a tier and one player adds only that job's tier-weighted share", () => {
  for (const tier of [1, 4]) for (const count of [1, 2, 3, 30]) {
    const players = Object.values(waiting(Array.from({ length: count }, () => "wizard")).players);
    const base = encounterBudget(players, tier, 10).hp;
    near(encounterBudget(players, tier, 11).hp - base, tier * 0.5);
    for (const job of ALL_CHARACTER_CLASSES) {
      const extra = Object.values(waiting([job]).players)[0];
      near(encounterBudget([...players, extra], tier, 10).hp - base, tier * expectedWeights[job]);
    }
  }
});

test("role shares span all waves and absent categories retain their unused allocation", () => {
  const f = template(2);
  const s = scaleEncounter(waiting(["wizard", "scout", "ranger", "warlock", "warrior", "paladin", "priest"], f), f);
  near(s.encounterHpPool!, 19.16);
  for (const [role, share] of Object.entries({ boss: 0.5, leader: 0.25, normal: 0.15, trash: 0.1 })) {
    const enemies = s.enemies.filter(e => e.role === role);
    assert.equal(enemies.length, 2);
    for (const e of enemies) assert.equal(e.maxHealth, roundHP(19.16 * share / 2));
  }
  const normals = { ...f, enemies: f.enemies.filter(e => e.role === "normal") };
  const onlyNormal = scaleEncounter(waiting(["wizard"], normals), normals);
  near(onlyNormal.enemies.reduce((n, e) => n + e.maxHealth, 0), 12 * 0.15);
});

test("HP weights and additive question scaling do not change outgoing pressure or swarm headcount", () => {
  for (const jobs of [["warrior"], ["wizard", "priest"], ALL_CHARACTER_CLASSES] as CharacterClass[][]) {
    const players = Object.values(waiting(jobs).players);
    const entries = players.map(p => encounterEntry(p, 10));
    const oldEntries = entries.map(({ hpWeight, ...entry }) => entry);
    assert.equal(encounterBudgetFromEntries(entries, 2, 10).rawPressure, encounterBudgetFromEntries(oldEntries, 2, 10).rawPressure);
  }
  const f = template();
  f.enemies = [{ ...f.enemies[0], quantity: 1, swarm: { enemiesPerFourPlayers: 3 } }];
  const seven = scaleEncounter(waiting(Array.from({ length: 7 }, () => "wizard"), f), f);
  const eight = scaleEncounter(waiting([...Array.from({ length: 7 }, () => "wizard" as const), "priest"], f), f);
  assert.equal(seven.encounterHpPool, eight.encounterHpPool);
  assert.equal(seven.enemies.length, 1);
  assert.equal(eight.enemies.length, 4);
});

test("late jobs add their weight once, preserve HP percentages/deaths, and survive departure and JSON recovery", () => {
  const f = template(2);
  for (const job of ALL_CHARACTER_CLASSES) {
    let s = startQuestion(scaleEncounter(waiting(["wizard", "scout"], f), f), 2000);
    s.enemies[0].health = 0;
    s.enemies[1].health /= 2;
    const before = structuredClone(s);
    s = addStudent(s, student(job, "late"));
    s.currentPhase = "enemy_ai";
    s = advancePhase(JSON.parse(JSON.stringify(s)), f, 5000);
    near(s.encounterHpPool!, 14 + 2 * expectedWeights[job]);
    assert.equal(s.encounterAttendance, 3);
    assert.equal(s.enemies[0].health, 0);
    near(s.enemies[1].health, s.enemies[1].maxHealth / 2, 0.00051);
    assert.equal(s.enemies.length, before.enemies.length);
    if (job === "priest") assert.deepEqual(hp(s), hp(before), "Priest admission must not even re-round existing HP");
    const allocated = hp(s);
    s = removeStudent(s, "late");
    s = addStudent(s, student("wizard", "late"));
    s.currentPhase = "enemy_ai";
    s = advancePhase(JSON.parse(JSON.stringify(s)), f, 6000);
    assert.deepEqual(hp(s), allocated, "re-entry cannot count or change a participant's frozen weight twice");
    assert.equal(s.encounterAttendance, 3);
    assert.deepEqual(scaleEncounter(s, f), s, "active rooms cannot be rescaled by start/preview logic");
  }
});

test("legacy fight definitions use the same additive pool and preserve proportional difficulty allocation", () => {
  for (const tier of [undefined, 1, 2, 4]) {
    const f = { ...fight, encounterTier: tier, questions: template().questions,
      enemies: [{ ...fight.enemies[0], difficultyMultiplier: 1 }, { ...fight.enemies[0], id: "e2", difficultyMultiplier: 3 }],
    };
    const s = scaleEncounter(waiting(["wizard", "warrior", "paladin", "priest"], f), f);
    near(s.encounterHpPool!, (tier || 1) * 6.58);
    assert.equal(s.enemies[0].maxHealth, roundHP(s.encounterHpPool! / 4));
    assert.equal(s.enemies[1].maxHealth, roundHP(s.encounterHpPool! * 3 / 4));
  }
});
