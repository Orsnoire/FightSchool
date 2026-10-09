import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { instanceLoot } from "../../shared/combat/instance-loot";
import { issueSession, type SessionRepository, type SessionRecord } from "../../worker/auth/session";
import { addStudent, initialCombatState } from "../../worker/combat/engine";
import { persistCombatResults, type GameDatabase } from "../../worker/db/game-repository";
import type { IdentityRepository } from "../../worker/db/repository";
import * as s from "../../worker/db/schema";
import { handleGame } from "../../worker/routes/game";
import { fight, student } from "./fixtures";

// Exercise the HTTP parser, signed-session identity, earned-result lookup and
// atomic SQL award together. Only session storage uses an in-memory substitute.
test("reward claims validate IDs without bypassing earned loot or one-choice receipts", async (t) => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema: s });
  const gameDb = db as unknown as GameDatabase;
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries) {
      await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    }
    await db.insert(s.teachers).values({
      id: fight.teacherId, firstName: "Test", lastName: "Teacher",
      email: "claims@example.invalid", emailNormalized: "claims@example.invalid",
      passwordHash: "unused", guildCode: "CLAIMS", billingAddress: "Test",
      schoolDistrict: "Test", school: "Test", subject: "Test", gradeLevel: "5",
    });
    const otherFight = { ...fight, id: "00000000-0000-4000-8000-000000000012" };
    await db.insert(s.fights).values([fight, otherFight]);
    const [owner, other] = await db.insert(s.students).values([
      student(), student("priest", "00000000-0000-4000-8000-000000000013"),
    ]).returning();
    const customId = "00000000-0000-4000-8000-000000000014";
    await db.insert(s.equipmentItems).values({
      id: customId, teacherId: fight.teacherId, name: "Earned custom sword",
      itemType: "sword", quality: "common", tier: 1, slot: "weapon", stats: { atk: 2 },
    });
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
    const config = { cookieName: "claim_test", secret: "test-only-claim-secret-not-deployed-123456", ttlSeconds: 300 };
    const ownerCookie = (await issueSession(repository, config, "student", owner.id)).split(";")[0];
    const otherCookie = (await issueSession(repository, config, "student", other.id)).split(";")[0];
    const teacherCookie = (await issueSession(repository, config, "teacher", fight.teacherId)).split(";")[0];
    const call = async (body: unknown, tail = "claim-loot", cookie = ownerCookie, studentId = owner.id) => {
      const url = new URL(`https://qa.example/api/student/${studentId}/${tail}`);
      const response = await handleGame(new Request(url, {
        method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }), url, repository, config, gameDb);
      assert.ok(response, "the real claim route handles the request");
      return { status: response.status, body: await response.json() };
    };
    const ok = (response: Awaited<ReturnType<typeof call>>) => {
      assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.success, true);
    };
    const savedStudent = async () => (await db.select().from(s.students).where(eq(s.students.id, owner.id)))[0];
    const receipt = async (id: string) => (await db.select().from(s.combatResults).where(eq(s.combatResults.id, id)))[0];
    let sequence = 0;
    const reward = async (options: {
      loot?: { itemId: string }[]; participant?: s.StudentRecord;
      encounter?: s.FightRecord; victory?: boolean; participated?: boolean; endedByHost?: boolean;
    } = {}) => {
      const sessionId = `RWD${String(++sequence).padStart(3, "0")}`;
      const participant = options.participant ?? owner;
      const encounter = { ...(options.encounter ?? fight), lootTable: options.loot ?? instanceLoot([], sessionId) };
      await db.insert(s.liveCombatSessions).values({ sessionId, fightId: encounter.id, teacherId: fight.teacherId });
      const state = addStudent(initialCombatState(sessionId, encounter), participant);
      state.currentPhase = "game_over";
      state.victory = options.victory ?? true;
      state.endedByHost = options.endedByHost ?? false;
      state.completedRounds = 1;
      state.players[participant.id].roundsParticipated = options.participated === false ? 0 : 1;
      const [result] = await persistCombatResults(gameDb, state, encounter);
      return result;
    };

    await t.test("earned custom UUID items still claim and retry exactly once", async () => {
      const result = await reward({ loot: [{ itemId: customId }] });
      const body = { fightId: fight.id, resultId: result.id, itemId: customId };
      const before = await savedStudent();
      ok(await call(body));
      ok(await call(body));
      const saved = await savedStudent();
      assert.equal(saved.inventory.filter(id => id === customId).length, 1);
      assert.equal(saved.gold, before.gold);
      assert.equal((await receipt(result.id)).rewardClaim, customId);
    });

    await t.test("all four fallback choices accept built-in IDs at the HTTP boundary", async () => {
      const choices = instanceLoot([], "CLAIM1");
      assert.equal(choices.length, 4);
      for (const { itemId } of choices) {
        const result = await reward({ loot: choices });
        const before = await savedStudent();
        const body = { fightId: fight.id, resultId: result.id, itemId };
        ok(await call(body));
        ok(await call(body));
        assert.equal((await savedStudent()).inventory.filter(id => id === itemId).length, 1);
        assert.equal((await receipt(result.id)).rewardClaim, itemId);
        const alternative = choices.find(item => item.itemId !== itemId)!;
        assert.equal((await call({ ...body, itemId: alternative.itemId })).status, 409);
        assert.equal((await call(body, "claim-gold")).status, 409);
        assert.equal((await savedStudent()).gold, before.gold, "equipment does not also grant choice gold");
      }
    });

    await t.test("malformed IDs and valid but unearned items cannot mutate rewards", async () => {
      const result = await reward({ loot: [{ itemId: customId }] });
      const body = { fightId: fight.id, resultId: result.id, itemId: customId };
      const before = await savedStudent();
      for (const itemId of [null, 42, "", "t1_unknown", "__proto__", "constructor", "toString"]) {
        assert.deepEqual(await call({ ...body, itemId }), { status: 400, body: { error: "Invalid request" } });
      }
      assert.deepEqual(await call({ fightId: fight.id, resultId: result.id }), { status: 400, body: { error: "Choose an item" } });
      assert.equal((await call({ ...body, fightId: "t1_healer_potion" })).status, 400);
      assert.equal((await call({ ...body, resultId: "t1_healer_potion" })).status, 400);
      for (const itemId of ["t1_healer_potion", "00000000-0000-4000-8000-000000000099"]) {
        assert.deepEqual(await call({ ...body, itemId }), { status: 400, body: { error: "Item is not in the earned loot table" } });
      }
      assert.deepEqual(await savedStudent(), before);
      assert.equal((await receipt(result.id)).rewardClaim, null);
    });

    await t.test("claims remain scoped to the authenticated student and exact fight/result", async () => {
      const result = await reward({ loot: [{ itemId: customId }] });
      const otherResult = await reward({ loot: [{ itemId: customId }], participant: other });
      const body = { fightId: fight.id, resultId: result.id, itemId: customId };
      const before = await savedStudent();
      assert.equal((await call(body, "claim-loot", "")).status, 401);
      assert.equal((await call(body, "claim-loot", otherCookie)).status, 403);
      assert.equal((await call(body, "claim-loot", teacherCookie)).status, 403);
      assert.equal((await call(body, "claim-loot", ownerCookie, other.id)).status, 403);
      assert.equal((await call({ ...body, resultId: otherResult.id })).status, 409);
      assert.equal((await call({ ...body, fightId: otherFight.id })).status, 409);
      assert.deepEqual(await savedStudent(), before);
      assert.equal((await receipt(result.id)).rewardClaim, null);
      assert.equal((await receipt(otherResult.id)).rewardClaim, null);
    });

    await t.test("defeat, host-ended and nonparticipating results offer no loot", async () => {
      for (const options of [{ victory: false }, { victory: false, endedByHost: true }, { participated: false }]) {
        const result = await reward({ ...options, loot: [{ itemId: customId }] });
        const before = await savedStudent();
        assert.deepEqual(result.lootTable, []);
        assert.equal((await call({ fightId: fight.id, resultId: result.id, itemId: customId })).status, 409);
        assert.deepEqual(await savedStudent(), before);
      }
    });

    await t.test("gold and the legacy optional result ID retain one-choice behavior", async () => {
      const result = await reward({ encounter: otherFight, loot: [{ itemId: customId }] });
      const before = await savedStudent();
      const body = { fightId: otherFight.id }; // Older clients may omit resultId.
      ok(await call(body, "claim-gold"));
      ok(await call(body, "claim-gold"));
      assert.equal((await call({ ...body, resultId: result.id, itemId: customId })).status, 409);
      const saved = await savedStudent();
      assert.equal(saved.gold, before.gold + result.goldReward);
      assert.deepEqual(saved.inventory, before.inventory);
      assert.equal((await receipt(result.id)).rewardClaim, "gold");
    });

    await t.test("simultaneous HTTP claims never duplicate an inventory award", async () => {
      // A distinct owner starts with an empty inventory for this race.
      const otherResult = await reward({ loot: [{ itemId: customId }], participant: other });
      const body = { fightId: fight.id, resultId: otherResult.id, itemId: customId };
      const responses = await Promise.all([call(body, "claim-loot", otherCookie, other.id), call(body, "claim-loot", otherCookie, other.id)]);
      assert.ok(responses.some(response => response.status === 200));
      assert.ok(responses.every(response => [200, 409].includes(response.status)));
      ok(await call(body, "claim-loot", otherCookie, other.id));
      const [saved] = await db.select().from(s.students).where(eq(s.students.id, other.id));
      assert.equal(saved.inventory.filter(id => id === customId).length, 1);
      assert.equal((await receipt(otherResult.id)).rewardClaim, customId);
    });
  } finally {
    await pg.close();
  }
});
