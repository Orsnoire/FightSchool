import { and, desc, eq, sql } from 'drizzle-orm';
import type { FightSummary } from '../../shared/contracts/fight-summary';
import type { GameDatabase } from './game-repository';
import { fights } from './schema';

export async function listTeacherFightSummaries(database: GameDatabase, teacherId: string): Promise<FightSummary[]> {
  const rows = await database.select({
    id: fights.id, teacherId: fights.teacherId, title: fights.title,
    guildCode: fights.guildCode, encounterTier: fights.encounterTier,
    questionCount: sql<number>`jsonb_array_length(${fights.questions})`.mapWith(Number),
    enemyCount: sql<number>`jsonb_array_length(${fights.enemies})`.mapWith(Number),
    createdAt: fights.createdAt, updatedAt: fights.updatedAt,
  }).from(fights).where(and(eq(fights.teacherId, teacherId), eq(fights.isArchived, false)))
    .orderBy(desc(fights.createdAt), desc(fights.id));
  return rows.map(row => ({ ...row, createdAt: row.createdAt.getTime(), updatedAt: row.updatedAt.getTime() }));
}
