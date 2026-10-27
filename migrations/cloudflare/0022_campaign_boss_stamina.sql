ALTER TABLE "combat_results" ADD COLUMN "stamina_restored" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "stamina_recovery" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_stamina_recovery_check" CHECK ("students"."stamina_recovery" >= 0 AND "students"."stamina_recovery" < 'Infinity'::double precision);
--> statement-breakpoint
-- Preserve all existing results, XP and daily counts. Zero recovery retains the
-- original curve. Boss eligibility is supplied only by the server-frozen campaign.
CREATE OR REPLACE FUNCTION award_combat_results_with_stamina(payload jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r record;
  student_row students%ROWTYPE;
  day_key text;
  completed integer;
  recovery double precision;
  position double precision;
  post_multiplier double precision;
  restored double precision;
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
    reward_claim text, participated boolean, level_cap integer, eligible_progression boolean, campaign_boss boolean
  ) ORDER BY student_id LOOP
    SELECT * INTO student_row FROM students WHERE id = r.student_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM combat_results WHERE session_id = r.session_id AND student_id = r.student_id) THEN CONTINUE; END IF;
    completed := CASE WHEN student_row.stamina_day = day_key THEN student_row.daily_combats ELSE 0 END;
    recovery := CASE WHEN student_row.stamina_day = day_key THEN student_row.stamina_recovery ELSE 0 END;
    position := greatest(0, completed - recovery);
    multiplier := 0.01 + 0.99 * exp(-rate * (position ^ power));
    restored := 0;
    -- First price this result normally. Restore stamina for subsequent fights,
    -- atomically with the same session/student receipt, never on a retry.
    IF r.campaign_boss AND r.victory AND r.participated AND coalesce(r.eligible_progression,true) THEN
      post_multiplier := 0.01 + 0.99 * exp(-rate * ((position + 1) ^ power));
      restored := least(0.2, greatest(0, 1 - post_multiplier));
      post_multiplier := least(1, post_multiplier + restored);
      -- Invert the existing curve: future decay resumes at this recovered position.
      -- The actual fight count remains an integer audit count, never a stamina proxy.
      position := CASE WHEN post_multiplier >= 1 THEN 0
        ELSE (-ln((post_multiplier - 0.01) / 0.99) / rate) ^ (1 / power) END;
      recovery := completed + 1 - position;
    END IF;
    precise_xp := CASE WHEN r.participated THEN greatest(0, r.base_xp) * multiplier + student_row.xp_remainder ELSE student_row.xp_remainder END;
    earned := CASE WHEN COALESCE(r.eligible_progression,true) THEN floor(precise_xp) ELSE 0 END;
    SELECT experience INTO existing_xp FROM student_job_levels WHERE student_id=r.student_id AND job_class=r.character_class;
    cap_xp := CASE WHEN r.level_cap IS NULL THEN 2147483647 ELSE 3*r.level_cap*(r.level_cap-1) END;
    job_earned := least(earned,greatest(0,cap_xp-COALESCE(existing_xp,0)));
    INSERT INTO combat_results(session_id,student_id,fight_id,guild_id,character_class,victory,survived,is_solo_mode,totals,xp_earned,gold_reward,loot_table,reward_claim,base_xp,xp_multiplier,stamina_fight_number,stamina_day,stamina_restored)
    VALUES(r.session_id,r.student_id,r.fight_id,r.guild_id,r.character_class,r.victory,r.survived,r.is_solo_mode,r.totals,earned,r.gold_reward,r.loot_table,r.reward_claim,r.base_xp,multiplier,CASE WHEN r.participated THEN completed+1 ELSE NULL END,day_key,restored);
    INSERT INTO student_job_levels(student_id,job_class,experience,level)
    VALUES(r.student_id,r.character_class,job_earned,1)
    ON CONFLICT(student_id,job_class) DO UPDATE SET experience=student_job_levels.experience+EXCLUDED.experience;
    UPDATE students SET
      aa_experience=aa_experience+(earned-job_earned),
      gold=gold+CASE WHEN r.reward_claim='automatic' THEN r.gold_reward ELSE 0 END,
      stamina_day=day_key,
      stamina_recovery=recovery,
      daily_combats=completed+CASE WHEN r.participated THEN 1 ELSE 0 END,
      xp_remainder=precise_xp-floor(precise_xp)
    WHERE id=r.student_id;
  END LOOP;
END;
$$;
