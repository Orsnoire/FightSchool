import { sql, type SQL } from "drizzle-orm";
import type { GameDatabase } from "../db/game-repository.ts";
import {
  questProgress,
  type QuestContext,
  type QuestProgress,
} from "../../shared/quests.ts";
import type { QuestCriteria } from "../../shared/schema.ts";

export const WEEK_MS = 7 * 86400000;
export const EVIDENCE_TYPES = [
  "custom",
  "fight_accuracy",
  "perfect_clear",
  "solo_fights",
  "try_solo",
  "master_bank",
];
export const LEVEL_TYPES = [
  "unlock_job",
  "unlock_cross_class",
  "unlock_license",
  "reach_job_level",
  "unlock_ultimate",
  "class_at_cap",
];
export const TOTAL_TYPES = [
  "total_correct_answers",
  "total_damage",
  "total_healing",
];

/** Request-scoped aggregate cache. No answer text or historical row sets leave SQL. */
export function questData(db: GameDatabase, guildId: string, week: number) {
  const cache = new Map<string, Promise<number>>();
  async function value(
    c: QuestCriteria,
    studentId: string | null,
    weekly: boolean,
    bank: string[],
  ) {
    if (
      (c.type === "solo_fights" || c.type === "try_solo") &&
      c.mode === "teacher"
    )
      return 0;
    const mode =
      c.type === "solo_fights" || c.type === "try_solo"
        ? "solo"
        : c.mode || "any";
    const kind = c.type === "perfect_clear" ? "fight_accuracy" : c.type;
    // Accuracy thresholds share the same maximum; targets don't change the query.
    const key = JSON.stringify([
      kind,
      c.fightId,
      mode,
      c.performanceType,
      studentId,
      weekly,
      bank,
    ]);
    if (!cache.has(key))
      cache.set(
        key,
        (async () => {
          const predicates = (
            alias: SQL,
            time: SQL,
          ) => sql`${alias}.guild_id=${guildId}::uuid
        ${studentId ? sql`AND ${alias}.student_id=${studentId}::uuid` : sql``}
        ${c.fightId ? sql`AND ${alias}.fight_id=${c.fightId}::uuid` : sql``}
        ${mode === "solo" ? sql`AND ${alias}.is_solo_mode=true` : mode === "teacher" ? sql`AND ${alias}.is_solo_mode=false` : sql``}
        ${weekly ? sql`AND ${time}>=${week * WEEK_MS} AND ${time}<${(week + 1) * WEEK_MS}` : sql``}`;
          let query: SQL;
          if (kind === "master_bank") {
            if (!bank.length) return 0;
            query = sql`SELECT count(DISTINCT k.key)::double precision AS value
          FROM quest_fight_evidence e CROSS JOIN LATERAL jsonb_array_elements_text(e.correct_keys) k(key)
          WHERE ${predicates(sql`e`, sql`e.updated_at`)} AND k.key IN(SELECT jsonb_array_elements_text(${JSON.stringify(bank)}::jsonb))`;
          } else {
            // Evidence always takes precedence over a legacy result, including departed
            // players and week boundaries. Never synthesize question mastery from totals.
            const evidence = sql`WITH evidence AS (
          SELECT e.session_id,e.victory,e.answered,e.correct FROM quest_fight_evidence e
          WHERE ${predicates(sql`e`, sql`e.updated_at`)}
          UNION ALL
          SELECT r.session_id,r.victory,COALESCE((r.totals->>'questionsAnswered')::integer,0),COALESCE((r.totals->>'questionsCorrect')::integer,0)
          FROM combat_results r WHERE ${predicates(sql`r`, sql`r.completed_at`)}
          AND NOT EXISTS(SELECT 1 FROM quest_fight_evidence e WHERE e.guild_id=${guildId}::uuid AND e.session_id=r.session_id AND e.student_id=r.student_id)
        )`;
            query =
              kind === "solo_fights"
                ? sql`${evidence} SELECT count(DISTINCT session_id)::double precision AS value FROM evidence WHERE victory`
                : kind === "try_solo"
                  ? sql`${evidence} SELECT CASE WHEN EXISTS(SELECT 1 FROM evidence WHERE answered>0) THEN 1 ELSE 0 END AS value`
                  : c.performanceType === "class_average"
                    ? sql`${evidence} SELECT COALESCE(max(accuracy),0)::double precision AS value FROM (SELECT 100.0*sum(correct)/sum(answered) AS accuracy FROM evidence WHERE victory AND answered>0 GROUP BY session_id) a`
                    : sql`${evidence} SELECT COALESCE(max(100.0*correct/answered),0)::double precision AS value FROM evidence WHERE victory AND answered>0`;
          }
          const result = await db.execute(query);
          return Number((result.rows[0] as any)?.value || 0);
        })(),
      );
    return cache.get(key)!;
  }
  return async function progress(
    c: QuestCriteria,
    x: QuestContext,
    studentId: string | null,
    weekly: boolean,
  ): Promise<QuestProgress> {
    if (c.type === "custom") {
      const criteria = [c.criteria1, c.criteria2, c.criteria3].filter(Boolean);
      const results = [];
      for (const k of criteria)
        results.push(
          await progress(
            { type: "fight_accuracy", ...k },
            x,
            studentId,
            weekly,
          ),
        );
      const complete = !!results.length && results.every((p) => p.complete);
      return {
        current: complete ? 1 : 0,
        target: 1,
        complete,
        label: "Teacher objective",
      };
    }
    const p = questProgress(c, x);
    if (!EVIDENCE_TYPES.includes(c.type)) return p;
    const current = await value(c, studentId, weekly, x.bankKeys || []);
    return { ...p, current, complete: p.target > 0 && current >= p.target };
  };
}
