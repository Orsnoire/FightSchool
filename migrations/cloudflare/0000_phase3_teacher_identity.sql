CREATE TABLE IF NOT EXISTS "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"password_hash" text NOT NULL,
	"guild_code" text NOT NULL,
	"billing_address" text NOT NULL,
	"school_district" text NOT NULL,
	"school" text NOT NULL,
	"subject" text NOT NULL,
	"grade_level" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teachers_email_normalized_unique" ON "teachers" USING btree ("email_normalized");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teachers_guild_code_unique" ON "teachers" USING btree ("guild_code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "app_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "app_sessions_actor_type_check" CHECK ("actor_type" IN ('teacher', 'student'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_sessions_actor_idx" ON "app_sessions" USING btree ("actor_type", "actor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_sessions_expiry_idx" ON "app_sessions" USING btree ("expires_at");
