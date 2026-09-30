import { handleGame } from "../../worker/routes/game.ts";
import { issueSession } from "../../worker/auth/session.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../../worker/db/schema.ts";
import {
  persistCombatResults,
  claimReward,
} from "../../worker/db/game-repository.ts";
import {
  seedGuildQuests,
  seedPersonalQuests,
  evaluateQuests,
} from "../../worker/progression/quests.ts";
import { fight, student, started } from "./fixtures.ts";
test("additive migrations preserve existing students; results and rewards are exactly once", async () => {
  const pg = new PGlite();
  try {
    const paths = [
      "0000_phase3_teacher_identity",
      "0001_phase3_teacher_fights",
      "0002_phase4_student_identity",
    ];
    for (const name of paths) {
      const sql = readFileSync(
        new URL(`../../migrations/cloudflare/${name}.sql`, import.meta.url),
        "utf8",
      );
      await pg.exec(sql);
    }
    await pg.query(
      `INSERT INTO teachers(id,first_name,last_name,email,email_normalized,password_hash,guild_code,billing_address,school_district,school,subject,grade_level) VALUES($1,'Test','Teacher','test@example.invalid','test@example.invalid','never-valid','ABCDEF','Test','Test','Test','Math','5')`,
      [fight.teacherId],
    );
    await pg.query(
      `INSERT INTO students(id,nickname,nickname_normalized,password_hash,character_class,gender) VALUES($1,'Existing student','existing student','never-valid','warrior','A')`,
      [student().id],
    );
    for (const name of [
      "0003_progression_guilds_results",
      "0004_quest_seed_uniqueness",
      "0005_history_preservation",
    ])
      await pg.exec(
        readFileSync(
          new URL(`../../migrations/cloudflare/${name}.sql`, import.meta.url),
          "utf8",
        ),
      );
    const preserved = await pg.query<any>(
      "SELECT nickname,password_hash,gold,inventory FROM students WHERE id=$1",
      [student().id],
    );
    assert.equal(preserved.rows[0].nickname, "Existing student");
    assert.equal(preserved.rows[0].password_hash, "never-valid");
    assert.equal(preserved.rows[0].gold, 0);
    const db = drizzle(pg, { schema });
    await db.insert(schema.fights).values(fight);
    await db.insert(schema.liveCombatSessions).values({
      sessionId: "ABC234",
      fightId: fight.id,
      teacherId: fight.teacherId,
    });
    const [item] = await db
      .insert(schema.equipmentItems)
      .values({
        teacherId: fight.teacherId,
        name: "Test sword",
        itemType: "sword",
        quality: "common",
        slot: "weapon",
        weaponType: "sword",
      })
      .returning();
    const snapshot = started();
    snapshot.currentPhase = "game_over";
    snapshot.victory = true;
    snapshot.players[student().id].totals.questionsCorrect = 3;
    const earnedFight = { ...fight, lootTable: [{ itemId: item.id }] };
    await persistCombatResults(db as any, snapshot, earnedFight);
    await persistCombatResults(
      db as any,
      JSON.parse(JSON.stringify(snapshot)),
      earnedFight,
    );
    const results = await db.select().from(schema.combatResults);
    assert.equal(results.length, 1);
    assert.equal(results[0].xpEarned, 13);
    const jobs = await db.select().from(schema.studentJobLevels);
    assert.equal(jobs[0].experience, 13);
    assert.equal(jobs[0].level, 2);
    await claimReward(db as any, student().id, fight.id, null, results[0].id);
    await claimReward(db as any, student().id, fight.id, null, results[0].id);
    assert.equal((await db.select().from(schema.students))[0].gold, 10);
    await assert.rejects(
      () =>
        claimReward(db as any, student().id, fight.id, item.id, results[0].id),
      /already/,
    );
    const [guild] = await db
      .insert(schema.guilds)
      .values({
        teacherId: fight.teacherId,
        name: "Test guild",
        code: "TEST01",
      })
      .returning();
    await db
      .insert(schema.guildMemberships)
      .values({ guildId: guild.id, studentId: student().id });
    await seedGuildQuests(db as any, guild.id);
    await seedGuildQuests(db as any, guild.id);
    await seedPersonalQuests(db as any, student().id, guild.id);
    await seedPersonalQuests(db as any, student().id, guild.id);
    assert.equal((await db.select().from(schema.quests)).length, 59);
    const [quest] = await db
      .insert(schema.quests)
      .values({
        guildId: guild.id,
        studentId: student().id,
        questType: "teacher_custom",
        title: "Teacher award",
        description: "A manually completed quest",
        criteria: { type: "custom" },
        rewards: { gold: 20, guildXP: 50, unlockTier: 3 },
      })
      .returning();
    await evaluateQuests(db as any, guild.id, quest.id);
    await evaluateQuests(db as any, guild.id, quest.id);
    assert.equal((await db.select().from(schema.students))[0].gold, 30);
    const updated = (
      await db
        .select()
        .from(schema.guilds)
        .where(eq(schema.guilds.id, guild.id))
    )[0];
    assert.equal(updated.experience, 50);
    assert.equal(updated.unlockedTier, 3);

    const sessions = new Map<string, any>();
    const repository: any = {
      createSession: async (record: any) =>
        sessions.set(record.tokenHash, record),
      findActiveSession: async (key: string) => sessions.get(key) || null,
    };
    const config = {
      cookieName: "test_session",
      secret: "test-only-secret-not-deployed-1234567890",
      ttlSeconds: 300,
    };
    const cookie = (
      await issueSession(repository, config, "student", student().id)
    ).split(";")[0];
    const call = async (path: string, method = "GET", body?: unknown) => {
      const url = new URL("https://qa.example" + path);
      return handleGame(
        new Request(url, {
          method,
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        url,
        repository,
        config,
        db as any,
      );
    };
    assert.equal((await call(`/api/guilds/${guild.id}/members`))?.status, 200);
    assert.equal(
      (
        await call(`/api/guilds/${guild.id}/progression`, "PATCH", {
          experience: 999999,
        })
      )?.status,
      403,
    );
    assert.equal(
      (
        await call(
          "/api/student/00000000-0000-4000-8000-999999999999/job-levels",
        )
      )?.status,
      403,
    );
    assert.equal(
      (await call("/api/equipment-items", "POST", { name: "Forged item" }))
        ?.status,
      403,
    );
    assert.equal(
      (
        await call(`/api/student/${student().id}/award-xp`, "POST", {
          xp: 1000,
        })
      )?.status,
      403,
    );
    assert.equal(
      (
        await call(`/api/student/${student().id}/equipment`, "PATCH", {
          weapon: crypto.randomUUID(),
        })
      )?.status,
      400,
    );
  } finally {
    await pg.close();
  }
});
