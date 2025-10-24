import type { Student, InsertStudent, Teacher, InsertTeacher, Fight, InsertFight, CombatState, PlayerState, CombatStat, InsertCombatStat, StudentJobLevel, InsertStudentJobLevel, CharacterClass, EquipmentItemDb, InsertEquipmentItem, Gender, ItemType, ItemQuality, EquipmentSlot, Guild, InsertGuild, GuildMembership, InsertGuildMembership, GuildFight, InsertGuildFight, GuildSettings, InsertGuildSettings, GuildQuest, InsertGuildQuest } from "@shared/schema";
import { students, teachers, fights, combatSessions, combatStats, studentJobLevels, equipmentItems, guilds, guildMemberships, guildFights, guildSettings, guildQuests, CLASS_STATS, generateSessionId, generateGuildCode, calculateEquipmentStats, calculateCharacterStats, getGuildLevelFromXP } from "@shared/schema";
import { randomUUID, scryptSync, randomBytes } from "crypto";
import { db } from "./db";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { calculateNewLevel, getTotalXPForLevel, XP_REQUIREMENTS, getTotalPassiveBonuses, getTotalMechanicUpgrades } from "@shared/jobSystem";

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
  seedDefaultTeacher(): Promise<void>;
  seedTestStudent(): Promise<void>;
  seedTestFight(): Promise<void>;
  seedTestGuild(): Promise<void>;
  
  // Guild operations
  getGuild(id: string): Promise<Guild | undefined>;
  getGuildByCode(code: string): Promise<Guild | undefined>;
  getGuildsByTeacher(teacherId: string): Promise<Guild[]>;
  createGuild(guild: InsertGuild): Promise<Guild>;
  updateGuild(id: string, updates: Partial<Guild>): Promise<Guild | undefined>;
  archiveGuild(id: string): Promise<Guild | undefined>;
  awardGuildXP(guildId: string, xpAmount: number): Promise<Guild>;
  
  // Guild membership operations
  addMemberToGuild(guildId: string, studentId: string): Promise<GuildMembership>;
  removeMemberFromGuild(guildId: string, studentId: string): Promise<boolean>;
  getGuildMembers(guildId: string): Promise<Student[]>;
  getStudentGuilds(studentId: string): Promise<Guild[]>;
  isStudentInGuild(guildId: string, studentId: string): Promise<boolean>;
  
  // Guild fight assignment operations
  assignFightToGuild(guildId: string, fightId: string): Promise<GuildFight>;
  unassignFightFromGuild(guildId: string, fightId: string): Promise<boolean>;
  getGuildFights(guildId: string): Promise<Fight[]>;
  getFightGuilds(fightId: string): Promise<Guild[]>;
  
  // Guild settings operations
  getGuildSettings(guildId: string): Promise<GuildSettings | undefined>;
  updateGuildSettings(guildId: string, updates: Partial<GuildSettings>): Promise<GuildSettings>;
  
  // Guild quest operations
  getGuildQuests(guildId: string): Promise<GuildQuest[]>;
  createGuildQuest(quest: InsertGuildQuest): Promise<GuildQuest>;
  updateGuildQuest(id: string, updates: Partial<GuildQuest>): Promise<GuildQuest | undefined>;
  deleteGuildQuest(id: string): Promise<boolean>;
  
  // Guild leaderboard operations
  getGuildLeaderboard(guildId: string, metric: string): Promise<any[]>;
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
    const guildCode = generateGuildCode();
    
    const [teacher] = await db
      .insert(teachers)
      .values({
        ...insertTeacher,
        password: hashedPassword,
        guildCode,
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

  async createCombatSession(fightId: string, fight: Fight, soloModeOptions?: {
    soloModeEnabled?: boolean;
    soloModeStartHP?: number;
    soloModeHostId?: string;
    soloModeAIEnabled?: boolean;
    soloModeJoinersBlocked?: boolean;
  }): Promise<CombatState> {
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
      soloModeEnabled: soloModeOptions?.soloModeEnabled || false,
      soloModeStartHP: soloModeOptions?.soloModeStartHP || undefined,
      soloModeHostId: soloModeOptions?.soloModeHostId || undefined,
      soloModeAIEnabled: soloModeOptions?.soloModeAIEnabled || false,
      soloModeJoinersBlocked: soloModeOptions?.soloModeJoinersBlocked || false,
    };
    
    await db.insert(combatSessions).values({
      sessionId: session.sessionId,
      fightId: session.fightId,
      currentQuestionIndex: session.currentQuestionIndex,
      currentPhase: session.currentPhase,
      players: session.players,
      enemies: session.enemies,
      questionOrder: session.questionOrder,
      soloModeEnabled: session.soloModeEnabled,
      soloModeStartHP: session.soloModeStartHP,
      soloModeHostId: session.soloModeHostId,
      soloModeAIEnabled: session.soloModeAIEnabled,
      soloModeJoinersBlocked: session.soloModeJoinersBlocked,
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
      warlock: 0,
    };
    
    for (const record of jobLevelRecords) {
      jobLevelMap[record.jobClass] = record.level;
    }
    
    // Calculate passive bonuses and mechanic upgrades from all job levels
    const passiveBonuses = getTotalPassiveBonuses(jobLevelMap);
    const mechanicUpgrades = getTotalMechanicUpgrades(jobLevelMap);
    
    // Calculate equipment stats from equipped items
    const equipmentStats = calculateEquipmentStats(
      student.weapon || '', 
      student.headgear || '', 
      student.armor || ''
    );
    
    // Calculate complete character stats using the new stat system
    const stats = calculateCharacterStats(student.characterClass, equipmentStats, passiveBonuses, mechanicUpgrades);

    const playerState: PlayerState = {
      studentId: student.id,
      nickname: student.nickname,
      characterClass: student.characterClass,
      gender: student.gender,
      health: stats.hp,
      maxHealth: stats.maxHp,
      mp: stats.mp,
      maxMp: stats.maxMp,
      comboPoints: 0,  // Start with 0 combo points
      maxComboPoints: stats.maxComboPoints,
      streakCounter: 0,  // DEPRECATED: kept for backward compat
      
      // Cached combat stats
      str: stats.str,
      int: stats.int,
      agi: stats.agi,
      mnd: stats.mnd,
      vit: stats.vit,
      def: stats.def,
      atk: stats.atk,
      mat: stats.mat,
      rtk: stats.rtk,
      
      isDead: false,
      hasAnswered: false,
      isHealing: false,
      potionCount: student.characterClass === 'herbalist' ? 5 : 0,
      isCreatingPotion: false,
      jobLevels: jobLevelMap,
      isChargingFireball: false,
      fireballChargeRounds: 0,
      fireballCooldown: 0,
      hexedEnemyId: undefined,
      hexRoundsRemaining: 0,
      hexDamage: 0,
      pactSurgeBoost: 0,
      abyssalDrainActive: false,
      abyssalDrainRounds: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
      questionsIncorrect: 0,
      damageDealt: 0,
      damageBlocked: 0,
      bonusDamage: 0,
      healingDone: 0,
      damageTaken: 0,
      deaths: 0,
      lastActionDamage: 0, // Track last damage dealt for UI display
      threat: 1, // Default threat level for enemy AI targeting
      
      // Ultimate abilities (level 15+ job abilities)
      fightCount: 0, // Total fights completed
      lastUltimatesUsed: {}, // Maps ultimate ID to fight number when last used
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
    try {
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
      console.log('Default equipment items created successfully');
    } catch (error) {
      console.error('Failed to seed default equipment:', error);
      // Don't throw - allow app to start even if seeding fails
      // This prevents crash loops during deployment
    }
  }

  async seedDefaultTeacher(): Promise<void> {
    try {
      // Check if default teacher already exists
      const existingTeacher = await this.getTeacherByEmail('teacher@test.com');
      
      if (existingTeacher) {
        return; // Already seeded
      }

      // Create default teacher account for testing with all required fields
      await this.createTeacher({
        email: 'teacher@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Teacher',
        billingAddress: '123 Test St',
        schoolDistrict: 'Test District',
        school: 'Test School',
        subject: 'General',
        gradeLevel: 'All',
      });
      console.log('Default teacher account created successfully');
    } catch (error) {
      console.error('Failed to seed default teacher:', error);
      // Don't throw - allow app to start even if seeding fails
      // This prevents crash loops during deployment
    }
  }

  async seedTestStudent(): Promise<void> {
    try {
      // Check if tester student already exists
      const existingStudent = await this.getStudentByNickname('tester');
      
      if (existingStudent) {
        return; // Already seeded
      }

      const hashedPassword = hashPassword('test');
      
      // Create tester student with all jobs at level 15
      const [student] = await db
        .insert(students)
        .values({
          nickname: 'tester',
          password: hashedPassword,
          characterClass: 'warrior' as CharacterClass,
          gender: 'male' as Gender,
          inventory: [],
        })
        .returning();

      // Create job levels for all base classes + warlock at level 15
      const jobsToLevel: CharacterClass[] = ['warrior', 'wizard', 'scout', 'herbalist', 'warlock'];
      
      for (const jobClass of jobsToLevel) {
        await db.insert(studentJobLevels).values({
          studentId: student.id,
          jobClass,
          level: 15,
          experience: getTotalXPForLevel(15), // XP for level 15
        });
      }

      console.log('Test student "tester" created with level 15 in all jobs');
    } catch (error) {
      console.error('Failed to seed test student:', error);
    }
  }

  async seedTestFight(): Promise<void> {
    try {
      // Get the default teacher
      const teacher = await this.getTeacherByEmail('teacher@test.com');
      if (!teacher) {
        console.error('Cannot create test fight: default teacher not found');
        return;
      }

      // Check if test fight already exists
      const existingFights = await db.select().from(fights).where(eq(fights.title, 'Ultimate Test Fight'));
      if (existingFights.length > 0) {
        return; // Already seeded
      }

      // Create a simple test fight with solo mode enabled
      await db.insert(fights).values({
        teacherId: teacher.id,
        title: 'Ultimate Test Fight',
        questions: [
          {
            id: randomUUID(),
            text: 'What is 2 + 2?',
            type: 'multiple_choice' as 'multiple_choice',
            options: ['3', '4', '5', '6'],
            correctAnswer: '4',
            timeLimit: 30,
          },
          {
            id: randomUUID(),
            text: 'What is the capital of France?',
            type: 'multiple_choice' as 'multiple_choice',
            options: ['London', 'Paris', 'Berlin', 'Rome'],
            correctAnswer: 'Paris',
            timeLimit: 30,
          },
          {
            id: randomUUID(),
            text: 'Is the sky blue?',
            type: 'true_false' as 'true_false',
            options: ['True', 'False'],
            correctAnswer: 'True',
            timeLimit: 20,
          },
        ],
        enemies: [
          {
            id: randomUUID(),
            name: 'Training Dummy',
            maxHP: 10,
            currentHP: 10,
          },
        ],
        baseXP: 10,
        baseEnemyDamage: 2,
        enemyDisplayMode: 'consecutive' as 'consecutive',
        lootTable: [],
        randomizeQuestions: false,
        shuffleOptions: true,
        soloModeEnabled: true,
      });

      console.log('Test fight "Ultimate Test Fight" created successfully');
    } catch (error) {
      console.error('Failed to seed test fight:', error);
    }
  }

  async seedTestGuild(): Promise<void> {
    try {
      // Get the default teacher and tester student
      const teacher = await this.getTeacherByEmail('teacher@test.com');
      const tester = await this.getStudentByNickname('tester');
      
      if (!teacher || !tester) {
        console.error('Cannot create test guild: teacher or tester not found');
        return;
      }

      // Check if test guild already exists
      const [existingGuild] = await db.select().from(guilds).where(eq(guilds.name, 'Test Guild'));
      
      let guildId: string;
      
      if (existingGuild) {
        guildId = existingGuild.id;
      } else {
        // Create test guild
        const code = generateGuildCode();
        const [guild] = await db.insert(guilds).values({
          teacherId: teacher.id,
          name: 'Test Guild',
          code,
          description: 'A test guild for trying out features',
          level: 1,
          experience: 0,
          isArchived: false,
        }).returning();
        
        guildId = guild.id;

        // Create default settings for the guild
        await db.insert(guildSettings).values({
          guildId: guild.id,
          hiddenLeaderboardMetrics: [],
          enableGroupQuests: true,
        });

        // Add tester student to the guild
        await db.insert(guildMemberships).values({
          guildId: guild.id,
          studentId: tester.id,
        });
        
        console.log(`Test guild created (code: ${code}) with tester student`);
      }

      // Get the test fight
      const [testFight] = await db.select().from(fights).where(eq(fights.title, 'Ultimate Test Fight'));
      if (!testFight) {
        console.error('Cannot assign test fight: fight not found');
        return;
      }

      // Check if fight is already assigned to the guild
      const [existingAssignment] = await db
        .select()
        .from(guildFights)
        .where(and(eq(guildFights.guildId, guildId), eq(guildFights.fightId, testFight.id)));
      
      if (!existingAssignment) {
        // Assign the test fight to the guild
        await db.insert(guildFights).values({
          guildId,
          fightId: testFight.id,
        });
        console.log('Test fight assigned to Test Guild');
      }
    } catch (error) {
      console.error('Failed to seed test guild:', error);
    }
  }

  // Guild operations
  async getGuild(id: string): Promise<Guild | undefined> {
    const [guild] = await db.select().from(guilds).where(eq(guilds.id, id));
    return guild || undefined;
  }

  async getGuildByCode(code: string): Promise<Guild | undefined> {
    const [guild] = await db.select().from(guilds).where(eq(guilds.code, code));
    return guild || undefined;
  }

  async getGuildsByTeacher(teacherId: string): Promise<Guild[]> {
    return await db.select().from(guilds).where(eq(guilds.teacherId, teacherId));
  }

  async createGuild(insertGuild: InsertGuild): Promise<Guild> {
    const code = generateGuildCode();
    const [guild] = await db
      .insert(guilds)
      .values({
        ...insertGuild,
        code,
      })
      .returning();
    
    // Create default settings for the guild
    await db.insert(guildSettings).values({
      guildId: guild.id,
      hiddenLeaderboardMetrics: [],
      enableGroupQuests: true,
    });
    
    return guild;
  }

  async updateGuild(id: string, updates: Partial<Guild>): Promise<Guild | undefined> {
    const [guild] = await db
      .update(guilds)
      .set(updates)
      .where(eq(guilds.id, id))
      .returning();
    return guild || undefined;
  }

  async archiveGuild(id: string): Promise<Guild | undefined> {
    return this.updateGuild(id, { isArchived: true });
  }

  async awardGuildXP(guildId: string, xpAmount: number): Promise<Guild> {
    const guild = await this.getGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found');
    }

    const newExperience = guild.experience + xpAmount;
    const newLevel = getGuildLevelFromXP(newExperience);

    const [updated] = await db
      .update(guilds)
      .set({
        experience: newExperience,
        level: newLevel,
      })
      .where(eq(guilds.id, guildId))
      .returning();

    return updated;
  }

  // Guild membership operations
  async addMemberToGuild(guildId: string, studentId: string): Promise<GuildMembership> {
    // Check if already a member
    const existing = await db
      .select()
      .from(guildMemberships)
      .where(
        and(
          eq(guildMemberships.guildId, guildId),
          eq(guildMemberships.studentId, studentId)
        )
      );

    if (existing.length > 0) {
      return existing[0];
    }

    const [membership] = await db
      .insert(guildMemberships)
      .values({ guildId, studentId })
      .returning();

    return membership;
  }

  async removeMemberFromGuild(guildId: string, studentId: string): Promise<boolean> {
    console.log(`[STORAGE] Deleting membership: guildId=${guildId}, studentId=${studentId}`);
    const result = await db
      .delete(guildMemberships)
      .where(
        and(
          eq(guildMemberships.guildId, guildId),
          eq(guildMemberships.studentId, studentId)
        )
      );
    console.log(`[STORAGE] Delete rowCount: ${result.rowCount}`);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getGuildMembers(guildId: string): Promise<any[]> {
    const result = await db
      .select({
        id: guildMemberships.id,
        studentId: guildMemberships.studentId,
        joinedAt: guildMemberships.joinedAt,
        nickname: students.nickname,
        characterClass: students.characterClass,
      })
      .from(guildMemberships)
      .leftJoin(students, eq(guildMemberships.studentId, students.id))
      .where(eq(guildMemberships.guildId, guildId));

    return result;
  }

  async getStudentGuilds(studentId: string): Promise<Guild[]> {
    const memberships = await db
      .select()
      .from(guildMemberships)
      .where(eq(guildMemberships.studentId, studentId));

    if (memberships.length === 0) {
      return [];
    }

    const guildIds = memberships.map(m => m.guildId);
    return await db.select().from(guilds).where(inArray(guilds.id, guildIds));
  }

  async isStudentInGuild(guildId: string, studentId: string): Promise<boolean> {
    const [membership] = await db
      .select()
      .from(guildMemberships)
      .where(
        and(
          eq(guildMemberships.guildId, guildId),
          eq(guildMemberships.studentId, studentId)
        )
      );
    return !!membership;
  }

  // Guild fight assignment operations
  async assignFightToGuild(guildId: string, fightId: string): Promise<GuildFight> {
    // Check if already assigned
    const existing = await db
      .select()
      .from(guildFights)
      .where(
        and(
          eq(guildFights.guildId, guildId),
          eq(guildFights.fightId, fightId)
        )
      );

    if (existing.length > 0) {
      return existing[0];
    }

    const [assignment] = await db
      .insert(guildFights)
      .values({ guildId, fightId })
      .returning();

    return assignment;
  }

  async unassignFightFromGuild(guildId: string, fightId: string): Promise<boolean> {
    const result = await db
      .delete(guildFights)
      .where(
        and(
          eq(guildFights.guildId, guildId),
          eq(guildFights.fightId, fightId)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getGuildFights(guildId: string): Promise<Fight[]> {
    const assignments = await db
      .select()
      .from(guildFights)
      .where(eq(guildFights.guildId, guildId));

    if (assignments.length === 0) {
      return [];
    }

    const fightIds = assignments.map(a => a.fightId);
    const dbFights = await db.select().from(fights).where(inArray(fights.id, fightIds));

    return dbFights.map(f => ({
      ...f,
      questions: f.questions as any,
      enemies: f.enemies as any,
      lootTable: (f.lootTable as any) || [],
      enemyScript: f.enemyScript || undefined,
      createdAt: Number(f.createdAt),
    }));
  }

  async getFightGuilds(fightId: string): Promise<Guild[]> {
    const assignments = await db
      .select()
      .from(guildFights)
      .where(eq(guildFights.fightId, fightId));

    if (assignments.length === 0) {
      return [];
    }

    const guildIds = assignments.map(a => a.guildId);
    return await db.select().from(guilds).where(inArray(guilds.id, guildIds));
  }

  // Guild settings operations
  async getGuildSettings(guildId: string): Promise<GuildSettings | undefined> {
    const [settings] = await db
      .select()
      .from(guildSettings)
      .where(eq(guildSettings.guildId, guildId));
    return settings || undefined;
  }

  async updateGuildSettings(guildId: string, updates: Partial<GuildSettings>): Promise<GuildSettings> {
    const existing = await this.getGuildSettings(guildId);

    if (existing) {
      const [updated] = await db
        .update(guildSettings)
        .set({ ...updates, updatedAt: Date.now() })
        .where(eq(guildSettings.guildId, guildId))
        .returning();
      return updated;
    } else {
      // Create if doesn't exist
      const [created] = await db
        .insert(guildSettings)
        .values({
          guildId,
          ...updates,
        })
        .returning();
      return created;
    }
  }

  // Guild quest operations
  async getGuildQuests(guildId: string): Promise<GuildQuest[]> {
    return await db.select().from(guildQuests).where(eq(guildQuests.guildId, guildId));
  }

  async createGuildQuest(quest: InsertGuildQuest): Promise<GuildQuest> {
    const [created] = await db.insert(guildQuests).values([quest]).returning();
    return created;
  }

  async updateGuildQuest(id: string, updates: Partial<GuildQuest>): Promise<GuildQuest | undefined> {
    const [updated] = await db
      .update(guildQuests)
      .set(updates)
      .where(eq(guildQuests.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteGuildQuest(id: string): Promise<boolean> {
    const result = await db.delete(guildQuests).where(eq(guildQuests.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Guild XP and leveling operations
  async awardXPToGuild(guildId: string, xpAmount: number): Promise<{ guild: Guild; leveledUp: boolean; newLevel: number }> {
    const guild = await this.getGuild(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Add XP to guild
    const newTotalXP = guild.experience + xpAmount;
    const oldLevel = guild.level;
    
    // Calculate new level using same formula as players (6 XP increment per level)
    // Formula: XP for level N = (N * (N - 1) * 6) / 2
    // This gives cumulative XP: Level 1=0, 2=6, 3=18, 4=36, 5=60, etc.
    let newLevel = oldLevel;
    while (newLevel < 99) { // Guilds can reach level 99
      const xpRequiredForNextLevel = (newLevel * (newLevel + 1) * 6) / 2;
      if (newTotalXP >= xpRequiredForNextLevel) {
        newLevel++;
      } else {
        break;
      }
    }

    const leveledUp = newLevel > oldLevel;

    // Update guild
    const updated = await this.updateGuild(guildId, {
      experience: newTotalXP,
      level: newLevel,
    });

    return {
      guild: updated!,
      leveledUp,
      newLevel,
    };
  }

  // Guild leaderboard operations
  async getGuildLeaderboard(guildId: string, metric: string): Promise<any[]> {
    // Get guild's assigned fights
    const assignments = await db
      .select()
      .from(guildFights)
      .where(eq(guildFights.guildId, guildId));

    if (assignments.length === 0) {
      return [];
    }

    const fightIds = assignments.map(a => a.fightId);

    // Get all stats for those fights
    const stats = await db
      .select()
      .from(combatStats)
      .where(
        and(
          inArray(combatStats.fightId, fightIds),
          eq(combatStats.guildId, guildId)
        )
      );

    // Aggregate by student
    const studentAggregates = new Map<string, any>();

    for (const stat of stats) {
      if (!studentAggregates.has(stat.studentId)) {
        studentAggregates.set(stat.studentId, {
          studentId: stat.studentId,
          nickname: stat.nickname,
          characterClass: stat.characterClass,
          totalDamageDealt: 0,
          totalDamageBlocked: 0,
          totalHealingDone: 0,
          totalQuestionsCorrect: 0,
          totalQuestionsAnswered: 0,
          fightsCompleted: 0,
        });
      }

      const agg = studentAggregates.get(stat.studentId);
      agg.totalDamageDealt += stat.damageDealt;
      agg.totalDamageBlocked += stat.damageBlocked;
      agg.totalHealingDone += stat.healingDone;
      agg.totalQuestionsCorrect += stat.questionsCorrect;
      agg.totalQuestionsAnswered += stat.questionsAnswered;
      agg.fightsCompleted += 1;
    }

    // Convert to array and sort by requested metric
    let leaderboard = Array.from(studentAggregates.values());

    switch (metric) {
      case 'damageDealt':
        leaderboard.sort((a, b) => b.totalDamageDealt - a.totalDamageDealt);
        break;
      case 'damageBlocked':
        leaderboard.sort((a, b) => b.totalDamageBlocked - a.totalDamageBlocked);
        break;
      case 'healing':
        leaderboard.sort((a, b) => b.totalHealingDone - a.totalHealingDone);
        break;
      case 'accuracy':
        leaderboard.sort((a, b) => {
          const aRate = a.totalQuestionsAnswered > 0 ? a.totalQuestionsCorrect / a.totalQuestionsAnswered : 0;
          const bRate = b.totalQuestionsAnswered > 0 ? b.totalQuestionsCorrect / b.totalQuestionsAnswered : 0;
          return bRate - aRate;
        });
        break;
      default:
        leaderboard.sort((a, b) => b.totalDamageDealt - a.totalDamageDealt);
    }

    return leaderboard;
  }
}

export const storage = new DatabaseStorage();
