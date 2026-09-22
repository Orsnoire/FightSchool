import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answersMatch,
  defaultActionForPlayer,
  findThreatLeader,
  questionResetPatch,
  selectionProgress,
  type PhaseRulePlayer,
} from "../../shared/combat/phaseRules.ts";

function player(overrides: Partial<PhaseRulePlayer> = {}): PhaseRulePlayer {
  return {
    characterClass: "wizard",
    isDead: false,
    threat: 1,
    hasAnswered: true,
    currentAnswer: "4",
    hasSelectedAbility: true,
    isHealing: false,
    pendingAction: { abilityId: "base_attack" },
    ...overrides,
  };
}

test("answer matching exposes legacy and canonical normalization explicitly", () => {
  assert.equal(answersMatch("TRUE", "true", "case-insensitive"), true);
  assert.equal(answersMatch("  New   York ", "new york", "case-insensitive"), false);
  assert.equal(answersMatch("  New   York ", "new york", "trimmed"), true);
});

test("threat leader ignores dead players, zero threat, and preserves tie order", () => {
  const players = {
    first: player({ threat: 3 }),
    tied: player({ threat: 3 }),
    dead: player({ threat: 99, isDead: true }),
  };
  assert.equal(findThreatLeader(players), "first");
  assert.equal(findThreatLeader({ idle: player({ threat: 0 }) }), null);
});

test("question reset patch clears only per-question decisions", () => {
  assert.deepEqual(questionResetPatch(), {
    hasAnswered: false,
    currentAnswer: undefined,
    answeredCurrentQuestionCorrectly: false,
    hasSelectedAbility: false,
    isHealing: false,
    healTarget: undefined,
    blockTarget: undefined,
    isCreatingPotion: false,
  });
});

test("selection progress handles tanks, active healers, targeted abilities, and dead players", () => {
  const requiresTarget = (abilityId: string) => abilityId === "mark";
  const players = {
    tank: player({ characterClass: "warrior", blockTarget: "ally" }),
    healer: player({ characterClass: "priest", isHealing: true, healTarget: "tank" }),
    scout: player({ characterClass: "scout", pendingAction: { abilityId: "mark", targetId: "enemy" } }),
    dead: player({ isDead: true, hasSelectedAbility: false, pendingAction: undefined }),
  };

  assert.deepEqual(selectionProgress(players, requiresTarget), {
    allComplete: true,
    completedCount: 3,
    totalPlayers: 3,
    tanksComplete: true,
    healersComplete: true,
    offensiveComplete: true,
  });

  players.scout.pendingAction = { abilityId: "mark" };
  assert.equal(selectionProgress(players, requiresTarget).allComplete, false);
});

test("default targeting preserves selected abilities and prefers a living previous target", () => {
  const enemies = [
    { id: "low", health: 2 },
    { id: "high", health: 8 },
    { id: "dead", health: 0 },
  ];

  assert.deepEqual(defaultActionForPlayer(player({ lastTargetId: "low" }), enemies), {
    abilityId: "base_attack",
    targetId: "low",
    targetType: "enemy",
  });
  assert.deepEqual(defaultActionForPlayer(player({ pendingAction: { abilityId: "mark" } }), enemies), {
    abilityId: "mark",
    targetId: "high",
    targetType: "enemy",
  });
  assert.equal(defaultActionForPlayer(player({ pendingAction: { abilityId: "mark", targetId: "low" } }), enemies), null);
});
