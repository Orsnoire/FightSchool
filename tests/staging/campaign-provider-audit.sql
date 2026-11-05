-- Read-only, parameterized psql audit AFTER an approved isolated browser run.
-- Supply campaign_id, student_id, teacher_id, guild_id and bank_id from that
-- run's private evidence.json. Verify the connection against the reviewed target
-- manifest first. Do not substitute classroom IDs or use a default DB target.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '10s';

-- Fail unless every supplied ID belongs to the same synthetic fixture.
SELECT 1 / CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS fixture_scope_verified
FROM campaigns c
JOIN teachers t ON t.id = c.teacher_id
JOIN guilds g ON g.id = c.guild_id AND g.teacher_id = t.id
JOIN guild_memberships gm ON gm.guild_id = g.id AND gm.student_id = :'student_id'::uuid
JOIN students s ON s.id = gm.student_id
JOIN fights f ON f.id = :'bank_id'::uuid AND f.teacher_id = t.id
WHERE c.id = :'campaign_id'::uuid AND c.teacher_id = :'teacher_id'::uuid
  AND c.guild_id = :'guild_id'::uuid AND c.name LIKE 'qa-campaign-%'
  AND t.email LIKE 'qa-campaign-%@example.invalid' AND s.nickname LIKE 'qa-campaign-%'
  AND NOT EXISTS (SELECT 1 FROM guild_memberships other WHERE other.guild_id = g.id AND other.student_id <> s.id);

-- Compare with the final browser/API snapshot: unchanged layout digest, key,
-- cleared=true, activeSessionId=null, and the same resource/progress revision.
SELECT c.id, c.revision AS gate_revision, c.gates, md5(c.layout::text) AS layout_digest,
       cp.revision AS progress_revision, cp.state
FROM campaigns c JOIN campaign_players cp ON cp.campaign_id = c.id
WHERE c.id = :'campaign_id'::uuid AND cp.student_id = :'student_id'::uuid;

-- Each row must have settled=true, completed status, exactly one receipt,
-- selected bank identity and expected objective/ordinary reward. Require two
-- distinct guardian sessions; do not mistake replay of one for a repeat win.
SELECT e.session_id, e.settled, e.fight_snapshot->'campaignContext' AS frozen_context,
       e.fight_snapshot->>'id' AS frozen_bank_id,
       jsonb_path_query_array(e.fight_snapshot, '$.questions[*].id') AS question_ids,
       l.status, l.fight_id AS session_bank_id, r.id AS result_id, r.victory,
       r.fight_id AS result_bank_id, r.stamina_day, r.stamina_fight_number,
       r.xp_multiplier, r.stamina_restored, r.xp_earned,
       count(r.id) OVER (PARTITION BY e.session_id, e.student_id) AS result_count
FROM campaign_encounters e
JOIN live_combat_sessions l ON l.session_id = e.session_id
LEFT JOIN combat_results r ON r.session_id = e.session_id AND r.student_id = e.student_id
WHERE e.campaign_id = :'campaign_id'::uuid AND e.student_id = :'student_id'::uuid
ORDER BY r.stamina_fight_number, e.session_id;

-- Direct provider check of the persistent curve position. Compare this result
-- with the last /stamina response before Denver midnight, then repeat this entire
-- read-only audit after completed-room replay to establish unchanged values.
SELECT id, stamina_day, daily_combats, stamina_recovery, xp_remainder, gold,
       0.01 + 0.99 * exp(-(-ln(0.89 / 0.99)) * power(greatest(0, daily_combats - stamina_recovery),
         ln(ln(990) / (-ln(0.89 / 0.99))) / ln(10))) AS next_xp_multiplier
FROM students WHERE id = :'student_id'::uuid;
COMMIT;
