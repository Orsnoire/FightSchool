import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import worker from "../../worker/index";

/** Real Worker + real SQL, with only external transport and bindings replaced. */
export async function mathAuthoringFixture() {
  const pg = new PGlite();
  const previousFetch = neonConfig.fetchFunction;
  const queries: string[] = [];
  let roomCalls = 0;
  neonConfig.fetchFunction = async (_url, init) => {
    const { query, params } = JSON.parse(init!.body as string);
    queries.push(query);
    try {
      const result = await pg.query<any[]>(query, params, { rowMode: "array" });
      const rows = result.rows.map(row => row.map(value => value === null ? null : value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value)));
      return Response.json({ rows, fields: result.fields, rowCount: result.affectedRows ?? rows.length });
    } catch (error: any) { return Response.json({ message: error.message, code: error.code }, { status: 400 }); }
  };
  const env = {
    DATABASE_URL: "postgresql://test:test@local.example/math",
    PASSWORD_PEPPER: "local-only-math-pepper-012345678901234567890",
    SESSION_SECRET: "local-only-math-secret-012345678901234567890",
    SESSION_COOKIE_NAME: "math_test", SESSION_TTL_SECONDS: "3600", STAGING_AUTH_TOKEN: "local-only",
    ENVIRONMENT: "test", PUBLIC_ORIGIN: "https://qa.example",
    ASSETS: { fetch: async () => new Response("SPA") },
    COMBAT_SESSIONS: { idFromName: (name: string) => name, get: (name: string) => ({ fetch: async () => {
      if (name.startsWith("rate:")) return Response.json({ allowed: true });
      roomCalls++; throw new Error("Math authoring must not access a combat room");
    } }) },
  };
  async function send(path: string, method = "GET", cookie?: string, body?: unknown, origin = env.PUBLIC_ORIGIN) {
    return worker.fetch(new Request(env.PUBLIC_ORIGIN + path, { method,
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env as any);
  }
  async function api(path: string, method = "GET", cookie?: string, body?: unknown, status = 200) {
    const response = await send(path, method, cookie, body);
    const data: any = await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    return { data, response, cookie: response.headers.get("Set-Cookie")?.split(";")[0] };
  }
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries) if (tag !== "0026_math_templates")
      await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    const body = (email: string) => ({ firstName: "Local", lastName: "Teacher", email, password: "local-only-password",
      billingAddress: "Fixture", schoolDistrict: "Fixture", school: "Fixture", subject: "Math", gradeLevel: "10" });
    const teacher = await api("/api/teacher/signup", "POST", undefined, body("math@example.invalid"), 201);
    const other = await api("/api/teacher/signup", "POST", undefined, body("other@example.invalid"), 201);
    const student = await api("/api/student/login", "POST", undefined, { nickname: "Math fixture", password: "local-only-password" });
    const fight = await api("/api/fights", "POST", teacher.cookie, { teacherId: teacher.data.id, title: "Preserved fixed quiz",
      questions: [{ id: "fixed", type: "short_answer", question: "One half?", correctAnswer: "1/2", timeLimit: 30 }],
      enemies: [{ id: "slime", name: "Slime", image: "/enemies/slime-v2.png", enemyType: "slime", difficultyMultiplier: 10 }] }, 201);
    const names = (await pg.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r => r.tablename);
    const snapshot = async () => {
      const rows: Record<string, unknown> = {};
      for (const name of names) rows[name] = (await pg.query(`SELECT row_to_json(t)::text AS value FROM "${name}" t ORDER BY row_to_json(t)::text`)).rows;
      return rows;
    };
    const before = await snapshot();
    await pg.exec(readFileSync(new URL("../../migrations/cloudflare/0026_math_templates.sql", import.meta.url), "utf8"));
    assert.deepEqual(await snapshot(), before, "new migration preserves every row in all existing public tables");
    return { pg, env, queries, send, api, teacher, other, student, fight, snapshot, roomCalls: () => roomCalls,
      close: async () => { neonConfig.fetchFunction = previousFetch; await pg.close(); } };
  } catch (error) { neonConfig.fetchFunction = previousFetch; await pg.close(); throw error; }
}
