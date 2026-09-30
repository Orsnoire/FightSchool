import { sql } from "drizzle-orm";
import type {
  CharacterClass,
  Gender,
  EquipmentItemStats,
  ItemType,
  ItemQuality,
  EquipmentSlot,
  WeaponType,
  QuestCriteria,
  QuestReward,
  QuestType,
} from "../../shared/schema.ts";
import {
  boolean,
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const teachers = pgTable(
  "teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    guildCode: text("guild_code").notNull(),
    billingAddress: text("billing_address").notNull(),
    schoolDistrict: text("school_district").notNull(),
    school: text("school").notNull(),
    subject: text("subject").notNull(),
    gradeLevel: text("grade_level").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("teachers_email_normalized_unique").on(
      table.emailNormalized,
    ),
    guildCodeUnique: uniqueIndex("teachers_guild_code_unique").on(
      table.guildCode,
    ),
  }),
);

export const appSessions = pgTable(
  "app_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    actorIndex: index("app_sessions_actor_idx").on(
      table.actorType,
      table.actorId,
    ),
    expiryIndex: index("app_sessions_expiry_idx").on(table.expiresAt),
  }),
);

export interface FightQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  question: string;
  options?: string[];
  correctAnswer: string;
  timeLimit: number;
}

export interface FightEnemy {
  id: string;
  name: string;
  image: string;
  difficultyMultiplier: number;
}

export const fights = pgTable(
  "fights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
    guildCode: text("guild_code"),
    questions: jsonb("questions").notNull().$type<FightQuestion[]>(),
    enemies: jsonb("enemies").notNull().$type<FightEnemy[]>(),
    baseXP: integer("base_xp").notNull().default(10),
    baseEnemyDamage: integer("base_enemy_damage").notNull().default(1),
    enemyDisplayMode: text("enemy_display_mode")
      .notNull()
      .default("consecutive"),
    lootTable: jsonb("loot_table")
      .notNull()
      .$type<Array<{ itemId: string }>>()
      .default([]),
    randomizeQuestions: boolean("randomize_questions").notNull().default(false),
    shuffleOptions: boolean("shuffle_options").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    teacherIndex: index("fights_teacher_idx").on(table.teacherId),
  }),
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nickname: text("nickname").notNull(),
    nicknameNormalized: text("nickname_normalized").notNull(),
    guildId: uuid("guild_id").references(() => guilds.id),
    weapon: text("weapon"),
    headgear: text("headgear"),
    armor: text("armor"),
    crossClassAbility1: text("cross_class_ability_1"),
    crossClassAbility2: text("cross_class_ability_2"),
    inventory: jsonb("inventory").$type<string[]>().notNull().default([]),
    gold: integer("gold").notNull().default(0),
    passwordHash: text("password_hash").notNull(),
    characterClass: text("character_class").$type<CharacterClass>(),
    gender: text("gender").$type<Gender>(),
    guildCode: text("guild_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nonnegativeGold: check(
      "students_gold_nonnegative",
      sql`${table.gold} >= 0`,
    ),
    nicknameUnique: uniqueIndex("students_nickname_normalized_unique").on(
      table.nicknameNormalized,
    ),
    guildCodeIndex: index("students_guild_code_idx").on(table.guildCode),
  }),
);

export const liveCombatSessions = pgTable(
  "live_combat_sessions",
  {
    sessionId: text("session_id").primaryKey(),
    fightId: uuid("fight_id")
      .notNull()
      .references(() => fights.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("waiting"),
    soloStudentId: uuid("solo_student_id").references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    fightIndex: index("live_combat_sessions_fight_idx").on(table.fightId),
    teacherIndex: index("live_combat_sessions_teacher_idx").on(table.teacherId),
  }),
);

export type TeacherRecord = typeof teachers.$inferSelect;
export type NewTeacherRecord = typeof teachers.$inferInsert;
export type AppSessionRecord = typeof appSessions.$inferSelect;
export type FightRecord = typeof fights.$inferSelect;
export type NewFightRecord = typeof fights.$inferInsert;
export type StudentRecord = typeof students.$inferSelect;
export type NewStudentRecord = typeof students.$inferInsert;
export type LiveCombatSessionRecord = typeof liveCombatSessions.$inferSelect;

export const equipmentItems = pgTable("equipment_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => teachers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  itemType: text("item_type").notNull().$type<ItemType>(),
  quality: text("quality").notNull().$type<ItemQuality>(),
  tier: integer("tier").notNull().default(1), // Equipment tier (1-10)
  slot: text("slot").notNull().$type<EquipmentSlot>(),
  weaponType: text("weapon_type").$type<WeaponType>(), // Nullable for backwards compatibility
  stats: jsonb("stats").notNull().$type<EquipmentItemStats>().default({}),
  shopPrice: integer("shop_price"), // Gold price in guild shop (null = not available for purchase)
  isPurchasable: boolean("is_purchasable").notNull().default(true), // Whether item appears in shop when tier is unlocked
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

export const studentJobLevels = pgTable(
  "student_job_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    jobClass: text("job_class").notNull().$type<CharacterClass>(),
    level: integer("level").notNull().default(1),
    experience: integer("experience").notNull().default(0),
    unlockedAt: bigint("unlocked_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    pairUnique: uniqueIndex("studentJobLevels_pair_unique").on(
      table.studentId,
      table.jobClass,
    ),
  }),
);

export const guilds = pgTable("guilds", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => teachers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // 6-character join code
  description: text("description"),
  unlockedTier: integer("unlocked_tier").notNull().default(1),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

export const guildMemberships = pgTable(
  "guild_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    joinedAt: bigint("joined_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    pairUnique: uniqueIndex("guildMemberships_pair_unique").on(
      table.guildId,
      table.studentId,
    ),
  }),
);

export const guildFights = pgTable(
  "guild_fights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id")
      .notNull()
      .references(() => guilds.id, { onDelete: "cascade" }),
    fightId: uuid("fight_id")
      .notNull()
      .references(() => fights.id, { onDelete: "cascade" }),
    soloModeEnabled: boolean("solo_mode_enabled").notNull().default(false), // Per-guild solo mode setting
    assignedAt: bigint("assigned_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    pairUnique: uniqueIndex("guildFights_pair_unique").on(
      table.guildId,
      table.fightId,
    ),
  }),
);

export const guildSettings = pgTable("guild_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: uuid("guild_id")
    .notNull()
    .references(() => guilds.id, { onDelete: "cascade" })
    .unique(),
  hiddenLeaderboardMetrics: jsonb("hidden_leaderboard_metrics")
    .$type<string[]>()
    .default([]), // Metrics to hide (e.g., ["damageDealt", "healing"])
  enableGroupQuests: boolean("enable_group_quests").notNull().default(true),
  enableChat: boolean("enable_chat").notNull().default(false), // Teacher can enable guild chat (default off)
  updatedAt: bigint("updated_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
});

export const quests = pgTable(
  "quests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guildId: uuid("guild_id").references(() => guilds.id, {
      onDelete: "cascade",
    }), // Null for personal quests
    studentId: uuid("student_id").references(() => students.id, {
      onDelete: "cascade",
    }), // Null for guild quests, set for personal quests
    questType: text("quest_type").notNull().$type<QuestType>(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    criteria: jsonb("criteria").notNull().$type<QuestCriteria>(),
    rewards: jsonb("rewards").$type<QuestReward>().default({}),
    isSeeded: boolean("is_seeded").notNull().default(false), // True for auto-generated quests
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: bigint("completed_at", { mode: "number" }),
    completedWeek: integer("completed_week"), // ISO week number when completed (for weekly reset)
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    seedUnique: uniqueIndex("quests_seed_unique").on(
      table.guildId,
      sql`coalesce(${table.studentId}::text, 'guild')`,
      table.title,
    ),
  }),
);

export const combatResults = pgTable(
  "combat_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: text("session_id")
      .notNull()
      .references(() => liveCombatSessions.sessionId),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    fightId: uuid("fight_id")
      .notNull()
      .references(() => fights.id),
    guildId: uuid("guild_id").references(() => guilds.id),
    characterClass: text("character_class").notNull().$type<CharacterClass>(),
    victory: boolean("victory").notNull(),
    survived: boolean("survived").notNull(),
    isSoloMode: boolean("is_solo_mode").notNull().default(false),
    totals: jsonb("totals")
      .notNull()
      .$type<import("../../shared/combat/model.ts").CombatTotals>(),
    xpEarned: integer("xp_earned").notNull(),
    goldReward: integer("gold_reward").notNull(),
    lootTable: jsonb("loot_table")
      .notNull()
      .$type<Array<{ itemId: string }>>()
      .default([]),
    rewardClaim: text("reward_claim"),
    completedAt: bigint("completed_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    once: uniqueIndex("combat_results_session_student_unique").on(
      table.sessionId,
      table.studentId,
    ),
  }),
);
export const questCompletions = pgTable(
  "quest_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questId: uuid("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    period: text("period").notNull().default("once"),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    once: uniqueIndex("quest_completion_once").on(
      table.questId,
      table.studentId,
      table.period,
    ),
  }),
);
