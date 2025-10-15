import type { Student, InsertStudent, Fight, InsertFight, CombatState, PlayerState, CombatStat, InsertCombatStat } from "@shared/schema";
import { students, fights, combatSessions, combatStats, CLASS_STATS } from "@shared/schema";
import { randomUUID, scryptSync, randomBytes } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  const verifyHash = scryptSync(password, salt, 64).toString("hex");
  return hash === verifyHash;
}

export interface IStorage {
  // Student operations
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByNickname(nickname: string): Promise<Student | undefined>;
  getStudentsByClassCode(classCode: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, updates: Partial<Student>): Promise<Student | undefined>;

  // Fight operations
  getFight(id: string): Promise<Fight | undefined>;
  getAllFights(): Promise<Fight[]>;
  createFight(fight: InsertFight): Promise<Fight>;
  deleteFight(id: string): Promise<boolean>;

  // Combat session operations
  getCombatSession(fightId: string): Promise<CombatState | undefined>;
  createCombatSession(fightId: string, fight: Fight): Promise<CombatState>;
  updateCombatSession(fightId: string, updates: Partial<CombatState>): Promise<CombatState | undefined>;
  addPlayerToCombat(fightId: string, student: Student): Promise<void>;
  updatePlayerState(fightId: string, studentId: string, updates: Partial<PlayerState>): Promise<void>;

  // Combat stats operations
  createCombatStat(stat: InsertCombatStat): Promise<CombatStat>;
  getStatsByFight(fightId: string): Promise<CombatStat[]>;
  getStatsByStudent(studentId: string): Promise<CombatStat[]>;
  getStatsByClassCode(classCode: string): Promise<CombatStat[]>;
}

// Integration: blueprint:javascript_database
export class DatabaseStorage implements IStorage {
  // Student operations
  async getStudent(id: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student || undefined;
  }

  async getStudentByNickname(nickname: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.nickname, nickname));
    return student || undefined;
  }

  async getStudentsByClassCode(classCode: string): Promise<Student[]> {
    return await db.select().from(students).where(eq(students.classCode, classCode));
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const hashedPassword = hashPassword(insertStudent.password);
    const [student] = await db
      .insert(students)
      .values({
        ...insertStudent,
        password: hashedPassword,
        characterClass: insertStudent.characterClass || "knight",
        gender: insertStudent.gender || "A",
        weapon: insertStudent.weapon || "basic",
        headgear: insertStudent.headgear || "basic",
        armor: insertStudent.armor || "basic",
      })
      .returning();
    return student;
  }

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student | undefined> {
    const [student] = await db
      .update(students)
      .set(updates)
      .where(eq(students.id, id))
      .returning();
    return student || undefined;
  }

  // Fight operations
  async getFight(id: string): Promise<Fight | undefined> {
    const [fight] = await db.select().from(fights).where(eq(fights.id, id));
    return fight || undefined;
  }

  async getAllFights(): Promise<Fight[]> {
    return await db.select().from(fights);
  }

  async createFight(insertFight: InsertFight): Promise<Fight> {
    const [fight] = await db
      .insert(fights)
      .values({
        title: insertFight.title,
        classCode: insertFight.classCode,
        questions: insertFight.questions,
        enemies: insertFight.enemies,
      })
      .returning();
    return fight;
  }

  async deleteFight(id: string): Promise<boolean> {
    const result = await db.delete(fights).where(eq(fights.id, id)).returning();
    return result.length > 0;
  }

  // Combat session operations
  async getCombatSession(fightId: string): Promise<CombatState | undefined> {
    const [session] = await db.select().from(combatSessions).where(eq(combatSessions.fightId, fightId));
    return session || undefined;
  }

  async createCombatSession(fightId: string, fight: Fight): Promise<CombatState> {
    const session: CombatState = {
      fightId,
      currentQuestionIndex: 0,
      currentPhase: "waiting",
      players: {},
      enemies: fight.enemies.map((e) => ({ ...e, health: e.maxHealth })),
    };
    
    // Delete existing session if it exists, then insert new one
    await db.delete(combatSessions).where(eq(combatSessions.fightId, fightId));
    
    await db.insert(combatSessions).values({
      fightId: session.fightId,
      currentQuestionIndex: session.currentQuestionIndex,
      currentPhase: session.currentPhase,
      players: session.players,
      enemies: session.enemies,
    });
    
    return session;
  }

  async updateCombatSession(fightId: string, updates: Partial<CombatState>): Promise<CombatState | undefined> {
    const [session] = await db
      .update(combatSessions)
      .set(updates)
      .where(eq(combatSessions.fightId, fightId))
      .returning();
    return session || undefined;
  }

  async addPlayerToCombat(fightId: string, student: Student): Promise<void> {
    const session = await this.getCombatSession(fightId);
    if (!session) return;

    const stats = CLASS_STATS[student.characterClass];
    const playerState: PlayerState = {
      studentId: student.id,
      nickname: student.nickname,
      characterClass: student.characterClass,
      gender: student.gender,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      streakCounter: 0,
      isDead: false,
      hasAnswered: false,
      isHealing: false,
      questionsAnswered: 0,
      questionsCorrect: 0,
      damageDealt: 0,
      healingDone: 0,
      damageTaken: 0,
      deaths: 0,
    };

    session.players[student.id] = playerState;
    await db
      .update(combatSessions)
      .set({ players: session.players })
      .where(eq(combatSessions.fightId, fightId));
  }

  async updatePlayerState(fightId: string, studentId: string, updates: Partial<PlayerState>): Promise<void> {
    const session = await this.getCombatSession(fightId);
    if (!session || !session.players[studentId]) return;

    session.players[studentId] = { ...session.players[studentId], ...updates };
    await db
      .update(combatSessions)
      .set({ players: session.players })
      .where(eq(combatSessions.fightId, fightId));
  }

  // Combat stats operations
  async createCombatStat(stat: InsertCombatStat): Promise<CombatStat> {
    const [createdStat] = await db.insert(combatStats).values(stat).returning();
    return createdStat;
  }

  async getStatsByFight(fightId: string): Promise<CombatStat[]> {
    return await db.select().from(combatStats).where(eq(combatStats.fightId, fightId));
  }

  async getStatsByStudent(studentId: string): Promise<CombatStat[]> {
    return await db.select().from(combatStats).where(eq(combatStats.studentId, studentId));
  }

  async getStatsByClassCode(classCode: string): Promise<CombatStat[]> {
    const classStudents = await this.getStudentsByClassCode(classCode);
    const studentIds = classStudents.map(s => s.id);
    
    if (studentIds.length === 0) return [];
    
    // Get all stats for students in this class
    const allStats: CombatStat[] = [];
    for (const studentId of studentIds) {
      const stats = await this.getStatsByStudent(studentId);
      allStats.push(...stats);
    }
    return allStats;
  }
}

export const storage = new DatabaseStorage();
