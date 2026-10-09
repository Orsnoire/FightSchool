import assert from "node:assert/strict";
import { test } from "node:test";
import { issueSession } from "../../worker/auth/session.ts";
import { handleFights } from "../../worker/routes/fights.ts";
import { fight as legacyFight } from "../phase4/fixtures.ts";
const fight = { ...legacyFight, enemies: legacyFight.enemies.map(e => ({...e, enemyType: "slime", ai: {mode:"basic"}})) };
const config = {
  cookieName: "test_session",
  secret: "test-only-secret-not-deployed-1234567890",
  ttlSeconds: 300,
};
async function setup(
  actorId = fight.teacherId,
  role: "teacher" | "student" = "teacher",
) {
  const sessions = new Map();
  const records = new Map([[fight.id, fight]]);
  const repository: any = {
    createSession: async (s: any) => sessions.set(s.tokenHash, s),
    findActiveSession: async (k: string) => sessions.get(k) || null,
    listTeacherFights: async (id: string) =>
      [...records.values()].filter((f) => f.teacherId === id),
    findFightById: async (id: string) => records.get(id) || null,
    createFight: async (f: any) => ({
      ...f,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    validateLoot: async () => false,
    updateFight: async (id: string, teacherId: string, f: any) =>
      records.get(id)?.teacherId === teacherId
        ? { ...records.get(id), ...f }
        : null,
    deleteFight: async (id: string, teacherId: string) =>
      records.get(id)?.teacherId === teacherId && records.delete(id),
  };
  const cookie = (await issueSession(repository, config, role, actorId)).split(
    ";",
  )[0];
  return {
    repository,
    cookie,
    request: async (
      method: string,
      path: string,
      body?: unknown,
      authenticated = true,
    ) => {
      const url = new URL("https://qa.example" + path);
      const request = new Request(url, {
        method,
        headers: {
          ...(authenticated ? { Cookie: cookie } : {}),
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return handleFights(request, url, repository, config);
    },
  };
}
test("fight routes require signed teacher identity and enforce owner isolation", async () => {
  const h = await setup();
  assert.equal(
    (await h.request("GET", `/api/fights/${fight.id}`, undefined, false))
      ?.status,
    401,
  );
  assert.equal(
    (await h.request("GET", `/api/fights/${fight.id}`))?.status,
    200,
  );
  const other = await setup("00000000-0000-4000-8000-999999999999");
  assert.equal(
    (await other.request("GET", `/api/fights/${fight.id}`))?.status,
    403,
  );
  assert.equal(
    (await other.request("DELETE", `/api/fights/${fight.id}`))?.status,
    404,
  );
  assert.equal(
    (await other.request("POST", "/api/fights", fight))?.status,
    403,
  );
  const student = await setup(fight.teacherId, "student");
  assert.equal(
    (await student.request("GET", `/api/fights/${fight.id}`))?.status,
    401,
  );
});
test("teacher CRUD validates questions, enemies, bounds, and owned loot", async () => {
  const h = await setup();
  assert.equal((await h.request("POST", "/api/fights", fight))?.status, 201);
  assert.equal(
    (await h.request("POST", "/api/fights", { ...fight, enemies: [] }))?.status,
    400,
  );
  assert.equal(
    (await h.request("POST", "/api/fights", { ...fight, baseXP: 100000 }))
      ?.status,
    400,
  );
  assert.equal(
    (
      await h.request("POST", "/api/fights", {
        ...fight,
        lootTable: [{ itemId: crypto.randomUUID() }],
      })
    )?.status,
    403,
  );
  assert.equal(
    (
      await h.request("PATCH", `/api/fights/${fight.id}`, {
        ...fight,
        title: "Updated",
      })
    )?.status,
    200,
  );
  assert.equal(
    (await h.request("DELETE", `/api/fights/${fight.id}`))?.status,
    200,
  );
});
