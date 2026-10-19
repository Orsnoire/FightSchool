import assert from "node:assert/strict";
import { test } from "node:test";
import { enemyAISchema, ruleFor } from "../../shared/combat/enemy-ai";
import { currentHP, maximumHP, normalizeSnapshotHP } from "../../shared/combat/hp";
import { damagePlayer, heal, hit } from "../../worker/combat/health";
import { applyAbility } from "../../worker/combat/ability-execution";
import { recoverRoom } from "../../worker/combat/room-recovery";
import { addStudent, advancePhase, initialCombatState, scaleEncounter, startQuestion } from "../../worker/combat/engine";
import { fight, student } from "./fixtures";

function room() {
  const s = startQuestion(scaleEncounter(addStudent(initialCombatState("HP", fight), student("bard"), { levels: { bard: 15 } }), fight));
  const p = s.players[student().id];
  p.maxHealth = 20; p.health = 10; p.stats.agi = 0;
  s.enemies[0].health = s.enemies[0].maxHealth = 20;
  return { s, p, e: s.enemies[0] };
}

test("maximum HP floors; current HP ceils, clamps and records actual damage/healing", () => {
  assert.equal(maximumHP(12.9), 12);
  assert.equal(currentHP(9.1, 12.9), 10);
  assert.equal(currentHP(12.5, 12.9), 12);
  assert.equal(currentHP(-0.3, 12.9), 0);
  const { s, p, e } = room();
  assert.equal(damagePlayer(s, p.studentId, 20, "limited", true, 3.5), 3);
  assert.equal(p.health, 7);
  assert.equal(p.totals.damageTaken, 3);
  p.equipmentEffects!.healingBonus = 0.5;
  assert.equal(heal(s, p, p.studentId, 3), 4);
  assert.equal(p.health, 11);
  assert.equal(p.totals.healingDone, 4);
  e.defense = 0.5;
  assert.equal(hit(s, p, e.id, 4), 4);
  assert.equal(e.health, 16);
  assert.equal(p.totals.damageDealt, 4);
  for (const event of s.events.filter(e => ["damage", "heal", "enemy_attack"].includes(e.type))) {
    assert.ok(Number.isInteger(event.amount));
    assert.equal(Math.abs(event.healthBefore! - event.healthAfter!), event.amount);
  }
  assert.equal(damagePlayer(s, p.studentId, 100, "lethal", true), 11);
  assert.equal(p.health, 0);
  assert.equal(p.isDead, true);
  assert.equal(heal(s, p, p.studentId, 0.5, true), 1);
  assert.equal(p.health, 1);
  assert.equal(p.isDead, false);
});

test("fractional Inspire grants an integer maximum and expires exactly after JSON recovery", () => {
  const { s, p } = room();
  p.stats.str = p.stats.int = p.stats.agi = p.stats.mnd = 2.5;
  p.mp = 100; p.maxMp = 100;
  applyAbility(s, p, "inspire", p.studentId);
  assert.equal(p.maxHealth, 22);
  assert.equal(p.health, 13);
  assert.equal(p.buffs.inspire.hpAmount, 2);
  p.buffs.inspire.rounds = 1;
  s.currentPhase = "enemy_ai";
  const expired = advancePhase(JSON.parse(JSON.stringify(s)), fight);
  assert.equal(expired.players[p.studentId].maxHealth, 20);
  assert.equal(expired.players[p.studentId].health, 13);
  assert.equal(expired.players[p.studentId].maxMp, 100);
});

test("enemy self costs cannot leave negative HP and enemy healing stays integral", () => {
  const { s, e } = room();
  s.currentPhase = "question_resolution";
  e.enemyType = "samhain"; e.health = 4; e.maxHealth = 30;
  e.ai = enemyAISchema.parse({ mode: "custom", rules: [ruleFor("blood_strike")] });
  const next = advancePhase(s, fight);
  assert.equal(next.enemies[0].health, 1);
  e.enemyType = "vampire"; e.health = 1; e.maxHealth = 21;
  e.ai = enemyAISchema.parse({ mode: "custom", rules: [ruleFor("vampiric_bite")] });
  const healed = advancePhase(s, fight);
  assert.equal(healed.enemies[0].health, 2);
  assert.equal(healed.events.find(e => e.type === "heal")?.amount, 1);
  assert.ok(next.events.every(e => Number.isInteger(e.healthAfter ?? 0)));
});

test("storage recovery enforces new HP rules once without refilling resources or rewriting old active rooms", async () => {
  const { s, p, e } = room();
  p.maxHealth = 20.8; p.health = 8.2; p.mp = 1;
  e.maxHealth = 9.9; e.health = 4.1;
  s.pendingPlayers = { pending: { ...structuredClone(p), studentId: "pending" } };
  s.departedPlayers = { departed: { ...structuredClone(p), studentId: "departed" } };
  const stored: any = { snapshot: JSON.parse(JSON.stringify(s)), fight, receipts: [] };
  let saves = 0;
  const effects = { repository: null, save: async () => { saves++; }, syncAlarm: async () => {} };
  await recoverRoom(stored, effects);
  assert.equal(saves, 1);
  for (const player of [stored.snapshot.players[p.studentId], stored.snapshot.pendingPlayers.pending, stored.snapshot.departedPlayers.departed]) {
    assert.equal(player.maxHealth, 20); assert.equal(player.health, 9); assert.equal(player.mp, 1);
  }
  assert.equal(stored.snapshot.enemies[0].maxHealth, 9);
  assert.equal(stored.snapshot.enemies[0].health, 5);
  await recoverRoom(stored, effects);
  assert.equal(saves, 1);
  delete s.encounterHpPool;
  assert.equal(normalizeSnapshotHP(s), s);
  assert.equal(s.enemies[0].health, 4.1);
});
