import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { getTotalPassiveBonuses, getTotalMechanicUpgrades } from "./jobSystem";

// Generate 6-character alphanumeric ID (used for session IDs and guild codes)
export function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars: 0,O,1,I
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate unique guild code for teachers (same format as session IDs)
export function generateGuildCode(): string {
  return generateSessionId();
}

// Character classes and equipment types
export type CharacterClass = "warrior" | "wizard" | "scout" | "herbalist" | "warlock" | "priest" | "paladin" | "dark_knight" | "blood_knight";
export type BaseClass = "warrior" | "wizard" | "scout" | "herbalist";
export const BASE_CLASSES: BaseClass[] = ["warrior", "wizard", "scout", "herbalist"];
export const ALL_CHARACTER_CLASSES: CharacterClass[] = ["warrior", "wizard", "scout", "herbalist", "warlock", "priest", "paladin", "dark_knight", "blood_knight"];
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
  guildCode: text("guild_code").notNull(), // Unique code for teacher's guild/class
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
  guildCode: true, // Auto-generated on creation
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
  guildCode: text("guild_code"), // Deprecated: use guild_fights table instead
  questions: jsonb("questions").notNull().$type<Question[]>(),
  enemies: jsonb("enemies").notNull().$type<Enemy[]>(),
  baseXP: integer("base_xp").notNull().default(10),
  baseEnemyDamage: integer("base_enemy_damage").notNull().default(1),
  enemyDisplayMode: text("enemy_display_mode").notNull().$type<"simultaneous" | "consecutive">().default("consecutive"),
  lootTable: jsonb("loot_table").$type<LootItem[]>().default([]),
  randomizeQuestions: boolean("randomize_questions").notNull().default(false),
  shuffleOptions: boolean("shuffle_options").notNull().default(true),
  enemyScript: text("enemy_script"), // Future: custom AI behavior script
  soloModeEnabled: boolean("solo_mode_enabled").notNull().default(false), // Teacher-enabled solo mode
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
  
  // Solo mode fields
  soloModeEnabled: boolean("solo_mode_enabled").notNull().default(false),
  soloModeHostId: varchar("solo_mode_host_id"), // Student ID of host (null for teacher-hosted)
  soloModeStartHP: integer("solo_mode_start_hp"), // Starting HP for solo mode (scales with players)
  soloModeAIEnabled: boolean("solo_mode_ai_enabled").notNull().default(false), // Whether AI players are enabled
  soloModeJoinersBlocked: boolean("solo_mode_joiners_blocked").notNull().default(false), // Whether new players can join
  guildId: varchar("guild_id"), // Which guild this session contributes XP to (for solo mode)
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
  guildId: varchar("guild_id"), // Guild this fight contributed to (for stats/leaderboards)
  isSoloMode: boolean("is_solo_mode").notNull().default(false), // Whether this was a solo mode fight
  completedAt: bigint("completed_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertCombatStatSchema = createInsertSchema(combatStats).omit({
  id: true,
  completedAt: true,
});

export type InsertCombatStat = z.infer<typeof insertCombatStatSchema>;
export type CombatStat = typeof combatStats.$inferSelect;

// Guilds table (teacher-created groups for organizing fights and students)
export const guilds = pgTable("guilds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // 6-character join code
  description: text("description"),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertGuildSchema = createInsertSchema(guilds).omit({
  id: true,
  code: true, // Auto-generated
  createdAt: true,
});

export type InsertGuild = z.infer<typeof insertGuildSchema>;
export type Guild = typeof guilds.$inferSelect;

// Guild memberships (many-to-many: students can join multiple guilds)
export const guildMemberships = pgTable("guild_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull(),
  studentId: varchar("student_id").notNull(),
  joinedAt: bigint("joined_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertGuildMembershipSchema = createInsertSchema(guildMemberships).omit({
  id: true,
  joinedAt: true,
});

export type InsertGuildMembership = z.infer<typeof insertGuildMembershipSchema>;
export type GuildMembership = typeof guildMemberships.$inferSelect;

// Guild fight assignments (many-to-many: fights can be assigned to multiple guilds)
export const guildFights = pgTable("guild_fights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull(),
  fightId: varchar("fight_id").notNull(),
  assignedAt: bigint("assigned_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertGuildFightSchema = createInsertSchema(guildFights).omit({
  id: true,
  assignedAt: true,
});

export type InsertGuildFight = z.infer<typeof insertGuildFightSchema>;
export type GuildFight = typeof guildFights.$inferSelect;

// Guild settings (teacher-configurable options per guild)
export const guildSettings = pgTable("guild_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull().unique(),
  hiddenLeaderboardMetrics: jsonb("hidden_leaderboard_metrics").$type<string[]>().default([]), // Metrics to hide (e.g., ["damageDealt", "healing"])
  enableGroupQuests: boolean("enable_group_quests").notNull().default(true),
  enableChat: boolean("enable_chat").notNull().default(false), // Teacher can enable guild chat (default off)
  updatedAt: bigint("updated_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertGuildSettingsSchema = createInsertSchema(guildSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;
export type GuildSettings = typeof guildSettings.$inferSelect;

// Guild quests (achievements and group goals)
export interface QuestCriteria {
  type: "all_members_play_class" | "member_unlocks_job" | "total_damage" | "total_healing" | "complete_fight_count" | "custom";
  targetClass?: CharacterClass; // For "all_members_play_class"
  targetJob?: CharacterClass; // For "member_unlocks_job"
  targetAmount?: number; // For "total_damage", "total_healing", "complete_fight_count"
  customDescription?: string; // For "custom" quests
}

export const guildQuests = pgTable("guild_quests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  guildId: varchar("guild_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  criteria: jsonb("criteria").notNull().$type<QuestCriteria>(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: bigint("completed_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull().default(sql`extract(epoch from now()) * 1000`),
});

export const insertGuildQuestSchema = createInsertSchema(guildQuests).omit({
  id: true,
  isCompleted: true,
  completedAt: true,
  createdAt: true,
});

export type InsertGuildQuest = z.infer<typeof insertGuildQuestSchema>;
export type GuildQuest = typeof guildQuests.$inferSelect;

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
  guildCode: string | null; // Deprecated: use guild_fights table instead
  questions: Question[];
  enemies: Enemy[];
  baseXP: number;
  baseEnemyDamage: number;
  enemyDisplayMode: "simultaneous" | "consecutive";
  lootTable: LootItem[];
  randomizeQuestions: boolean;
  shuffleOptions: boolean;
  enemyScript?: string; // Future: custom AI behavior script
  soloModeEnabled: boolean; // Teacher-enabled solo mode
  createdAt: number;
}

export const insertFightSchema = z.object({
  teacherId: z.string().min(1),
  title: z.string().min(1),
  guildCode: z.string().optional().nullable(), // Deprecated: use guild_fights table
  questions: z.array(questionSchema).min(1),
  enemies: z.array(enemySchema).default([]),
  baseXP: z.number().min(1).max(100).default(10),
  baseEnemyDamage: z.number().min(1).max(10).default(1),
  enemyDisplayMode: z.enum(["simultaneous", "consecutive"]).default("consecutive"),
  lootTable: z.array(z.object({ itemId: z.string() })).default([]),
  randomizeQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(true),
  soloModeEnabled: z.boolean().default(false),
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
  mp: number; // Magic Points - (INT + MND) × 3
  maxMp: number; // Maximum MP
  comboPoints: number; // For Scout and cross-class Headshot users
  maxComboPoints: number; // AGI × 2
  streakCounter: number; // DEPRECATED: Use comboPoints instead (kept for backward compat)
  
  // Calculated combat stats (cached from job + equipment + passives)
  str: number;  // Strength
  int: number;  // Intelligence
  agi: number;  // Agility
  mnd: number;  // Mind
  vit: number;  // Vitality
  def: number;  // Defense (from armor + VIT/2)
  atk: number;  // Attack (from weapon + STR)
  mat: number;  // Magic Attack (from weapon + INT)
  rtk: number;  // Ranged Attack (from weapon + AGI)
  
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
  
  // Cross-class abilities
  crossClassAbility1?: string | null; // ID of equipped cross-class ability 1
  crossClassAbility2?: string | null; // ID of equipped cross-class ability 2
  
  // Wizard fireball ability
  isChargingFireball: boolean; // For wizards - manually charging fireball
  fireballChargeRounds: number; // 0-2 rounds charged
  fireballCooldown: number; // Rounds remaining before can use again (0-5)
  
  // Warlock abilities
  hexedEnemyId?: string; // ID of enemy currently hexed by this warlock
  hexRoundsRemaining: number; // Rounds remaining for hex effect
  hexDamage: number; // Damage dealt per round by hex (INT - 1)
  pactSurgeBoost: number; // Temporary ATK boost from Pact Surge
  abyssalDrainActive: boolean; // Whether Abyssal Drain buff is active
  abyssalDrainRounds: number; // Rounds remaining for Abyssal Drain buff
  
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
  lastActionDamage: number; // Damage dealt in the most recent action (for UI display)
  
  // Enemy AI targeting
  threat: number; // Enemy targeting priority (default 1)
  
  // Ultimate abilities (level 15+ job abilities)
  fightCount: number; // Total fights completed (for ultimate cooldown tracking)
  lastUltimatesUsed: Record<string, number>; // Maps ultimate ID to fight number when last used
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
  
  // Solo mode fields
  soloModeEnabled?: boolean;
  soloModeHostId?: string; // Student ID of the host
  soloModeStartHP?: number; // Starting HP for solo mode (scales with players)
  soloModeAIEnabled?: boolean; // Whether AI players are enabled
  soloModeJoinersBlocked?: boolean; // Whether new players can join
}

// Equipment item definition
export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: "common" | "rare" | "epic" | "legendary";
  stats: {
    str?: number;
    int?: number;
    agi?: number;
    mnd?: number;
    vit?: number;
    def?: number;    // Direct defense bonus
    atk?: number;    // Direct attack bonus (melee)
    mat?: number;    // Direct magic attack bonus
    rtk?: number;    // Direct ranged attack bonus
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
    stats: { atk: 1 },
    classRestriction: ["warrior"],
  },
  basic_staff: {
    id: "basic_staff",
    name: "Basic Staff",
    slot: "weapon",
    rarity: "common",
    stats: { mat: 1 },
    classRestriction: ["wizard", "warlock"],
  },
  basic_bow: {
    id: "basic_bow",
    name: "Basic Bow",
    slot: "weapon",
    rarity: "common",
    stats: { rtk: 1 },
    classRestriction: ["scout"],
  },
  basic_herbs: {
    id: "basic_herbs",
    name: "Basic Herbs",
    slot: "weapon",
    rarity: "common",
    stats: { mnd: 1 },
    classRestriction: ["herbalist"],
  },
  basic_helm: {
    id: "basic_helm",
    name: "Basic Helm",
    slot: "headgear",
    rarity: "common",
    stats: { def: 1 },
  },
  basic_armor: {
    id: "basic_armor",
    name: "Basic Armor",
    slot: "armor",
    rarity: "common",
    stats: { def: 1 },
  },
  
  // Common drops
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    slot: "weapon",
    rarity: "common",
    stats: { atk: 2, str: 1 },
    classRestriction: ["warrior"],
  },
  steel_bow: {
    id: "steel_bow",
    name: "Steel Bow",
    slot: "weapon",
    rarity: "rare",
    stats: { rtk: 3, agi: 1 },
    classRestriction: ["scout"],
  },
  magic_staff: {
    id: "magic_staff",
    name: "Magic Staff",
    slot: "weapon",
    rarity: "rare",
    stats: { mat: 3, int: 1 },
    classRestriction: ["wizard", "warlock"],
  },
  leather_helm: {
    id: "leather_helm",
    name: "Leather Helm",
    slot: "headgear",
    rarity: "common",
    stats: { def: 2 },
  },
  steel_helmet: {
    id: "steel_helmet",
    name: "Steel Helmet",
    slot: "headgear",
    rarity: "rare",
    stats: { def: 3, vit: 1 },
  },
  arcane_crown: {
    id: "arcane_crown",
    name: "Arcane Crown",
    slot: "headgear",
    rarity: "epic",
    stats: { mat: 2, int: 2 },
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    slot: "armor",
    rarity: "common",
    stats: { def: 2 },
  },
  chainmail: {
    id: "chainmail",
    name: "Chainmail",
    slot: "armor",
    rarity: "rare",
    stats: { def: 4 },
  },
  plate_armor: {
    id: "plate_armor",
    name: "Plate Armor",
    slot: "armor",
    rarity: "epic",
    stats: { def: 5, vit: 2 },
  },
  dragon_scale: {
    id: "dragon_scale",
    name: "Dragon Scale Armor",
    slot: "armor",
    rarity: "legendary",
    stats: { def: 7, vit: 3, str: 1 },
  },
  legendary_blade: {
    id: "legendary_blade",
    name: "Legendary Blade",
    slot: "weapon",
    rarity: "legendary",
    stats: { atk: 5, str: 2 },
    classRestriction: ["warrior"],
  },
};

// Get class-specific starting equipment
export function getStartingEquipment(characterClass: CharacterClass): { weapon: string; headgear: string; armor: string } {
  const weaponMap: Record<CharacterClass, string> = {
    warrior: "basic_sword",
    wizard: "basic_staff",
    scout: "basic_bow",
    herbalist: "basic_herbs",
    warlock: "basic_staff",
    priest: "basic_staff",      // MAT-based healer
    paladin: "basic_sword",      // ATK-based tank/healer
    dark_knight: "basic_sword",  // ATK-based tank/DPS
    blood_knight: "basic_sword", // ATK-based tank/DPS
  };

  return {
    weapon: weaponMap[characterClass],
    headgear: "basic_helm",
    armor: "basic_armor",
  };
}

// Calculate total equipment bonuses
export interface EquipmentStats {
  str: number;
  int: number;
  agi: number;
  mnd: number;
  vit: number;
  def: number;
  atk: number;
  mat: number;
  rtk: number;
}

export function calculateEquipmentStats(weapon: string, headgear: string, armor: string): EquipmentStats {
  const stats: EquipmentStats = { str: 0, int: 0, agi: 0, mnd: 0, vit: 0, def: 0, atk: 0, mat: 0, rtk: 0 };
  
  const items = [weapon, headgear, armor];
  for (const itemId of items) {
    const item = EQUIPMENT_ITEMS[itemId];
    if (item) {
      stats.str += item.stats.str || 0;
      stats.int += item.stats.int || 0;
      stats.agi += item.stats.agi || 0;
      stats.mnd += item.stats.mnd || 0;
      stats.vit += item.stats.vit || 0;
      stats.def += item.stats.def || 0;
      stats.atk += item.stats.atk || 0;
      stats.mat += item.stats.mat || 0;
      stats.rtk += item.stats.rtk || 0;
    }
  }
  
  return stats;
}

// Base job starting stats (these are NOT awarded as passive bonuses)
export interface BaseJobStats {
  baseHP: number;
  str?: number;
  int?: number;
  agi?: number;
  mnd?: number;
  vit?: number;
  role: string;
}

// Character class stats using new stat system
export const CLASS_STATS: Record<CharacterClass, BaseJobStats> = {
  warrior: { baseHP: 15, vit: 1, str: 1, role: "Tank - Can block for allies" },
  wizard: { baseHP: 7, int: 2, role: "DPS - Magical damage" },
  scout: { baseHP: 7, agi: 2, role: "DPS - Ranged damage" },
  herbalist: { baseHP: 10, mnd: 1, role: "Healer - Can heal allies" },
  warlock: { baseHP: 7, int: 2, role: "Curse specialist - DoT damage" },
  priest: { baseHP: 10, mnd: 3, role: "Healer - Advanced healing specialist" },
  paladin: { baseHP: 16, vit: 1, str: 1, mnd: 1, role: "Tank/Healer - Holy defender" },
  dark_knight: { baseHP: 14, vit: 1, str: 1, int: 1, role: "Tank/DPS - Dark magic melee" },
  blood_knight: { baseHP: 20, str: 1, int: 2, vit: 1, role: "Tank/DPS - Lifesteal specialist" },
};

// Complete character stats (all stats combined)
export interface CharacterStats {
  // Base stats (from job + equipment + passives)
  str: number;  // Strength - Adds damage to physical attacks
  int: number;  // Intelligence - Adds MP and damage to magical attacks
  agi: number;  // Agility - Adds damage to ranged attacks, reduces damage agro
  mnd: number;  // Mind - Adds MP and healing to spells
  vit: number;  // Vitality - Reduces damage by VIT/2 and adds VIT HP
  
  // Derived stats
  hp: number;       // Hit Points: Job baseHP + VIT
  maxHp: number;    // Maximum HP
  mp: number;       // Magic Points: (INT + MND) × 3
  maxMp: number;    // Maximum MP
  def: number;      // Defense: Reduces damage by DEF points
  atk: number;      // Attack: Raises melee damage by ATK points
  mat: number;      // Magic Attack: Raises magic damage by MAT points
  rtk: number;      // Ranged Attack: Raises ranged attack damage by RTK points
  comboPoints: number;     // Current combo points (for Scout and cross-class users)
  maxComboPoints: number;  // Starting Max Combo Points = AGI × 2
}

// Calculate complete character stats
export function calculateCharacterStats(
  characterClass: CharacterClass,
  equipmentStats: EquipmentStats,
  passiveBonuses: { str?: number; int?: number; agi?: number; mnd?: number; vit?: number },
  mechanicUpgrades: { maxComboPoints?: number; potionCraftBonus?: number; hexDuration?: number; siphonHealBonus?: number } = {}
): CharacterStats {
  const baseJob = CLASS_STATS[characterClass];
  
  // Calculate base stats (job + equipment + passives)
  const str = (baseJob.str || 0) + equipmentStats.str + (passiveBonuses.str || 0);
  const int = (baseJob.int || 0) + equipmentStats.int + (passiveBonuses.int || 0);
  const agi = (baseJob.agi || 0) + equipmentStats.agi + (passiveBonuses.agi || 0);
  const mnd = (baseJob.mnd || 0) + equipmentStats.mnd + (passiveBonuses.mnd || 0);
  const vit = (baseJob.vit || 0) + equipmentStats.vit + (passiveBonuses.vit || 0);
  
  // Calculate derived stats
  const maxHp = baseJob.baseHP + vit;
  const maxMp = (int + mnd) * 3;
  const def = equipmentStats.def + Math.floor(vit / 2);
  const atk = equipmentStats.atk + str;
  const mat = equipmentStats.mat + int;
  const rtk = equipmentStats.rtk + agi;
  const maxComboPoints = (agi * 2) + (mechanicUpgrades.maxComboPoints || 0);
  
  return {
    str,
    int,
    agi,
    mnd,
    vit,
    hp: maxHp,  // Start at max HP
    maxHp,
    mp: maxMp,  // Start at max MP
    maxMp,
    def,
    atk,
    mat,
    rtk,
    comboPoints: 0,  // Start with 0 combo points
    maxComboPoints,
  };
}

// Calculate player's current combat stats from PlayerState
export function getPlayerCombatStats(playerState: PlayerState, weapon: string, headgear: string, armor: string): CharacterStats {
  const passiveBonuses = getTotalPassiveBonuses(playerState.jobLevels);
  const mechanicUpgrades = getTotalMechanicUpgrades(playerState.jobLevels);
  const equipmentStats = calculateEquipmentStats(weapon, headgear, armor);
  
  return calculateCharacterStats(
    playerState.characterClass,
    equipmentStats,
    passiveBonuses,
    mechanicUpgrades
  );
}

// Calculate damage for different attack types
export function calculatePhysicalDamage(atk: number, str: number): number {
  return Math.floor((atk + str) / 2);
}

export function calculateMagicalDamage(mat: number, int: number): number {
  return Math.floor((mat + int) / 2);
}

export function calculateRangedDamage(rtk: number, agi: number): number {
  return Math.floor((rtk + agi) / 2);
}

export function calculateHybridDamage(mat: number, agi: number, mnd: number): number {
  // For Herbalist base damage
  return Math.floor((mat + agi + mnd) / 2);
}

// Calculate damage reduction
export function calculateDamageReduction(def: number, vit: number): number {
  return def + Math.floor(vit / 2);
}

// Calculate agro reduction from AGI
export function calculateAgroReduction(agi: number): number {
  return agi;
}

// Guild level system (uses same curve as player jobs, extends to 99)
export function getGuildXPForLevel(level: number): number {
  if (level <= 1) return 0;
  // Same formula as player jobs: 6 * (level - 1)
  return 6 * (level - 1);
}

export function getTotalGuildXPForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getGuildXPForLevel(i);
  }
  return total;
}

export function getGuildLevelFromXP(xp: number): number {
  let level = 1;
  let cumulativeXP = 0;
  
  while (level < 99) {
    const xpNeededForNext = getGuildXPForLevel(level + 1);
    if (cumulativeXP + xpNeededForNext > xp) {
      break;
    }
    cumulativeXP += xpNeededForNext;
    level++;
  }
  
  return level;
}
