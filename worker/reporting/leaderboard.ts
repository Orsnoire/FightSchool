import { eq, sql } from "drizzle-orm";
import type { GameDatabase } from "../db/database";
import * as s from "../db/schema";
import { GameError as ApiError } from "../services/errors";
export async function guildLeaderboard(db: GameDatabase, id: string, teacher: boolean, metric: string) {
  if (![
    "damageDealt",
    "damageBlocked",
    "healingDone",
    "questionsCorrect",
    "xpEarned",
    "accuracy",
  ].includes(metric))
    throw new ApiError("Invalid metric");
  const [settings] = await db
    .select()
    .from(s.guildSettings)
    .where(eq(s.guildSettings.guildId, id));
  if (!teacher && settings?.hiddenLeaderboardMetrics?.includes(metric))
    return [];
  const column = metric === 'accuracy' ? 'questionsCorrect' : metric;
  const value = metric === 'xpEarned' ? sql`r.xp_earned::double precision` : sql`COALESCE((r.totals->>${column})::double precision,0)`;
  const aggregate = await db.execute(sql`SELECT student_id,sum(${value}) AS value,
    sum(COALESCE((r.totals->>'questionsAnswered')::double precision,0)) AS answered,count(*)::integer AS fights
    FROM combat_results r WHERE guild_id=${id}::uuid GROUP BY student_id`);
  const grouped = new Map(aggregate.rows.map(r => [String(r.student_id), r]));
  const members = await db.select({ id: s.students.id, nickname: s.students.nickname, characterClass: s.students.characterClass })
    .from(s.guildMemberships).innerJoin(s.students, eq(s.students.id, s.guildMemberships.studentId)).where(eq(s.guildMemberships.guildId, id));
  return members.map(m => {
    const total = grouped.get(m.id);
    const value = metric === 'accuracy' ? (Number(total?.answered) ? 100 * Number(total?.value) / Number(total?.answered) : 0) : Number(total?.value || 0);
    return { ...m, studentId: m.id, value, totalDamageDealt: value, fightsCompleted: Number(total?.fights || 0), [metric]: value };
  }).sort((a, b) => b.value - a.value);
}
