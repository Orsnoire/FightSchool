import { EQUIPMENT_SLOTS } from "../../shared/equipment-catalog.ts";
import {
  getStartingEquipment,
  type CharacterClass,
} from "../../shared/schema.ts";
import {
  combatProfile,
  gameDatabase,
  persistCombatResults,
} from "./game-repository.ts";
import type { CombatProfile } from "../combat/engine.ts";
import type { CombatSnapshot } from "../../shared/combat/model.ts";
import { neon } from "@neondatabase/serverless";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { SessionRepository } from "../auth/session.ts";
import {
  appSessions,
  fights,
  equipmentItems,
  guildFights,
  liveCombatSessions,
  students,
  studentJobLevels,
  teachers,
  type FightRecord,
  type NewFightRecord,
  type NewTeacherRecord,
  type NewStudentRecord,
  type StudentRecord,
  type LiveCombatSessionRecord,
  type TeacherRecord,
} from "./schema.ts";

export interface IdentityRepository extends SessionRepository {
  validateLoot?(teacherId: string, itemIds: string[]): Promise<boolean>;
  getCombatProfile?(student: StudentRecord): Promise<CombatProfile>;
  persistResults?(
    state: CombatSnapshot,
    fight: FightRecord,
  ): Promise<unknown[]>;
  findTeacherByEmail(emailNormalized: string): Promise<TeacherRecord | null>;
  findTeacherById(id: string): Promise<TeacherRecord | null>;
  createTeacher(teacher: NewTeacherRecord): Promise<TeacherRecord>;
  listTeacherFights(teacherId: string): Promise<FightRecord[]>;
  findFightById(id: string): Promise<FightRecord | null>;
  createFight(fight: NewFightRecord): Promise<FightRecord>;
  updateFight(
    id: string,
    teacherId: string,
    fight: Omit<NewFightRecord, "teacherId">,
  ): Promise<FightRecord | null>;
  deleteFight(id: string, teacherId: string): Promise<boolean>;
  findStudentByNickname(
    nicknameNormalized: string,
  ): Promise<StudentRecord | null>;
  findStudentById(id: string): Promise<StudentRecord | null>;
  createStudent(student: NewStudentRecord): Promise<StudentRecord>;
  updateStudentCharacter(
    id: string,
    characterClass: string,
    gender: string,
  ): Promise<StudentRecord | null>;
  createLiveCombatSession(input: {
    sessionId: string;
    fightId: string;
    teacherId: string;
  }): Promise<LiveCombatSessionRecord>;
  findLiveCombatSession(
    sessionId: string,
  ): Promise<LiveCombatSessionRecord | null>;
  findOpenLiveCombatSessionForFight(
    fightId: string,
    teacherId: string,
  ): Promise<LiveCombatSessionRecord | null>;
  updateLiveCombatSessionStatus(
    sessionId: string,
    status: string,
  ): Promise<void>;
}

export function createIdentityRepository(
  databaseUrl: string,
): IdentityRepository {
  const client = neon(databaseUrl);
  const database = drizzle(client);

  return {
    async validateLoot(teacherId, itemIds) {
      if (!itemIds.length) return true;
      const rows = await database
        .select({ id: equipmentItems.id })
        .from(equipmentItems)
        .where(
          and(
            eq(equipmentItems.teacherId, teacherId),
            inArray(equipmentItems.id, itemIds),
          ),
        );
      return new Set(rows.map((r) => r.id)).size === new Set(itemIds).size;
    },
    async getCombatProfile(student) {
      return combatProfile(gameDatabase(databaseUrl), student);
    },
    async persistResults(state, fight) {
      return persistCombatResults(gameDatabase(databaseUrl), state, fight);
    },
    async findTeacherByEmail(emailNormalized) {
      const [teacher] = await database
        .select()
        .from(teachers)
        .where(eq(teachers.emailNormalized, emailNormalized))
        .limit(1);
      return teacher || null;
    },

    async findTeacherById(id) {
      const [teacher] = await database
        .select()
        .from(teachers)
        .where(eq(teachers.id, id))
        .limit(1);
      return teacher || null;
    },

    async createTeacher(teacher) {
      const [created] = await database
        .insert(teachers)
        .values(teacher)
        .returning();
      return created;
    },

    async listTeacherFights(teacherId) {
      return database
        .select()
        .from(fights)
        .where(
          and(eq(fights.teacherId, teacherId), eq(fights.isArchived, false)),
        )
        .orderBy(desc(fights.createdAt));
    },

    async findFightById(id) {
      const [fight] = await database
        .select()
        .from(fights)
        .where(and(eq(fights.id, id), eq(fights.isArchived, false)))
        .limit(1);
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
      const [archived] = await database
        .update(fights)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(and(eq(fights.id, id), eq(fights.teacherId, teacherId)))
        .returning({ id: fights.id });
      if (archived)
        await database.delete(guildFights).where(eq(guildFights.fightId, id));
      return !!archived;
    },

    async findStudentByNickname(nicknameNormalized) {
      const [student] = await database
        .select()
        .from(students)
        .where(eq(students.nicknameNormalized, nicknameNormalized))
        .limit(1);
      return student || null;
    },

    async findStudentById(id) {
      const [student] = await database
        .select()
        .from(students)
        .where(eq(students.id, id))
        .limit(1);
      return student || null;
    },

    async createStudent(student) {
      const [created] = await database
        .insert(students)
        .values(student)
        .returning();
      return created;
    },

    async updateStudentCharacter(id, characterClass, gender) {
      const [previous] = await database.select().from(students).where(eq(students.id,id));
      if (!previous) return null;
      const starting = previous.characterClass === characterClass ? {} : getStartingEquipment(characterClass as CharacterClass);
      await database
        .insert(studentJobLevels)
        .values({ studentId: id, jobClass: characterClass as CharacterClass })
        .onConflictDoNothing();
      const [updated] = await database
        .update(students)
        .set({
          ...starting,
          inventory: sql`(SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb) FROM jsonb_array_elements(${students.inventory} || ${JSON.stringify(EQUIPMENT_SLOTS.map(slot => previous[slot]).filter(Boolean))}::jsonb))`,
          characterClass: characterClass as StudentRecord["characterClass"],
          gender: gender as StudentRecord["gender"],
        })
        .where(eq(students.id, id))
        .returning();
      return updated || null;
    },

    async createLiveCombatSession(input) {
      const [created] = await database
        .insert(liveCombatSessions)
        .values(input)
        .returning();
      return created;
    },

    async findLiveCombatSession(sessionId) {
      const [session] = await database
        .select()
        .from(liveCombatSessions)
        .where(eq(liveCombatSessions.sessionId, sessionId))
        .limit(1);
      return session || null;
    },

    async findOpenLiveCombatSessionForFight(fightId, teacherId) {
      const [session] = await database
        .select()
        .from(liveCombatSessions)
        .where(
          and(
            eq(liveCombatSessions.fightId, fightId),
            eq(liveCombatSessions.teacherId, teacherId),
            isNull(liveCombatSessions.soloStudentId),
            inArray(liveCombatSessions.status, ["waiting", "active"]),
          ),
        )
        .orderBy(desc(liveCombatSessions.createdAt))
        .limit(1);
      return session || null;
    },

    async updateLiveCombatSessionStatus(sessionId, status) {
      await database
        .update(liveCombatSessions)
        .set({
          status,
          completedAt: status === "completed" ? new Date() : null,
        })
        .where(eq(liveCombatSessions.sessionId, sessionId));
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
        .where(
          and(
            eq(appSessions.tokenHash, tokenHash),
            isNull(appSessions.revokedAt),
            gt(appSessions.expiresAt, now),
          ),
        )
        .limit(1);
      return session || null;
    },

    async revokeSession(tokenHash, now) {
      await database
        .update(appSessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(appSessions.tokenHash, tokenHash),
            isNull(appSessions.revokedAt),
          ),
        );
    },
  };
}

export async function verifyDatabase(databaseUrl: string): Promise<void> {
  const database = drizzle(neon(databaseUrl));
  await database.execute(sql`select 1`);
}
