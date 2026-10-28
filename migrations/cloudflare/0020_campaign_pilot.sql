CREATE TABLE "campaign_encounters" (
	"session_id" text PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"fight_snapshot" jsonb NOT NULL,
	"player_snapshot" jsonb NOT NULL,
	"settled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_players" (
	"campaign_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"state" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_players_campaign_id_student_id_pk" PRIMARY KEY("campaign_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"guild_id" uuid NOT NULL,
	"fight_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dungeon_name" text NOT NULL,
	"theme" text DEFAULT 'normal_cave' NOT NULL,
	"gates" jsonb NOT NULL,
	"layout" jsonb NOT NULL,
	"fight_snapshot" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_encounters" ADD CONSTRAINT "campaign_encounters_session_id_live_combat_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_combat_sessions"("session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_encounters" ADD CONSTRAINT "campaign_encounters_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_encounters" ADD CONSTRAINT "campaign_encounters_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_players" ADD CONSTRAINT "campaign_players_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_players" ADD CONSTRAINT "campaign_players_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_fight_id_fights_id_fk" FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_encounters_player_idx" ON "campaign_encounters" USING btree ("campaign_id","student_id");--> statement-breakpoint
CREATE INDEX "campaign_players_student_idx" ON "campaign_players" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "campaigns_guild_idx" ON "campaigns" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "campaigns_teacher_idx" ON "campaigns" USING btree ("teacher_id");
--> statement-breakpoint
-- Worker-only command boundary. State/effects are calculated by authenticated server code.
-- Locks serialize movement, purchases and encounter creation across tabs and Workers.
CREATE FUNCTION apply_campaign_action(p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c campaigns%ROWTYPE; g guilds%ROWTYPE; s students%ROWTYPE; r campaign_players%ROWTYPE;
BEGIN
 SELECT * INTO c FROM campaigns WHERE id=(p->>'campaign')::uuid FOR SHARE;
 SELECT * INTO g FROM guilds WHERE id=c.guild_id FOR SHARE;
 IF c.id IS NULL OR g.is_archived OR NOT EXISTS(SELECT 1 FROM guild_memberships WHERE guild_id=g.id AND student_id=(p->>'student')::uuid) THEN
  RETURN jsonb_build_object('error','Campaign unavailable');
 END IF;
 SELECT * INTO s FROM students WHERE id=(p->>'student')::uuid FOR UPDATE;
 SELECT * INTO r FROM campaign_players WHERE campaign_id=c.id AND student_id=s.id FOR UPDATE;
 IF r.state->>'lastCommandId'=p->>'command' THEN RETURN jsonb_build_object('ok',true); END IF;
 IF r.campaign_id IS NULL OR r.revision<>(p->>'revision')::integer OR c.revision<>(p->>'campaignRevision')::integer OR s.loadout_revision<>(p->>'loadoutRevision')::integer OR r.state->>'activeSessionId' IS NOT NULL THEN
  RETURN jsonb_build_object('error','Adventure changed. Refresh and try again.');
 END IF;
 IF p->'purchase' IS NOT NULL THEN
  IF (p->'purchase'->>'tier')::integer>g.unlocked_tier OR (p->'purchase'->>'price')::integer<0 OR s.gold<(p->'purchase'->>'price')::integer OR s.inventory @> jsonb_build_array(p->'purchase'->>'id') THEN
   RETURN jsonb_build_object('error','Item unavailable, already owned, or not enough gold');
  END IF;
  UPDATE students SET gold=gold-(p->'purchase'->>'price')::integer, inventory=inventory||jsonb_build_array(p->'purchase'->>'id') WHERE id=s.id;
 END IF;
 IF p->'encounter' IS NOT NULL THEN
  INSERT INTO live_combat_sessions(session_id,fight_id,teacher_id,solo_student_id,guild_id,guild_limit_tier,status)
   VALUES(p->'encounter'->>'id',c.fight_id,c.teacher_id,s.id,c.guild_id,1,'waiting');
  INSERT INTO campaign_encounters(session_id,campaign_id,student_id,fight_snapshot,player_snapshot)
   VALUES(p->'encounter'->>'id',c.id,s.id,p->'encounter'->'fight',p->'encounter'->'player');
 END IF;
 UPDATE campaign_players SET state=(p->'state')||jsonb_build_object('lastCommandId',p->>'command'),revision=revision+1,updated_at=now() WHERE campaign_id=c.id AND student_id=s.id;
 RETURN jsonb_build_object('ok',true);
END $$;
--> statement-breakpoint
-- Retried by the combat room's durable completion outbox; never accepts browser HP.
CREATE FUNCTION settle_campaign_encounter(p jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE e campaign_encounters%ROWTYPE; r campaign_players%ROWTYPE; c campaigns%ROWTYPE; next_state jsonb;
BEGIN
 SELECT * INTO e FROM campaign_encounters WHERE session_id=p->>'session' FOR UPDATE;
 IF e.session_id IS NULL OR e.settled THEN RETURN; END IF;
 SELECT * INTO r FROM campaign_players WHERE campaign_id=e.campaign_id AND student_id=e.student_id FOR UPDATE;
 IF r.state->>'activeSessionId' IS DISTINCT FROM e.session_id THEN RAISE EXCEPTION 'Campaign session mismatch'; END IF;
 SELECT * INTO c FROM campaigns WHERE id=e.campaign_id;
 next_state=r.state||jsonb_build_object('health',greatest(0,least((r.state->>'maxHealth')::integer,(p->>'health')::integer)),
  'mp',greatest(0,least((r.state->>'maxMp')::integer,(p->>'mp')::integer)),
  'healingPotions',greatest(0,least(5,(p->>'healingPotions')::integer)),
  'shieldPotions',greatest(0,least(3,(p->>'shieldPotions')::integer)), 'activeSessionId',NULL,
  'cleared',coalesce((r.state->>'cleared')::boolean,false) OR (coalesce((p->>'victory')::boolean,false) AND coalesce((e.fight_snapshot->'campaignContext'->>'objective')::boolean,false)));
 IF (p->>'health')::integer<=0 THEN
  next_state=next_state||jsonb_build_object('zone','overworld','position',c.layout->'overworld'->'spawn');
 END IF;
 UPDATE campaign_players SET state=next_state,revision=revision+1,updated_at=now() WHERE campaign_id=e.campaign_id AND student_id=e.student_id;
 UPDATE campaign_encounters SET settled=true WHERE session_id=e.session_id;
END $$;
