import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(new URL(path, `file://${root}/`), "utf8");
const worker = read("worker/index.ts");
const object = read("worker/combat/session-object.ts");
const host = read("client/src/pages/HostFight.tsx");
const student = read("client/src/pages/Combat.tsx");
const migration = read("migrations/cloudflare/0002_phase4_student_identity.sql");

test("upgrade identity comes from the signed server session", () => {
  assert.match(worker, /authenticateSession\(request, repository, sessionConfig\)/);
  assert.match(worker, /x-questacademy-actor-id/);
  assert.match(worker, /request\.headers\.get\("origin"\) !== env\.PUBLIC_ORIGIN/);
  assert.doesNotMatch(host, /type: "host", fightId/);
  assert.doesNotMatch(student, /type: "join", studentId/);
});

test("one Durable Object owns room state, deadlines, reconnects, and idempotency", () => {
  assert.match(object, /state\.storage\.put\(ROOM_KEY/);
  assert.match(object, /state\.storage\.setAlarm/);
  assert.match(object, /COMMAND_PREFIX \+ attachment\.actorId/);
  assert.match(object, /state\.getWebSockets\(\)/);
  assert.match(object, /publicQuestion/);
  assert.match(object, /currentAnswer: null/);
});

test("live schema is additive and does not touch legacy data", () => {
  assert.match(migration, /CREATE TABLE(?: IF NOT EXISTS)? "students"/);
  assert.match(migration, /CREATE TABLE(?: IF NOT EXISTS)? "live_combat_sessions"/);
  assert.doesNotMatch(migration, /DROP|TRUNCATE|DELETE FROM/i);
});
