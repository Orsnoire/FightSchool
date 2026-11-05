CREATE TABLE "math_template_revisions" (
	"template_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"mutation_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"preset" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"preview" jsonb NOT NULL,
	"state" text NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "math_template_revisions_template_id_revision_pk" PRIMARY KEY("template_id","revision"),
	CONSTRAINT "math_template_revisions_mutation_unique" UNIQUE("template_id","mutation_id"),
	CONSTRAINT "math_template_revisions_revision_check" CHECK ("math_template_revisions"."revision" > 0),
	CONSTRAINT "math_template_revisions_hashes_check" CHECK ("math_template_revisions"."content_hash" ~ '^[a-f0-9]{64}$' AND "math_template_revisions"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "math_template_revisions_objects_check" CHECK (jsonb_typeof("math_template_revisions"."preset") = 'object' AND jsonb_typeof("math_template_revisions"."preview") = 'object'),
	CONSTRAINT "math_template_revisions_approval_check" CHECK (("math_template_revisions"."state" = 'draft' AND "math_template_revisions"."approved_by" IS NULL AND "math_template_revisions"."approved_at" IS NULL) OR ("math_template_revisions"."state" = 'approved' AND "math_template_revisions"."approved_by" IS NOT NULL AND "math_template_revisions"."approved_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "math_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"teacher_id" uuid NOT NULL,
	"create_key" uuid NOT NULL,
	"latest_revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "math_templates_owner_create_unique" UNIQUE("teacher_id","create_key"),
	CONSTRAINT "math_templates_revision_check" CHECK ("math_templates"."latest_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "math_template_revisions" ADD CONSTRAINT "math_template_revisions_template_id_math_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."math_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "math_template_revisions" ADD CONSTRAINT "math_template_revisions_approved_by_teachers_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "math_templates" ADD CONSTRAINT "math_templates_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "math_templates_owner_idx" ON "math_templates" USING btree ("teacher_id","updated_at");