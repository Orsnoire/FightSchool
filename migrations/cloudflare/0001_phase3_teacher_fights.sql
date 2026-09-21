CREATE TABLE IF NOT EXISTS "fights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"guild_code" text,
	"questions" jsonb NOT NULL,
	"enemies" jsonb NOT NULL,
	"base_xp" integer DEFAULT 10 NOT NULL,
	"base_enemy_damage" integer DEFAULT 1 NOT NULL,
	"enemy_display_mode" text DEFAULT 'consecutive' NOT NULL,
	"loot_table" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"randomize_questions" boolean DEFAULT false NOT NULL,
	"shuffle_options" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fights_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fights_teacher_idx" ON "fights" USING btree ("teacher_id");
