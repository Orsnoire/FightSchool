import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findBlocker,
  resolveDamage,
  resolveEnemyAttacks,
  resolveHealing,
  scheduleResolution,
  type ResolutionPlayer,
} from "../../shared/combat/resolutionRules.ts";

function player(id: string, overrides: Partial<ResolutionPlayer> = {}): ResolutionPlayer {
  return {
    nickname: id,
    characterClass: "wizard",
    health: 10,
    maxHealth: 10,
    mp: 3,
    mnd: 2,
    vit: 1,
    def: 0,
    threat: 1,
    isDead: false,
    potionCount: 0,
    healingDone: 0,
    damageTaken: 0,
    damageBlocked: 0,
    deaths: 0,
    ...overrides,
  };
}

test("healing resolves in intent order, caps overheal, spends resources, and leaves input unchanged", () => {
  const players = {
    herbs: player("herbs", { characterClass: "herbalist", mnd: 4, potionCount: 1 }),
    priest: player("priest", { characterClass: "priest", mnd: 4 }),
    target: player("target", { health: 5 }),
  };
  const result = resolveHealing(players, [
    { healerId: "herbs", targetId: "target", kind: "potion" },
    { healerId: "priest", targetId: "target", kind: "mend" },
  ]);

  assert.equal(players.target.health, 5);
  assert.equal(result.players.target.health, 10);
  assert.deepEqual(result.outcomes.map(outcome => outcome.amount), [4, 1]);
  assert.equal(result.players.herbs.potionCount, 0);
  assert.equal(result.players.herbs.threat, 9);
  assert.equal(result.players.priest.mp, 2);
  assert.equal(result.players.priest.threat, 3);
});

test("invalid and dead-target heals do not spend resources", () => {
  const players = {
    priest: player("priest", { characterClass: "priest", mp: 1 }),
    dead: player("dead", { health: 0, isDead: true }),
  };
  const result = resolveHealing(players, [
    { healerId: "priest", targetId: "dead", kind: "mend" },
    { healerId: "priest", targetId: "missing", kind: "mend" },
  ]);
  assert.equal(result.players.priest.mp, 1);
  assert.deepEqual(result.outcomes, []);
});

test("damage is deterministic, applies defense, keeps the one-damage floor, and reports first death", () => {
  assert.deepEqual(resolveDamage(8, 7, 2, 3), {
    rawDamage: 7,
    actualDamage: 4,
    defendedAmount: 3,
    health: 4,
    isDead: false,
    becameDead: false,
  });
  assert.equal(resolveDamage(8, 2, 50, 50).actualDamage, 1);
  assert.equal(resolveDamage(1, 4, 0, 0).becameDead, true);
  assert.equal(resolveDamage(0, 4, 0, 0, true).becameDead, false);
});

test("block selection is stable and ignores dead or non-tank candidates", () => {
  const players = {
    dead: player("dead", { characterClass: "warrior", blockTarget: "target", isDead: true }),
    mage: player("mage", { blockTarget: "target" }),
    first: player("first", { characterClass: "paladin", blockTarget: "target" }),
    second: player("second", { characterClass: "warrior", blockTarget: "target" }),
  };
  assert.equal(findBlocker(players, "target"), "first");
});

test("enemy simulation retargets after each attack and lets blocking threat affect later AI", () => {
  const players = {
    leader: player("leader", { threat: 10, health: 5 }),
    tank: player("tank", { characterClass: "warrior", threat: 8, blockTarget: "leader" }),
  };
  const enemies = [
    { id: "e1", name: "One", image: "one.png", health: 5 },
    { id: "e2", name: "Two", image: "two.png", health: 5 },
    { id: "dead", name: "Dead", image: "dead.png", health: 0 },
  ];
  const result = resolveEnemyAttacks(players, enemies, { baseDamage: 4 });

  assert.equal(result.attacks.length, 2);
  assert.deepEqual(result.attacks.map(attack => [attack.targetId, attack.blocked]), [
    ["leader", true],
    ["tank", false],
  ]);
  assert.equal(result.players.tank.threat, 12);
  assert.equal(result.players.tank.damageBlocked, 4);
  assert.equal(result.players.tank.health, 6);
  assert.equal(players.tank.health, 10);
});

test("solo damage cap and phase schedules reproduce the legacy timing contract", () => {
  const result = resolveEnemyAttacks(
    { leader: player("leader", { threat: 1 }) },
    [{ id: "e", name: "Enemy", image: "enemy.png", health: 1 }],
    { baseDamage: 9, soloModeDamageCap: 3 },
  );
  assert.equal(result.attacks[0].rawDamage, 3);
  assert.deepEqual(scheduleResolution([2, 1], true, 2), {
    questionResolutionMs: 9_000,
    enemyAiMs: 7_800,
    nextQuestionMs: 2_000,
  });
  assert.deepEqual(scheduleResolution([], false, 0), {
    questionResolutionMs: 3_000,
    enemyAiMs: 1_000,
    nextQuestionMs: 2_000,
  });
});

test("the same simulated round produces byte-for-byte identical results", () => {
  const players = {
    healer: player("healer", { characterClass: "priest", mnd: 3, threat: 2 }),
    tank: player("tank", { characterClass: "warrior", health: 6, threat: 5 }),
  };
  const run = () => {
    const healed = resolveHealing(players, [{ healerId: "healer", targetId: "tank", kind: "mend" }]);
    return resolveEnemyAttacks(
      healed.players,
      [{ id: "e", name: "Enemy", image: "enemy.png", health: 10 }],
      { baseDamage: 5 },
    );
  };
  assert.deepEqual(run(), run());
});
