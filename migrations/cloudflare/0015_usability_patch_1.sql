CREATE TABLE "question_attempts" (
	"session_id" text NOT NULL,
	"student_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"teacher_id" uuid NOT NULL,
	"fight_id" uuid NOT NULL,
	"guild_id" uuid,
	"job" text NOT NULL,
	"question_id" text NOT NULL,
	"question_version" text NOT NULL,
	"question" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"recorded_at" bigint NOT NULL,
	CONSTRAINT "question_attempts_session_id_student_id_round_pk" PRIMARY KEY("session_id","student_id","round"),
	CONSTRAINT "question_attempts_outcome_check" CHECK ("question_attempts"."outcome" IN ('correct','incorrect','unanswered'))
);
--> statement-breakpoint
CREATE TABLE "session_participants" (
	"session_id" text NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"fight_id" uuid NOT NULL,
	"guild_id" uuid,
	"nickname" text NOT NULL,
	"quiz_title" text NOT NULL,
	"job" text NOT NULL,
	"status" text NOT NULL,
	"victory" boolean,
	"survived" boolean NOT NULL,
	"totals" jsonb NOT NULL,
	"revision" integer NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "session_participants_session_id_student_id_pk" PRIMARY KEY("session_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_session_id_live_combat_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_combat_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_fight_id_fights_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_live_combat_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_combat_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_fight_id_fights_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_attempts_teacher_question_idx" ON "question_attempts" USING btree ("teacher_id","question_id","session_id");--> statement-breakpoint
CREATE INDEX "question_attempts_session_round_idx" ON "question_attempts" USING btree ("session_id","round");--> statement-breakpoint
CREATE INDEX "session_participants_teacher_session_idx" ON "session_participants" USING btree ("teacher_id","session_id");--> statement-breakpoint
CREATE INDEX "session_participants_guild_player_idx" ON "session_participants" USING btree ("guild_id","student_id");