CREATE TABLE "student_activity_receipts" (
	"student_id" uuid NOT NULL,
	"pulse_id" uuid NOT NULL,
	"bucket_start" bigint NOT NULL,
	CONSTRAINT "student_activity_receipts_student_id_pulse_id_pk" PRIMARY KEY("student_id","pulse_id")
);
--> statement-breakpoint
CREATE TABLE "student_activity_samples" (
	"student_id" uuid NOT NULL,
	"bucket_start" bigint NOT NULL,
	"pulse_id" uuid NOT NULL,
	CONSTRAINT "student_activity_samples_student_id_bucket_start_pk" PRIMARY KEY("student_id","bucket_start"),
	CONSTRAINT "student_activity_bucket_check" CHECK ("student_activity_samples"."bucket_start" >= 0 AND "student_activity_samples"."bucket_start" % 30000 = 0)
);
--> statement-breakpoint
CREATE TABLE "student_activity_tracking" (
	"student_id" uuid PRIMARY KEY NOT NULL,
	"started_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_activity_receipts" ADD CONSTRAINT "student_activity_receipts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activity_samples" ADD CONSTRAINT "student_activity_samples_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_activity_tracking" ADD CONSTRAINT "student_activity_tracking_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_activity_receipts_retention_idx" ON "student_activity_receipts" USING btree ("student_id","bucket_start");--> statement-breakpoint
CREATE UNIQUE INDEX "student_activity_pulse_unique" ON "student_activity_samples" USING btree ("student_id","pulse_id");--> statement-breakpoint
CREATE INDEX "question_attempts_guild_recent_idx" ON "question_attempts" USING btree ("guild_id","recorded_at","student_id");