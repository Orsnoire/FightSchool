import type { Student, InsertStudent, Fight, InsertFight, CombatState, PlayerState } from "@shared/schema";
import { randomUUID, scryptSync, randomBytes } from "crypto";
import { CLASS_STATS } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private students: Map<string, Student>;
  private fights: Map<string, Fight>;
  private combatSessions: Map<string, CombatState>;

  constructor() {
    this.students = new Map();
    this.fights = new Map();
    this.combatSessions = new Map();
  }

  // Student operations
  async getStudent(id: string): Promise<Student | undefined> {
    return this.students.get(id);
  }

  async getStudentByNickname(nickname: string): Promise<Student | undefined> {
    return Array.from(this.students.values()).find((s) => s.nickname === nickname);
  }

  async getStudentsByClassCode(classCode: string): Promise<Student[]> {
    return Array.from(this.students.values()).filter((s) => s.classCode === classCode);
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const id = randomUUID();
    const hashedPassword = hashPassword(insertStudent.password);
    const student: Student = {
      id,
      ...insertStudent,
      password: hashedPassword,
      characterClass: insertStudent.characterClass || "knight",
      gender: insertStudent.gender || "A",
      weapon: "basic",
      headgear: "basic",
      armor: "basic",
    };
    this.students.set(id, student);
    return student;
  }

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student | undefined> {
    const student = this.students.get(id);
    if (!student) return undefined;
    const updated = { ...student, ...updates };
    this.students.set(id, updated);
    return updated;
  }

  // Fight operations
  async getFight(id: string): Promise<Fight | undefined> {
    return this.fights.get(id);
  }

  async getAllFights(): Promise<Fight[]> {
    return Array.from(this.fights.values());
  }

  async createFight(insertFight: InsertFight): Promise<Fight> {
    const id = randomUUID();
    const fight: Fight = {
      id,
      ...insertFight,
      createdAt: Date.now(),
    };
    this.fights.set(id, fight);
    return fight;
  }

  async deleteFight(id: string): Promise<boolean> {
    return this.fights.delete(id);
  }

  // Combat session operations
  async getCombatSession(fightId: string): Promise<CombatState | undefined> {
    return this.combatSessions.get(fightId);
  }

  async createCombatSession(fightId: string, fight: Fight): Promise<CombatState> {
    const session: CombatState = {
      fightId,
      currentQuestionIndex: 0,
      currentPhase: "waiting",
      players: {},
      enemies: fight.enemies.map((e) => ({ ...e, health: e.maxHealth })),
    };
    this.combatSessions.set(fightId, session);
    return session;
  }

  async updateCombatSession(fightId: string, updates: Partial<CombatState>): Promise<CombatState | undefined> {
    const session = this.combatSessions.get(fightId);
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.combatSessions.set(fightId, updated);
    return updated;
  }

  async addPlayerToCombat(fightId: string, student: Student): Promise<void> {
    const session = this.combatSessions.get(fightId);
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
    };

    session.players[student.id] = playerState;
    this.combatSessions.set(fightId, session);
  }

  async updatePlayerState(fightId: string, studentId: string, updates: Partial<PlayerState>): Promise<void> {
    const session = this.combatSessions.get(fightId);
    if (!session || !session.players[studentId]) return;

    session.players[studentId] = { ...session.players[studentId], ...updates };
    this.combatSessions.set(fightId, session);
  }
}

export const storage = new MemStorage();
