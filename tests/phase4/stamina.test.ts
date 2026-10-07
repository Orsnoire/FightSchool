import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../../worker/db/schema.ts";
import { mountainDay, nextMountainMidnight, xpMultiplier } from "../../shared/combat/stamina.ts";
import { persistCombatResults } from "../../worker/db/game-repository.ts";
import { fight, student, started } from "./fixtures.ts";

test("stamina curve starts full, falls increasingly toward a permanent one-percent floor", () => {
  assert.equal(xpMultiplier(0), 1);
  assert.ok(Math.abs(xpMultiplier(1) - 0.9) < 1e-12);
  assert.ok(Math.abs(xpMultiplier(10) - 0.011) < 1e-12);
  for (let n = 1; n < 100; n++) {
    assert.ok(xpMultiplier(n) <= xpMultiplier(n - 1));
    assert.ok(xpMultiplier(n) >= 0.01);
  }
  assert.equal(xpMultiplier(1000), 0.01);
});

test("Denver date and reset honor midnight on normal, spring-forward and fall-back days", () => {
  assert.equal(mountainDay(Date.parse("2026-10-02T05:59:59Z")), "2026-10-01");
  assert.equal(mountainDay(Date.parse("2026-10-02T06:00:00Z")), "2026-10-02");
  for (const [start, end, hours] of [
    ["2026-10-01T06:00:00Z", "2026-10-02T06:00:00Z", 24],
    ["2026-03-08T07:00:00Z", "2026-03-09T06:00:00Z", 23],
    ["2026-11-01T06:00:00Z", "2026-11-02T07:00:00Z", 25],
  ] as const) {
    const next = nextMountainMidnight(Date.parse(start));
    assert.equal(next, Date.parse(end));
    assert.equal((next - Date.parse(start)) / 3600000, hours);
  }
});

test("SQL stamina awards are atomic, mode/job-independent, retry-safe and preserve tiny fractional rewards", async () => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema });
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries) await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    await db.insert(schema.teachers).values({ id: fight.teacherId, firstName: "Test", lastName: "Teacher", email: "stamina@example.invalid", emailNormalized: "stamina@example.invalid", passwordHash: "unused", guildCode: "STAMINA", billingAddress: "Test", schoolDistrict: "Test", school: "Test", subject: "Math", gradeLevel: "5" });
    await db.insert(schema.students).values(student());
    await db.insert(schema.fights).values(fight);
    const earnedFight = { ...fight, baseXP: 99 };
    const makeState = async (n: number) => {
      const sessionId = `STA${n}`;
      await db.insert(schema.liveCombatSessions).values({ sessionId, fightId: fight.id, teacherId: fight.teacherId, soloStudentId: n % 2 ? student().id : null });
      const state = started(n % 2 ? "wizard" : "warrior");
      state.sessionId = sessionId; state.currentPhase = "game_over"; state.victory = true;
      state.players[student().id].totals.questionsAnswered = 1;
      state.players[student().id].totals.questionsCorrect = 1;
      return state;
    };
    for (let n = 0; n < 12; n++) {
      const state = await makeState(n);
      const [results, duplicate] = await Promise.all([
        persistCombatResults(db as any, state, earnedFight),
        persistCombatResults(db as any, structuredClone(state), earnedFight),
      ]);
      assert.equal(results[0].id, duplicate[0].id);
      assert.equal(results[0].staminaFightNumber, n + 1);
      assert.ok(Math.abs(results[0].xpMultiplier - xpMultiplier(n)) < 1e-12);
      assert.equal(results[0].baseXp, 100);
    }
    let [record] = await db.select().from(schema.students);
    assert.equal(record.dailyCombats, 12);
    assert.equal(record.gold, 120);
    const results = await db.select().from(schema.combatResults);
    const precise = Array.from({ length: 12 }, (_, n) => 100 * xpMultiplier(n)).reduce((a, b) => a + b);
    assert.ok(Math.abs(results.reduce((sum, r) => sum + r.xpEarned, 0) + record.xpRemainder - precise) < 1e-8);
    assert.equal(results.reduce((sum, r) => sum + r.xpEarned, 0), Math.floor(precise));
    // A previous Mountain date refreshes stamina but keeps earned sub-point XP.
    await db.update(schema.students).set({ staminaDay: "2000-01-01" }).where(eq(schema.students.id, student().id));
    const reset = await persistCombatResults(db as any, await makeState(12), earnedFight);
    assert.equal(reset[0].xpMultiplier, 1);
    assert.equal(reset[0].staminaFightNumber, 1);
    // Replaying an old result on a new day cannot spend stamina or award XP again.
    const retry = started(); retry.sessionId = "STA0"; retry.currentPhase = "game_over";
    await persistCombatResults(db as any, retry, earnedFight);
    [record] = await db.select().from(schema.students);
    assert.equal(record.dailyCombats, 1);
    // Simultaneous different rooms share one counter.
    const a = await makeState(13), b = await makeState(14);
    const together = await Promise.all([persistCombatResults(db as any, a, earnedFight), persistCombatResults(db as any, b, earnedFight)]);
    assert.deepEqual(together.map(r => r[0].staminaFightNumber).sort(), [2, 3]);
    // Ending an untouched room neither consumes stamina nor grants its configured base XP.
    const empty = await makeState(15); empty.players[student().id].totals.questionsAnswered = 0; empty.players[student().id].totals.questionsCorrect = 0; empty.victory = false;
    const abandoned = await persistCombatResults(db as any, empty, earnedFight);
    assert.equal(abandoned[0].xpEarned, 0);
    assert.equal(abandoned[0].staminaFightNumber, null);
    const partial = await makeState(17);
    partial.victory = false; partial.endedByHost = true; partial.round = 11; partial.completedRounds = 10;
    partial.enemies[0].health = 3; partial.enemies[0].maxHealth = 10;
    partial.players[student().id].roundsParticipated = 5;
    await db.update(schema.students).set({ dailyCombats: 0, xpRemainder: 0 });
    const half = await persistCombatResults(db as any, partial, { ...fight, baseXP: 10 });
    assert.equal(half[0].baseXp, 4.5, "half participation at 70% progress adds 3.5 base plus one earned activity XP");
    assert.equal(half[0].xpEarned, 4);
    [record] = await db.select().from(schema.students);
    assert.equal(record.xpRemainder, .5);
    const again = await persistCombatResults(db as any, partial, fight);
    assert.equal(again[0].id, half[0].id);
    // At the floor, tiny rewards must accumulate instead of rounding up to 1 per fight or vanishing.
    await db.update(schema.students).set({ dailyCombats: 100, xpRemainder: 0.999 });
    const tiny = await persistCombatResults(db as any, await makeState(16), { ...fight, baseXP: 0 });
    assert.equal(tiny[0].xpEarned, 1);
    assert.equal(tiny[0].xpMultiplier, 0.01);
    [record] = await db.select().from(schema.students);
    assert.ok(Math.abs(record.xpRemainder - 0.009) < 1e-10);
  } finally { await pg.close(); }
});
