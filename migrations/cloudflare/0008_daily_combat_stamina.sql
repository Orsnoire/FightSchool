ALTER TABLE students ADD COLUMN stamina_day text;
ALTER TABLE students ADD COLUMN daily_combats integer NOT NULL DEFAULT 0 CHECK (daily_combats >= 0);
ALTER TABLE students ADD COLUMN xp_remainder double precision NOT NULL DEFAULT 0 CHECK (xp_remainder >= 0 AND xp_remainder < 1);
ALTER TABLE combat_results ADD COLUMN base_xp integer NOT NULL DEFAULT 0;
ALTER TABLE combat_results ADD COLUMN xp_multiplier double precision NOT NULL DEFAULT 1;
ALTER TABLE combat_results ADD COLUMN stamina_fight_number integer;
ALTER TABLE combat_results ADD COLUMN stamina_day text;
UPDATE combat_results SET base_xp = xp_earned;
--> statement-breakpoint
-- One transaction locks recipients in a stable order across simultaneous rooms.
-- A duplicate result is checked after the lock, before stamina or currency changes.
-- Do not expose this function through an unauthenticated/client-selected XP route.
CREATE FUNCTION award_combat_results_with_stamina(payload jsonb) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r record;
  student_row students%ROWTYPE;
  day_key text;
  completed integer;
  multiplier double precision;
  precise_xp double precision;
  earned integer;
  rate CONSTANT double precision := -ln(0.89 / 0.99);
  power CONSTANT double precision := ln(ln(990.0) / (-ln(0.89 / 0.99))) / ln(10.0);
BEGIN
  day_key := to_char(CURRENT_TIMESTAMP AT TIME ZONE 'America/Denver', 'YYYY-MM-DD');
  FOR r IN SELECT * FROM jsonb_to_recordset(payload) AS x(
    session_id text, student_id uuid, fight_id uuid, guild_id uuid,
    character_class text, victory boolean, survived boolean, is_solo_mode boolean,
    totals jsonb, base_xp integer, gold_reward integer, loot_table jsonb,
    reward_claim text, participated boolean
  ) ORDER BY student_id LOOP
    SELECT * INTO student_row FROM students WHERE id = r.student_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM combat_results WHERE session_id = r.session_id AND student_id = r.student_id) THEN CONTINUE; END IF;
    completed := CASE WHEN student_row.stamina_day = day_key THEN student_row.daily_combats ELSE 0 END;
    multiplier := 0.01 + 0.99 * exp(-rate * (completed::double precision ^ power));
    precise_xp := CASE WHEN r.participated THEN greatest(0, r.base_xp) * multiplier + student_row.xp_remainder ELSE student_row.xp_remainder END;
    earned := floor(precise_xp);
    INSERT INTO combat_results(session_id,student_id,fight_id,guild_id,character_class,victory,survived,is_solo_mode,totals,xp_earned,gold_reward,loot_table,reward_claim,base_xp,xp_multiplier,stamina_fight_number,stamina_day)
    VALUES(r.session_id,r.student_id,r.fight_id,r.guild_id,r.character_class,r.victory,r.survived,r.is_solo_mode,r.totals,earned,r.gold_reward,r.loot_table,r.reward_claim,r.base_xp,multiplier,CASE WHEN r.participated THEN completed+1 ELSE NULL END,day_key);
    INSERT INTO student_job_levels(student_id,job_class,experience,level)
    VALUES(r.student_id,r.character_class,earned,1)
    ON CONFLICT(student_id,job_class) DO UPDATE SET experience=student_job_levels.experience+EXCLUDED.experience;
    UPDATE students SET
      gold=gold+CASE WHEN r.reward_claim='automatic' THEN r.gold_reward ELSE 0 END,
      stamina_day=day_key,
      daily_combats=completed+CASE WHEN r.participated THEN 1 ELSE 0 END,
      xp_remainder=precise_xp-earned
    WHERE id=r.student_id;
  END LOOP;
END;
$$;
