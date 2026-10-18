import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { issueSession, type SessionRecord } from "../../worker/auth/session";
import type { IdentityRepository } from "../../worker/db/repository";
import type { GameDatabase } from "../../worker/db/game-repository";
import * as s from "../../worker/db/schema";
import { handleGame } from "../../worker/routes/game";
import { fight, student } from "./fixtures";

// Pin the public boundary before moving handlers. Only session storage is fake;
// authorization queries, migrations and reward SQL run against PostgreSQL.
test("C09 domain extraction preserves HTTP ownership, errors and replay behavior", async (t) => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema: s });
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries) await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    const foreignTeacher = crypto.randomUUID();
    for (const [i, id] of [fight.teacherId, foreignTeacher].entries()) await db.insert(s.teachers).values({
      id, firstName: "Boundary", lastName: "Test", email: `boundary${i}@example.invalid`, emailNormalized: `boundary${i}@example.invalid`,
      passwordHash: "private credential", guildCode: `BOUND${i}`, billingAddress: "Test", schoolDistrict: "Test", school: "Test", subject: "Math", gradeLevel: "5",
    });
    await db.insert(s.fights).values(fight);
    const [guild] = await db.insert(s.guilds).values({ name: "Boundary", code: "BOUND1", teacherId: fight.teacherId }).returning();
    const [member, outsider] = await db.insert(s.students).values([
      { ...student(), guildId: guild.id, gold: 1000 }, student("priest", crypto.randomUUID()),
    ]).returning();
    await db.insert(s.guildMemberships).values({ guildId: guild.id, studentId: member.id });
    await db.insert(s.guildFights).values({ guildId: guild.id, fightId: fight.id });
    const [item] = await db.insert(s.equipmentItems).values({ teacherId: fight.teacherId, name: "Custom sword", itemType: "sword", slot: "weapon", quality: "common", stats: { atk: 2 } }).returning();
    const sessions = new Map<string, SessionRecord>();
    const repository = {
      createSession: async (r: SessionRecord & { tokenHash: string }) => { sessions.set(r.tokenHash, r); },
      findActiveSession: async (key: string) => sessions.get(key) || null,
      findFightById: async (id: string) => (await db.select().from(s.fights).where(eq(s.fights.id, id)))[0],
      findTeacherById: async (id: string) => (await db.select().from(s.teachers).where(eq(s.teachers.id, id)))[0],
    } as IdentityRepository;
    const config = { cookieName: "c09", secret: "isolated-c09-secret-not-deployed-123456", ttlSeconds: 300 };
    const cookie = async (role: "teacher" | "student", id: string) => (await issueSession(repository, config, role, id)).split(";")[0];
    const owner = await cookie("teacher", fight.teacherId), otherTeacher = await cookie("teacher", foreignTeacher);
    const own = await cookie("student", member.id), other = await cookie("student", outsider.id);
    const call = async (path: string, auth = own, method = "GET", body?: unknown, database = db as unknown as GameDatabase, raw?: string) => {
      const url = new URL("https://qa.example" + path);
      const response = await handleGame(new Request(url, { method, headers: { Cookie: auth, "Content-Type": "application/json" }, ...(body !== undefined || raw !== undefined ? { body: raw ?? JSON.stringify(body) } : {}) }), url, repository, config, database);
      if (!response) return null;
      return { status: response.status, body: await response.json(), headers: response.headers };
    };
    const g = `/api/guilds/${guild.id}`, p = `/api/student/${member.id}`;

    await t.test("namespace dispatch, authentication and legacy method behavior stay stable", async () => {
      assert.equal(await call("/api/unrelated", ""), null);
      for (const path of [g, "/api/equipment-items", `${p}/currency`, "/api/combat-stats/report", "/api/combat/unknown"]) {
        const r = await call(path, "");
        assert.equal(r?.status, 401, path);
        assert.deepEqual(r?.body, { error: "Authentication required" });
      }
      assert.equal((await call("/api/combat/unknown"))?.status, 404);
      assert.equal((await call(`${g}/unknown`, owner))?.status, 404);
      assert.equal((await call(`${g}/unknown`, other))?.status, 403);
      // These historical reads are method-agnostic. Tightening methods is a separate API change.
      assert.equal((await call(`/api/teacher/${fight.teacherId}/guilds`, owner, "POST"))?.status, 200);
      assert.equal((await call(`${p}/currency`, own, "POST"))?.status, 200);
    });

    await t.test("guild, quest, item, student and report routes keep tenant/role boundaries", async () => {
      for (const tail of ["", "/members", "/settings", "/fights", "/active-sessions", "/quests", "/leaderboard"]) {
        assert.equal((await call(g + tail, owner))?.status, 200, tail);
        assert.equal((await call(g + tail, own))?.status, 200, tail);
        assert.equal((await call(g + tail, otherTeacher))?.status, 403, tail);
        assert.equal((await call(g + tail, other))?.status, 403, tail);
      }
      for (const tail of ["currency", "guilds", "equipment", "quests", "job-levels", "available-fights", "claim-gold"]) {
        assert.equal((await call(`${p}/${tail}`, other))?.status, 403, tail);
        assert.equal((await call(`${p}/${tail}`, owner))?.status, 403, tail);
      }
      assert.equal((await call(`${g}/quests/reconcile`, own, "POST", {}))?.status, 403);
      assert.equal((await call(`${g}/members/${member.id}`, other, "DELETE"))?.status, 403);
      assert.equal((await call(`/api/equipment-items/${item.id}`, otherTeacher))?.status, 403);
      assert.equal((await call(`/api/equipment-items/${item.id}`, other))?.status, 403);
      assert.equal((await call(`/api/equipment-items/${item.id}`, own, "DELETE"))?.status, 403);
      assert.equal((await call(`/api/teacher/${fight.teacherId}/equipment-items`, otherTeacher))?.status, 403);
      assert.equal((await call(`/api/combat-stats/fight/${fight.id}`, otherTeacher))?.status, 403);
      assert.equal((await call(`/api/combat-stats/fight/${fight.id}`, owner))?.status, 200);
      assert.equal((await call("/api/combat-stats/report", own))?.status, 403);
      assert.equal((await call("/api/combat-stats", owner, "POST", {}))?.status, 403);
      assert.equal((await call(`${p}/award-xp`, own, "POST", { amount: 999 }))?.status, 403);
    });

    await t.test("DTOs, input limits and sanitized dependency failures remain compatible", async () => {
      const members = await call(`${g}/members`, owner);
      for (const key of ["passwordHash", "nicknameNormalized", "loadoutRevision", "jobLoadouts"]) assert.ok(!(key in members!.body[0]), key);
      assert.equal(typeof members!.body[0].joinedAt, "number");
      const fights = await call(`${g}/fights`, own);
      assert.equal(fights!.body[0].questionCount, 1);
      assert.ok(!("questions" in fights!.body[0]));
      assert.equal(fights!.headers.get("Cache-Control"), "no-store");
      assert.equal((await call("/api/guilds", owner, "POST", { name: "x".repeat(201) }))?.status, 400);
      assert.equal((await call("/api/guilds", owner, "POST", undefined, undefined, "{"))?.status, 400);
      assert.equal((await call("/api/guilds", owner, "POST", { name: "x", ignored: "x".repeat(65536) }))?.status, 413);
      const failed = new Proxy(db, { get(target, key) { if (key === "select") return () => { throw new Error("private SQL credential detail"); }; const v = Reflect.get(target, key); return typeof v === "function" ? v.bind(target) : v; } }) as unknown as GameDatabase;
      const failure = await call(g, own, "GET", undefined, failed);
      assert.equal(failure?.status, 503);
      assert.deepEqual(failure?.body, { error: "Unable to complete request" });
    });

    await t.test("reward storage failure and lost acknowledgement retry never lose or duplicate gold", async () => {
      await db.insert(s.liveCombatSessions).values({ sessionId: "C09RETRY", fightId: fight.id, teacherId: fight.teacherId });
      const [result] = await db.insert(s.combatResults).values({ sessionId: "C09RETRY", fightId: fight.id, studentId: member.id, characterClass: "warrior", victory: true, survived: true, totals: {}, xpEarned: 0, lootTable: [{ itemId: item.id }], goldReward: 77 }).returning();
      const body = { fightId: fight.id, resultId: result.id };
      const inject = (afterCommit: boolean) => new Proxy(db, { get(target, key) {
        if (key === "execute") return async (...args: any[]) => { if (afterCommit) await (target.execute as any)(...args); throw new Error("injected storage acknowledgement failure"); };
        const v = Reflect.get(target, key); return typeof v === "function" ? v.bind(target) : v;
      } }) as unknown as GameDatabase;
      const saved = async () => (await db.select().from(s.students).where(eq(s.students.id, member.id)))[0];
      assert.equal((await call(`${p}/claim-gold`, own, "POST", body, inject(false)))?.status, 503);
      assert.equal((await saved()).gold, 1000);
      assert.equal((await call(`${p}/claim-gold`, own, "POST", body, inject(true)))?.status, 503);
      assert.equal((await saved()).gold, 1077);
      assert.equal((await call(`${p}/claim-gold`, own, "POST", body))?.status, 200);
      assert.equal((await saved()).gold, 1077);
      assert.equal((await call(`${p}/claim-loot`, own, "POST", { ...body, itemId: item.id }))?.status, 409);
      assert.equal((await saved()).inventory.includes(item.id), false);
    });
  } finally { await pg.close(); }
});
