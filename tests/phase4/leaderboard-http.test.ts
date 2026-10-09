import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { issueSession, type SessionRepository, type SessionRecord } from "../../worker/auth/session";
import type { IdentityRepository } from "../../worker/db/repository";
import type { GameDatabase } from "../../worker/db/game-repository";
import * as s from "../../worker/db/schema";
import { handleGame } from "../../worker/routes/game";
import { fight, student } from "./fixtures";

test("leaderboard HTTP metrics use guild-scoped totals and preserve access controls", async (t) => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema: s });
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries) {
      await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    }
    await db.insert(s.teachers).values({
      id: fight.teacherId, firstName: "Test", lastName: "Teacher",
      email: "leaderboard@example.invalid", emailNormalized: "leaderboard@example.invalid",
      passwordHash: "unused", guildCode: "LBTEST", billingAddress: "Test",
      schoolDistrict: "Test", school: "Test", subject: "Test", gradeLevel: "5",
    });
    await db.insert(s.fights).values(fight);
    const [guild, elsewhere] = await db.insert(s.guilds).values([
      { id: id(10), teacherId: fight.teacherId, name: "This guild", code: "LBTHIS" },
      { id: id(11), teacherId: fight.teacherId, name: "Other guild", code: "LBTHAT" },
    ]).returning();
    const members = await db.insert(s.students).values(
      ["equal", "unequal", "zero", "new", "fractional", "outsider"].map((name, i) => ({
        ...student("warrior", id(20 + i)), nickname: name, nicknameNormalized: name,
      })),
    ).returning();
    const [equal, unequal, zero, fresh, fractional, outsider] = members;
    await db.insert(s.guildMemberships).values([
      ...members.slice(0, -1).map(m => ({ guildId: guild.id, studentId: m.id })),
      { guildId: elsewhere.id, studentId: equal.id },
    ]);
    let sequence = 0;
    const result = async (studentId: string, correct: number, answered: number, guildId = guild.id) => {
      const sessionId = `LBR${String(++sequence).padStart(3, "0")}`;
      await db.insert(s.liveCombatSessions).values({ sessionId, fightId: fight.id, teacherId: fight.teacherId, guildId });
      await db.insert(s.combatResults).values({
        sessionId, studentId, fightId: fight.id, guildId, characterClass: "warrior",
        victory: true, survived: true, xpEarned: 7, goldReward: 0,
        totals: { questionsAnswered: answered, questionsCorrect: correct,
          questionsIncorrect: answered - correct, damageDealt: 13, damageBlocked: 5,
          healingDone: 3, bonusDamage: 0, damageTaken: 0, deaths: 0 },
      });
    };
    await result(equal.id, 8, 10);
    await result(equal.id, 8, 10);
    await result(equal.id, 100, 100, elsewhere.id); // Must not enter this guild's totals.
    await result(unequal.id, 1, 1);
    await result(unequal.id, 1, 9);
    await result(unequal.id, 0, 0); // Adds a fight, not an accuracy observation.
    await result(zero.id, 0, 0);
    await result(fractional.id, 1, 3);
    await result(outsider.id, 100, 100); // Historical result of a nonmember stays excluded.

    const sessions = new Map<string, SessionRecord>();
    const sessionRepository: SessionRepository = {
      async createSession(record) { sessions.set(record.tokenHash, record); },
      async findActiveSession(hash, now) {
        const record = sessions.get(hash);
        return record && record.expiresAt > now ? record : null;
      },
      async revokeSession(hash) { sessions.delete(hash); },
    };
    const repository = sessionRepository as IdentityRepository;
    const config = { cookieName: "leaderboard_test", secret: "test-only-leaderboard-secret-not-deployed", ttlSeconds: 300 };
    const cookie = async (role: "student" | "teacher", actorId: string) => (await issueSession(repository, config, role, actorId)).split(";")[0];
    const memberCookie = await cookie("student", equal.id);
    const teacherCookie = await cookie("teacher", fight.teacherId);
    const call = async (suffix = "?metric=accuracy", auth = memberCookie) => {
      const url = new URL(`https://qa.example/api/guilds/${guild.id}/leaderboard${suffix}`);
      const response = await handleGame(new Request(url, { headers: { Cookie: auth } }), url, repository, config, db as unknown as GameDatabase);
      assert.ok(response);
      return { status: response.status, body: await response.json() };
    };
    const entries = async (metric = "accuracy") => {
      const response = await call(`?metric=${metric}`);
      assert.equal(response.status, 200);
      return response.body as Array<{ studentId: string; value: number; accuracy?: number; totalDamageDealt: number; fightsCompleted: number; [key: string]: unknown }>;
    };

    await t.test("two 8/10 fights yield 80%, never a sum of percentages", async () => {
      const rows = await entries();
      assert.equal(rows.find(r => r.studentId === equal.id)!.value, 80);
      assert.equal(rows.find(r => r.studentId === equal.id)!.accuracy, 80);
      assert.ok(rows.every(r => r.value >= 0 && r.value <= 100));
    });
    await t.test("unequal fight lengths weight each answered question equally", async () => {
      const rows = await entries();
      assert.equal(rows.find(r => r.studentId === unequal.id)!.value, 20, "1/1 plus 1/9 is 2/10");
      assert.deepEqual(rows.slice(0, 3).map(r => r.studentId), [equal.id, fractional.id, unequal.id]);
      assert.equal(rows.find(r => r.studentId === unequal.id)!.fightsCompleted, 3);
    });
    await t.test("zero answers and no history return finite zero values", async () => {
      const rows = await entries();
      for (const member of [zero, fresh]) {
        const row = rows.find(r => r.studentId === member.id)!;
        assert.equal(row.value, 0);
        assert.equal(row.accuracy, 0);
      }
      assert.equal(rows.find(r => r.studentId === fresh.id)!.fightsCompleted, 0);
      assert.equal(rows.find(r => r.studentId === zero.id)!.fightsCompleted, 1);
    });
    await t.test("fractional accuracy retains precision", async () => {
      const row = (await entries()).find(r => r.studentId === fractional.id)!;
      assert.ok(Math.abs(row.value - 100 / 3) < 1e-10);
    });
    await t.test("additive metrics, ranking, aliases and guild/member scope remain intact", async () => {
      for (const [metric, expected] of [["damageDealt", 26], ["damageBlocked", 10], ["healingDone", 6], ["questionsCorrect", 16], ["xpEarned", 14]] as const) {
        const rows = await entries(metric);
        const row = rows.find(r => r.studentId === equal.id)!;
        assert.equal(row.value, expected, metric);
        assert.equal(row[metric], expected);
        assert.equal(row.totalDamageDealt, expected, "retain the existing response alias");
        assert.equal(row.fightsCompleted, 2);
        assert.equal(rows.length, 5);
        assert.ok(!rows.some(r => r.studentId === outsider.id));
        assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].value >= r.value));
      }
      assert.deepEqual((await call("")).body, (await call("?metric=damageDealt")).body);
      assert.equal((await call("/damageDealt")).status, 404, "the metric is a query parameter, not a path segment");
    });
    await t.test("authentication, guild ownership and teacher-hidden metrics still apply", async () => {
      assert.equal((await call("?metric=accuracy", "")).status, 401);
      assert.equal((await call("?metric=accuracy", await cookie("student", outsider.id))).status, 403);
      assert.equal((await call("?metric=accuracy", await cookie("teacher", id(99)))).status, 403);
      assert.equal((await call("?metric=notAMetric")).status, 400);
      await db.insert(s.guildSettings).values({ guildId: guild.id, hiddenLeaderboardMetrics: ["accuracy", "damageDealt"] });
      assert.deepEqual(await call(), { status: 200, body: [] });
      assert.deepEqual(await call(""), { status: 200, body: [] });
      const visible = await call("?metric=accuracy", teacherCookie);
      assert.equal(visible.status, 200);
      assert.equal(visible.body.length, 5);
    });
  } finally {
    await pg.close();
  }
});
