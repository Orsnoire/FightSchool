import type { Student, InsertStudent, Teacher, InsertTeacher, Fight, InsertFight, CombatState, PlayerState, CombatStat, InsertCombatStat, StudentJobLevel, InsertStudentJobLevel, CharacterClass, EquipmentItemDb, InsertEquipmentItem, Gender, ItemType, ItemQuality, EquipmentSlot } from "@shared/schema";
import { students, teachers, fights, combatSessions, combatStats, studentJobLevels, equipmentItems, CLASS_STATS, generateSessionId } from "@shared/schema";
import { randomUUID, scryptSync, randomBytes } from "crypto";
import { db } from "./db";
import { eq, and, or, inArray, sql } from "drizzle-orm";
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
  updateFight(id: string, fight: InsertFight): Promise<Fight | undefined>;
  deleteFight(id: string): Promise<boolean>;

  // Combat session operations
  getCombatSession(sessionId: string): Promise<CombatState | undefined>;
  getCombatSessionsByFightId(fightId: string): Promise<CombatState[]>; // Get all sessions for a fight
  createCombatSession(fightId: string, fight: Fight): Promise<CombatState>;
  updateCombatSession(sessionId: string, updates: Partial<CombatState>): Promise<CombatState | undefined>;
  deleteCombatSession(sessionId: string): Promise<boolean>;
  addPlayerToCombat(sessionId: string, student: Student): Promise<void>;
  updatePlayerState(sessionId: string, studentId: string, updates: Partial<PlayerState>): Promise<void>;

  // Combat stats operations
  createCombatStat(stat: InsertCombatStat): Promise<CombatStat>;
  getCombatStatByFightAndStudent(fightId: string, studentId: string): Promise<CombatStat | undefined>;
  updateCombatStat(id: string, updates: Partial<CombatStat>): Promise<CombatStat | undefined>;
  claimLootAtomically(fightId: string, studentId: string, itemId: string): Promise<boolean>;
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
  
  // Equipment items operations
  getEquipmentItem(id: string): Promise<EquipmentItemDb | undefined>;
  getEquipmentItemsByIds(ids: string[]): Promise<EquipmentItemDb[]>;
  getEquipmentItemsByTeacher(teacherId: string): Promise<EquipmentItemDb[]>;
  createEquipmentItem(item: InsertEquipmentItem): Promise<EquipmentItemDb>;
  updateEquipmentItem(id: string, updates: Partial<EquipmentItemDb>): Promise<EquipmentItemDb | undefined>;
  deleteEquipmentItem(id: string): Promise<boolean>;
  seedDefaultEquipment(): Promise<void>;
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
    return await db.select().from(students).where(eq(students.guildCode, classCode));
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const hashedPassword = hashPassword(insertStudent.password);
    const [student] = await db
      .insert(students)
      .values([{
        ...insertStudent,
        password: hashedPassword,
        characterClass: insertStudent.characterClass as CharacterClass | null | undefined,
        gender: insertStudent.gender as Gender | null | undefined,
        inventory: insertStudent.inventory as string[] | null | undefined,
      }])
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
        guildCode: insertFight.guildCode,
        questions: insertFight.questions,
        enemies: insertFight.enemies,
        baseXP: insertFight.baseXP,
        baseEnemyDamage: insertFight.baseEnemyDamage,
        enemyDisplayMode: insertFight.enemyDisplayMode,
        lootTable: insertFight.lootTable,
        randomizeQuestions: insertFight.randomizeQuestions,
        shuffleOptions: insertFight.shuffleOptions,
      })
      .returning();
    return { ...fight, lootTable: fight.lootTable || [] } as Fight;
  }

  async updateFight(id: string, insertFight: InsertFight): Promise<Fight | undefined> {
    const [fight] = await db
      .update(fights)
      .set({
        title: insertFight.title,
        guildCode: insertFight.guildCode,
        questions: insertFight.questions,
        enemies: insertFight.enemies,
        baseXP: insertFight.baseXP,
        baseEnemyDamage: insertFight.baseEnemyDamage,
        enemyDisplayMode: insertFight.enemyDisplayMode,
        lootTable: insertFight.lootTable,
        randomizeQuestions: insertFight.randomizeQuestions,
        shuffleOptions: insertFight.shuffleOptions,
      })
      .where(eq(fights.id, id))
      .returning();
    return fight ? { ...fight, lootTable: fight.lootTable || [] } as Fight : undefined;
  }

  async deleteFight(id: string): Promise<boolean> {
    const result = await db.delete(fights).where(eq(fights.id, id)).returning();
    return result.length > 0;
  }

  // Combat session operations
  async getCombatSession(sessionId: string): Promise<CombatState | undefined> {
    const [session] = await db.select().from(combatSessions).where(eq(combatSessions.sessionId, sessionId));
    return session as CombatState | undefined;
  }

  async getCombatSessionsByFightId(fightId: string): Promise<CombatState[]> {
    const sessions = await db.select().from(combatSessions).where(eq(combatSessions.fightId, fightId));
    return sessions as CombatState[];
  }

  async createCombatSession(fightId: string, fight: Fight): Promise<CombatState> {
    // Generate unique 6-character session ID
    let sessionId = generateSessionId();
    
    // Ensure uniqueness (very unlikely to collide with 32^6 = 1 billion+ combinations)
    let attempts = 0;
    while (attempts < 5) {
      const existing = await this.getCombatSession(sessionId);
      if (!existing) break;
      sessionId = generateSessionId();
      attempts++;
    }
    
    // Generate question order (shuffle if randomizeQuestions is true)
    const questionOrder = Array.from({ length: fight.questions.length }, (_, i) => i);
    if (fight.randomizeQuestions) {
      // Fisher-Yates shuffle algorithm
      for (let i = questionOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questionOrder[i], questionOrder[j]] = [questionOrder[j], questionOrder[i]];
      }
    }
    
    const session: CombatState = {
      sessionId,
      fightId,
      currentQuestionIndex: 0,
      currentPhase: "waiting",
      players: {},
      enemies: fight.enemies.map((e) => ({ ...e, health: e.maxHealth })),
      questionOrder,
    };
    
    await db.insert(combatSessions).values({
      sessionId: session.sessionId,
      fightId: session.fightId,
      currentQuestionIndex: session.currentQuestionIndex,
      currentPhase: session.currentPhase,
      players: session.players,
      enemies: session.enemies,
      questionOrder: session.questionOrder,
    });
    
    return session;
  }

  async updateCombatSession(sessionId: string, updates: Partial<CombatState>): Promise<CombatState | undefined> {
    const [session] = await db
      .update(combatSessions)
      .set(updates)
      .where(eq(combatSessions.sessionId, sessionId))
      .returning();
    return session as CombatState | undefined;
  }

  async deleteCombatSession(sessionId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(combatSessions)
        .where(eq(combatSessions.sessionId, sessionId))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error(`Failed to delete combat session ${sessionId}:`, error);
      return false;
    }
  }

  async addPlayerToCombat(sessionId: string, student: Student): Promise<void> {
    const session = await this.getCombatSession(sessionId);
    if (!session) return;
    
    // Student must have completed character selection
    if (!student.characterClass || !student.gender) return;

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
      isChargingFireball: false,
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
      threat: 1, // Default threat level for enemy AI targeting
    };

    session.players[student.id] = playerState;
    await db
      .update(combatSessions)
      .set({ players: session.players })
      .where(eq(combatSessions.sessionId, sessionId));
  }

  async updatePlayerState(sessionId: string, studentId: string, updates: Partial<PlayerState>): Promise<void> {
    const session = await this.getCombatSession(sessionId);
    if (!session || !session.players[studentId]) return;

    session.players[studentId] = { ...session.players[studentId], ...updates };
    await db
      .update(combatSessions)
      .set({ players: session.players })
      .where(eq(combatSessions.sessionId, sessionId));
  }

  // Combat stats operations
  async createCombatStat(stat: InsertCombatStat): Promise<CombatStat> {
    const [createdStat] = await db.insert(combatStats).values([{
      ...stat,
      characterClass: stat.characterClass as CharacterClass,
    }]).returning();
    return createdStat;
  }

  async getCombatStatByFightAndStudent(fightId: string, studentId: string): Promise<CombatStat | undefined> {
    const [stat] = await db
      .select()
      .from(combatStats)
      .where(and(eq(combatStats.fightId, fightId), eq(combatStats.studentId, studentId)));
    return stat || undefined;
  }

  async updateCombatStat(id: string, updates: Partial<CombatStat>): Promise<CombatStat | undefined> {
    const [updatedStat] = await db
      .update(combatStats)
      .set(updates)
      .where(eq(combatStats.id, id))
      .returning();
    return updatedStat || undefined;
  }

  async claimLootAtomically(fightId: string, studentId: string, itemId: string): Promise<boolean> {
    // Atomically update the loot claim only if it hasn't been claimed yet
    const [updatedStat] = await db
      .update(combatStats)
      .set({ lootItemClaimed: itemId })
      .where(
        and(
          eq(combatStats.fightId, fightId),
          eq(combatStats.studentId, studentId),
          sql`${combatStats.lootItemClaimed} IS NULL`
        )
      )
      .returning();
    
    // Return true if update succeeded (row was found and updated), false otherwise
    return !!updatedStat;
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
    // Get all fights for this guild code
    const allFights = await this.getAllFights();
    const classFights = allFights.filter(f => f.guildCode === classCode);
    const fightIds = classFights.map(f => f.id);
    
    if (fightIds.length === 0) return [];
    
    const uniqueStudentIds = new Set<string>();
    
    // Check combat sessions (active/ongoing fights) for student IDs
    for (const fightId of fightIds) {
      const sessions = await this.getCombatSessionsByFightId(fightId);
      for (const session of sessions) {
        if (session && session.players) {
          Object.keys(session.players).forEach(studentId => uniqueStudentIds.add(studentId));
        }
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
    const [created] = await db.insert(studentJobLevels).values([{
      ...jobLevel,
      jobClass: jobLevel.jobClass as CharacterClass,
    }]).returning();
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

  // Equipment items operations
  async getEquipmentItem(id: string): Promise<EquipmentItemDb | undefined> {
    const [item] = await db.select().from(equipmentItems).where(eq(equipmentItems.id, id));
    return item || undefined;
  }

  async getEquipmentItemsByIds(ids: string[]): Promise<EquipmentItemDb[]> {
    if (ids.length === 0) return [];
    return await db.select().from(equipmentItems).where(inArray(equipmentItems.id, ids));
  }

  async getEquipmentItemsByTeacher(teacherId: string): Promise<EquipmentItemDb[]> {
    // Return both teacher's custom items AND shared system items
    return await db
      .select()
      .from(equipmentItems)
      .where(
        or(
          eq(equipmentItems.teacherId, teacherId),
          eq(equipmentItems.teacherId, 'SYSTEM')
        )
      );
  }

  async createEquipmentItem(item: InsertEquipmentItem): Promise<EquipmentItemDb> {
    const [created] = await db.insert(equipmentItems).values([{
      ...item,
      itemType: item.itemType as ItemType,
      quality: item.quality as ItemQuality,
      slot: item.slot as EquipmentSlot,
    }]).returning();
    return created;
  }

  async updateEquipmentItem(id: string, updates: Partial<EquipmentItemDb>): Promise<EquipmentItemDb | undefined> {
    const [updated] = await db
      .update(equipmentItems)
      .set(updates)
      .where(eq(equipmentItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEquipmentItem(id: string): Promise<boolean> {
    const result = await db.delete(equipmentItems).where(eq(equipmentItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async seedDefaultEquipment(): Promise<void> {
    // Check if system items already exist
    const existingSystemItems = await db
      .select()
      .from(equipmentItems)
      .where(eq(equipmentItems.teacherId, 'SYSTEM'));
    
    if (existingSystemItems.length > 0) {
      return; // Already seeded
    }

    // Define default equipment items from EQUIPMENT_ITEMS constant
    const defaultItems = [
      // Basic starting gear
      { id: 'basic_sword', name: 'Basic Sword', slot: 'weapon' as const, quality: 'common' as const, itemType: 'sword' as const, attackBonus: 1, hpBonus: 0, defenseBonus: 0 },
      { id: 'basic_staff', name: 'Basic Staff', slot: 'weapon' as const, quality: 'common' as const, itemType: 'staff' as const, attackBonus: 1, hpBonus: 0, defenseBonus: 0 },
      { id: 'basic_bow', name: 'Basic Bow', slot: 'weapon' as const, quality: 'common' as const, itemType: 'bow' as const, attackBonus: 1, hpBonus: 0, defenseBonus: 0 },
      { id: 'basic_herbs', name: 'Basic Herbs', slot: 'weapon' as const, quality: 'common' as const, itemType: 'herbs' as const, attackBonus: 0, hpBonus: 1, defenseBonus: 0 },
      { id: 'basic_helm', name: 'Basic Helm', slot: 'headgear' as const, quality: 'common' as const, itemType: 'helmet' as const, attackBonus: 0, hpBonus: 0, defenseBonus: 1 },
      { id: 'basic_armor', name: 'Basic Armor', slot: 'armor' as const, quality: 'common' as const, itemType: 'armor' as const, attackBonus: 0, hpBonus: 0, defenseBonus: 1 },
      
      // Common drops
      { id: 'iron_sword', name: 'Iron Sword', slot: 'weapon' as const, quality: 'common' as const, itemType: 'sword' as const, attackBonus: 2, hpBonus: 0, defenseBonus: 0 },
      { id: 'steel_bow', name: 'Steel Bow', slot: 'weapon' as const, quality: 'rare' as const, itemType: 'bow' as const, attackBonus: 3, hpBonus: 0, defenseBonus: 0 },
      { id: 'magic_staff', name: 'Magic Staff', slot: 'weapon' as const, quality: 'rare' as const, itemType: 'staff' as const, attackBonus: 3, hpBonus: 0, defenseBonus: 0 },
      { id: 'leather_helm', name: 'Leather Helm', slot: 'headgear' as const, quality: 'common' as const, itemType: 'helmet' as const, attackBonus: 0, hpBonus: 0, defenseBonus: 2 },
      { id: 'steel_helmet', name: 'Steel Helmet', slot: 'headgear' as const, quality: 'rare' as const, itemType: 'helmet' as const, attackBonus: 0, hpBonus: 2, defenseBonus: 3 },
      { id: 'arcane_crown', name: 'Arcane Crown', slot: 'headgear' as const, quality: 'epic' as const, itemType: 'helmet' as const, attackBonus: 2, hpBonus: 3, defenseBonus: 0 },
      { id: 'leather_armor', name: 'Leather Armor', slot: 'armor' as const, quality: 'common' as const, itemType: 'armor' as const, attackBonus: 0, hpBonus: 0, defenseBonus: 2 },
      { id: 'chainmail', name: 'Chainmail', slot: 'armor' as const, quality: 'rare' as const, itemType: 'armor' as const, attackBonus: 0, hpBonus: 0, defenseBonus: 4 },
      { id: 'plate_armor', name: 'Plate Armor', slot: 'armor' as const, quality: 'epic' as const, itemType: 'armor' as const, attackBonus: 0, hpBonus: 5, defenseBonus: 5 },
      { id: 'dragon_scale', name: 'Dragon Scale Armor', slot: 'armor' as const, quality: 'legendary' as const, itemType: 'armor' as const, attackBonus: 2, hpBonus: 10, defenseBonus: 7 },
      { id: 'legendary_blade', name: 'Legendary Blade', slot: 'weapon' as const, quality: 'legendary' as const, itemType: 'sword' as const, attackBonus: 5, hpBonus: 5, defenseBonus: 0 },
    ];

    // Insert all default items with teacherId='SYSTEM'
    const itemsToInsert = defaultItems.map(item => ({
      id: item.id,
      teacherId: 'SYSTEM' as string,
      name: item.name,
      slot: item.slot,
      quality: item.quality,
      itemType: item.itemType,
      iconUrl: null as string | null,
      hpBonus: item.hpBonus,
      attackBonus: item.attackBonus,
      defenseBonus: item.defenseBonus,
    }));

    // Use a transaction to insert all items
    await db.insert(equipmentItems).values(itemsToInsert);
  }
}

export const storage = new DatabaseStorage();
