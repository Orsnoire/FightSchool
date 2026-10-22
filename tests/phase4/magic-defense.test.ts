import assert from "node:assert/strict";
import { test } from "node:test";
import { abilityDamageType } from "../../shared/combat/damage-types";
import { abilityDamage } from "../../shared/combat/abilityValues";
import { applyAbility } from "../../worker/combat/ability-execution";
import { hit } from "../../worker/combat/health";
import { addStudent, initialCombatState, scaleEncounter, startQuestion, advancePhase } from "../../worker/combat/engine";
import { publicSnapshot } from "../../worker/combat/public-snapshot";
import type { CharacterClass } from "../../shared/schema";
import type { EnemyType } from "../../shared/combat/enemy-ai";
import { fight, student } from "./fixtures";

function room(tier = 2, job: CharacterClass = "wizard") {
  const f = { ...fight, encounterTier: tier };
  const s = startQuestion(addStudent(initialCombatState("MDF", f), student(job), { levels: { wizard: 8, [job]: 15 },
    crossClass: ["fireball_crossclass"] }));
  const p = s.players[student().id];
  p.stats.agi = 0;
  p.mp = p.maxMp = 100;
  s.enemies[0].health = s.enemies[0].maxHealth = 100000;
  s.enemies[0].defense = 5;
  return { s, p, f, e: s.enemies[0] };
}

test("every monster family gets tier MDF 0/2/4/6 in preview, start and JSON recovery", () => {
  for (const [tier, expected] of [[1, 0], [2, 2], [3, 4], [4, 6]]) {
    const f = { ...fight, encounterTier: tier, enemies: ["zombie", "ghost", "spider", "vampire", "slime", "samhain", "goblin"].map((type, i) => ({
      ...fight.enemies[0], id: `e${i}`, enemyType: type as EnemyType, quantity: type === "goblin" ? 5 : 1,
    })) };
    const waiting = addStudent(initialCombatState("TIERS", f), student("wizard"));
    // Waiting rooms created before the update acquire MDF when previewed/started.
    for (const e of waiting.enemies) delete e.magicDefense;
    const scaled = scaleEncounter(waiting, f);
    for (const e of scaled.enemies) assert.equal(e.magicDefense, expected);
    for (const e of publicSnapshot(waiting, f).enemies) assert.equal(e.magicDefense, expected);
    assert.deepEqual(JSON.parse(JSON.stringify(scaled)).enemies, scaled.enemies);
    assert.ok(waiting.enemies.every(e => e.magicDefense === undefined), "preview is read-only");
  }
  assert.equal(initialCombatState("DEFAULT", fight).enemies[0].magicDefense, 0);
});

test("magical hits use MDF only; physical hits retain DEF buffs, immunity and nonnegative damage", () => {
  const { s, p, e } = room();
  e.aiState!.buffs = [{ type: "defense", throughRound: s.round }];
  assert.equal(hit(s, p, e.id, 12, false, "magic"), 10);
  assert.equal(hit(s, p, e.id, 12, false, "physical"), 5, "ceil(12 - 5 * 1.5)");
  assert.equal(hit(s, p, e.id, 1, false, "magic"), 0);
  assert.equal(p.totals.damageDealt, 15);
  e.aiState!.buffs.push({ type: "fade", throughRound: s.round });
  assert.equal(hit(s, p, e.id, 12, false, "magic"), 0);
  assert.equal(hit(s, p, e.id, 12, false, "physical"), 0);
  e.aiState!.buffs = [];
  delete e.magicDefense;
  assert.equal(hit(s, p, e.id, 12, false, "magic"), 7, "historical running rooms retain their defense rule");
});

test("Wizard basic attacks, spells and cross-class Fireball resolve against MDF with actual damage accounting", () => {
  for (const [job, ability] of [["wizard", "attack"], ["wizard", "fireball"], ["wizard", "manabomb"], ["priest", "fireball"]] as const) {
    const { s, p, e } = room(3, job);
    e.defense = 1000;
    const expected = Math.max(0, Math.floor(abilityDamage(p, ability)!) - 4);
    const before = e.health;
    applyAbility(s, p, ability, e.id);
    assert.equal(before - e.health, expected, `${job}/${ability}`);
    assert.equal(p.totals.damageDealt, expected);
    assert.equal(s.events.filter(e => e.type === "damage").reduce((n, e) => n + e.amount, 0), expected);
  }
  assert.equal(abilityDamageType("warrior", "fireball_crossclass"), "magic");
  for (const ability of ["ruin_strike", "blood_price", "shadow_requiem", "crimson_slash", "hemorrhage", "headshot"])
    assert.equal(abilityDamageType("wizard", ability), "physical", ability);
  for (const ability of ["hex", "siphon", "sacred_strike", "holy_judgment", "raining_blood", "finale", "crescendo"])
    assert.equal(abilityDamageType("warrior", ability), "magic", ability);
});

test("Hex ticks use MDF while Hemorrhage ticks use physical DEF after JSON recovery", () => {
  const { s, p, e, f } = room(2, "warlock");
  s.currentPhase = "abilities";
  p.currentAnswer = "4";
  p.hasAnswered = true;
  p.questionAction = null;
  e.effects = ["hex", "hemorrhage"].map(type => ({ ownerId: p.studentId, type, rounds: 2, damage: 6 }));
  const normal = advancePhase(s, f, 1234);
  assert.deepEqual(advancePhase(JSON.parse(JSON.stringify(s)), f, 1234), normal);
  assert.equal(normal.enemies[0].health, 99995, "6 - MDF 2 plus 6 - DEF 5");
  assert.equal(normal.players[p.studentId].totals.damageDealt, 5);
});
