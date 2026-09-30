import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import worker from "../../worker/index.ts";

// Run the real Worker routes, identity repository, and SQL against a disposable
// database. Only Neon's network boundary and Cloudflare bindings are replaced.
test("Worker integrates migrated auth, guilds, rooms, equipment, uploads, and revocation", async () => {
  const pg = new PGlite();
  const previousFetch = neonConfig.fetchFunction;
  const databaseErrors: string[] = [];
  let subrequests = 0;
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries) {
      await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    }
    neonConfig.fetchFunction = async (_url, init) => {
      if (++subrequests > 50) {
        databaseErrors.push("Worker external subrequest budget exceeded");
        throw new Error("Worker external subrequest budget exceeded");
      }
      const { query, params } = JSON.parse(init!.body as string);
      try {
        const result = await pg.query<any[]>(query, params, { rowMode: "array" });
        const rows = result.rows.map(row => row.map(value =>
          value === null ? null : value instanceof Date ? value.toISOString() :
          typeof value === "object" ? JSON.stringify(value) : String(value)));
        return Response.json({ rows, fields: result.fields, rowCount: result.affectedRows ?? rows.length });
      } catch (error: any) {
        databaseErrors.push(`${error.code}: ${error.message}`);
        return Response.json({ message: error.message, code: error.code }, { status: 400 });
      }
    };
    const objects = new Map<string, { bytes: Uint8Array; type: string }>();
    const env = {
      DATABASE_URL: "postgresql://test:test@local.example/test",
      PASSWORD_PEPPER: "local-only-pepper-012345678901234567890123",
      SESSION_SECRET: "local-only-secret-012345678901234567890123",
      SESSION_COOKIE_NAME: "qa_test_session",
      SESSION_TTL_SECONDS: "3600",
      STAGING_AUTH_TOKEN: "local-only-smoke",
      ENVIRONMENT: "test",
      PUBLIC_ORIGIN: "https://qa.example",
      ASSETS: { fetch: async () => new Response("SPA") },
      COMBAT_SESSIONS: {
        idFromName: (name: string) => name,
        get: () => ({ fetch: async () => Response.json({ status: "ready", allowed: true }) }),
      },
      OBJECTS: {
        head: async (key: string) => {
          const item = objects.get(key);
          return item ? { size: item.bytes.length, httpEtag: '"test-etag"', httpMetadata: { contentType: item.type } } : null;
        },
        get: async (key: string, options?: { range: { offset: number; length: number } }) => {
          const item = objects.get(key);
          const range = options?.range;
          return item ? { body: range ? item.bytes.slice(range.offset, range.offset + range.length) : item.bytes,
            size: item.bytes.length, httpEtag: '"test-etag"', httpMetadata: { contentType: item.type } } : null;
        },
        put: async (key: string, bytes: Uint8Array, options: any) => {
          objects.set(key, { bytes, type: options.httpMetadata.contentType });
        },
      },
    };
    async function api(path: string, method = "GET", cookie?: string, body?: unknown, status = 200) {
      subrequests = 0;
      const response = await worker.fetch(new Request(env.PUBLIC_ORIGIN + path, {
        method, headers: { Origin: env.PUBLIC_ORIGIN, ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }), env as any);
      const payload = await response.json();
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)} ${databaseErrors.join("; ")}`);
      return { payload, cookie: response.headers.get("set-cookie")?.split(";")[0], response };
    }
    const password = "local-acceptance-password";
    const teacherBody = (email: string) => ({ firstName: "Test", lastName: "Teacher", email, password,
      billingAddress: "Test", schoolDistrict: "Test", school: "Test", subject: "Math", gradeLevel: "10" });
    const teacher = await api("/api/teacher/signup", "POST", undefined, teacherBody("teacher@example.invalid"), 201);
    const other = await api("/api/teacher/signup", "POST", undefined, teacherBody("other@example.invalid"), 201);
    assert.match(teacher.response.headers.get("set-cookie")!, /HttpOnly; Secure; SameSite=Lax/);
    assert.equal(teacher.payload.passwordHash, undefined);
    await api("/api/teacher/login", "POST", undefined, { email: "teacher@example.invalid", password: "wrong" }, 401);
    const student = await api("/api/student/login", "POST", undefined, { nickname: "Test student", password });
    assert.equal(student.payload.passwordHash, undefined);
    await api(`/api/student/${student.payload.id}/character`, "PATCH", student.cookie, { characterClass: "wizard", gender: "A" });
    await api(`/api/student/${student.payload.id}/character`, "PATCH", student.cookie, { characterClass: "paladin", gender: "A" }, 403);
    const guild = await api("/api/guilds", "POST", teacher.cookie, { name: "Test guild" }, 201);
    await api(`/api/guilds/${guild.payload.id}/members`, "POST", student.cookie, { studentId: student.payload.id });
    await api(`/api/guilds/${guild.payload.id}/members`, "GET", other.cookie, undefined, 403);
    const quests = await api(`/api/guilds/${guild.payload.id}/quests`, "GET", student.cookie);
    assert.ok(quests.payload.length > 0);
    const quest = await api(`/api/guilds/${guild.payload.id}/quests`, "POST", teacher.cookie, {
      title: "Acceptance manual reward", description: "Exactly once", criteria: { type: "custom" }, rewards: { gold: 2 },
    }, 201);
    await api(`/api/guilds/${guild.payload.id}/quests/${quest.payload.id}`, "PATCH", teacher.cookie, { isCompleted: true });
    await api(`/api/guilds/${guild.payload.id}/quests/${quest.payload.id}`, "PATCH", teacher.cookie, { isCompleted: true });
    assert.equal((await api(`/api/student/${student.payload.id}`, "GET", student.cookie)).payload.gold, 2);
    const item = await api("/api/equipment-items", "POST", teacher.cookie, {
      name: "Test wand", itemType: "wand", weaponType: "staff", slot: "weapon", quality: "common", tier: 1, stats: { mat: 1 }, shopPrice: 1,
    }, 201);
    const fight = await api("/api/fights", "POST", teacher.cookie, {
      teacherId: teacher.payload.id, title: "Integration fight",
      questions: [{ id: "q1", type: "short_answer", question: "2+2?", correctAnswer: "4", timeLimit: 30 }],
      enemies: [{ id: "e1", name: "Slime", image: "/slime.png", difficultyMultiplier: 1 }],
      baseXP: 10, baseEnemyDamage: 1, enemyDisplayMode: "consecutive", lootTable: [{ itemId: item.payload.id }],
      randomizeQuestions: false, shuffleOptions: false,
    }, 201);
    await api(`/api/fights/${fight.payload.id}`, "GET", other.cookie, undefined, 403);
    await api(`/api/fights/${fight.payload.id}`, "GET", student.cookie, undefined, 401);
    await api(`/api/guilds/${guild.payload.id}/fights`, "POST", teacher.cookie, { fightId: fight.payload.id });
    const assignment = await api(`/api/guilds/${guild.payload.id}/fights`, "GET", student.cookie);
    assert.equal(assignment.payload[0].questions, undefined);
    const room = await api(`/api/fights/${fight.payload.id}/sessions`, "POST", teacher.cookie, undefined, 201);
    const resumed = await api(`/api/fights/${fight.payload.id}/sessions`, "POST", teacher.cookie);
    assert.equal(resumed.payload.sessionId, room.payload.sessionId);
    await api(`/api/sessions/${room.payload.sessionId}`, "GET", student.cookie);
    await api(`/api/student/${student.payload.id}/award-xp`, "POST", student.cookie, { xp: 100000 }, 403);
    await api("/api/objects/upload", "POST", student.cookie, undefined, 401);
    const upload = await api("/api/objects/upload", "POST", teacher.cookie);
    const image = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const put = (cookie: string, body: Uint8Array, type = "image/png") => worker.fetch(new Request(env.PUBLIC_ORIGIN + upload.payload.uploadURL, {
      method: "PUT", headers: { Origin: env.PUBLIC_ORIGIN, Cookie: cookie, "Content-Type": type }, body,
    }), env as any);
    assert.equal((await put(other.cookie!, image)).status, 403);
    assert.equal((await put(teacher.cookie!, image, "image/svg+xml")).status, 415);
    assert.equal((await put(teacher.cookie!, new Uint8Array([1, 2, 3]))).status, 415);
    assert.equal((await put(teacher.cookie!, image)).status, 201);
    assert.equal((await put(teacher.cookie!, image)).status, 409);
    const read = await worker.fetch(new Request(env.PUBLIC_ORIGIN + upload.payload.objectPath), env as any);
    assert.equal(read.status, 200);
    assert.equal(read.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(new Uint8Array(await read.arrayBuffer()), image);
    const objectRequest = (method: string, headers = {}) => worker.fetch(new Request(env.PUBLIC_ORIGIN + upload.payload.objectPath, { method, headers }), env as any);
    const partial = await objectRequest("GET", { Range: "bytes=0-3" });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), "bytes 0-3/8");
    assert.deepEqual(new Uint8Array(await partial.arrayBuffer()), image.slice(0, 4));
    const suffix = await objectRequest("GET", { Range: "bytes=-2" });
    assert.deepEqual(new Uint8Array(await suffix.arrayBuffer()), image.slice(-2));
    const unsatisfiable = await objectRequest("GET", { Range: "bytes=99-100" });
    assert.equal(unsatisfiable.status, 416);
    assert.equal(unsatisfiable.headers.get("content-range"), "bytes */8");
    assert.equal((await objectRequest("GET", { Range: "bytes=0-3", "If-Range": '"old-etag"' })).status, 200);
    const head = await objectRequest("HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "8");
    assert.equal(head.headers.get("etag"), '"test-etag"');
    assert.equal(await head.text(), "");
    await api("/api/not-a-route", "GET", undefined, undefined, 404);
    await api("/api/health/ready");
    const crossOrigin = await worker.fetch(new Request(env.PUBLIC_ORIGIN + "/api/guilds", {
      method: "POST", headers: { Origin: "https://wrong.example", Cookie: teacher.cookie! }, body: "{}",
    }), env as any);
    assert.equal(crossOrigin.status, 403);
    await api("/api/teacher/logout", "POST", teacher.cookie);
    await api("/api/teacher/check-session", "GET", teacher.cookie, undefined, 401);
    await api("/api/student/logout", "POST", student.cookie);
    await api(`/api/student/${student.payload.id}`, "GET", student.cookie, undefined, 401);
  } finally {
    neonConfig.fetchFunction = previousFetch;
    await pg.close();
  }
});
