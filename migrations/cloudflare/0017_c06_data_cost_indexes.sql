CREATE INDEX "combat_results_student_history_idx" ON "combat_results" USING btree ("student_id","completed_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "combat_results_guild_history_idx" ON "combat_results" USING btree ("guild_id","completed_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "combat_results_fight_history_idx" ON "combat_results" USING btree ("fight_id","completed_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "guild_memberships_student_idx" ON "guild_memberships" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "quests_guild_student_idx" ON "quests" USING btree ("guild_id","student_id");