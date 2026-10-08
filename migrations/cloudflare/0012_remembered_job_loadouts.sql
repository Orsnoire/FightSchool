ALTER TABLE students ADD COLUMN job_loadouts jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE students ADD COLUMN loadout_revision integer NOT NULL DEFAULT 0;
