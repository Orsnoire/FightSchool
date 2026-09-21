import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { hashPassword, verifyPassword } from "../../worker/auth/crypto.ts";
import {
  authenticateSession,
  issueSession,
  revokeRequestSession,
  type SessionRecord,
  type SessionRepository,
} from "../../worker/auth/session.ts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(new URL(path, "file://" + repoRoot + "/"), "utf8");

class MemorySessions implements SessionRepository {
  records = new Map<string, SessionRecord & { revokedAt?: Date }>();

  async createSession(input: {
    tokenHash: string;
    actorType: "teacher" | "student";
    actorId: string;
    expiresAt: Date;
  }) {
    this.records.set(input.tokenHash, input);
  }

  async findActiveSession(tokenHash: string, now: Date) {
    const record = this.records.get(tokenHash);
    return record && !record.revokedAt && record.expiresAt > now ? record : null;
  }

  async revokeSession(tokenHash: string, now: Date) {
    const record = this.records.get(tokenHash);
    if (record) record.revokedAt = now;
  }
}

test("password hashes are salted, versioned, and reject incorrect credentials", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.match(first, /^pbkdf2_sha256\$600000\$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("incorrect", first), false);
  assert.equal(await verifyPassword("password", "malformed"), false);
});

test("signed opaque sessions are revocable and use hardened cookies", async () => {
  const repository = new MemorySessions();
  const config = {
    cookieName: "qa_staging_session",
    secret: "a-development-only-secret-that-is-at-least-32-bytes",
    ttlSeconds: 3600,
  };
  const setCookie = await issueSession(repository, config, "teacher", "teacher-id");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);

  const cookie = setCookie.split(";", 1)[0];
  const request = new Request("https://example.test/api/teacher/check-session", {
    headers: { cookie },
  });
  assert.equal((await authenticateSession(request, repository, config, "teacher"))?.actorId, "teacher-id");
  assert.equal(await authenticateSession(request, repository, config, "student"), null);

  await revokeRequestSession(request, repository, config);
  assert.equal(await authenticateSession(request, repository, config, "teacher"), null);
});

test("Phase 3 configuration is migration-backed and fails closed", () => {
  const worker = read("worker/index.ts");
  const schema = read("worker/db/schema.ts");
  const migration = read("migrations/cloudflare/0000_phase3_teacher_identity.sql");
  const wrangler = read("wrangler.jsonc");
  const deploy = read(".github/workflows/deploy-cloudflare-staging.yml");
  const migrate = read(".github/workflows/migrate-neon-staging.yml");

  assert.match(schema, /emailNormalized/);
  assert.match(schema, /tokenHash/);
  assert.match(migration, /teachers_email_normalized_unique/);
  assert.match(migration, /app_sessions_actor_type_check/);
  assert.match(worker, /Forbidden origin/);
  assert.match(worker, /Identity service unavailable/);
  assert.match(worker, /handleTeacherAuth/);
  assert.match(wrangler, /"DATABASE_URL"/);
  assert.match(wrangler, /"SESSION_SECRET"/);
  assert.match(deploy, /secrets\.DATABASE_URL/);
  assert.match(deploy, /secrets\.SESSION_SECRET/);
  assert.match(migrate, /db:migrate:cloudflare/);
  assert.doesNotMatch(migration, /INSERT INTO/i);
});
