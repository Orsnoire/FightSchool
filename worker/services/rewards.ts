import { and, desc, eq, sql } from "drizzle-orm";
import type { GameDatabase } from "../db/database";
import * as s from "../db/schema";
// Keep the earned-result lookup and atomic receipt/inventory/gold statement together.
export class RewardError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}
export async function claimReward(db: GameDatabase, studentId: string, fightId: string, itemId: string | null, resultId?: string) {
  const [result] = await db
    .select()
    .from(s.combatResults)
    .where(and(eq(s.combatResults.studentId, studentId), eq(s.combatResults.fightId, fightId), ...(resultId ? [eq(s.combatResults.id, resultId)] : [])))
    .orderBy(desc(s.combatResults.completedAt))
    .limit(1);
  if (!result?.victory || !result.lootTable.length)
    throw new RewardError("No reward choice is available");
  if (itemId && !result.lootTable.some((x) => x.itemId === itemId))
    throw new RewardError("Item is not in the earned loot table", 400);
  const claim = itemId || "gold";
  const response = await db.execute(sql`WITH claim AS (UPDATE combat_results SET reward_claim=${claim} WHERE id=${result.id} AND reward_claim IS NULL RETURNING student_id,gold_reward)
 UPDATE students SET gold=gold+${itemId ? 0 : result.goldReward}, inventory=CASE WHEN ${itemId !== null} THEN CASE WHEN inventory @> ${JSON.stringify(itemId ? [itemId] : [])}::jsonb THEN inventory ELSE inventory || ${JSON.stringify(itemId ? [itemId] : [])}::jsonb END ELSE inventory END
 WHERE id IN(SELECT student_id FROM claim) RETURNING id,gold,inventory`);
  if (!response.rows.length && result.rewardClaim !== claim)
    throw new RewardError("Reward has already been claimed");
  return { success: true, goldReward: itemId ? 0 : result.goldReward };
}
