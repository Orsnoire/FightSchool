import { and, eq, sql } from 'drizzle-orm';
import type { GameDatabase } from '../db/database';
import * as s from '../db/schema';
import type { CampaignRecord } from './state';

function eligible(campaign: CampaignRecord, fightId?: string) {
  return and(eq(s.guildFights.guildId, campaign.guildId), eq(s.fights.teacherId, campaign.teacherId),
    eq(s.fights.isArchived, false), sql`jsonb_array_length(${s.fights.questions}) > 0`, fightId ? eq(s.fights.id, fightId) : undefined);
}
/** Metadata only: entry options must never expose the questions or answers. */
export async function campaignQuestionBanks(db: GameDatabase, campaign: CampaignRecord, fightId?: string) {
  return db.select({ fightId: s.fights.id, title: s.fights.title, questionCount: sql<number>`jsonb_array_length(${s.fights.questions})` })
    .from(s.fights).innerJoin(s.guildFights, eq(s.guildFights.fightId, s.fights.id))
    .where(eligible(campaign, fightId)).orderBy(s.fights.title, s.fights.id);
}
export async function campaignQuestionBank(db: GameDatabase, campaign: CampaignRecord, fightId?: string) {
  if (!fightId) return null;
  const [row] = await db.select({ fight: s.fights }).from(s.fights)
    .innerJoin(s.guildFights, eq(s.guildFights.fightId, s.fights.id)).where(eligible(campaign, fightId));
  return row?.fight || null;
}
