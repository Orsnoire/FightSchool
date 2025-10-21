import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Generate 6-character alphanumeric session ID
export function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars: 0,O,1,I
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Character classes and equipment types
export type CharacterClass = "warrior" | "wizard" | "scout" | "herbalist" | "knight" | "paladin" | "dark_knight" | "sage" | "ranger" | "druid" | "monk";
export type BaseClass = "warrior" | "wizard" | "scout" | "herbalist";
export const BASE_CLASSES: BaseClass[] = ["warrior", "wizard", "scout", "herbalist"];
export type Gender = "A" | "B";
export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type EquipmentSlot = "weapon" | "headgear" | "armor";
export type ItemType = "sword" | "wand" | "bow" | "staff" | "herbs" | "light_armor" | "leather_armor" | "armor" | "helmet" | "cap" | "hat" | "consumable";
export type ItemQuality = "common" | "rare" | "epic" | "legendary";

// Teachers table
export const teachers = pgTable("teachers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  billingAddress: text("billing_address").notNull(),
  schoolDistrict: text("school_district").notNull(),
  school: text("school").notNull(),
  subject: text("subject").notNull(),
  gradeLevel: text("grade_level").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
  createdAt: true,
});

export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachers.$inferSelect;

// Students table
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nickname: text("nickname").notNull(),
  password: text("password").notNull(),
  guildCode: text("guild_code"), // Future: student's assigned guild/class
  characterClass: text("character_class").$type<CharacterClass>(),
  gender: text("gender").$type<Gender>(),
  weapon: text("weapon"),
  headgear: text("headgear"),
  armor: text("armor"),
  crossClassAbility1: text("cross_class_ability_1"),
  crossClassAbility2: text("cross_class_ability_2"),
  inventory: jsonb("inventory").$type<string[]>(), // Array of equipment item IDs, starts null
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
});

export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof students.$inferSelect;

// Equipment items table (teacher-created custom items)
export const equipmentItems = pgTable("equipment_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  itemType: text("item_type").notNull().$type<ItemType>(),
  quality: text("quality").notNull().$type<ItemQuality>(),
  slot: text("slot").notNull().$type<EquipmentSlot>(),
  hpBonus: integer("hp_bonus").notNull().default(0),
  attackBonus: integer("attack_bonus").notNull().default(0),
  defenseBonus: integer("defense_bonus").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertEquipmentItemSchema = createInsertSchema(equipmentItems).omit({
  id: true,
  createdAt: true,
});

export type InsertEquipmentItem = z.infer<typeof insertEquipmentItemSchema>;
export type EquipmentItemDb = typeof equipmentItems.$inferSelect;

// Loot table item (references equipment items)
export interface LootItem {
  itemId: string; // References EQUIPMENT_ITEMS
}

// Fights table
export const fights = pgTable("fights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  title: text("title").notNull(),
  guildCode: text("guild_code"), // Future: fight assigned to a specific guild/class
  questions: jsonb("questions").notNull().$type<Question[]>(),
  enemies: jsonb("enemies").notNull().$type<Enemy[]>(),
  baseXP: integer("base_xp").notNull().default(10),
  baseEnemyDamage: integer("base_enemy_damage").notNull().default(1),
  enemyDisplayMode: text("enemy_display_mode").notNull().$type<"simultaneous" | "consecutive">().default("consecutive"),
  lootTable: jsonb("loot_table").$type<LootItem[]>().default([]),
  randomizeQuestions: boolean("randomize_questions").notNull().default(false),
  shuffleOptions: boolean("shuffle_options").notNull().default(true),
  enemyScript: text("enemy_script"), // Future: custom AI behavior script
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export type DbFight = typeof fights.$inferSelect;

// Student job levels table (tracks progression)
export const studentJobLevels = pgTable("student_job_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  jobClass: text("job_class").notNull().$type<CharacterClass>(),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  unlockedAt: bigint("unlocked_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertStudentJobLevelSchema = createInsertSchema(studentJobLevels).omit({
  id: true,
  unlockedAt: true,
});

export type InsertStudentJobLevel = z.infer<typeof insertStudentJobLevelSchema>;
export type StudentJobLevel = typeof studentJobLevels.$inferSelect;

// Combat sessions table (active game state)
export const combatSessions = pgTable("combat_sessions", {
  sessionId: varchar("session_id", { length: 6 }).primaryKey(), // 6-character alphanumeric code
  fightId: varchar("fight_id").notNull(), // References fights table
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  currentPhase: text("current_phase").notNull().$type<"waiting" | "question" | "tank_blocking" | "combat" | "game_over">(),
  players: jsonb("players").notNull().$type<Record<string, PlayerState>>(),
  enemies: jsonb("enemies").notNull(),
  questionStartTime: bigint("question_start_time", { mode: "number" }),
  phaseStartTime: bigint("phase_start_time", { mode: "number" }),
  jobLocked: boolean("job_locked").notNull().default(false),
  questionOrder: jsonb("question_order").$type<number[]>(),
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
  questionsIncorrect: integer("questions_incorrect").notNull().default(0),
  damageDealt: integer("damage_dealt").notNull().default(0),
  damageBlocked: integer("damage_blocked").notNull().default(0),
  bonusDamage: integer("bonus_damage").notNull().default(0),
  healingDone: integer("healing_done").notNull().default(0),
  damageTaken: integer("damage_taken").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  survived: boolean("survived").notNull().default(false),
  xpEarned: integer("xp_earned").notNull().default(0),
  lootItemClaimed: varchar("loot_item_claimed"), // Item ID claimed from this fight's loot table
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
  teacherId: string;
  title: string;
  guildCode: string | null; // Future: fight assigned to a specific guild/class
  questions: Question[];
  enemies: Enemy[];
  baseXP: number;
  baseEnemyDamage: number;
  enemyDisplayMode: "simultaneous" | "consecutive";
  lootTable: LootItem[];
  randomizeQuestions: boolean;
  shuffleOptions: boolean;
  enemyScript?: string; // Future: custom AI behavior script
  createdAt: number;
}

export const insertFightSchema = z.object({
  teacherId: z.string().min(1),
  title: z.string().min(1),
  guildCode: z.string().optional().nullable(), // Future: guild assignment
  questions: z.array(questionSchema).min(1),
  enemies: z.array(enemySchema).default([]),
  baseXP: z.number().min(1).max(100).default(10),
  baseEnemyDamage: z.number().min(1).max(10).default(1),
  enemyDisplayMode: z.enum(["simultaneous", "consecutive"]).default("consecutive"),
  lootTable: z.array(z.object({ itemId: z.string() })).default([]),
  randomizeQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(true),
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
  streakCounter: number; // For damage dealers (Scout uses this)
  isDead: boolean;
  currentAnswer?: string;
  hasAnswered: boolean;
  isHealing: boolean;
  healTarget?: string; // Student ID to heal
  blockTarget?: string; // Student ID to block (for tanks)
  potionCount: number; // For herbalists - starts with 5
  isCreatingPotion: boolean; // For herbalists - choosing to create potion instead of damage
  
  // Job system integration
  jobLevels: Record<CharacterClass, number>; // Level for each job class (0 if not started)
  
  // Wizard fireball ability
  isChargingFireball: boolean; // For wizards - manually charging fireball
  fireballChargeRounds: number; // 0-2 rounds charged
  fireballCooldown: number; // Rounds remaining before can use again (0-5)
  
  // Combat statistics tracking (for XP calculation)
  questionsAnswered: number;
  questionsCorrect: number;
  questionsIncorrect: number;
  damageDealt: number;
  damageBlocked: number; // For tanks
  bonusDamage: number; // Damage exceeding base (streak bonuses)
  healingDone: number;
  damageTaken: number;
  deaths: number;
  
  // Enemy AI targeting
  threat: number; // Enemy targeting priority (default 1)
}

export interface CombatState {
  sessionId: string; // 6-character code for this session
  fightId: string; // Reference to fight template
  currentQuestionIndex: number;
  currentPhase: "waiting" | "question" | "tank_blocking" | "combat" | "game_over";
  players: Record<string, PlayerState>;
  enemies: Array<{ id: string; name: string; image: string; health: number; maxHealth: number }>;
  questionStartTime?: number;
  phaseStartTime?: number;
  questionOrder?: number[]; // Array of question indices (shuffled if randomizeQuestions is true)
}

// Equipment item definition
export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: "common" | "rare" | "epic" | "legendary";
  stats: {
    hp?: number;
    attack?: number;
    defense?: number;
  };
  classRestriction?: CharacterClass[]; // undefined = available to all
}

// Equipment items database (single source of truth)
export const EQUIPMENT_ITEMS: Record<string, EquipmentItem> = {
  // Class-specific basic equipment (starting gear)
  basic_sword: {
    id: "basic_sword",
    name: "Basic Sword",
    slot: "weapon",
    rarity: "common",
    stats: { attack: 1 },
    classRestriction: ["warrior", "knight", "paladin", "dark_knight", "monk"],
  },
  basic_staff: {
    id: "basic_staff",
    name: "Basic Staff",
    slot: "weapon",
    rarity: "common",
    stats: { attack: 1 },
    classRestriction: ["wizard", "sage", "druid"],
  },
  basic_bow: {
    id: "basic_bow",
    name: "Basic Bow",
    slot: "weapon",
    rarity: "common",
    stats: { attack: 1 },
    classRestriction: ["scout", "ranger"],
  },
  basic_herbs: {
    id: "basic_herbs",
    name: "Basic Herbs",
    slot: "weapon",
    rarity: "common",
    stats: { hp: 1 },
    classRestriction: ["herbalist", "druid"],
  },
  basic_helm: {
    id: "basic_helm",
    name: "Basic Helm",
    slot: "headgear",
    rarity: "common",
    stats: { defense: 1 },
  },
  basic_armor: {
    id: "basic_armor",
    name: "Basic Armor",
    slot: "armor",
    rarity: "common",
    stats: { defense: 1 },
  },
  
  // Common drops
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    slot: "weapon",
    rarity: "common",
    stats: { attack: 2 },
    classRestriction: ["warrior", "knight", "paladin", "dark_knight", "monk"],
  },
  steel_bow: {
    id: "steel_bow",
    name: "Steel Bow",
    slot: "weapon",
    rarity: "rare",
    stats: { attack: 3 },
    classRestriction: ["scout", "ranger"],
  },
  magic_staff: {
    id: "magic_staff",
    name: "Magic Staff",
    slot: "weapon",
    rarity: "rare",
    stats: { attack: 3 },
    classRestriction: ["wizard", "sage"],
  },
  leather_helm: {
    id: "leather_helm",
    name: "Leather Helm",
    slot: "headgear",
    rarity: "common",
    stats: { defense: 2 },
  },
  steel_helmet: {
    id: "steel_helmet",
    name: "Steel Helmet",
    slot: "headgear",
    rarity: "rare",
    stats: { defense: 3, hp: 2 },
  },
  arcane_crown: {
    id: "arcane_crown",
    name: "Arcane Crown",
    slot: "headgear",
    rarity: "epic",
    stats: { attack: 2, hp: 3 },
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    slot: "armor",
    rarity: "common",
    stats: { defense: 2 },
  },
  chainmail: {
    id: "chainmail",
    name: "Chainmail",
    slot: "armor",
    rarity: "rare",
    stats: { defense: 4 },
  },
  plate_armor: {
    id: "plate_armor",
    name: "Plate Armor",
    slot: "armor",
    rarity: "epic",
    stats: { defense: 5, hp: 5 },
  },
  dragon_scale: {
    id: "dragon_scale",
    name: "Dragon Scale Armor",
    slot: "armor",
    rarity: "legendary",
    stats: { defense: 7, hp: 10, attack: 2 },
  },
  legendary_blade: {
    id: "legendary_blade",
    name: "Legendary Blade",
    slot: "weapon",
    rarity: "legendary",
    stats: { attack: 5, hp: 5 },
    classRestriction: ["warrior", "knight", "paladin", "dark_knight"],
  },
};

// Get class-specific starting equipment
export function getStartingEquipment(characterClass: CharacterClass): { weapon: string; headgear: string; armor: string } {
  const weaponMap: Record<CharacterClass, string> = {
    warrior: "basic_sword",
    wizard: "basic_staff",
    scout: "basic_bow",
    herbalist: "basic_herbs",
    knight: "basic_sword",
    paladin: "basic_sword",
    dark_knight: "basic_sword",
    sage: "basic_staff",
    ranger: "basic_bow",
    druid: "basic_herbs",
    monk: "basic_sword",
  };

  return {
    weapon: weaponMap[characterClass],
    headgear: "basic_helm",
    armor: "basic_armor",
  };
}

// Calculate total equipment bonuses
export function calculateEquipmentStats(weapon: string, headgear: string, armor: string): { hp: number; attack: number; defense: number } {
  const stats = { hp: 0, attack: 0, defense: 0 };
  
  const items = [weapon, headgear, armor];
  for (const itemId of items) {
    const item = EQUIPMENT_ITEMS[itemId];
    if (item) {
      stats.hp += item.stats.hp || 0;
      stats.attack += item.stats.attack || 0;
      stats.defense += item.stats.defense || 0;
    }
  }
  
  return stats;
}

// Character class stats
export const CLASS_STATS: Record<CharacterClass, { maxHealth: number; damage: number; defense: number; role: string }> = {
  warrior: { maxHealth: 15, damage: 1, defense: 2, role: "Tank - Can block for allies" },
  wizard: { maxHealth: 10, damage: 2, defense: 0, role: "DPS - Streak bonus damage" },
  scout: { maxHealth: 10, damage: 2, defense: 0, role: "DPS - Streak bonus damage" },
  herbalist: { maxHealth: 12, damage: 1, defense: 0, role: "Healer - Can heal allies" },
  knight: { maxHealth: 16, damage: 1, defense: 3, role: "Unlockable Tank - Advanced combat techniques" },
  paladin: { maxHealth: 16, damage: 1, defense: 2, role: "Holy Tank - Warrior + Herbalist fusion" },
  dark_knight: { maxHealth: 14, damage: 2, defense: 1, role: "Aggressive Tank - High damage, self-sustaining" },
  sage: { maxHealth: 11, damage: 3, defense: 0, role: "Advanced Mage - Wizard evolution" },
  ranger: { maxHealth: 11, damage: 3, defense: 0, role: "Master Scout - Scout evolution" },
  druid: { maxHealth: 13, damage: 1, defense: 1, role: "Nature Healer - Herbalist evolution" },
  monk: { maxHealth: 13, damage: 2, defense: 1, role: "Balanced Fighter - All-rounder" },
};
