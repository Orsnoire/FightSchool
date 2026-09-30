ALTER TABLE students ADD COLUMN guild_id uuid, ADD COLUMN weapon text, ADD COLUMN headgear text, ADD COLUMN armor text, ADD COLUMN cross_class_ability_1 text, ADD COLUMN cross_class_ability_2 text, ADD COLUMN inventory jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN gold integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE live_combat_sessions ADD COLUMN solo_student_id uuid;
--> statement-breakpoint
CREATE TABLE "combat_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"student_id" uuid NOT NULL,
	"fight_id" uuid NOT NULL,
	"guild_id" uuid,
	"character_class" text NOT NULL,
	"victory" boolean NOT NULL,
	"survived" boolean NOT NULL,
	"is_solo_mode" boolean DEFAULT false NOT NULL,
	"totals" jsonb NOT NULL,
	"xp_earned" integer NOT NULL,
	"gold_reward" integer NOT NULL,
	"loot_table" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reward_claim" text,
	"completed_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	"item_type" text NOT NULL,
	"quality" text NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"slot" text NOT NULL,
	"weapon_type" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"shop_price" integer,
	"is_purchasable" boolean DEFAULT true NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_fights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"fight_id" uuid NOT NULL,
	"solo_mode_enabled" boolean DEFAULT false NOT NULL,
	"assigned_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"joined_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"hidden_leaderboard_metrics" jsonb DEFAULT '[]'::jsonb,
	"enable_group_quests" boolean DEFAULT true NOT NULL,
	"enable_chat" boolean DEFAULT false NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "guild_settings_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"unlocked_tier" integer DEFAULT 1 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "guilds_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quest_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"period" text DEFAULT 'once' NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid,
	"student_id" uuid,
	"quest_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"rewards" jsonb DEFAULT '{}'::jsonb,
	"is_seeded" boolean DEFAULT false NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" bigint,
	"completed_week" integer,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_job_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"job_class" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"unlocked_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "combat_results" ADD CONSTRAINT "combat_results_session_id_live_combat_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_combat_sessions"("session_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combat_results" ADD CONSTRAINT "combat_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combat_results" ADD CONSTRAINT "combat_results_fight_id_fights_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combat_results" ADD CONSTRAINT "combat_results_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guild_fights" ADD CONSTRAINT "guild_fights_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guild_fights" ADD CONSTRAINT "guild_fights_fight_id_fights_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guild_memberships" ADD CONSTRAINT "guild_memberships_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guild_memberships" ADD CONSTRAINT "guild_memberships_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guild_settings" ADD CONSTRAINT "guild_settings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "live_combat_sessions" ADD CONSTRAINT "live_combat_sessions_solo_student_id_students_id_fk" FOREIGN KEY ("solo_student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_job_levels" ADD CONSTRAINT "student_job_levels_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "combat_results_session_student_unique" ON "combat_results" USING btree ("session_id","student_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "guildFights_pair_unique" ON "guild_fights" USING btree ("guild_id","fight_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "guildMemberships_pair_unique" ON "guild_memberships" USING btree ("guild_id","student_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "quest_completion_once" ON "quest_completions" USING btree ("quest_id","student_id","period");
--> statement-breakpoint
CREATE UNIQUE INDEX "studentJobLevels_pair_unique" ON "student_job_levels" USING btree ("student_id","job_class");
