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
