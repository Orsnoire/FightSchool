import { test } from "node:test";
import assert from "node:assert/strict";
import { fight, student } from "./fixtures";
import {
  initialCombatState,
  addStudent,
  scaleEncounter,
  advancePhase,
  selectAction,
} from "../../worker/combat/engine";
import {
  activeEnemies,
  allocateHP,
  encounterBudget,
  referenceParty,
  goblinTargets,
  bounceTarget,
  performance,
  enemyImage,
} from "../../shared/combat/encounters";
import { combatReward } from "../../worker/db/game-repository";
const quiz = {
  ...fight,
  encounterTier: 1,
  questions: Array.from({ length: 10 }, (_, i) => ({
    ...fight.questions[0],
    id: "q" + i,
  })),
  enemies: [
    {
      ...fight.enemies[0],
      name: "Goblin",
      species: "goblin" as const,
      role: "trash" as const,
      quantity: 30,
      wave: 1,
    },
  ],
};
function room(count = 4, f = quiz) {
  let s = initialCombatState("SWARM1", f);
  for (let i = 0; i < count; i++)
    s = addStudent(s, student("warrior", "p" + i));
  return s;
}
test("quantities create unique individuals; role budgets remain separate across waves and fractional HP preserves small swarms", () => {
  const s = room();
  assert.equal(s.enemies.length, 30);
  assert.equal(new Set(s.enemies.map((e) => e.id)).size, 30);
  const hp = allocateHP(s.enemies, 100);
  assert.ok(Math.abs(hp.reduce((n, e) => n + e.health, 0) - 11) < 0.02);
  assert.ok(hp.every((e) => e.health < 1));
  const extra = [
    ...s.enemies,
    { ...s.enemies[0], id: "boss1", role: "boss" as const, wave: 2 },
    { ...s.enemies[0], id: "boss2", role: "boss" as const, wave: 2 },
  ];
  const allocated = allocateHP(extra, 100);
  assert.equal(allocated.at(-1)!.maxHealth, 25);
  assert.equal(allocated.at(-2)!.maxHealth, 25);
  assert.equal(
    enemyImage({ image: "/assets/Goblin_horde_enemy_illustration_abc.png" }),
    "/enemies/goblin-v1.png",
  );
});
test("classroom reference scales n/4 independent of actual gear; solo setup changes the entry budget", () => {
  const party = referenceParty(1);
  const four = encounterBudget(party, 1, 10),
    eight = encounterBudget([...party, ...party], 1, 10);
  assert.equal(eight.hp, four.hp * 2);
  assert.equal(eight.rawPressure, four.rawPressure * 2);
  const enhanced = structuredClone(party);
  enhanced.forEach((p) => (p.stats.str += 100));
  assert.equal(encounterBudget(enhanced, 1, 10).hp, four.hp);
  assert.ok(
    encounterBudget([enhanced[0]], 1, 10).hp >
      encounterBudget([party[0]], 1, 10).hp,
  );
  const s = scaleEncounter(room(), quiz);
  assert.equal(s.encounterXpFraction, 0.1);
  s.currentPhase = "question";
  assert.deepEqual(scaleEncounter(s, quiz), s, "running fights do not rescale");
  assert.ok(
    performance(party[2], 30).damage / 30 < performance(party[2], 3).damage / 3,
    "wizard finite MP matters",
  );
});
test("goblin targeting retains the 50/25/25 allocation, balances healers, and excludes knocked-out players", () => {
  const s = room(4);
  s.players.p0.threat = 100;
  s.threatLeaderId = "p0";
  s.players.p1.totals.damageDealt = 100;
  for (const id of ["p2", "p3"]) {
    s.players[id].characterClass = "priest";
    s.players[id].availableAbilities = ["first_aid"];
  }
  const targets = goblinTargets(s, 40, () => 0.2);
  assert.equal(targets.filter((id) => id === "p0").length, 20);
  assert.equal(targets.filter((id) => id === "p1").length, 10);
  assert.equal(targets.filter((id) => id === "p2").length, 5);
  assert.equal(targets.filter((id) => id === "p3").length, 5);
  s.players.p2.isDead = true;
  assert.ok(!goblinTargets(s, 8, () => 0.2).includes("p2"));
  const solo = room(1);
  assert.deepEqual(
    goblinTargets(solo, 4, () => 0.2),
    ["p0", "p0", "p0", "p0"],
  );
});
test("manual targets bounce within the current wave; later waves cannot be targeted by players", () => {
  const f = {
    ...quiz,
    enemies: [
      { ...quiz.enemies[0], species: "other" as const, enemyType: "zombie" as const, quantity: 2 },
      {
        ...quiz.enemies[0],
        id: "boss",
        species: "other" as const,
        enemyType: "zombie" as const,
        role: "boss" as const,
        quantity: 2,
        wave: 2,
      },
    ],
  };
  let s = scaleEncounter(room(4, f), f);
  s.currentPhase = "actions";
  for (const p of Object.values(s.players)) {
    p.hasAnswered = true;
    p.lastAnswerCorrect = true;
  }
  assert.throws(() => selectAction(s, "p0", "attack", "boss:1"), /not active/);
  const target = s.enemies[0].id;
  s.enemies[0].health = 0;
  assert.equal(bounceTarget(s, target), s.enemies[1].id);
  s.enemies[1].health = 1;
  s.currentPhase = "abilities";
  s.players.p0.questionAction = { ability: "attack", targetId: target };
  s.players.p1.questionAction = { ability: "attack", targetId: target };
  const next = advancePhase(s, f, 1000);
  assert.equal(next.enemies[1].health, 0);
  assert.equal(next.enemies[2].health, s.enemies[2].health);
  assert.equal(next.players.p0.totals.damageDealt, 1);
  assert.equal(next.players.p1.totals.damageDealt, 0);
  const enemy = advancePhase(next, f, 2000);
  assert.equal(
    enemy.players.p0.health,
    next.players.p0.health,
    "next wave cannot attack on its predecessors turn",
  );
  const between = advancePhase(enemy, f, 3000);
  assert.equal(between.activeWave, 2);
  assert.equal(between.currentPhase, "wave_break");
  assert.equal(between.phaseDeadline, null);
  assert.equal(activeEnemies(between).length, 2);
  assert.equal(advancePhase(between, f, 4000).currentPhase, "question");
});
test("goblin swarm bonus is per victim per three actual attacks, with armor and classroom concentration guardrail", () => {
  let s = scaleEncounter(room(1), quiz);
  s.currentPhase = "question_resolution";
  s.enemyRoundBudget = 0;
  const p = s.players.p0;
  p.maxHealth = 100;
  p.health = 100;
  p.stats.def = 999;
  const next = advancePhase(s, quiz, 1000);
  assert.equal(
    next.players.p0.health,
    90,
    "30 goblins collectively force through 10 damage",
  );
  s.players.p0.maxHealth = 10;
  s.players.p0.health = 10;
  const capped = advancePhase(s, quiz, 1000);
  assert.equal(capped.players.p0.health, 6.5);
});
test("question bank cycles reshuffle deterministically, preserve mastery IDs and avoid immediate repeat", () => {
  let s = scaleEncounter(room(), quiz);
  s.currentPhase = "enemy_ai";
  s.currentQuestionIndex = 9;
  s.questionOrder = Array.from({ length: 10 }, (_, i) => i);
  s.questionCursor = 9;
  const f = { ...quiz, randomizeQuestions: true };
  const a = advancePhase(s, f, 1000),
    b = advancePhase(s, f, 1000);
  assert.deepEqual(a, b);
  assert.notEqual(a.currentQuestionIndex, 9);
  assert.deepEqual(
    [...a.questionOrder!].sort((a, b) => a - b),
    Array.from({ length: 10 }, (_, i) => i),
  );
});
test("only base fight XP follows role composition; answer activity XP is unchanged", () => {
  const s = scaleEncounter(room(1), quiz);
  s.currentPhase = "game_over";
  s.victory = true;
  s.completedRounds = 1;
  const p = s.players.p0;
  p.roundsParticipated = 1;
  p.totals.questionsAnswered = 1;
  p.totals.questionsCorrect = 1;
  const trash = combatReward(s, p, quiz).xp;
  s.encounterXpFraction = 1;
  const full = combatReward(s, p, quiz).xp;
  assert.equal(full - trash, 9);
});

test("join order rotates the first acting player each round", () => {
  for (const round of [1, 2, 3, 4]) {
    const s = scaleEncounter(room(), quiz);
    s.round = round;
    s.currentPhase = "abilities";
    s.enemies.forEach((e, i) => (e.health = i === 0 ? 1 : 0));
    for (const p of Object.values(s.players)) {
      p.lastAnswerCorrect = true;
      p.questionAction = { ability: "attack", targetId: s.enemies[0].id };
    }
    const next = advancePhase(s, quiz, 1000);
    assert.equal(next.players["p" + (round - 1)].totals.damageDealt, 1);
  }
});
test("late entry grows remaining budgets without resurrecting defeated enemies", () => {
  let s = scaleEncounter(room(), quiz);
  s.currentPhase = "enemy_ai";
  s.enemies[0].health = 0;
  s.enemies[1].health = s.enemies[1].maxHealth / 2;
  const oldMax = s.enemies[1].maxHealth;
  s = addStudent(s, student("warrior", "late"));
  assert.ok(s.pendingPlayers?.late);
  const next = advancePhase(s, quiz, 1000);
  assert.equal(next.encounterAttendance, 5);
  assert.equal(next.enemies[0].health, 0);
  assert.ok(Math.abs(next.enemies[1].maxHealth / oldMax - 1.25) < 0.01);
  assert.ok(
    Math.abs(next.enemies[1].health / next.enemies[1].maxHealth - 0.5) < 0.001,
  );
  assert.ok(next.players.late);
});
