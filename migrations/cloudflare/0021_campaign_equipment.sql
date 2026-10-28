-- Preserve campaign progress and make gear changes atomic with encounter admission.
CREATE OR REPLACE FUNCTION apply_campaign_action(p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
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
 IF p->'equipment' IS NOT NULL THEN
  UPDATE students SET
   job_loadouts=coalesce(job_loadouts,'{}'::jsonb)||jsonb_build_object(p->'equipment'->>'job',p->'equipment'->'loadout'),
   weapon=CASE WHEN character_class=p->'equipment'->>'job' THEN p->'equipment'->'loadout'->>'weapon' ELSE weapon END,
   offhand=CASE WHEN character_class=p->'equipment'->>'job' THEN p->'equipment'->'loadout'->>'offhand' ELSE offhand END,
   headgear=CASE WHEN character_class=p->'equipment'->>'job' THEN p->'equipment'->'loadout'->>'headgear' ELSE headgear END,
   armor=CASE WHEN character_class=p->'equipment'->>'job' THEN p->'equipment'->'loadout'->>'armor' ELSE armor END,
   arms=CASE WHEN character_class=p->'equipment'->>'job' THEN p->'equipment'->'loadout'->>'arms' ELSE arms END,
   hands=CASE WHEN character_class=p->'equipment'->>'job' THEN p->'equipment'->'loadout'->>'hands' ELSE hands END,
   legs=CASE WHEN character_class=p->'equipment'->>'job' THEN p->'equipment'->'loadout'->>'legs' ELSE legs END,
   feet=CASE WHEN character_class=p->'equipment'->>'job' THEN p->'equipment'->'loadout'->>'feet' ELSE feet END,
   loadout_revision=loadout_revision+1 WHERE id=s.id;
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
