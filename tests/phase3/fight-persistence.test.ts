import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../../worker/routes/fights.ts", import.meta.url);
const workerPath = new URL("../../worker/index.ts", import.meta.url);
const schemaPath = new URL("../../worker/db/schema.ts", import.meta.url);
const migrationPath = new URL("../../migrations/cloudflare/0001_phase3_teacher_fights.sql", import.meta.url);

test("fight routes cover the existing teacher create and dashboard workflow", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /request\.method === "POST" && url\.pathname === "\/api\/fights"/);
  assert.match(route, /request\.method === "GET" && url\.pathname\.match\(\/\^\\\/api\\\/teacher/);
  assert.match(route, /request\.method === "GET" && fightMatch/);
  assert.match(route, /request\.method === "PATCH" && fightMatch/);
  assert.match(route, /request\.method === "DELETE" && fightMatch/);
});

test("fight writes and reads require the signed-in teacher and enforce ownership", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /authenticateSession\(request, repository, sessionConfig, "teacher"\)/);
  assert.match(route, /input\.teacherId !== session\.actorId/);
  assert.match(route, /fight\.teacherId === session\.actorId/);
  assert.match(route, /repository\.updateFight\(fightMatch\[1\], session\.actorId/);
  assert.match(route, /repository\.deleteFight\(fightMatch\[1\], session\.actorId\)/);
});

test("fight input is bounded while preserving legacy unknown-field stripping", async () => {
  const route = await readFile(routePath, "utf8");

  assert.match(route, /1_048_576/);
  assert.match(route, /questions: z\.array\(questionSchema\)\.min\(1\)\.max\(1_000\)/);
  assert.doesNotMatch(route, /fightSchema[\s\S]*?\.strict\(\)/);
});

test("worker dispatches fight routes before the generic API 404", async () => {
  const worker = await readFile(workerPath, "utf8");
  const fightDispatch = worker.indexOf('url.pathname === "/api/fights"');
  const notFound = worker.indexOf('url.pathname === "/api"');

  assert.ok(fightDispatch > -1);
  assert.ok(notFound > fightDispatch);
});

test("fight storage is additive and tied to teacher ownership", async () => {
  const [schema, migration] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(migrationPath, "utf8"),
  ]);

  assert.match(schema, /export const fights = pgTable\("fights"/);
  assert.match(schema, /references\(\(\) => teachers\.id, \{ onDelete: "cascade" \}\)/);
  assert.match(migration, /REFERENCES "public"\."teachers"\("id"\) ON DELETE cascade/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS "fights_teacher_idx"/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)/i);
});
