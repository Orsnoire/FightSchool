import { neon } from "@neondatabase/serverless";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { SessionRepository } from "../auth/session.ts";
import {
  appSessions,
  fights,
  teachers,
  type FightRecord,
  type NewFightRecord,
  type NewTeacherRecord,
  type TeacherRecord,
} from "./schema.ts";

export interface IdentityRepository extends SessionRepository {
  findTeacherByEmail(emailNormalized: string): Promise<TeacherRecord | null>;
  findTeacherById(id: string): Promise<TeacherRecord | null>;
  createTeacher(teacher: NewTeacherRecord): Promise<TeacherRecord>;
  listTeacherFights(teacherId: string): Promise<FightRecord[]>;
  findFightById(id: string): Promise<FightRecord | null>;
  createFight(fight: NewFightRecord): Promise<FightRecord>;
  updateFight(id: string, teacherId: string, fight: Omit<NewFightRecord, "teacherId">): Promise<FightRecord | null>;
  deleteFight(id: string, teacherId: string): Promise<boolean>;
}

export function createIdentityRepository(databaseUrl: string): IdentityRepository {
  const client = neon(databaseUrl);
  const database = drizzle(client);

  return {
    async findTeacherByEmail(emailNormalized) {
      const [teacher] = await database
        .select()
        .from(teachers)
        .where(eq(teachers.emailNormalized, emailNormalized))
        .limit(1);
      return teacher || null;
    },

    async findTeacherById(id) {
      const [teacher] = await database.select().from(teachers).where(eq(teachers.id, id)).limit(1);
      return teacher || null;
    },

    async createTeacher(teacher) {
      const [created] = await database.insert(teachers).values(teacher).returning();
      return created;
    },

    async listTeacherFights(teacherId) {
      return database.select().from(fights).where(eq(fights.teacherId, teacherId)).orderBy(desc(fights.createdAt));
    },

    async findFightById(id) {
      const [fight] = await database.select().from(fights).where(eq(fights.id, id)).limit(1);
      return fight || null;
    },

    async createFight(fight) {
      const [created] = await database.insert(fights).values(fight).returning();
      return created;
    },

    async updateFight(id, teacherId, fight) {
      const [updated] = await database
        .update(fights)
        .set({ ...fight, updatedAt: new Date() })
        .where(and(eq(fights.id, id), eq(fights.teacherId, teacherId)))
        .returning();
      return updated || null;
    },

    async deleteFight(id, teacherId) {
      const deleted = await database
        .delete(fights)
        .where(and(eq(fights.id, id), eq(fights.teacherId, teacherId)))
        .returning({ id: fights.id });
      return deleted.length === 1;
    },

    async createSession(session) {
      await database.insert(appSessions).values(session);
    },

    async findActiveSession(tokenHash, now) {
      const [session] = await database
        .select({
          actorType: appSessions.actorType,
          actorId: appSessions.actorId,
          expiresAt: appSessions.expiresAt,
        })
        .from(appSessions)
        .where(and(
          eq(appSessions.tokenHash, tokenHash),
          isNull(appSessions.revokedAt),
          gt(appSessions.expiresAt, now),
        ))
        .limit(1);
      return session || null;
    },

    async revokeSession(tokenHash, now) {
      await database
        .update(appSessions)
        .set({ revokedAt: now })
        .where(and(eq(appSessions.tokenHash, tokenHash), isNull(appSessions.revokedAt)));
    },
  };
}

export async function verifyDatabase(databaseUrl: string): Promise<void> {
  const database = drizzle(neon(databaseUrl));
  await database.execute(sql`select 1`);
}
