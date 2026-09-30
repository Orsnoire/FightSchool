import { evaluateQuests } from "../progression/quests.ts";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, inArray, sql, desc } from "drizzle-orm";
import * as s from "./schema.ts";
import { calculateXP, calculateNewLevel } from "../../shared/jobSystem.ts";
import {
  calculateGoldReward,
  calculateEquipmentStats,
  EQUIPMENT_ITEMS,
  getStartingEquipment,
  type CharacterClass,
  type EquipmentStats,
} from "../../shared/schema.ts";
import type { CombatSnapshot } from "../../shared/combat/model.ts";
import type { CombatProfile } from "../combat/engine.ts";
export const gameDatabase = (url: string) => drizzle(neon(url), { schema: s });
export type GameDatabase = ReturnType<typeof gameDatabase>;
export async function combatProfile(
  db: GameDatabase,
  student: s.StudentRecord,
): Promise<CombatProfile> {
  const jobs = await db
    .select()
    .from(s.studentJobLevels)
    .where(eq(s.studentJobLevels.studentId, student.id));
  const levels = Object.fromEntries(jobs.map((j) => [j.jobClass, j.level]));
  const defaults = getStartingEquipment(student.characterClass || "warrior");
  const ids = [
    student.weapon || defaults.weapon,
    student.headgear || defaults.headgear,
    student.armor || defaults.armor,
  ];
  const equipment = calculateEquipmentStats(ids[0], ids[1], ids[2]);
  const custom = await db
    .select()
    .from(s.equipmentItems)
    .where(
      inArray(
        s.equipmentItems.id,
        ids.filter((x) => !EQUIPMENT_ITEMS[x]),
      ),
    );
  for (const item of custom)
    for (const [k, n] of Object.entries(item.stats))
      equipment[k as keyof EquipmentStats] += n || 0;
  return {
    levels,
    equipment,
    crossClass: [student.crossClassAbility1, student.crossClassAbility2].filter(
      Boolean,
    ) as string[],
  };
}
export async function persistCombatResults(
  db: GameDatabase,
  state: CombatSnapshot,
  fight: s.FightRecord,
) {
  if (state.currentPhase !== "game_over")
    throw new Error("Combat is not complete");
  const [live] = await db
    .select()
    .from(s.liveCombatSessions)
    .where(eq(s.liveCombatSessions.sessionId, state.sessionId));
  const players = Object.values(state.players);
  const studentIds = players.map(p => p.studentId);
  const students = studentIds.length
    ? await db.select({ id: s.students.id }).from(s.students).where(inArray(s.students.id, studentIds))
    : [];
  const existingIds = new Set(students.map(student => student.id));
  const assignments = studentIds.length ? await db
      .select({ studentId: s.guildMemberships.studentId, guildId: s.guilds.id })
      .from(s.guildMemberships)
      .innerJoin(s.guilds, eq(s.guilds.id, s.guildMemberships.guildId))
      .innerJoin(s.guildFights, eq(s.guildFights.guildId, s.guilds.id))
      .where(
        and(
          inArray(s.guildMemberships.studentId, studentIds),
          eq(s.guildFights.fightId, fight.id),
          eq(s.guilds.teacherId, fight.teacherId),
          eq(s.guilds.isArchived, false),
        ),
      )
      .orderBy(s.guilds.id) : [];
  const guildByStudent = new Map<string, string>();
  for (const assigned of assignments)
    if (!guildByStudent.has(assigned.studentId)) guildByStudent.set(assigned.studentId, assigned.guildId);
  const values = [];
  for (const p of players) {
    if (!existingIds.has(p.studentId)) continue;
    const earnedGuildId = guildByStudent.get(p.studentId) || null;
    const xp = calculateXP({
      ...p.totals,
      baseFightXP: state.victory ? fight.baseXP : 0,
    });
    const gold = state.victory
      ? calculateGoldReward(
          Math.max(...fight.enemies.map((e) => e.difficultyMultiplier)),
        )
      : 0;
    values.push(sql`(${state.sessionId},${p.studentId},${fight.id},${earnedGuildId},${p.characterClass},${!!state.victory},${!p.isDead},${!!live?.soloStudentId},${JSON.stringify(p.totals)}::jsonb,${xp},${gold},${JSON.stringify(state.victory ? fight.lootTable : [])}::jsonb,${!state.victory || !fight.lootTable.length ? "automatic" : null})`);
  }
  // One classroom-wide ledger statement keeps network requests independent of
  // attendance. Only newly inserted results may award XP or automatic gold.
  if (values.length) await db.execute(sql`WITH result AS (
 INSERT INTO combat_results(session_id,student_id,fight_id,guild_id,character_class,victory,survived,is_solo_mode,totals,xp_earned,gold_reward,loot_table,reward_claim)
 VALUES ${sql.join(values, sql`, `)}
 ON CONFLICT(session_id,student_id) DO NOTHING RETURNING *),
 job AS (INSERT INTO student_job_levels(student_id,job_class,experience,level) SELECT student_id,character_class,xp_earned,1 FROM result
 ON CONFLICT(student_id,job_class) DO UPDATE SET experience=student_job_levels.experience+EXCLUDED.experience RETURNING student_id,job_class,experience)
 UPDATE students SET gold=gold+COALESCE((SELECT gold_reward FROM result WHERE reward_claim='automatic' AND result.student_id=students.id),0) WHERE id IN(SELECT student_id FROM result)`);
  // Derive levels from total earned XP after the atomic ledger write; safe to repeat on recovery.
  if (studentIds.length) {
    const rows = await db
      .select()
      .from(s.studentJobLevels)
      .where(inArray(s.studentJobLevels.studentId, studentIds));
    if (rows.length) await db.execute(sql`UPDATE student_job_levels AS job
 SET level=greatest(job.level, derived.level)
 FROM (VALUES ${sql.join(rows.map(row => sql`(${row.id}::uuid, ${calculateNewLevel(1, row.experience)}::integer)`), sql`, `)}) AS derived(id,level)
 WHERE job.id=derived.id`);
  }
  await db
    .update(s.liveCombatSessions)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(s.liveCombatSessions.sessionId, state.sessionId));
  const results = await db.select().from(s.combatResults).where(eq(s.combatResults.sessionId, state.sessionId));
  const guildIds = [
    ...new Set(results
        .map((r) => r.guildId)
        .filter(Boolean),
    ),
  ];
  for (const id of guildIds) await evaluateQuests(db, id!);
  return results;
}
export class RewardError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
export async function claimReward(
  db: GameDatabase,
  studentId: string,
  fightId: string,
  itemId: string | null,
  resultId?: string,
) {
  const [result] = await db
    .select()
    .from(s.combatResults)
    .where(
      and(
        eq(s.combatResults.studentId, studentId),
        eq(s.combatResults.fightId, fightId),
        ...(resultId ? [eq(s.combatResults.id, resultId)] : []),
      ),
    )
    .orderBy(desc(s.combatResults.completedAt))
    .limit(1);
  if (!result?.victory || !result.lootTable.length)
    throw new RewardError("No reward choice is available");
  if (itemId && !result.lootTable.some((x) => x.itemId === itemId))
    throw new RewardError("Item is not in the earned loot table", 400);
  const claim = itemId || "gold";
  const response =
    await db.execute(sql`WITH claim AS (UPDATE combat_results SET reward_claim=${claim} WHERE id=${result.id} AND reward_claim IS NULL RETURNING student_id,gold_reward)
 UPDATE students SET gold=gold+${itemId ? 0 : result.goldReward}, inventory=CASE WHEN ${itemId !== null} THEN CASE WHEN inventory @> ${JSON.stringify(itemId ? [itemId] : [])}::jsonb THEN inventory ELSE inventory || ${JSON.stringify(itemId ? [itemId] : [])}::jsonb END ELSE inventory END
 WHERE id IN(SELECT student_id FROM claim) RETURNING id,gold,inventory`);
  if (!response.rows.length && result.rewardClaim !== claim)
    throw new RewardError("Reward has already been claimed");
  return { success: true, goldReward: itemId ? 0 : result.goldReward };
}
