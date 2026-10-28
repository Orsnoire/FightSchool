import { eq, sql } from 'drizzle-orm';
import { ALL_CHARACTER_CLASSES, type CharacterClass } from '../../shared/schema';
import { ACTIVITY_SAMPLE_MS, ACTIVITY_WEEK_MS } from '../../shared/contracts/player-activity';
import { aaWallet } from '../../shared/aa';
import type { TeacherRosterMember } from '../../shared/contracts/guild-roster';
import type { GameDatabase } from '../db/database';
import * as s from '../db/schema';

/** Caller must enforce guild ownership. Project only teacher roster fields. */
export async function teacherGuildRoster(db: GameDatabase, guildId: string, now = Date.now()): Promise<TeacherRosterMember[]> {
  const members = await db.select({ studentId: s.students.id, nickname: s.students.nickname,
    joinedAt: s.guildMemberships.joinedAt, aaExperience: s.students.aaExperience })
    .from(s.guildMemberships).innerJoin(s.students, eq(s.students.id, s.guildMemberships.studentId))
    .where(eq(s.guildMemberships.guildId, guildId));
  const levels = await db.select({ studentId: s.studentJobLevels.studentId,
    job: s.studentJobLevels.jobClass, level: s.studentJobLevels.level })
    .from(s.studentJobLevels).innerJoin(s.guildMemberships, eq(s.guildMemberships.studentId, s.studentJobLevels.studentId))
    .where(eq(s.guildMemberships.guildId, guildId));
  const recent = await db.execute(sql`WITH members AS (
    SELECT student_id FROM guild_memberships WHERE guild_id=${guildId}::uuid
  ), academic AS (
    SELECT a.student_id,a.session_id,(a.outcome='correct')::int AS correct,1 AS attempts,0 AS legacy
    FROM question_attempts a JOIN members m USING(student_id)
    WHERE a.guild_id=${guildId}::uuid AND a.recorded_at>=${now - 86400000}::bigint AND a.recorded_at<${now}::bigint
    UNION ALL
    SELECT r.student_id,r.session_id,coalesce((r.totals->>'questionsCorrect')::int,0),
      coalesce((r.totals->>'questionsAnswered')::int,0),1
    FROM combat_results r JOIN members m USING(student_id)
    WHERE r.guild_id=${guildId}::uuid AND r.completed_at>=${now - 86400000}::bigint AND r.completed_at<${now}::bigint
      AND NOT EXISTS(SELECT 1 FROM question_attempts a WHERE a.session_id=r.session_id AND a.student_id=r.student_id)
  ), accuracy AS (
    SELECT student_id,sum(correct) AS correct,sum(attempts) AS attempts,
      count(DISTINCT session_id) AS fights,sum(legacy) AS legacy FROM academic GROUP BY student_id
  ), activity AS (
    SELECT a.student_id,sum(greatest(0,least(a.bucket_start+${ACTIVITY_SAMPLE_MS}::bigint,${now}::bigint)
      -greatest(a.bucket_start,${now - ACTIVITY_WEEK_MS}::bigint))) AS milliseconds
    FROM student_activity_samples a JOIN members m USING(student_id)
    WHERE a.bucket_start>${now - ACTIVITY_WEEK_MS - ACTIVITY_SAMPLE_MS}::bigint AND a.bucket_start<${now}::bigint
    GROUP BY a.student_id
  ) SELECT m.student_id,t.started_at,a.milliseconds,c.correct,c.attempts,c.fights,c.legacy
    FROM members m LEFT JOIN student_activity_tracking t USING(student_id)
    LEFT JOIN activity a USING(student_id) LEFT JOIN accuracy c USING(student_id)`);
  const stats = new Map(recent.rows.map(row => [String(row.student_id), row]));
  const byStudent = new Map<string, Record<CharacterClass, number>>();
  for (const member of members) byStudent.set(member.studentId,
    Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, 0])) as Record<CharacterClass, number>);
  for (const level of levels) {
    const jobs = byStudent.get(level.studentId);
    if (jobs && ALL_CHARACTER_CLASSES.includes(level.job)) jobs[level.job] = level.level;
  }
  return members.map(({aaExperience, ...member}) => {
    const r = stats.get(member.studentId)!;
    const since = r.started_at == null ? null : Number(r.started_at);
    const correct = Number(r.correct || 0), attempts = Number(r.attempts || 0);
    return { ...member, jobLevels: byStudent.get(member.studentId)!, totalAAsEarned: aaWallet(aaExperience).total,
      weeklyActiveHours: since === null ? null : Number(r.milliseconds || 0) / 3600000,
      activityTrackedSince: since, activityHistoryPartial: since === null || since > now - ACTIVITY_WEEK_MS,
      dailyAccuracy: attempts ? 100 * correct / attempts : null,
      dailyCorrect: correct, dailyAttempts: attempts, dailyFights: Number(r.fights || 0), dailyLegacyFights: Number(r.legacy || 0),
    };
  });
}
