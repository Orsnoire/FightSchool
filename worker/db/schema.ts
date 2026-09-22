import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const teachers = pgTable("teachers", {
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailUnique: uniqueIndex("teachers_email_normalized_unique").on(table.emailNormalized),
  guildCodeUnique: uniqueIndex("teachers_guild_code_unique").on(table.guildCode),
}));

export const appSessions = pgTable("app_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  actorType: text("actor_type").notNull(),
  actorId: uuid("actor_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => ({
  actorIndex: index("app_sessions_actor_idx").on(table.actorType, table.actorId),
  expiryIndex: index("app_sessions_expiry_idx").on(table.expiresAt),
}));

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

export const fights = pgTable("fights", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  guildCode: text("guild_code"),
  questions: jsonb("questions").notNull().$type<FightQuestion[]>(),
  enemies: jsonb("enemies").notNull().$type<FightEnemy[]>(),
  baseXP: integer("base_xp").notNull().default(10),
  baseEnemyDamage: integer("base_enemy_damage").notNull().default(1),
  enemyDisplayMode: text("enemy_display_mode").notNull().default("consecutive"),
  lootTable: jsonb("loot_table").notNull().$type<Array<{ itemId: string }>>().default([]),
  randomizeQuestions: boolean("randomize_questions").notNull().default(false),
  shuffleOptions: boolean("shuffle_options").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  teacherIndex: index("fights_teacher_idx").on(table.teacherId),
}));

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  nickname: text("nickname").notNull(),
  nicknameNormalized: text("nickname_normalized").notNull(),
  passwordHash: text("password_hash").notNull(),
  characterClass: text("character_class"),
  gender: text("gender"),
  guildCode: text("guild_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  nicknameUnique: uniqueIndex("students_nickname_normalized_unique").on(table.nicknameNormalized),
  guildCodeIndex: index("students_guild_code_idx").on(table.guildCode),
}));

export const liveCombatSessions = pgTable("live_combat_sessions", {
  sessionId: text("session_id").primaryKey(),
  fightId: uuid("fight_id").notNull().references(() => fights.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("waiting"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  fightIndex: index("live_combat_sessions_fight_idx").on(table.fightId),
  teacherIndex: index("live_combat_sessions_teacher_idx").on(table.teacherId),
}));

export type TeacherRecord = typeof teachers.$inferSelect;
export type NewTeacherRecord = typeof teachers.$inferInsert;
export type AppSessionRecord = typeof appSessions.$inferSelect;
export type FightRecord = typeof fights.$inferSelect;
export type NewFightRecord = typeof fights.$inferInsert;
export type StudentRecord = typeof students.$inferSelect;
export type NewStudentRecord = typeof students.$inferInsert;
export type LiveCombatSessionRecord = typeof liveCombatSessions.$inferSelect;
