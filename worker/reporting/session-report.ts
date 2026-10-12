import { sql, type SQL } from "drizzle-orm";
import {
  reportQuerySchema,
  type SessionReport,
} from "../../shared/contracts/reporting";
import type { GameDatabase } from "../db/game-repository";

export async function sessionReport(
  db: GameDatabase,
  teacherId: string,
  params: URLSearchParams,
): Promise<SessionReport> {
  const q = reportQuerySchema.parse(Object.fromEntries(params));
  const terms: SQL[] = [sql`p.teacher_id=${teacherId}::uuid`];
  if (q.guildId) terms.push(sql`p.guild_id=${q.guildId}::uuid`);
  if (q.sessionId) terms.push(sql`p.session_id=${q.sessionId}`);
  if (q.quizId) terms.push(sql`p.fight_id=${q.quizId}::uuid`);
  if (q.playerId) terms.push(sql`p.student_id=${q.playerId}::uuid`);
  if (q.job) terms.push(sql`p.job=${q.job}`);
  if (q.from !== undefined)
    terms.push(sql`l.created_at>=to_timestamp(${q.from}/1000.0)`);
  if (q.to !== undefined)
    terms.push(sql`l.created_at<to_timestamp(${q.to}/1000.0)`);
  if (q.questionId)
    terms.push(
      sql`EXISTS(SELECT 1 FROM question_attempts a WHERE a.session_id=p.session_id AND a.student_id=p.student_id AND a.question_id=${q.questionId})`,
    );
  const term = "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%";
  const metadataSearch = (alias: "p" | "e") => {
    const t = sql.raw(alias);
    return sql`(${t}.nickname ILIKE ${term} OR ${t}.quiz_title ILIKE ${term} OR ${t}.session_id ILIKE ${term} OR ${t}.student_id::text ILIKE ${term})`;
  };
  const questionSearch = sql`(a.question->>'question' ILIKE ${term} OR a.question_id ILIKE ${term})`;
  if (q.search)
    terms.push(
      sql`(${metadataSearch("p")} OR EXISTS(SELECT 1 FROM question_attempts a WHERE a.session_id=p.session_id AND a.student_id=p.student_id AND ${questionSearch}))`,
    );
  if (q.view === "questions")
    terms.push(
      sql`EXISTS(SELECT 1 FROM question_attempts a WHERE a.session_id=p.session_id AND a.student_id=p.student_id)`,
    );
  const attemptSearch = (alias: "p" | "e") =>
    q.view === "questions" && q.search
      ? sql`AND (${metadataSearch(alias)} OR ${questionSearch})`
      : sql``;
  const academicOnly = q.view === "questions" || !!q.questionId;
  const question = q.questionId
    ? sql`AND a.question_id=${q.questionId}`
    : sql``;
  const answeredTotal = sql`coalesce((totals->>'questionsAnswered')::int,0)`;
  const correctCount = academicOnly
    ? sql`recorded_correct`
    : sql`greatest(recorded_correct,coalesce((totals->>'questionsCorrect')::int,0))`;
  const incorrectCount = academicOnly
    ? sql`recorded_incorrect`
    : sql`greatest(recorded_incorrect,coalesce((totals->>'questionsIncorrect')::int,0))`;
  const missingHistory = academicOnly
    ? sql`false`
    : sql`(historical OR ${answeredTotal}>recorded_correct+recorded_incorrect)`;
  const cte = sql`WITH population AS (
    SELECT session_id,student_id,teacher_id,fight_id,guild_id,nickname,quiz_title,job,status,victory,survived,totals,false AS historical FROM session_participants WHERE teacher_id=${teacherId}::uuid
    UNION ALL
    SELECT r.session_id,r.student_id,f.teacher_id,r.fight_id,r.guild_id,s.nickname,f.title,r.character_class,'completed',r.victory,r.survived,r.totals,true
    FROM combat_results r JOIN fights f ON f.id=r.fight_id JOIN students s ON s.id=r.student_id
    WHERE f.teacher_id=${teacherId}::uuid AND NOT EXISTS(SELECT 1 FROM session_participants p WHERE p.session_id=r.session_id AND p.student_id=r.student_id)
  ), filtered AS (
    SELECT p.*,g.name AS guild_name,extract(epoch FROM l.created_at)*1000 AS started_at,
      coalesce(r.xp_earned,0) AS xp,coalesce(r.gold_reward,0) AS gold,
      coalesce(a.correct,0) AS recorded_correct,coalesce(a.incorrect,0) AS recorded_incorrect,coalesce(a.unanswered,0) AS unanswered,coalesce(a.attempts,0) AS recorded_attempts
    FROM population p JOIN live_combat_sessions l ON l.session_id=p.session_id
    LEFT JOIN guilds g ON g.id=p.guild_id LEFT JOIN combat_results r ON r.session_id=p.session_id AND r.student_id=p.student_id
    LEFT JOIN LATERAL (SELECT count(*) AS attempts,count(*) FILTER(WHERE outcome='correct') AS correct,count(*) FILTER(WHERE outcome='incorrect') AS incorrect,count(*) FILTER(WHERE outcome='unanswered') AS unanswered FROM question_attempts a WHERE a.session_id=p.session_id AND a.student_id=p.student_id ${question} ${attemptSearch("p")}) a ON true
    WHERE ${sql.join(terms, sql` AND `)}
  ), evidence AS (
    SELECT *, ${missingHistory} AS incomplete_history, ${correctCount} AS correct,
      ${incorrectCount} AS incorrect, ${correctCount}+${incorrectCount}+unanswered AS attempts
    FROM filtered
  )`;
  const combatMetrics = q.questionId
    ? sql`0::float AS damage,0::float AS healing,0::float AS blocked,0::float AS deaths,0::float AS xp,0::float AS gold`
    : sql`sum(coalesce((totals->>'damageDealt')::float,0)) AS damage,sum(coalesce((totals->>'healingDone')::float,0)) AS healing,
    sum(coalesce((totals->>'damageBlocked')::float,0)) AS blocked,sum(coalesce((totals->>'deaths')::float,0)) AS deaths,sum(xp)::float AS xp,sum(gold)::float AS gold`;
  const metrics = sql`sum(correct)::float AS correct,sum(incorrect)::float AS incorrect,
    CASE WHEN bool_or(incomplete_history) THEN NULL ELSE sum(unanswered)::float END AS unanswered,
    sum(attempts)::float AS attempts,sum(recorded_attempts)::float AS "recordedAttempts",
    ${combatMetrics}`;
  // A question filter scopes academic evidence. Whole-session combat metrics are deliberately omitted.
  const combatColumns = q.questionId
    ? sql`0::float AS damage,0::float AS healing,0::float AS blocked,0::float AS deaths,0::float AS xp,0::float AS gold`
    : sql`coalesce((totals->>'damageDealt')::float,0) AS damage,coalesce((totals->>'healingDone')::float,0) AS healing,coalesce((totals->>'damageBlocked')::float,0) AS blocked,coalesce((totals->>'deaths')::float,0) AS deaths,xp::float AS xp,gold::float AS gold`;
  const detail =
    q.view === "sessions"
      ? sql`SELECT session_id AS "sessionId",max(quiz_title) AS "quizTitle",string_agg(DISTINCT guild_name,', ') AS "guildName",max(started_at)::float AS "startedAt",count(*)::float AS players,CASE WHEN bool_and(status='completed') THEN 'completed' ELSE 'active' END AS status,bool_or(victory) AS victory,${metrics} FROM evidence GROUP BY session_id`
      : q.view === "players"
        ? sql`SELECT session_id AS "sessionId",student_id AS "studentId",nickname,quiz_title AS "quizTitle",guild_name AS "guildName",job,status,victory,survived,started_at::float AS "startedAt",correct::float,incorrect::float,CASE WHEN incomplete_history THEN NULL ELSE unanswered::float END AS unanswered,attempts::float,recorded_attempts::float AS "recordedAttempts",${combatColumns} FROM evidence`
        : sql`SELECT e.session_id AS "sessionId",e.student_id AS "studentId",e.nickname,e.quiz_title AS "quizTitle",e.guild_name AS "guildName",a.job,e.status,e.started_at::float AS "startedAt",a.round,a.question_id AS "questionId",a.question_version AS "questionVersion",a.question,a.outcome,(a.outcome='correct')::int AS correct,(a.outcome='incorrect')::int AS incorrect,(a.outcome='unanswered')::int AS unanswered,1 AS attempts,1 AS "recordedAttempts",0 AS damage,0 AS healing,0 AS blocked,0 AS deaths,0 AS xp,0 AS gold FROM evidence e JOIN question_attempts a ON a.session_id=e.session_id AND a.student_id=e.student_id WHERE true ${question} ${attemptSearch("e")}`;
  const order =
    q.sort === "accuracy"
      ? sql`correct::float/nullif(attempts,0) DESC NULLS LAST, "startedAt" DESC`
      : q.sort === "name"
        ? q.view === "sessions"
          ? sql`"quizTitle", "sessionId"`
          : sql`nickname, "sessionId"`
        : sql`"startedAt" DESC, "sessionId"`;
  const [rows, count, summary, facets] = await Promise.all([
    db.execute(
      sql`${cte}, report AS (${detail}) SELECT * FROM report ORDER BY ${order}${q.view !== "sessions" ? sql`, "studentId"` : sql``}${q.view === "questions" ? sql`, round` : sql``} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    ),
    db.execute(
      sql`${cte}, report AS (${detail}) SELECT count(*)::float AS total FROM report`,
    ),
    db.execute(
      sql`${cte} SELECT count(DISTINCT session_id)::float AS sessions,count(DISTINCT student_id)::float AS players,coalesce(sum(correct),0)::float AS correct,coalesce(sum(attempts),0)::float AS attempts,coalesce(sum(recorded_attempts),0)::float AS "recordedAttempts",count(*) FILTER(WHERE incomplete_history)::float AS "historicalParticipants" FROM evidence`,
    ),
    db.execute(
      sql`SELECT 'guild' AS kind,id,name FROM guilds WHERE teacher_id=${teacherId}::uuid UNION ALL SELECT 'quiz',id,title FROM fights WHERE teacher_id=${teacherId}::uuid ORDER BY name LIMIT 1000`,
    ),
  ]);
  return {
    rows: rows.rows as unknown as SessionReport["rows"],
    total: Number(count.rows[0].total),
    page: q.page,
    pageSize: q.pageSize,
    summary: summary.rows[0] as unknown as SessionReport["summary"],
    facets: {
      guilds: facets.rows.filter((r) => r.kind === "guild") as any,
      quizzes: facets.rows.filter((r) => r.kind === "quiz") as any,
    },
  };
}
