import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

export type TeacherRecord = typeof teachers.$inferSelect;
export type NewTeacherRecord = typeof teachers.$inferInsert;
export type AppSessionRecord = typeof appSessions.$inferSelect;
