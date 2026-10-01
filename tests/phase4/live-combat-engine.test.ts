import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addStudent,
  initialCombatState,
  startQuestion,
  applyAnswer,
  advancePhase,
  selectAction,
  setReady,
  baseDamage,
} from "../../worker/combat/engine.ts";
import {
  ALL_CHARACTER_CLASSES,
  calculateGoldReward,
  calculateCharacterStats,
  calculateEquipmentStats,
  getStartingEquipment,
  type CharacterClass,
} from "../../shared/schema.ts";
import {
  availableAbilities,
  SUPPORT,
  ULTIMATES,
} from "../../shared/combat/abilities.ts";
import { getUnlockedJobs } from "../../shared/jobSystem.ts";
import type { FightRecord, StudentRecord } from "../../worker/db/schema.ts";
import { fight, student, started } from "./fixtures.ts";
const resolution = (s: ReturnType<typeof started>) =>
  advancePhase(advancePhase(s, fight, 200), fight, 300);
test("correct answers damage enemies; question exhaustion cycles and never grants victory", () => {
  let s = applyAnswer(
    started(),
    "00000000-0000-4000-8000-000000000003",
    "4",
    fight.questions[0],
  );
  const before = s.enemies[0].health;
  s = resolution(s);
  assert.ok(s.enemies[0].health < before);
  s = advancePhase(advancePhase(s, fight, 400), fight, 500);
  assert.equal(s.currentPhase, "question");
  assert.equal(s.currentQuestionIndex, 0);
  assert.equal(s.round, 2);
  assert.equal(s.victory, null);
});
test("wrong and absent answers take damage without damaging enemies", () => {
  const s = started("wizard");
  const wrong = resolution(
    applyAnswer(s, student().id, "5", fight.questions[0]),
  );
  assert.equal(wrong.enemies[0].health, 10);
  assert.ok(
    wrong.players[student().id].health < s.players[student().id].health,
  );
  const timeout = resolution(s);
  assert.equal(timeout.players[student().id].totals.questionsIncorrect, 1);
});
test("enemy AI attacks a living threat leader and defeat is real", () => {
  let s = started("wizard");
  s.players[student().id].health = 1;
  s = resolution(applyAnswer(s, student().id, "4", fight.questions[0]));
  s = advancePhase(s, fight, 400);
  assert.equal(s.players[student().id].isDead, true);
  s = advancePhase(s, fight, 500);
  assert.equal(s.currentPhase, "game_over");
  assert.equal(s.victory, false);
});
test("victory requires every enemy to die, and dead enemies do not attack", () => {
  let s = started("wizard");
  s.enemies[0].health = 1;
  s = resolution(applyAnswer(s, student().id, "4", fight.questions[0]));
  const health = s.players[student().id].health;
  s = advancePhase(s, fight, 400);
  assert.equal(s.players[student().id].health, health);
  s = advancePhase(s, fight, 500);
  assert.equal(s.victory, true);
});
test("answer retries and late joins reject; pure rules do not mutate input", () => {
  const s = started();
  const copy = structuredClone(s);
  const first = applyAnswer(s, student().id, "4", fight.questions[0]);
  assert.deepEqual(s, copy);
  assert.throws(() =>
    applyAnswer(first, student().id, "5", fight.questions[0]),
  );
  assert.throws(() =>
    addStudent(s, student("wizard", "00000000-0000-4000-8000-000000000004")),
  );
});
test("a one-vitality warrior can block a real amount and healing cannot exceed missing HP", () => {
  let s = applyAnswer(started(), student().id, "wrong", fight.questions[0]);
  s = advancePhase(s, fight, 200);
  s = selectAction(s, student().id, "warrior_block", student().id);
  s = advancePhase(s, fight, 300);
  assert.equal(s.players[student().id].totals.damageBlocked, 1);
  let h = started("herbalist");
  h.players[student().id].health--;
  h = applyAnswer(h, student().id, "4", fight.questions[0]);
  h = selectAction(h, student().id, "healing_potion", student().id);
  h = resolution(h);
  assert.equal(h.players[student().id].totals.healingDone, 1);
  assert.equal(h.players[student().id].healingPotions, 4);
});
test("all jobs use server-derived stats; base stats are never passive bonuses", () => {
  for (const job of ALL_CHARACTER_CLASSES) {
    const s = started(job),
      p = s.players[student().id];
    assert.ok(Number.isFinite(baseDamage(p)));
    assert.equal(p.maxMp, (p.stats.int + p.stats.mnd) * 3);
    assert.equal(p.mp, job === "wizard" ? Math.floor(p.maxMp / 2) : p.maxMp);
    assert.equal(
      p.stats.def,
      calculateEquipmentStats(
        ...(Object.values(getStartingEquipment(job)) as [
          string,
          string,
          string,
        ]),
      ).def,
    );
  }
  assert.equal(started("monk").players[student().id].maxHealth, 11);
});
test("every unlocked ability has an executable rule and can only run in its documented phase", () => {
  for (const job of ALL_CHARACTER_CLASSES) {
    const levels = Object.fromEntries(
      ALL_CHARACTER_CLASSES.map((j) => [j, 15]),
    );
    for (const ability of availableAbilities(job, levels)) {
      let s = startQuestion(
        addStudent(initialCombatState("ABC234", fight, 0), student(job), {
          levels,
        }),
        100,
      );
      const p = s.players[student().id];
      p.mp = 100;
      p.maxMp = 100;
      p.comboPoints = 50;
      p.maxComboPoints = 50;
      p.shieldPotions = 2;
      p.healingPotions = 4;
      p.health = 5;
      s.enemies[0].health = 10000;
      s.enemies[0].maxHealth = 10000;
      s = applyAnswer(s, student().id, "4", fight.questions[0]);
      if (SUPPORT.has(ability)) s = advancePhase(s, fight, 200);
      const target = [
        "warrior_block",
        "shield_bash",
        "healing_potion",
        "shield_potion",
        "mend",
        "purify",
        "bless",
        "healing_guard",
        "lay_on_hands",
        "aegis",
        "deflect",
        "manashield",
      ].includes(ability)
        ? student().id
        : "e1";
      s = selectAction(s, student().id, ability, target);
      if (s.currentPhase === "question") s = advancePhase(s, fight, 200);
      assert.doesNotThrow(
        () => advancePhase(s, fight, 300),
        `${job}: ${ability}`,
      );
    }
  }
});
test("resource, cooldown, ultimate, and target validation reject illegal commands", () => {
  let s = applyAnswer(started("wizard"), student().id, "4", fight.questions[0]);
  s.players[student().id].mp = 0;
  assert.throws(() => selectAction(s, student().id, "fireball", "e1"));
  assert.throws(() => selectAction(s, student().id, "fireblast", "missing"));
  assert.throws(() => selectAction(s, student().id, "manabomb", "e1"));
  assert.throws(() => selectAction(s, student().id, "ruin_strike", "e1"));
});
test("job unlocks follow the class design and gold endpoints match the guild design", () => {
  assert.ok(
    getUnlockedJobs({ warrior: 2, priest: 2 } as any).includes("paladin"),
  );
  assert.ok(
    !getUnlockedJobs({ warrior: 2, warlock: 2 } as any).includes(
      "blood_knight",
    ),
  );
  assert.ok(
    getUnlockedJobs({ warrior: 2, warlock: 5 } as any).includes("blood_knight"),
  );
  assert.equal(calculateGoldReward(1), 10);
  assert.equal(calculateGoldReward(100), 10000);
});
test("seeded combat is identical after a JSON storage round-trip", () => {
  const s = applyAnswer(
    started("scout"),
    student().id,
    "4",
    fight.questions[0],
  );
  assert.deepEqual(resolution(s), resolution(JSON.parse(JSON.stringify(s))));
});
