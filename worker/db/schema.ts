import type { SavedJobLoadouts } from "../../shared/job-loadouts";
import type { CampaignGate, CampaignLayout, CampaignProgress } from "../../shared/campaign/model";
import type { AARanks } from "../../shared/aa";
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
  doublePrecision,
  bigint,
  check,
  index,
  integer,
  jsonb,
  foreignKey,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  unique,
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
    actorTypeCheck: check("app_sessions_actor_type_check", sql`${table.actorType} IN ('teacher', 'student')`),
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
  palette?: import("../../shared/avatar/visuals").SpritePalette;
  enemyType?: Exclude<import("../../shared/combat/enemy-ai").EnemyType, "basic">;
  ai?: import("../../shared/combat/enemy-ai").EnemyAI;
  quantity?: number;
  swarm?: import("../../shared/combat/swarm").EnemySwarm;
  wave?: number;
  species?: "goblin" | "other";
  role?: import("../../shared/encounter-tiers").EnemyRole;
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
    encounterTier: integer("encounter_tier"),
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
    encounterTierCheck: check("fights_encounter_tier_check", sql`${table.encounterTier} BETWEEN 1 AND 4`),
    teacherIndex: index("fights_teacher_idx").on(table.teacherId),
  }),
);

export const students = pgTable(
  "students",
  {
    grantedJobs: jsonb("granted_jobs").$type<CharacterClass[]>().notNull().default([]),
    aaExperience: integer("aa_experience").notNull().default(0),
    aaPointsSpent: integer("aa_points_spent").notNull().default(0),
    aaRanks: jsonb("aa_ranks").$type<AARanks>().notNull().default({}),
    aaRevision: integer("aa_revision").notNull().default(0),
    characterName: text("character_name"),
    staminaDay: text("stamina_day"),
    dailyCombats: integer("daily_combats").notNull().default(0),
    staminaRecovery: doublePrecision("stamina_recovery").notNull().default(0),
    xpRemainder: doublePrecision("xp_remainder").notNull().default(0),
    id: uuid("id").primaryKey().defaultRandom(),
    nickname: text("nickname").notNull(),
    nicknameNormalized: text("nickname_normalized").notNull(),
    guildId: uuid("guild_id").references(() => guilds.id),
    weapon: text("weapon"),
    headgear: text("headgear"),
    armor: text("armor"),
    offhand: text("offhand"),
    hands: text("hands"),
    legs: text("legs"),
    feet: text("feet"),
    arms: text("arms"),
    jobLoadouts: jsonb("job_loadouts").$type<SavedJobLoadouts>().notNull().default({}),
    loadoutRevision: integer("loadout_revision").notNull().default(0),
    crossClassAbility1: text("cross_class_ability_1"),
    crossClassAbility2: text("cross_class_ability_2"),
    crossClassAbilities: jsonb("cross_class_abilities").$type<(string | null)[]>(),
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
    staminaRecoveryCheck: check("students_stamina_recovery_check", sql`${table.staminaRecovery} >= 0 AND ${table.staminaRecovery} < 'Infinity'::double precision`),
    dailyCombatsCheck: check("students_daily_combats_check", sql`${table.dailyCombats} >= 0`),
    xpRemainderCheck: check("students_xp_remainder_check", sql`${table.xpRemainder} >= 0 AND ${table.xpRemainder} < 1`),
    aaExperienceCheck: check("students_aa_experience_check", sql`${table.aaExperience} >= 0`),
    aaSpentCheck: check("students_aa_spent_check", sql`${table.aaPointsSpent} >= 0`),
    aaRevisionCheck: check("students_aa_revision_check", sql`${table.aaRevision} >= 0`),
    aaRanksCheck: check("students_aa_ranks_check", sql`jsonb_typeof(${table.aaRanks}) = 'object'`),
    crossClassListCheck: check("students_cross_class_list_check", sql`${table.crossClassAbilities} IS NULL OR (jsonb_typeof(${table.crossClassAbilities}) = 'array' AND jsonb_array_length(${table.crossClassAbilities}) <= 5)`),
    nicknameUnique: unique("students_nickname_normalized_unique").on(
      table.nicknameNormalized,
    ),
    guildCodeIndex: index("students_guild_code_idx").on(table.guildCode),
  }),
);

export const aaPurchases = pgTable('aa_purchases', {
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(),
  upgradeId: text('upgrade_id').notNull(),
  rank: integer('rank').notNull(),
  cost: integer('cost').notNull(),
  catalogVersion: integer('catalog_version').notNull(),
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  receipt: jsonb('receipt').notNull().$type<import('../../shared/contracts/advancement').AAPurchaseReceipt>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ pk: primaryKey({ columns: [t.studentId, t.requestId] }),
  costCheck: check('aa_purchases_cost_check', sql`${t.cost} >= 0`),
}));

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
    guildLimitTier: integer("guild_limit_tier"),
    guildId: uuid("guild_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    guildForeignKey: foreignKey({ name: "live_combat_sessions_guild_id_fkey", columns: [table.guildId], foreignColumns: [guilds.id] }),
    guildLimitTierCheck: check("live_combat_sessions_guild_limit_tier_check", sql`${table.guildLimitTier} BETWEEN 1 AND 4`),
    fightIndex: index("live_combat_sessions_fight_idx").on(table.fightId),
    teacherIndex: index("live_combat_sessions_teacher_idx").on(table.teacherId),
  }),
);

export type TeacherRecord = typeof teachers.$inferSelect;
export type NewTeacherRecord = typeof teachers.$inferInsert;
export type AppSessionRecord = typeof appSessions.$inferSelect;
export type FightRecord = typeof fights.$inferSelect & { campaignContext?: { campaignId: string; studentId: string; objective: boolean; fixedTier: number } };
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
  visual: jsonb("visual").$type<import("../../shared/avatar/visuals").EquipmentVisual>(),
  itemType: text("item_type").notNull().$type<ItemType>(),
  quality: text("quality").notNull().$type<ItemQuality>(),
  tier: integer("tier").notNull().default(1), // Equipment tier (1-10)
  slot: text("slot").notNull().$type<EquipmentSlot>(),
  armorCategory: text("armor_category").$type<"heavy_armor" | "leather_armor" | "light_armor">(),
  offhandType: text("offhand_type").$type<"shield" | "potion" | "quiver" | "spellbook">(),
  weaponType: text("weapon_type").$type<WeaponType>(), // Nullable for backwards compatibility
  stats: jsonb("stats").notNull().$type<EquipmentItemStats>().default({}),
  shopPrice: integer("shop_price"), // Gold price in guild shop (null = not available for purchase)
  isPurchasable: boolean("is_purchasable").notNull().default(true), // Whether item appears in shop when tier is unlocked
  createdAt: bigint("created_at", { mode: "number" })
    .notNull()
    .default(sql`(extract(epoch from now()) * 1000)::bigint`),
}, (t) => ({
  armorCategoryCheck: check("equipment_items_armor_category_check", sql`${t.armorCategory} IN ('heavy_armor', 'leather_armor', 'light_armor')`),
  offhandTypeCheck: check("equipment_items_offhand_type_check", sql`${t.offhandType} IN ('shield', 'potion', 'quiver', 'spellbook')`),
}));

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
  limitTier: integer("limit_tier").notNull().default(1),
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
}, (t) => ({
  limitTierCheck: check("guilds_limit_tier_check", sql`${t.limitTier} BETWEEN 1 AND 4`),
}));

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
    studentIndex: index("guild_memberships_student_idx").on(table.studentId),
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
    isArchived: boolean("is_archived").notNull().default(false),
    isSeeded: boolean("is_seeded").notNull().default(false), // True for auto-generated quests
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: bigint("completed_at", { mode: "number" }),
    completedWeek: integer("completed_week"), // ISO week number when completed (for weekly reset)
    createdAt: bigint("created_at", { mode: "number" })
      .notNull()
      .default(sql`(extract(epoch from now()) * 1000)::bigint`),
  },
  (table) => ({
    guildStudentIndex: index("quests_guild_student_idx").on(table.guildId,table.studentId),
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
    baseXp: doublePrecision("base_xp").notNull().default(0),
    xpMultiplier: doublePrecision("xp_multiplier").notNull().default(1),
    staminaRestored: doublePrecision("stamina_restored").notNull().default(0),
    staminaFightNumber: integer("stamina_fight_number"),
    staminaDay: text("stamina_day"),
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
    studentHistory: index("combat_results_student_history_idx").on(table.studentId,table.completedAt.desc().nullsFirst(),table.id.desc().nullsFirst()),
    guildHistory: index("combat_results_guild_history_idx").on(table.guildId,table.completedAt.desc().nullsFirst(),table.id.desc().nullsFirst()),
    fightHistory: index("combat_results_fight_history_idx").on(table.fightId,table.completedAt.desc().nullsFirst(),table.id.desc().nullsFirst()),
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

// Avatar art is independent of jobs and combat statistics. Catalog records are
// seeded by migrations; student choices reference palette IDs, not image pixels.
export const avatarPalettes = pgTable("avatar_palettes", {
  id: text("id").primaryKey(),
  channel: text("channel").notNull().$type<"hair" | "eyes" | "skin">(),
  version: integer("version").notNull(),
}, (t) => ({
  channelKey: unique("avatar_palettes_channel_key").on(t.id, t.channel),
  validChannel: check("avatar_palettes_channel_check", sql`${t.channel} IN ('hair','eyes','skin')`),
  positiveVersion: check("avatar_palettes_version_check", sql`${t.version} > 0`),
}));

export const avatarColors = pgTable("avatar_colors", {
  paletteId: text("palette_id").notNull().references(() => avatarPalettes.id),
  id: text("id").notNull(),
  label: text("label").notNull(),
  hex: text("hex").notNull(),
  sortOrder: integer("sort_order").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.paletteId, t.id] }),
  validHex: check("avatar_colors_hex_check", sql`${t.hex} ~ '^#[0-9A-Fa-f]{6}$'`),
  validOrder: check("avatar_colors_order_check", sql`${t.sortOrder} >= 0`),
  orderUnique: uniqueIndex("avatar_colors_order_unique").on(t.paletteId, t.sortOrder),
}));

export const avatarModels = pgTable("avatar_models", {
  id: text("id").primaryKey(),
  species: text("species").notNull(),
  bodyType: text("body_type").notNull(),
  rigFamily: text("rig_family").notNull(),
  status: text("status").notNull().default("concept"),
  hairPaletteId: text("hair_palette_id").notNull(),
  eyePaletteId: text("eye_palette_id").notNull(),
  skinPaletteId: text("skin_palette_id").notNull(),
  // Constant channel columns let PostgreSQL enforce palette semantics via FKs.
  hairChannel: text("hair_channel").notNull().default("hair"),
  eyeChannel: text("eye_channel").notNull().default("eyes"),
  skinChannel: text("skin_channel").notNull().default("skin"),
  colorRegions: jsonb("color_regions").notNull().$type<Record<string, {
    regions: string[]; excludedRegions: string[];
  }>>(),
}, (t) => ({
  paletteKey: unique("avatar_models_palette_key").on(t.id, t.hairPaletteId, t.eyePaletteId, t.skinPaletteId),
  channels: check("avatar_models_channels_check", sql`${t.hairChannel} = 'hair' AND ${t.eyeChannel} = 'eyes' AND ${t.skinChannel} = 'skin'`),
  hairPalette: foreignKey({ name: "avatar_models_hair_palette_fk", columns: [t.hairPaletteId, t.hairChannel], foreignColumns: [avatarPalettes.id, avatarPalettes.channel] }),
  eyePalette: foreignKey({ name: "avatar_models_eye_palette_fk", columns: [t.eyePaletteId, t.eyeChannel], foreignColumns: [avatarPalettes.id, avatarPalettes.channel] }),
  skinPalette: foreignKey({ name: "avatar_models_skin_palette_fk", columns: [t.skinPaletteId, t.skinChannel], foreignColumns: [avatarPalettes.id, avatarPalettes.channel] }),
  validStatus: check("avatar_models_status_check", sql`${t.status} IN ('concept','production','retired')`),
}));

export const avatarModelViews = pgTable("avatar_model_views", {
  modelId: text("model_id").notNull().references(() => avatarModels.id),
  viewKey: text("view_key").notNull(),
  sourcePath: text("source_path").notNull(),
  sourceSha256: text("source_sha256").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  facing: text("facing").notNull(),
  intendedYaw: integer("intended_yaw").notNull(),
  hairMaskPath: text("hair_mask_path"),
  eyeMaskPath: text("eye_mask_path"),
  skinMaskPath: text("skin_mask_path"),
  neutralBasePath: text("neutral_base_path"),
  rigPath: text("rig_path"),
  partsPath: text("parts_path"),
  recolorReady: boolean("recolor_ready").notNull().default(false),
  rigReady: boolean("rig_ready").notNull().default(false),
}, (t) => ({
  pk: primaryKey({ columns: [t.modelId, t.viewKey] }),
  dimensions: check("avatar_views_dimensions_check", sql`${t.width} > 0 AND ${t.height} > 0`),
  yaw: check("avatar_views_yaw_check", sql`${t.intendedYaw} BETWEEN -180 AND 180`),
  hash: check("avatar_views_sha_check", sql`${t.sourceSha256} ~ '^[0-9a-f]{64}$'`),
  masks: check("avatar_views_masks_check", sql`NOT ${t.recolorReady} OR (${t.hairMaskPath} IS NOT NULL AND ${t.eyeMaskPath} IS NOT NULL AND ${t.skinMaskPath} IS NOT NULL AND ${t.neutralBasePath} IS NOT NULL)`),
  rig: check("avatar_views_rig_check", sql`NOT ${t.rigReady} OR (${t.rigPath} IS NOT NULL AND ${t.partsPath} IS NOT NULL)`),
}));

export const avatarEquipmentSlots = pgTable("avatar_equipment_slots", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  bodyPart: text("body_part").notNull(),
  side: text("side").notNull().$type<"left" | "right" | "center">(),
  kind: text("kind").notNull().$type<"wearable" | "grip">(),
}, (t) => ({
  side: check("avatar_slots_side_check", sql`${t.side} IN ('left','right','center')`),
  kind: check("avatar_slots_kind_check", sql`${t.kind} IN ('wearable','grip')`),
}));

export const avatarModelSlots = pgTable("avatar_model_slots", {
  modelId: text("model_id").notNull().references(() => avatarModels.id),
  slotId: text("slot_id").notNull().references(() => avatarEquipmentSlots.id),
  boneName: text("bone_name").notNull(),
  // Calibrated transform and layer order belong to each view/rig, not the
  // conceptual skeleton. Null explicitly means the artwork is not rigged yet.
  viewTransforms: jsonb("view_transforms").$type<Record<string, {
    pivotX: number; pivotY: number; offsetX: number; offsetY: number;
    rotation: number; scaleX: number; scaleY: number; layer: number;
  }>>(),
}, (t) => ({ pk: primaryKey({ columns: [t.modelId, t.slotId] }) }));

export const studentAvatars = pgTable("student_avatars", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().unique().references(() => students.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  hairPaletteId: text("hair_palette_id").notNull(),
  hairColorId: text("hair_color_id").notNull(),
  eyePaletteId: text("eye_palette_id").notNull(),
  eyeColorId: text("eye_color_id").notNull(),
  skinPaletteId: text("skin_palette_id").notNull(),
  skinColorId: text("skin_color_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  modelKey: unique("student_avatars_model_key").on(t.id, t.modelId),
  model: foreignKey({ name: "student_avatars_model_palettes_fk", columns: [t.modelId, t.hairPaletteId, t.eyePaletteId, t.skinPaletteId], foreignColumns: [avatarModels.id, avatarModels.hairPaletteId, avatarModels.eyePaletteId, avatarModels.skinPaletteId] }),
  hair: foreignKey({ name: "student_avatars_hair_color_fk", columns: [t.hairPaletteId, t.hairColorId], foreignColumns: [avatarColors.paletteId, avatarColors.id] }),
  eyes: foreignKey({ name: "student_avatars_eye_color_fk", columns: [t.eyePaletteId, t.eyeColorId], foreignColumns: [avatarColors.paletteId, avatarColors.id] }),
  skin: foreignKey({ name: "student_avatars_skin_color_fk", columns: [t.skinPaletteId, t.skinColorId], foreignColumns: [avatarColors.paletteId, avatarColors.id] }),
}));

// One item definition can have several visual parts (for example a cuirass
// covering torso and upper arms). A part is fitted to a model, slot and view.
export const avatarEquipment = pgTable("avatar_equipment", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  gameplayItemId: uuid("gameplay_item_id").references(() => equipmentItems.id, { onDelete: "set null" }),
  builtinItemId: text("builtin_item_id"),
}, (t) => ({
  oneLink: check("avatar_equipment_one_item_link", sql`${t.gameplayItemId} IS NULL OR ${t.builtinItemId} IS NULL`),
}));

export const avatarEquipmentFits = pgTable("avatar_equipment_fits", {
  equipmentId: text("equipment_id").notNull().references(() => avatarEquipment.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  slotId: text("slot_id").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.equipmentId, t.modelId, t.slotId] }),
  slot: foreignKey({ name: "avatar_equipment_fits_slot_fk", columns: [t.modelId, t.slotId], foreignColumns: [avatarModelSlots.modelId, avatarModelSlots.slotId] }),
}));

export const avatarEquipmentVisuals = pgTable("avatar_equipment_visuals", {
  equipmentId: text("equipment_id").notNull(),
  modelId: text("model_id").notNull(),
  slotId: text("slot_id").notNull(),
  viewKey: text("view_key").notNull(),
  assetPath: text("asset_path").notNull(),
  attachment: jsonb("attachment").$type<{
    pivotX: number; pivotY: number; offsetX: number; offsetY: number;
    rotation: number; scaleX: number; scaleY: number; layer: number;
  }>(),
  ready: boolean("ready").notNull().default(false),
}, (t) => ({
  pk: primaryKey({ columns: [t.equipmentId, t.modelId, t.slotId, t.viewKey] }),
  fit: foreignKey({ name: "avatar_equipment_visuals_fit_fk", columns: [t.equipmentId, t.modelId, t.slotId], foreignColumns: [avatarEquipmentFits.equipmentId, avatarEquipmentFits.modelId, avatarEquipmentFits.slotId] }).onDelete("cascade"),
  view: foreignKey({ name: "avatar_equipment_visuals_view_fk", columns: [t.modelId, t.viewKey], foreignColumns: [avatarModelViews.modelId, avatarModelViews.viewKey] }),
  readyTransform: check("avatar_equipment_visuals_ready_check", sql`NOT ${t.ready} OR ${t.attachment} IS NOT NULL`),
}));

export const avatarEquippedItems = pgTable("avatar_equipped_items", {
  avatarId: uuid("avatar_id").notNull(),
  modelId: text("model_id").notNull(),
  slotId: text("slot_id").notNull(),
  equipmentId: text("equipment_id").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.avatarId, t.slotId] }),
  avatar: foreignKey({ name: "avatar_equipped_items_avatar_fk", columns: [t.avatarId, t.modelId], foreignColumns: [studentAvatars.id, studentAvatars.modelId] }).onDelete("cascade"),
  fit: foreignKey({ name: "avatar_equipped_items_fit_fk", columns: [t.equipmentId, t.modelId, t.slotId], foreignColumns: [avatarEquipmentFits.equipmentId, avatarEquipmentFits.modelId, avatarEquipmentFits.slotId] }),
}));

export type StudentAvatarRecord = typeof studentAvatars.$inferSelect;

// Introduced by handwritten migration 0014. Keep all relational structures in
// Drizzle; only procedural SQL and data backfills remain migration-owned.
export const questFightEvidence = pgTable("quest_fight_evidence", {
  sessionId: text("session_id").notNull(),
  studentId: uuid("student_id").notNull(),
  guildId: uuid("guild_id").notNull(),
  fightId: uuid("fight_id").notNull(),
  isSoloMode: boolean("is_solo_mode").notNull(),
  victory: boolean("victory").notNull().default(false),
  answered: integer("answered").notNull(),
  correct: integer("correct").notNull(),
  correctKeys: jsonb("correct_keys").$type<string[]>().notNull().default([]),
  bankKeys: jsonb("bank_keys").$type<string[]>().notNull().default([]),
  revision: integer("revision").notNull().default(0),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (t) => ({
  pk: primaryKey({ name: "quest_fight_evidence_pkey", columns: [t.sessionId, t.studentId] }),
  session: foreignKey({ name: "quest_fight_evidence_session_id_fkey", columns: [t.sessionId], foreignColumns: [liveCombatSessions.sessionId] }),
  student: foreignKey({ name: "quest_fight_evidence_student_id_fkey", columns: [t.studentId], foreignColumns: [students.id] }),
  guild: foreignKey({ name: "quest_fight_evidence_guild_id_fkey", columns: [t.guildId], foreignColumns: [guilds.id] }),
  fight: foreignKey({ name: "quest_fight_evidence_fight_id_fkey", columns: [t.fightId], foreignColumns: [fights.id] }),
  guildStudentIndex: index("quest_evidence_guild_student").on(t.guildId, t.studentId),
}));

export const personalQuestReceipts = pgTable("personal_quest_receipts", {
  studentId: uuid("student_id").notNull(),
  milestone: text("milestone").notNull(),
}, (t) => ({
  pk: primaryKey({ name: "personal_quest_receipts_pkey", columns: [t.studentId, t.milestone] }),
  student: foreignKey({ name: "personal_quest_receipts_student_id_fkey", columns: [t.studentId], foreignColumns: [students.id] }),
}));

// Reporting projections retain session-time identity and are independent of rewards.
export const sessionParticipants = pgTable('session_participants', {
  sessionId: text('session_id').notNull().references(() => liveCombatSessions.sessionId),
  studentId: uuid('student_id').notNull().references(() => students.id),
  teacherId: uuid('teacher_id').notNull().references(() => teachers.id),
  fightId: uuid('fight_id').notNull().references(() => fights.id),
  guildId: uuid('guild_id').references(() => guilds.id),
  nickname: text('nickname').notNull(),
  quizTitle: text('quiz_title').notNull(),
  job: text('job').notNull().$type<CharacterClass>(),
  status: text('status').notNull(),
  victory: boolean('victory'),
  survived: boolean('survived').notNull(),
  totals: jsonb('totals').notNull().$type<import('../../shared/combat/model').CombatTotals>(),
  revision: integer('revision').notNull(),
  updatedAt: bigint('updated_at', {mode:'number'}).notNull(),
}, t => ({
  pk: primaryKey({columns:[t.sessionId,t.studentId]}),
  teacherSession: index('session_participants_teacher_session_idx').on(t.teacherId,t.sessionId),
  guildPlayer: index('session_participants_guild_player_idx').on(t.guildId,t.studentId),
}));

export const questionAttempts = pgTable('question_attempts', {
  sessionId: text('session_id').notNull().references(() => liveCombatSessions.sessionId),
  studentId: uuid('student_id').notNull().references(() => students.id),
  round: integer('round').notNull(),
  teacherId: uuid('teacher_id').notNull().references(() => teachers.id),
  fightId: uuid('fight_id').notNull().references(() => fights.id),
  guildId: uuid('guild_id').references(() => guilds.id),
  job: text('job').notNull().$type<CharacterClass>(),
  questionId: text('question_id').notNull(),
  questionVersion: text('question_version').notNull(),
  question: jsonb('question').notNull().$type<FightQuestion>(),
  outcome: text('outcome').notNull().$type<'correct'|'incorrect'|'unanswered'>(),
  recordedAt: bigint('recorded_at', {mode:'number'}).notNull(),
}, t => ({
  pk: primaryKey({columns:[t.sessionId,t.studentId,t.round]}),
  teacherQuestion: index('question_attempts_teacher_question_idx').on(t.teacherId,t.questionId,t.sessionId),
  guildRecent: index('question_attempts_guild_recent_idx').on(t.guildId,t.recordedAt,t.studentId),
  sessionRound: index('question_attempts_session_round_idx').on(t.sessionId,t.round),
  validOutcome: check('question_attempts_outcome_check',sql`${t.outcome} IN ('correct','incorrect','unanswered')`),
}));

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => teachers.id),
  guildId: uuid('guild_id').notNull().references(() => guilds.id),
  fightId: uuid('fight_id').notNull().references(() => fights.id),
  name: text('name').notNull(), dungeonName: text('dungeon_name').notNull(),
  theme: text('theme').notNull().default('normal_cave'),
  gates: jsonb('gates').$type<CampaignGate[]>().notNull(),
  layout: jsonb('layout').$type<CampaignLayout>().notNull(),
  fightSnapshot: jsonb('fight_snapshot').$type<FightRecord>().notNull(),
  revision: integer('revision').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ guildIndex: index('campaigns_guild_idx').on(t.guildId), teacherIndex: index('campaigns_teacher_idx').on(t.teacherId) }));

export const campaignPlayers = pgTable('campaign_players', {
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  studentId: uuid('student_id').notNull().references(() => students.id),
  state: jsonb('state').$type<CampaignProgress>().notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => ({ pk: primaryKey({columns: [t.campaignId, t.studentId]}), studentIndex: index('campaign_players_student_idx').on(t.studentId) }));

export const campaignEncounters = pgTable('campaign_encounters', {
  sessionId: text('session_id').primaryKey().references(() => liveCombatSessions.sessionId),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id),
  studentId: uuid('student_id').notNull().references(() => students.id),
  fightSnapshot: jsonb('fight_snapshot').$type<FightRecord>().notNull(),
  playerSnapshot: jsonb('player_snapshot').$type<import('../../shared/combat/model').CombatPlayer>().notNull(),
  settled: boolean('settled').notNull().default(false),
}, t => ({ playerIndex: index('campaign_encounters_player_idx').on(t.campaignId, t.studentId) }));

// Availability marker is retained; samples are pruned on the student's next pulse.
export const studentActivityTracking = pgTable('student_activity_tracking', {
  studentId: uuid('student_id').primaryKey().references(() => students.id, {onDelete: 'cascade'}),
  startedAt: bigint('started_at', {mode: 'number'}).notNull(),
});
export const studentActivitySamples = pgTable('student_activity_samples', {
  studentId: uuid('student_id').notNull().references(() => students.id, {onDelete: 'cascade'}),
  bucketStart: bigint('bucket_start', {mode: 'number'}).notNull(),
  pulseId: uuid('pulse_id').notNull(),
}, t => ({
  pk: primaryKey({columns: [t.studentId, t.bucketStart]}),
  pulse: uniqueIndex('student_activity_pulse_unique').on(t.studentId, t.pulseId),
  bucketCheck: check('student_activity_bucket_check', sql`${t.bucketStart} >= 0 AND ${t.bucketStart} % 30000 = 0`),
}));

// Keep receipts even when another tab already claimed the sample bucket.
export const studentActivityReceipts = pgTable('student_activity_receipts', {
  studentId: uuid('student_id').notNull().references(() => students.id, {onDelete: 'cascade'}),
  pulseId: uuid('pulse_id').notNull(),
  bucketStart: bigint('bucket_start', {mode: 'number'}).notNull(),
}, t => ({
  pk: primaryKey({columns: [t.studentId,t.pulseId]}),
  retention: index('student_activity_receipts_retention_idx').on(t.studentId,t.bucketStart),
}));
