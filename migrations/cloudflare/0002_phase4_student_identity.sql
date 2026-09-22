CREATE TABLE IF NOT EXISTS "students" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "nickname" text NOT NULL,
  "nickname_normalized" text NOT NULL,
  "password_hash" text NOT NULL,
  "character_class" text,
  "gender" text,
  "guild_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "students_nickname_normalized_unique" UNIQUE("nickname_normalized")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_guild_code_idx" ON "students" USING btree ("guild_code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_combat_sessions" (
  "session_id" text PRIMARY KEY NOT NULL,
  "fight_id" uuid NOT NULL,
  "teacher_id" uuid NOT NULL,
  "status" text DEFAULT 'waiting' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "live_combat_sessions_fight_id_fights_id_fk"
    FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "live_combat_sessions_teacher_id_teachers_id_fk"
    FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_combat_sessions_fight_idx" ON "live_combat_sessions" USING btree ("fight_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_combat_sessions_teacher_idx" ON "live_combat_sessions" USING btree ("teacher_id");
