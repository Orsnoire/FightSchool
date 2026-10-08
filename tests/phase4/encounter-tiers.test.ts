import { test } from "node:test";
import assert from "node:assert/strict";
import { enemyTuning, ENEMY_ROLES } from "../../shared/encounter-tiers";
import {
  initialCombatState,
  addStudent,
  scaleEncounter,
} from "../../worker/combat/engine";
import { handleFights } from "../../worker/routes/fights";
import { issueSession } from "../../worker/auth/session";
import { fight, student } from "./fixtures";
test("tier/role presets are monotonic and change a single enemy HP budget; legacy fights remain unchanged", () => {
  for (let tier = 1; tier <= 4; tier++) {
    let previous = 0,
      health = 0;
    for (const role of ENEMY_ROLES) {
      const tuning = enemyTuning(tier, role);
      assert.ok(tuning.rawCounterattack >= previous);
      previous = tuning.rawCounterattack;
      const f = {
        ...fight,
        encounterTier: tier,
        baseEnemyDamage: tuning.baseEnemyDamage,
        enemies: [
          {
            ...fight.enemies[0],
            role,
            difficultyMultiplier: tuning.difficultyMultiplier,
          },
        ],
      };
      const state = addStudent(initialCombatState("TIER01", f), student());
      const hp = scaleEncounter(state, f).enemies[0].health;
      assert.ok(hp >= health);
      health = hp;
      if (tier > 1)
        assert.ok(
          tuning.rawCounterattack >=
            enemyTuning(tier - 1, role).rawCounterattack,
        );
    }
  }
  const legacy = addStudent(initialCombatState("LEGACY", fight), student());
  assert.deepEqual(
    scaleEncounter(legacy, fight),
    scaleEncounter(legacy, { ...fight, encounterTier: null }),
  );
});
test("fight API derives scaling from tier/role instead of accepting conflicting client values", async () => {
  const sessions = new Map();
  let stored: any;
  const repo: any = {
    createSession: async (r: any) => sessions.set(r.tokenHash, r),
    findActiveSession: async (k: string) => sessions.get(k),
    createFight: async (input: any) => {
      stored = input;
      return {
        ...input,
        id: fight.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
  };
  const config = {
    cookieName: "session",
    secret: "test-only-secret-01234567890123456789",
    ttlSeconds: 300,
  };
  const cookie = (
    await issueSession(repo, config, "teacher", fight.teacherId)
  ).split(";")[0];
  const save = async (body: any) => {
    const url = new URL("https://qa.example/api/fights");
    return handleFights(
      new Request(url, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      url,
      repo,
      config,
    );
  };
  assert.equal(
    (
      await save({
        ...fight,
        encounterTier: 2,
        baseEnemyDamage: 9,
        enemies: [
          { ...fight.enemies[0], role: "boss", difficultyMultiplier: 1 },
        ],
      })
    )?.status,
    201,
  );
  assert.equal(stored.baseEnemyDamage, 2);
  assert.equal(stored.enemies[0].difficultyMultiplier, 52);
  assert.equal((await save({ ...fight, encounterTier: 2 }))?.status, 400);
  assert.equal((await save({ ...fight, encounterTier: 5 }))?.status, 400);
  assert.equal((await save(fight))?.status, 201);
  assert.equal(stored.baseEnemyDamage, fight.baseEnemyDamage);
});
