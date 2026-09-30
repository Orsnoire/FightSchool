import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../worker/db/schema.ts";
import { persistCombatResults } from "../../worker/db/game-repository.ts";
import { evaluateQuests, seedPersonalQuests } from "../../worker/progression/quests.ts";
import { addStudent, initialCombatState } from "../../worker/combat/engine.ts";
import { fight, student } from "./fixtures.ts";

test("thirty-player results and retries fit the Worker query budget", async () => {
  const pg = new PGlite();
  let queries = 0, enforceBudget = false;
  const db = drizzle(pg, { schema, logger: { logQuery() {
    queries++;
    if (enforceBudget && queries > 45) throw new Error("Result persistence exhausted the Worker subrequest budget");
  } } });
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries)
      await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    await db.insert(schema.teachers).values({ id: fight.teacherId, firstName: "Test", lastName: "Teacher",
      email: "classroom@example.invalid", emailNormalized: "classroom@example.invalid", passwordHash: "unused", guildCode: "LOADTEST",
      billingAddress: "Test", schoolDistrict: "Test", school: "Test", subject: "Math", gradeLevel: "5" });
    await db.insert(schema.fights).values(fight);
    await db.insert(schema.liveCombatSessions).values({ sessionId: "CLASS30", fightId: fight.id, teacherId: fight.teacherId });
    const students = Array.from({ length: 30 }, (_, i) => ({ ...student("warrior", crypto.randomUUID()), nickname: `Test ${i}`, nicknameNormalized: `test ${i}` }));
    await db.insert(schema.students).values(students);
    let state = initialCombatState("CLASS30", fight, Date.now());
    for (const record of students) state = addStudent(state, record);
    state.currentPhase = "game_over"; state.victory = true;
    for (const p of Object.values(state.players)) { p.totals.questionsAnswered = 1; p.totals.questionsCorrect = 1; }
    for (let attempt = 0; attempt < 2; attempt++) {
      queries = 0; enforceBudget = true;
      const results = await persistCombatResults(db as any, state, fight);
      enforceBudget = false;
      assert.equal(results.length, 30);
      assert.ok(queries <= 45);
    }
    const jobs = await db.select().from(schema.studentJobLevels);
    assert.equal(jobs.length, 30);
    assert.ok(jobs.every(job => job.experience === 11));
    assert.ok((await db.select().from(schema.students)).every(record => record.gold === 10));
    const [guild] = await db.insert(schema.guilds).values({ teacherId: fight.teacherId, name: "Classroom", code: "CLASS30" }).returning();
    await db.insert(schema.guildMemberships).values(students.map(record => ({ guildId: guild.id, studentId: record.id })));
    for (const record of students) await seedPersonalQuests(db as any, record.id, guild.id);
    await db.update(schema.studentJobLevels).set({ level: 4 });
    const [quest] = await db.insert(schema.quests).values({ guildId: guild.id, questType: "teacher_custom",
      title: "Class award", description: "All students", criteria: { type: "custom" }, rewards: { gold: 2, guildXP: 50 } }).returning();
    for (let attempt = 0; attempt < 2; attempt++) {
      queries = 0; enforceBudget = true;
      await evaluateQuests(db as any, guild.id, quest.id);
      enforceBudget = false;
      assert.ok(queries <= 45);
    }
    assert.ok((await db.select().from(schema.students)).every(record => record.gold === 212));
    assert.equal((await db.select().from(schema.guilds))[0].experience, 50);
    assert.equal((await db.select().from(schema.questCompletions)).length, 60);
  } finally { await pg.close(); }
});
