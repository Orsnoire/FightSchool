import type { Student, InsertStudent, Teacher, InsertTeacher, Fight, InsertFight, CombatState, PlayerState, CombatStat, InsertCombatStat, StudentJobLevel, InsertStudentJobLevel, CharacterClass } from "@shared/schema";
import { students, teachers, fights, combatSessions, combatStats, studentJobLevels, CLASS_STATS } from "@shared/schema";
import { randomUUID, scryptSync, randomBytes } from "crypto";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { calculateNewLevel, getTotalXPForLevel, XP_REQUIREMENTS, getTotalPassiveBonuses } from "@shared/jobSystem";

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
  // Teacher operations
  getTeacher(id: string): Promise<Teacher | undefined>;
  getTeacherByEmail(email: string): Promise<Teacher | undefined>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: string, updates: Partial<Teacher>): Promise<Teacher | undefined>;

  // Student operations
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByNickname(nickname: string): Promise<Student | undefined>;
  getStudentsByClassCode(classCode: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, updates: Partial<Student>): Promise<Student | undefined>;

  // Fight operations
  getFight(id: string): Promise<Fight | undefined>;
  getAllFights(): Promise<Fight[]>;
  getFightsByTeacherId(teacherId: string): Promise<Fight[]>;
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
  
  // Get students who participated in fights for a specific class code
  getStudentsWhoUsedFightCodes(classCode: string): Promise<Student[]>;

  // Student job level operations
  getStudentJobLevels(studentId: string): Promise<StudentJobLevel[]>;
  getStudentJobLevel(studentId: string, jobClass: CharacterClass): Promise<StudentJobLevel | undefined>;
  createStudentJobLevel(jobLevel: InsertStudentJobLevel): Promise<StudentJobLevel>;
  updateStudentJobLevel(id: string, updates: Partial<StudentJobLevel>): Promise<StudentJobLevel | undefined>;
  awardXPToJob(studentId: string, jobClass: CharacterClass, xpAmount: number): Promise<{ jobLevel: StudentJobLevel; leveledUp: boolean; newLevel: number }>;
}

// Integration: blueprint:javascript_database
export class DatabaseStorage implements IStorage {
  // Teacher operations
  async getTeacher(id: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.id, id));
    return teacher || undefined;
  }

  async getTeacherByEmail(email: string): Promise<Teacher | undefined> {
    const [teacher] = await db.select().from(teachers).where(eq(teachers.email, email));
    return teacher || undefined;
  }

  async createTeacher(insertTeacher: InsertTeacher): Promise<Teacher> {
    const hashedPassword = hashPassword(insertTeacher.password);
    const [teacher] = await db
      .insert(teachers)
      .values({
        ...insertTeacher,
        password: hashedPassword,
      })
      .returning();
    return teacher;
  }

  async updateTeacher(id: string, updates: Partial<Teacher>): Promise<Teacher | undefined> {
    const [teacher] = await db
      .update(teachers)
      .set(updates)
      .where(eq(teachers.id, id))
      .returning();
    return teacher || undefined;
  }

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
        characterClass: insertStudent.characterClass || "warrior",
        gender: insertStudent.gender || "A",
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
    if (!fight) return undefined;
    return { ...fight, lootTable: fight.lootTable || [] } as Fight;
  }

  async getAllFights(): Promise<Fight[]> {
    const results = await db.select().from(fights);
    return results.map(f => ({ ...f, lootTable: f.lootTable || [] })) as Fight[];
  }

  async getFightsByTeacherId(teacherId: string): Promise<Fight[]> {
    const results = await db.select().from(fights).where(eq(fights.teacherId, teacherId));
    return results.map(f => ({ ...f, lootTable: f.lootTable || [] })) as Fight[];
  }

  async createFight(insertFight: InsertFight): Promise<Fight> {
    const [fight] = await db
      .insert(fights)
      .values({
        teacherId: insertFight.teacherId,
        title: insertFight.title,
        classCode: insertFight.classCode,
        questions: insertFight.questions,
        enemies: insertFight.enemies,
        baseXP: insertFight.baseXP,
        enemyDisplayMode: insertFight.enemyDisplayMode,
        lootTable: insertFight.lootTable,
      })
      .returning();
    return { ...fight, lootTable: fight.lootTable || [] } as Fight;
  }

  async deleteFight(id: string): Promise<boolean> {
    const result = await db.delete(fights).where(eq(fights.id, id)).returning();
    return result.length > 0;
  }

  // Combat session operations
  async getCombatSession(fightId: string): Promise<CombatState | undefined> {
    const [session] = await db.select().from(combatSessions).where(eq(combatSessions.fightId, fightId));
    return session as CombatState | undefined;
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
    return session as CombatState | undefined;
  }

  async addPlayerToCombat(fightId: string, student: Student): Promise<void> {
    const session = await this.getCombatSession(fightId);
    if (!session) return;

    // Fetch student's job levels
    const jobLevelRecords = await this.getStudentJobLevels(student.id);
    
    // Convert to map with all classes (default to 0 for unleveled classes)
    const jobLevelMap: Record<CharacterClass, number> = {
      warrior: 0,
      wizard: 0,
      scout: 0,
      herbalist: 0,
      knight: 0,
      paladin: 0,
      dark_knight: 0,
      sage: 0,
      ranger: 0,
      druid: 0,
      monk: 0,
    };
    
    for (const record of jobLevelRecords) {
      jobLevelMap[record.jobClass] = record.level;
    }
    
    // Get base stats and calculate passive bonuses from all job levels
    const baseStats = CLASS_STATS[student.characterClass];
    const passiveBonuses = getTotalPassiveBonuses(jobLevelMap);
    
    // Apply bonuses to base stats
    const maxHealth = baseStats.maxHealth + (passiveBonuses.hp || 0);

    const playerState: PlayerState = {
      studentId: student.id,
      nickname: student.nickname,
      characterClass: student.characterClass,
      gender: student.gender,
      health: maxHealth,
      maxHealth: maxHealth,
      streakCounter: 0,
      isDead: false,
      hasAnswered: false,
      isHealing: false,
      potionCount: student.characterClass === 'herbalist' ? 5 : 0,
      isCreatingPotion: false,
      jobLevels: jobLevelMap,
      fireballChargeRounds: 0,
      fireballCooldown: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
      questionsIncorrect: 0,
      damageDealt: 0,
      damageBlocked: 0,
      bonusDamage: 0,
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

  async getStudentsWhoUsedFightCodes(classCode: string): Promise<Student[]> {
    // Get all fights for this class code
    const allFights = await this.getAllFights();
    const classFights = allFights.filter(f => f.classCode === classCode);
    const fightIds = classFights.map(f => f.id);
    
    if (fightIds.length === 0) return [];
    
    const uniqueStudentIds = new Set<string>();
    
    // Check combat sessions (active/ongoing fights) for student IDs
    for (const fightId of fightIds) {
      const session = await this.getCombatSession(fightId);
      if (session && session.players) {
        Object.keys(session.players).forEach(studentId => uniqueStudentIds.add(studentId));
      }
    }
    
    // Also check combat stats (completed fights) for student IDs
    for (const fightId of fightIds) {
      const stats = await this.getStatsByFight(fightId);
      stats.forEach(stat => uniqueStudentIds.add(stat.studentId));
    }
    
    // Fetch the actual student records
    const studentsList: Student[] = [];
    for (const studentId of Array.from(uniqueStudentIds)) {
      const student = await this.getStudent(studentId);
      if (student) {
        studentsList.push(student);
      }
    }
    
    return studentsList;
  }

  // Student job level operations
  async getStudentJobLevels(studentId: string): Promise<StudentJobLevel[]> {
    return await db.select().from(studentJobLevels).where(eq(studentJobLevels.studentId, studentId));
  }

  async getStudentJobLevel(studentId: string, jobClass: CharacterClass): Promise<StudentJobLevel | undefined> {
    const [jobLevel] = await db
      .select()
      .from(studentJobLevels)
      .where(and(eq(studentJobLevels.studentId, studentId), eq(studentJobLevels.jobClass, jobClass)));
    return jobLevel || undefined;
  }

  async createStudentJobLevel(jobLevel: InsertStudentJobLevel): Promise<StudentJobLevel> {
    const [created] = await db.insert(studentJobLevels).values(jobLevel).returning();
    return created;
  }

  async updateStudentJobLevel(id: string, updates: Partial<StudentJobLevel>): Promise<StudentJobLevel | undefined> {
    const [updated] = await db
      .update(studentJobLevels)
      .set(updates)
      .where(eq(studentJobLevels.id, id))
      .returning();
    return updated || undefined;
  }

  async awardXPToJob(
    studentId: string,
    jobClass: CharacterClass,
    xpAmount: number
  ): Promise<{ jobLevel: StudentJobLevel; leveledUp: boolean; newLevel: number }> {
    // Get or create job level record
    let jobLevel = await this.getStudentJobLevel(studentId, jobClass);
    
    if (!jobLevel) {
      // Create new job level at level 1
      jobLevel = await this.createStudentJobLevel({
        studentId,
        jobClass,
        level: 1,
        experience: 0,
      });
    }

    // Add XP
    const newTotalXP = jobLevel.experience + xpAmount;
    const oldLevel = jobLevel.level;
    const newLevel = calculateNewLevel(oldLevel, newTotalXP);
    const leveledUp = newLevel > oldLevel;

    // Update the job level
    const updated = await this.updateStudentJobLevel(jobLevel.id, {
      experience: newTotalXP,
      level: newLevel,
    });

    return {
      jobLevel: updated || jobLevel,
      leveledUp,
      newLevel,
    };
  }
}

export const storage = new DatabaseStorage();
