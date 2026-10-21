import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../worker/db/schema.ts";
import {
  seedGuildQuests,
  seedPersonalQuests,
} from "../../worker/progression/quests.ts";
import { questionKey } from "../../worker/progression/question-key.ts";
import { fight, student } from "../phase4/fixtures.ts";

export const fixtureId = (n: number) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function dataCostFixture(
  members = 30,
  history = 100,
  migrationLimit = Infinity,
) {
  const pg = new PGlite();
  const journal = JSON.parse(
    readFileSync("migrations/cloudflare/meta/_journal.json", "utf8"),
  );
  for (const { idx, tag } of journal.entries)
    if (idx <= migrationLimit)
      await pg.exec(readFileSync(`migrations/cloudflare/${tag}.sql`, "utf8"));
  const db = drizzle(pg, { schema });
  const guildId = fixtureId(1),
    otherGuildId = fixtureId(2);
  const students = Array.from({ length: members }, (_, i) => ({
    ...student("warrior", fixtureId(100 + i)),
    nickname: `member-${i}`,
    nicknameNormalized: `member-${i}`,
    guildId,
  }));
  await db
    .insert(schema.teachers)
    .values({
      id: fight.teacherId,
      firstName: "Fixture",
      lastName: "Teacher",
      email: "c06@example.invalid",
      emailNormalized: "c06@example.invalid",
      passwordHash: "unused",
      guildCode: "C06FIX",
      billingAddress: "Fixture",
      schoolDistrict: "Fixture",
      school: "Fixture",
      subject: "Math",
      gradeLevel: "10",
    });
  const bank = {
    ...fight,
    questions: Array.from({ length: 20 }, (_, i) => ({
      ...fight.questions[0],
      id: `q${i}`,
      question: `${i}+2`,
      correctAnswer: String(i + 2),
    })),
  };
  await db.insert(schema.fights).values(bank);
  await db.insert(schema.guilds).values([
    {
      id: guildId,
      teacherId: fight.teacherId,
      name: "Measured guild",
      code: "C06ONE",
    },
    {
      id: otherGuildId,
      teacherId: fight.teacherId,
      name: "Other guild",
      code: "C06TWO",
    },
  ]);
  // Explicit historical columns keep the pre-0017 migration fixture independent
  // of columns added to today's ORM schema (such as campaign stamina recovery).
  await pg.query(`INSERT INTO students(id,nickname,nickname_normalized,password_hash,character_class,gender,guild_id,inventory,gold,created_at)
    SELECT x.id,x.nickname,x.nickname,x.password_hash,'warrior','A',x.guild_id,'[]'::jsonb,0,to_timestamp(0)
    FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,nickname text,password_hash text,guild_id uuid)`,
    [JSON.stringify(students.map(s => ({ id: s.id, nickname: s.nickname, password_hash: s.passwordHash, guild_id: s.guildId })))]);
  await db.insert(schema.guildMemberships).values(
    students.flatMap((s) => [
      { guildId, studentId: s.id },
      { guildId: otherGuildId, studentId: s.id },
    ]),
  );
  await db.insert(schema.guildFights).values([
    { guildId, fightId: fight.id },
    { guildId: otherGuildId, fightId: fight.id },
  ]);
  await db
    .insert(schema.studentJobLevels)
    .values(
      students.map((s) => ({
        studentId: s.id,
        jobClass: "warrior" as const,
        level: 1,
        experience: 0,
      })),
    );
  await seedGuildQuests(db as any, guildId);
  for (const s of students) await seedPersonalQuests(db as any, s.id, guildId);
  // Two guilds, 100 group attempts each, 20 questions per result. Fixed historic time;
  // current-week tests add their own evidence. Half the results predate mastery evidence.
  await pg.query(
    `INSERT INTO live_combat_sessions(session_id,fight_id,teacher_id,guild_id,status)
    SELECT 'C06-'||g.id||'-'||n,$1,$2,g.id,'completed' FROM guilds g CROSS JOIN generate_series(1,$3) n`,
    [fight.id, fight.teacherId, history],
  );
  const totals = JSON.stringify({
    damageDealt: 100,
    damageBlocked: 10,
    healingDone: 20,
    questionsAnswered: 20,
    questionsCorrect: 15,
    accuracy: 75,
  });
  await pg.query(
    `INSERT INTO combat_results(session_id,student_id,fight_id,guild_id,character_class,victory,survived,is_solo_mode,totals,xp_earned,gold_reward,loot_table,reward_claim,completed_at)
    SELECT l.session_id,m.student_id,l.fight_id,l.guild_id,'warrior',true,true,false,$1::jsonb,0,0,'[]','automatic',1700000000000 FROM live_combat_sessions l JOIN guild_memberships m ON m.guild_id=l.guild_id`,
    [totals],
  );
  await pg.query(
    `INSERT INTO quest_fight_evidence(session_id,student_id,guild_id,fight_id,is_solo_mode,victory,answered,correct,correct_keys,bank_keys,revision,updated_at)
    SELECT session_id,student_id,guild_id,fight_id,false,true,20,15,$1::jsonb,$2::jsonb,1,completed_at FROM combat_results WHERE (right(session_id,1)::int % 2)=0`,
    [
      JSON.stringify(bank.questions.slice(0, 15).map(questionKey)),
      JSON.stringify(bank.questions.map(questionKey)),
    ],
  );
  await pg.exec("ANALYZE");
  const calls: Array<{
    sql: string;
    params: any[];
    rows: number;
    bytes: number;
    ms: number;
  }> = [];
  const original = pg.query.bind(pg);
  (pg as any).query = async (
    query: string,
    params: any[] = [],
    options?: any,
  ) => {
    const start = performance.now();
    const result = await original(query, params, options);
    calls.push({
      sql: query,
      params,
      rows: result.rows.length,
      bytes: Buffer.byteLength(JSON.stringify(result.rows)),
      ms: performance.now() - start,
    });
    return result;
  };
  return { pg, db: db as any, guildId, otherGuildId, students, bank, calls };
}
export const summarizeCalls = (
  calls: Array<{ rows: number; bytes: number; ms: number }>,
) => ({
  queries: calls.length,
  rows: calls.reduce((n, c) => n + c.rows, 0),
  bytes: calls.reduce((n, c) => n + c.bytes, 0),
  dbMs: Number(calls.reduce((n, c) => n + c.ms, 0).toFixed(2)),
});
