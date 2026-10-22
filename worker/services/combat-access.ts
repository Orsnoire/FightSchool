import { and, eq } from 'drizzle-orm';
import type { GameDatabase } from '../db/database';
import type { IdentityRepository } from '../db/repository';
import { guildMemberships, guilds, type LiveCombatSessionRecord } from '../db/schema';

export async function isActiveGuildMember(db: GameDatabase, studentId: string, guildId: string, teacherId: string) {
  const [member] = await db.select({ id: guildMemberships.studentId }).from(guildMemberships)
    .innerJoin(guilds, eq(guilds.id, guildMemberships.guildId))
    .where(and(eq(guildMemberships.studentId, studentId), eq(guilds.id, guildId),
      eq(guilds.teacherId, teacherId), eq(guilds.isArchived, false))).limit(1);
  return !!member;
}

/** Student-created guild battles admit active guildmates; legacy private rooms stay owner-only. */
export async function studentCanAccessSession(repository: IdentityRepository, room: LiveCombatSessionRecord, studentId: string) {
  if (!room.soloStudentId) return true;
  if (!room.guildId) return room.soloStudentId === studentId;
  return !!(await repository.isActiveGuildMember?.(studentId, room.guildId, room.teacherId));
}
