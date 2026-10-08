ALTER TABLE fights ADD COLUMN encounter_tier integer CHECK(encounter_tier BETWEEN 1 AND 4);
-- Preserve earned progression and existing guild ceilings. New guilds start at tier 1.
ALTER TABLE guilds ADD COLUMN limit_tier integer NOT NULL DEFAULT 4 CHECK(limit_tier BETWEEN 1 AND 4);
ALTER TABLE guilds ALTER COLUMN limit_tier SET DEFAULT 1;
ALTER TABLE students ADD COLUMN granted_jobs jsonb NOT NULL DEFAULT '[]';
ALTER TABLE students ADD COLUMN aa_experience integer NOT NULL DEFAULT 0 CHECK(aa_experience >= 0);
ALTER TABLE live_combat_sessions ADD COLUMN guild_id uuid REFERENCES guilds(id);
ALTER TABLE live_combat_sessions ADD COLUMN guild_limit_tier integer CHECK(guild_limit_tier BETWEEN 1 AND 4);
ALTER TABLE quests ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
CREATE TABLE quest_fight_evidence (
 session_id text NOT NULL REFERENCES live_combat_sessions(session_id), student_id uuid NOT NULL REFERENCES students(id),
 guild_id uuid NOT NULL REFERENCES guilds(id), fight_id uuid NOT NULL REFERENCES fights(id),
 is_solo_mode boolean NOT NULL, victory boolean NOT NULL DEFAULT false,
 answered integer NOT NULL, correct integer NOT NULL, correct_keys jsonb NOT NULL DEFAULT '[]', bank_keys jsonb NOT NULL DEFAULT '[]',
 revision integer NOT NULL DEFAULT 0, updated_at bigint NOT NULL,
 PRIMARY KEY(session_id,student_id)
);
CREATE INDEX quest_evidence_guild_student ON quest_fight_evidence(guild_id,student_id);
-- Character-wide receipts prevent re-awarding seeded personal milestones in another guild.
CREATE TABLE personal_quest_receipts (
 student_id uuid NOT NULL REFERENCES students(id), milestone text NOT NULL,
 PRIMARY KEY(student_id,milestone)
);
INSERT INTO personal_quest_receipts(student_id,milestone)
 SELECT DISTINCT c.student_id,q.title FROM quest_completions c JOIN quests q ON q.id=c.quest_id WHERE q.is_seeded AND q.student_id IS NOT NULL
 ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION award_quest_batch(guild uuid, payload jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE entry jsonb; q quests%ROWTYPE; recipient uuid; period_key text; receipt uuid; fresh boolean; active_guild guilds%ROWTYPE;
BEGIN
 SELECT * INTO active_guild FROM guilds WHERE id=guild FOR UPDATE;
 IF NOT FOUND OR active_guild.is_archived THEN RETURN; END IF;
 -- All quest writers take this guild lock, then student locks in the same order as combat awards.
 PERFORM id FROM students WHERE id IN(SELECT (jsonb_array_elements_text(e->'recipients'))::uuid FROM jsonb_array_elements(payload) e) ORDER BY id FOR UPDATE;
 FOR entry IN SELECT value FROM jsonb_array_elements(payload) ORDER BY value->>'id' LOOP
  SELECT * INTO q FROM quests WHERE id=(entry->>'id')::uuid AND guild_id=guild AND NOT is_archived FOR UPDATE;
  IF NOT FOUND THEN CONTINUE; END IF;
  period_key:=entry->>'period';
  fresh:=NOT q.is_completed OR (q.quest_type='weekly' AND q.completed_week IS DISTINCT FROM CASE WHEN q.quest_type='weekly' THEN period_key::integer ELSE NULL END);
  IF fresh THEN
   UPDATE quests SET is_completed=true,completed_at=(extract(epoch from now())*1000)::bigint,
    completed_week=CASE WHEN q.quest_type='weekly' THEN period_key::integer ELSE NULL END WHERE id=q.id;
   UPDATE guilds SET experience=experience+COALESCE((q.rewards->>'guildXP')::integer,0),
    unlocked_tier=GREATEST(unlocked_tier,COALESCE((q.rewards->>'unlockTier')::integer,1)),
    limit_tier=GREATEST(limit_tier,CASE WHEN q.quest_type='guild' AND q.student_id IS NULL THEN COALESCE((q.rewards->>'limitBreak')::integer,1) ELSE 1 END)
    WHERE id=guild;
  END IF;
  FOR recipient IN SELECT value::uuid FROM jsonb_array_elements_text(entry->'recipients') ORDER BY value LOOP
   IF NOT EXISTS(SELECT 1 FROM guild_memberships WHERE guild_id=guild AND student_id=recipient) THEN CONTINUE; END IF;
   IF q.student_id IS NOT NULL AND q.student_id<>recipient THEN CONTINUE; END IF;
   receipt:=NULL;
   INSERT INTO quest_completions(quest_id,student_id,period) VALUES(q.id,recipient,period_key) ON CONFLICT DO NOTHING RETURNING id INTO receipt;
   IF receipt IS NULL THEN CONTINUE; END IF;
   IF q.is_seeded AND q.student_id IS NOT NULL THEN
    INSERT INTO personal_quest_receipts(student_id,milestone) VALUES(recipient,q.title) ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;
   END IF;
   UPDATE students SET gold=gold+COALESCE((q.rewards->>'gold')::integer,0),
    inventory=CASE WHEN q.rewards->>'equipmentItemId' IS NOT NULL AND NOT inventory @> jsonb_build_array(q.rewards->>'equipmentItemId') THEN inventory||jsonb_build_array(q.rewards->>'equipmentItemId') ELSE inventory END,
    granted_jobs=CASE WHEN q.rewards->>'unlockJob' IS NOT NULL AND NOT granted_jobs @> jsonb_build_array(q.rewards->>'unlockJob') THEN granted_jobs||jsonb_build_array(q.rewards->>'unlockJob') ELSE granted_jobs END
    WHERE id=recipient;
  END LOOP;
 END LOOP;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION award_combat_results_with_stamina(payload jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r record;
  student_row students%ROWTYPE;
  day_key text;
  completed integer;
  multiplier double precision;
  precise_xp double precision;
  earned integer;
  job_earned integer;
  existing_xp integer;
  cap_xp integer;
  rate CONSTANT double precision := -ln(0.89 / 0.99);
  power CONSTANT double precision := ln(ln(990.0) / (-ln(0.89 / 0.99))) / ln(10.0);
BEGIN
  day_key := to_char(CURRENT_TIMESTAMP AT TIME ZONE 'America/Denver', 'YYYY-MM-DD');
  FOR r IN SELECT * FROM jsonb_to_recordset(payload) AS x(
    session_id text, student_id uuid, fight_id uuid, guild_id uuid,
    character_class text, victory boolean, survived boolean, is_solo_mode boolean,
    totals jsonb, base_xp double precision, gold_reward integer, loot_table jsonb,
    reward_claim text, participated boolean, level_cap integer, eligible_progression boolean
  ) ORDER BY student_id LOOP
    SELECT * INTO student_row FROM students WHERE id = r.student_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM combat_results WHERE session_id = r.session_id AND student_id = r.student_id) THEN CONTINUE; END IF;
    completed := CASE WHEN student_row.stamina_day = day_key THEN student_row.daily_combats ELSE 0 END;
    multiplier := 0.01 + 0.99 * exp(-rate * (completed::double precision ^ power));
    precise_xp := CASE WHEN r.participated THEN greatest(0, r.base_xp) * multiplier + student_row.xp_remainder ELSE student_row.xp_remainder END;
    earned := CASE WHEN COALESCE(r.eligible_progression,true) THEN floor(precise_xp) ELSE 0 END;
    SELECT experience INTO existing_xp FROM student_job_levels WHERE student_id=r.student_id AND job_class=r.character_class;
    cap_xp := CASE WHEN r.level_cap IS NULL THEN 2147483647 ELSE 3*r.level_cap*(r.level_cap-1) END;
    job_earned := least(earned,greatest(0,cap_xp-COALESCE(existing_xp,0)));
    INSERT INTO combat_results(session_id,student_id,fight_id,guild_id,character_class,victory,survived,is_solo_mode,totals,xp_earned,gold_reward,loot_table,reward_claim,base_xp,xp_multiplier,stamina_fight_number,stamina_day)
    VALUES(r.session_id,r.student_id,r.fight_id,r.guild_id,r.character_class,r.victory,r.survived,r.is_solo_mode,r.totals,earned,r.gold_reward,r.loot_table,r.reward_claim,r.base_xp,multiplier,CASE WHEN r.participated THEN completed+1 ELSE NULL END,day_key);
    INSERT INTO student_job_levels(student_id,job_class,experience,level)
    VALUES(r.student_id,r.character_class,job_earned,1)
    ON CONFLICT(student_id,job_class) DO UPDATE SET experience=student_job_levels.experience+EXCLUDED.experience;
    UPDATE students SET
      aa_experience=aa_experience+(earned-job_earned),
      gold=gold+CASE WHEN r.reward_claim='automatic' THEN r.gold_reward ELSE 0 END,
      stamina_day=day_key,
      daily_combats=completed+CASE WHEN r.participated THEN 1 ELSE 0 END,
      xp_remainder=precise_xp-floor(precise_xp)
    WHERE id=r.student_id;
  END LOOP;
END;
$$;
