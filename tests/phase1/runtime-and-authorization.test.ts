import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isTeacherAuthorized } from "../../server/auth.ts";
import { loadRuntimeConfig } from "../../server/config.ts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(new URL(path, "file://" + repoRoot + "/"), "utf8");

test("production configuration fails closed without required secrets", () => {
  assert.throws(
    () => loadRuntimeConfig({ NODE_ENV: "production", DATABASE_URL: "postgres://example" }),
    /SESSION_SECRET must be set/,
  );
  assert.throws(
    () => loadRuntimeConfig({ NODE_ENV: "production", SESSION_SECRET: "secret" }),
    /DATABASE_URL must be set/,
  );
});

test("production configuration rejects startup seed data", () => {
  assert.throws(
    () => loadRuntimeConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example",
      SESSION_SECRET: "secret",
      SEED_DEVELOPMENT_DATA: "1",
    }),
    /cannot be enabled in production/,
  );
});

test("development seed data requires explicit opt-in", () => {
  const defaultConfig = loadRuntimeConfig({
    NODE_ENV: "development",
    DATABASE_URL: "postgres://example",
  });
  const optedInConfig = loadRuntimeConfig({
    NODE_ENV: "development",
    DATABASE_URL: "postgres://example",
    SEED_DEVELOPMENT_DATA: "1",
  });

  assert.equal(defaultConfig.seedDevelopmentData, false);
  assert.equal(optedInConfig.seedDevelopmentData, true);
});

test("teacher authorization rejects missing and cross-teacher identities", () => {
  assert.equal(isTeacherAuthorized(undefined, "teacher-a"), false);
  assert.equal(isTeacherAuthorized("teacher-a", "teacher-b"), false);
  assert.equal(isTeacherAuthorized("teacher-a", "teacher-a"), true);
});

test("teacher-scoped reads and fight mutations enforce ownership", () => {
  const routes = read("server/routes.ts");

  assert.match(routes, /app\.get\("\/api\/teacher\/:id", requireAuth, requireTeacherParamOwnership\("id"\)/);
  assert.match(routes, /app\.get\("\/api\/teacher\/:teacherId\/fights", requireAuth, requireTeacherParamOwnership\("teacherId"\)/);
  assert.match(routes, /app\.get\("\/api\/teacher\/:teacherId\/equipment-items", requireAuth, requireTeacherParamOwnership\("teacherId"\)/);
  assert.match(routes, /app\.get\("\/api\/teacher\/:teacherId\/guilds", requireAuth, requireTeacherParamOwnership\("teacherId"\)/);
  assert.match(routes, /app\.post\("\/api\/fights", requireAuth,[\s\S]*?isTeacherAuthorized\(req\.session\.teacherId, data\.teacherId\)/);
  assert.match(routes, /app\.patch\("\/api\/fights\/:id", requireAuth,[\s\S]*?isTeacherAuthorized\(req\.session\.teacherId, existingFight\.teacherId\)/);
  assert.match(routes, /app\.delete\("\/api\/fights\/:id", requireAuth,[\s\S]*?isTeacherAuthorized\(req\.session\.teacherId, existingFight\.teacherId\)/);
});

test("legacy runtime exposes health checks, JSON API misses, and redacted request logs", () => {
  const index = read("server/index.ts");

  assert.match(index, /app\.get\("\/api\/health\/live"/);
  assert.match(index, /app\.get\("\/api\/health\/ready"/);
  assert.match(index, /await pool\.query\("select 1"\)/);
  assert.match(index, /app\.use\("\/api"[\s\S]*?status\(404\)\.json\(\{ error: "API route not found" \}\)/);
  assert.match(index, /event: "http_request"/);
  assert.doesNotMatch(index, /capturedJsonResponse|JSON\.stringify\(bodyJson\)/);
  assert.doesNotMatch(read("server/routes.ts"), /submitted answer:[\s\S]*?message\.answer/);
});

test("session cookie and request correlation match the migration contract", () => {
  const index = read("server/index.ts");

  assert.match(index, /sameSite: "lax"/);
  assert.match(index, /path: "\/"/);
  assert.match(index, /httpOnly: true/);
  assert.match(index, /res\.setHeader\("X-Request-Id", requestId\)/);
  assert.match(read("server/routes.ts"), /res\.clearCookie\("connect\.sid", \{[\s\S]*?path: "\/"[\s\S]*?sameSite: "lax"/);
});
