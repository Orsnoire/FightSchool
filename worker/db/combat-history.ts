import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { StudentCombatSummary } from "../../shared/contracts/history.ts";
import type { GameDatabase } from "./game-repository.ts";
import * as s from "./schema.ts";

export type HistoryScope =
  | { studentId: string }
  | { fightId: string }
  | { teacherId: string }
  | { guildIds: string[] };
export async function combatHistory(
  db: GameDatabase,
  scope: HistoryScope,
  params: URLSearchParams,
) {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(params.get("limit") || 50);
  const before = params.get("before");
  let cursor: SQL | undefined;
  if (before) {
    const parts = z
      .tuple([
        z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        z.string().uuid(),
      ])
      .parse(before.split(":"));
    cursor = sql`(${s.combatResults.completedAt},${s.combatResults.id})<(${parts[0]}::bigint,${parts[1]}::uuid)`;
  }
  const where =
    "studentId" in scope
      ? eq(s.combatResults.studentId, scope.studentId)
      : "fightId" in scope
        ? eq(s.combatResults.fightId, scope.fightId)
        : "teacherId" in scope
          ? eq(s.fights.teacherId, scope.teacherId)
          : inArray(s.combatResults.guildId, scope.guildIds);
  const rows = await db
    .select({ result: s.combatResults, nickname: s.students.nickname })
    .from(s.combatResults)
    .innerJoin(s.fights, eq(s.fights.id, s.combatResults.fightId))
    .innerJoin(s.students, eq(s.students.id, s.combatResults.studentId))
    .where(and(where, cursor))
    .orderBy(desc(s.combatResults.completedAt), desc(s.combatResults.id))
    .limit(limit + 1);
  const page = rows
    .slice(0, limit)
    .map(({ result: r, nickname }) => ({
      ...r,
      ...r.totals,
      nickname,
      lootItemClaimed: r.rewardClaim,
    }));
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor:
      rows.length > limit && last ? `${last.completedAt}:${last.id}` : null,
  };
}

export async function studentCombatSummary(
  db: GameDatabase,
  studentId: string,
): Promise<StudentCombatSummary> {
  const result =
    await db.execute(sql`SELECT character_class,count(*)::integer AS fights,
    count(*) FILTER(WHERE survived)::integer AS survived,
    COALESCE(sum((totals->>'damageDealt')::double precision),0) AS damage,
    COALESCE(sum((totals->>'healingDone')::double precision),0) AS healing,
    COALESCE(sum((totals->>'damageTaken')::double precision),0) AS taken
    FROM combat_results WHERE student_id=${studentId}::uuid GROUP BY character_class ORDER BY fights DESC,character_class`);
  const summary: StudentCombatSummary = {
    totalFights: 0,
    survived: 0,
    totalDamage: 0,
    totalHealing: 0,
    totalDamageTaken: 0,
    favoriteClass: String(result.rows[0]?.character_class || "None"),
  };
  for (const r of result.rows) {
    summary.totalFights += Number(r.fights);
    summary.survived += Number(r.survived);
    summary.totalDamage += Number(r.damage);
    summary.totalHealing += Number(r.healing);
    summary.totalDamageTaken += Number(r.taken);
  }
  return summary;
}
