import { eq } from 'drizzle-orm';
import { ALL_CHARACTER_CLASSES, type CharacterClass } from '../../shared/schema';
import { aaWallet } from '../../shared/aa';
import type { TeacherRosterMember } from '../../shared/contracts/guild-roster';
import type { GameDatabase } from '../db/database';
import * as s from '../db/schema';

/** Caller must enforce guild ownership. Project only teacher roster fields. */
export async function teacherGuildRoster(db: GameDatabase, guildId: string): Promise<TeacherRosterMember[]> {
  const members = await db.select({ studentId: s.students.id, nickname: s.students.nickname,
    joinedAt: s.guildMemberships.joinedAt, aaExperience: s.students.aaExperience })
    .from(s.guildMemberships).innerJoin(s.students, eq(s.students.id, s.guildMemberships.studentId))
    .where(eq(s.guildMemberships.guildId, guildId));
  const levels = await db.select({ studentId: s.studentJobLevels.studentId,
    job: s.studentJobLevels.jobClass, level: s.studentJobLevels.level })
    .from(s.studentJobLevels).innerJoin(s.guildMemberships, eq(s.guildMemberships.studentId, s.studentJobLevels.studentId))
    .where(eq(s.guildMemberships.guildId, guildId));
  const byStudent = new Map<string, Record<CharacterClass, number>>();
  for (const member of members) byStudent.set(member.studentId,
    Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, 0])) as Record<CharacterClass, number>);
  for (const level of levels) {
    const jobs = byStudent.get(level.studentId);
    if (jobs && ALL_CHARACTER_CLASSES.includes(level.job)) jobs[level.job] = level.level;
  }
  return members.map(({aaExperience, ...member}) => ({ ...member,
    jobLevels: byStudent.get(member.studentId)!, totalAAsEarned: aaWallet(aaExperience).total,
  }));
}
