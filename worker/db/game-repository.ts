import { getStudentAvatar } from "./avatar-repository.ts";
import { validAppearance } from "../../shared/avatar/appearance.ts";
import { EQUIPMENT_SLOTS } from "../../shared/equipment-catalog.ts";
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
import { completedRounds, participatedRounds, type CombatProfile } from "../combat/engine.ts";
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
  const ids = EQUIPMENT_SLOTS.map(slot => student[slot]).filter((id): id is string => !!id);
  const equipment = calculateEquipmentStats(student.weapon, student.headgear, student.armor, student.hands, student.legs, student.feet, student.offhand);
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
  const avatar = await getStudentAvatar(db, student.id);
  const appearance = avatar && { modelId: avatar.modelId, hairColorId: avatar.hairColorId, eyeColorId: avatar.eyeColorId, skinColorId: avatar.skinColorId };
  return {
    appearance: validAppearance(appearance) ? appearance : null,
    levels,
    equipment,
    crossClass: [student.crossClassAbility1, student.crossClassAbility2].filter(
      Boolean,
    ) as string[],
  };
}
/** Activity XP is never prorated. Stamina is applied atomically by the database. */
export function combatReward(state: CombatSnapshot, player: import("../../shared/combat/model.ts").CombatPlayer, fight: s.FightRecord) {
  const rounds = completedRounds(state);
  const participation = rounds ? participatedRounds(state, player) / rounds : 0;
  const maximum = state.enemies.reduce((sum, enemy) => sum + enemy.maxHealth, 0);
  const remaining = state.enemies.reduce((sum, enemy) => sum + Math.max(0, Math.min(enemy.health, enemy.maxHealth)), 0);
  const progress = state.victory ? 1 : state.endedByHost && maximum ? 1 - remaining / maximum : 0;
  return {
    participation,
    progress,
    xp: participation ? calculateXP({ ...player.totals, baseFightXP: fight.baseXP * progress * participation }) : 0,
    gold: state.victory && participation ? Math.floor(calculateGoldReward(Math.max(...fight.enemies.map(e => e.difficultyMultiplier))) * participation) : 0,
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
  const players = Object.values({ ...state.pendingPlayers, ...state.players });
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
    const { xp, gold, participation } = combatReward(state, p, fight);
    const eligibleLoot = state.victory && participation > 0 ? fight.lootTable : [];
    values.push({ session_id: state.sessionId, student_id: p.studentId, fight_id: fight.id,
      guild_id: earnedGuildId, character_class: p.characterClass, victory: !!state.victory,
      survived: !p.isDead, is_solo_mode: !!live?.soloStudentId, totals: p.totals,
      base_xp: xp, gold_reward: gold, loot_table: eligibleLoot,
      reward_claim: !eligibleLoot.length ? "automatic" : null,
      participated: participation > 0 });
  }
  // The database serializes each student's daily counter and result/reward receipt
  // across rooms. A single batched call also stays within classroom request budgets.
  if (values.length) await db.execute(sql`SELECT award_combat_results_with_stamina(${JSON.stringify(values)}::jsonb)`);
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
