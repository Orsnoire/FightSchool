import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Character classes and equipment types
export type CharacterClass = "knight" | "wizard" | "scout" | "herbalist";
export type Gender = "A" | "B";
export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type EquipmentSlot = "weapon" | "headgear" | "armor";

// Students table
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nickname: text("nickname").notNull(),
  password: text("password").notNull(),
  classCode: text("class_code").notNull(),
  characterClass: text("character_class").notNull().$type<CharacterClass>(),
  gender: text("gender").notNull().$type<Gender>(),
  weapon: text("weapon").notNull().default("basic"),
  headgear: text("headgear").notNull().default("basic"),
  armor: text("armor").notNull().default("basic"),
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

// Fights table
export const fights = pgTable("fights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  classCode: text("class_code").notNull(),
  questions: jsonb("questions").notNull().$type<Question[]>(),
  enemies: jsonb("enemies").notNull().$type<Enemy[]>(),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export type DbFight = typeof fights.$inferSelect;

// Combat sessions table (active game state)
export const combatSessions = pgTable("combat_sessions", {
  fightId: varchar("fight_id").primaryKey(),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  currentPhase: text("current_phase").notNull().$type<"waiting" | "question" | "tank_blocking" | "combat" | "game_over">(),
  players: jsonb("players").notNull().$type<Record<string, PlayerState>>(),
  enemies: jsonb("enemies").notNull(),
  questionStartTime: bigint("question_start_time", { mode: "number" }),
  phaseStartTime: bigint("phase_start_time", { mode: "number" }),
});

export type DbCombatSession = typeof combatSessions.$inferSelect;

// Combat stats table (post-fight performance tracking)
export const combatStats = pgTable("combat_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fightId: varchar("fight_id").notNull(),
  studentId: varchar("student_id").notNull(),
  nickname: text("nickname").notNull(),
  characterClass: text("character_class").notNull().$type<CharacterClass>(),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  questionsCorrect: integer("questions_correct").notNull().default(0),
  damageDealt: integer("damage_dealt").notNull().default(0),
  healingDone: integer("healing_done").notNull().default(0),
  damageTaken: integer("damage_taken").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  survived: boolean("survived").notNull().default(false),
  completedAt: bigint("completed_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertCombatStatSchema = createInsertSchema(combatStats).omit({
  id: true,
  completedAt: true,
});

export type InsertCombatStat = z.infer<typeof insertCombatStatSchema>;
export type CombatStat = typeof combatStats.$inferSelect;

// Question schema
export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer: string;
  timeLimit: number; // in seconds
}

export const questionSchema = z.object({
  id: z.string(),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  timeLimit: z.number().min(5).max(300),
});

// Enemy schema
export interface Enemy {
  id: string;
  name: string;
  image: string;
  maxHealth: number;
}

export const enemySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  image: z.string(),
  maxHealth: z.number().min(1).max(1000),
});

// Fight schema (teacher creates)
export interface Fight {
  id: string;
  title: string;
  classCode: string;
  questions: Question[];
  enemies: Enemy[];
  createdAt: number;
}

export const insertFightSchema = z.object({
  title: z.string().min(1),
  classCode: z.string().min(1),
  questions: z.array(questionSchema).min(1),
  enemies: z.array(enemySchema).min(1),
});

export type InsertFight = z.infer<typeof insertFightSchema>;

// Combat state (active game session)
export interface PlayerState {
  studentId: string;
  nickname: string;
  characterClass: CharacterClass;
  gender: Gender;
  health: number;
  maxHealth: number;
  streakCounter: number; // For damage dealers
  isDead: boolean;
  currentAnswer?: string;
  hasAnswered: boolean;
  isHealing: boolean;
  healTarget?: string; // Student ID to heal
  blockTarget?: string; // Student ID to block (for tanks)
  
  // Combat statistics tracking
  questionsAnswered: number;
  questionsCorrect: number;
  damageDealt: number;
  healingDone: number;
  damageTaken: number;
  deaths: number;
}

export interface CombatState {
  fightId: string;
  currentQuestionIndex: number;
  currentPhase: "waiting" | "question" | "tank_blocking" | "combat" | "game_over";
  players: Record<string, PlayerState>;
  enemies: Array<{ id: string; name: string; image: string; health: number; maxHealth: number }>;
  questionStartTime?: number;
  phaseStartTime?: number;
}

// Equipment items (predefined)
export const EQUIPMENT_ITEMS: Record<EquipmentSlot, Array<{ id: string; name: string; rarity: string }>> = {
  weapon: [
    { id: "basic", name: "Basic Weapon", rarity: "common" },
    { id: "iron_sword", name: "Iron Sword", rarity: "common" },
    { id: "steel_bow", name: "Steel Bow", rarity: "rare" },
    { id: "magic_staff", name: "Magic Staff", rarity: "rare" },
    { id: "legendary_blade", name: "Legendary Blade", rarity: "legendary" },
  ],
  headgear: [
    { id: "basic", name: "Basic Headgear", rarity: "common" },
    { id: "leather_helm", name: "Leather Helm", rarity: "common" },
    { id: "steel_helmet", name: "Steel Helmet", rarity: "rare" },
    { id: "arcane_crown", name: "Arcane Crown", rarity: "epic" },
  ],
  armor: [
    { id: "basic", name: "Basic Armor", rarity: "common" },
    { id: "leather_armor", name: "Leather Armor", rarity: "common" },
    { id: "chainmail", name: "Chainmail", rarity: "rare" },
    { id: "plate_armor", name: "Plate Armor", rarity: "epic" },
    { id: "dragon_scale", name: "Dragon Scale Armor", rarity: "legendary" },
  ],
};

// Character class stats
export const CLASS_STATS: Record<CharacterClass, { maxHealth: number; damage: number; role: string }> = {
  knight: { maxHealth: 15, damage: 1, role: "Tank - Can block for allies" },
  wizard: { maxHealth: 10, damage: 2, role: "DPS - Streak bonus damage" },
  scout: { maxHealth: 10, damage: 2, role: "DPS - Streak bonus damage" },
  herbalist: { maxHealth: 12, damage: 1, role: "Healer - Can heal allies" },
};
