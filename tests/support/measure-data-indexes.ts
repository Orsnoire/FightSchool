// Candidate plans are captured BEFORE adding indexes to the production schema.
import { writeFileSync } from "node:fs";
import { dataCostFixture, fixtureId } from "./data-costs.ts";
const f = await dataCostFixture(30, 100, 16);
try {
  // 100 additional guilds with distinct students make leading-column selectivity
  // representative of a school, instead of drawing conclusions from 60 memberships.
  await f.pg.exec(`INSERT INTO guilds(id,teacher_id,name,code)
    SELECT ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${f.bank.teacherId}','Noise '||n,'NOISE'||n FROM generate_series(1,100) n;
    INSERT INTO students(id,nickname,nickname_normalized,password_hash)
    SELECT ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'noise-'||n,'noise-'||n,'unused' FROM generate_series(1,3000) n;
    INSERT INTO guild_memberships(guild_id,student_id)
    SELECT ('20000000-0000-4000-8000-'||lpad(((n-1)/30+1)::text,12,'0'))::uuid,('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,3000) n;
    INSERT INTO live_combat_sessions(session_id,fight_id,teacher_id,guild_id)
    SELECT 'NOISE-'||g.id||'-'||n,'${f.bank.id}','${f.bank.teacherId}',g.id FROM guilds g CROSS JOIN generate_series(1,10) n WHERE code LIKE 'NOISE%';
    INSERT INTO combat_results(session_id,student_id,fight_id,guild_id,character_class,victory,survived,totals,xp_earned,gold_reward)
    SELECT l.session_id,m.student_id,l.fight_id,l.guild_id,'warrior',true,true,'{"questionsCorrect":15,"questionsAnswered":20}',0,0 FROM live_combat_sessions l JOIN guild_memberships m USING(guild_id) WHERE l.session_id LIKE 'NOISE-%';
    ANALYZE;`);
  const candidates = [
    {
      name: "membership",
      ddl: "CREATE INDEX guild_memberships_student_idx ON guild_memberships(student_id)",
      query: "SELECT guild_id FROM guild_memberships WHERE student_id=$1",
      params: [f.students[0].id],
    },
    {
      name: "studentHistory",
      ddl: "CREATE INDEX combat_results_student_history_idx ON combat_results(student_id,completed_at DESC,id DESC)",
      query:
        "SELECT * FROM combat_results WHERE student_id=$1 ORDER BY completed_at DESC,id DESC LIMIT 50",
      params: [f.students[0].id],
    },
    {
      name: "guildHistory",
      ddl: "CREATE INDEX combat_results_guild_history_idx ON combat_results(guild_id,completed_at DESC,id DESC)",
      query:
        "SELECT * FROM combat_results WHERE guild_id=$1 ORDER BY completed_at DESC,id DESC LIMIT 50",
      params: [f.guildId],
    },
    {
      name: "fightHistory",
      ddl: "CREATE INDEX combat_results_fight_history_idx ON combat_results(fight_id,completed_at DESC,id DESC)",
      query:
        "SELECT * FROM combat_results WHERE fight_id=$1 ORDER BY completed_at DESC,id DESC LIMIT 50",
      params: [f.bank.id],
    },
    {
      name: "affectedQuests",
      ddl: "CREATE INDEX quests_guild_student_idx ON quests(guild_id,student_id)",
      query:
        "SELECT * FROM quests WHERE guild_id=$1 AND (student_id=$2 OR student_id IS NULL)",
      params: [f.guildId, f.students[0].id],
    },
  ];
  const report = [];
  for (const c of candidates) {
    const explain = async () =>
      (
        await f.pg.query(
          `EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${c.query}`,
          c.params,
        )
      ).rows;
    const before = await explain();
    await f.pg.exec(c.ddl + "; ANALYZE;");
    const after = await explain();
    report.push({ ...c, before, after });
  }
  // Existing evidence guild/student and level student/job indexes already match:
  // no speculative replacement index is added for those paths.
  writeFileSync(
    "docs/reviews/c06/index-candidates.json",
    JSON.stringify(
      {
        database:
          "PGlite PostgreSQL, isolated synthetic school: 102 guilds, 3030 students, 36000 results, 2051 quests",
        report,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    report.map((r) => ({
      name: r.name,
      before: (r.before[0] as any)["QUERY PLAN"][0]["Execution Time"],
      after: (r.after[0] as any)["QUERY PLAN"][0]["Execution Time"],
    })),
  );
} finally {
  await f.pg.close();
}
