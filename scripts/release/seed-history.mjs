import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateIsolation } from './fixture-cleanup.mjs';
import { questionKey } from '../../worker/progression/question-key.ts';
import { getTotalXPForLevel } from '../../shared/jobSystem.ts';

// Test tooling only: never imported by the application. The caller supplies one
// pinned SQL connection so BEGIN/COMMIT and every guard share a transaction.
export async function seedHistory({ query, fixtures, target, databaseUrl, productionHosts,
  teacherId, guildId, fightId, studentIds, history = 100 }) {
  const m = fixtures.manifest;
  assert.ok(Array.isArray(productionHosts) && productionHosts.length > 0, 'Independent production endpoint inventory required');
  for (const host of productionHosts) validateIsolation(target, m, databaseUrl, host);
  assert.ok([30, 60].includes(studentIds.length), 'Only bounded classroom history is supported');
  assert.equal(new Set(studentIds).size, studentIds.length);
  assert.equal(history, 100, 'Representative fixture requires 100 prior results per learner');
  assert.ok(m.teachers.some(t => t.id === teacherId) && m.guilds.includes(guildId) && m.fights.includes(fightId));
  assert.ok(studentIds.every(id => m.students.some(s => s.id === id)));
  const sessions = Array.from({ length: history }, () => randomUUID());
  const intent = fixtures.beginHistory(sessions);
  await query('BEGIN');
  try {
    const teacher = (await query('SELECT email_normalized AS alias FROM teachers WHERE id=$1 FOR SHARE', [teacherId])).rows;
    assert.equal(teacher.length, 1);
    assert.equal(teacher[0].alias, m.teachers.find(t => t.id === teacherId).alias, 'Teacher identity changed');
    const students = (await query('SELECT id,nickname_normalized AS alias,character_class FROM students WHERE id=ANY($1::uuid[]) FOR SHARE', [studentIds])).rows;
    assert.equal(students.length, studentIds.length);
    for (const s of students) {
      assert.equal(s.alias, m.students.find(x => x.id === s.id).alias, 'Student identity changed');
      assert.ok(['warrior','wizard','scout','herbalist'].includes(s.character_class));
    }
    const guild = (await query('SELECT teacher_id FROM guilds WHERE id=$1 FOR SHARE', [guildId])).rows;
    assert.equal(guild[0]?.teacher_id, teacherId, 'Foreign guild');
    const fight = (await query('SELECT teacher_id,questions FROM fights WHERE id=$1 FOR SHARE', [fightId])).rows;
    assert.equal(fight[0]?.teacher_id, teacherId, 'Foreign fight');
    assert.equal(fight[0].questions.length, 20);
    const members = (await query('SELECT student_id FROM guild_memberships WHERE guild_id=$1 FOR SHARE', [guildId])).rows;
    assert.deepEqual(members.map(s => s.student_id).sort(), [...studentIds].sort(), 'Guild membership must be exactly this run');
    assert.equal((await query('SELECT 1 FROM guild_fights WHERE guild_id=$1 AND fight_id=$2', [guildId,fightId])).rows.length, 1);
    assert.equal((await query('SELECT 1 FROM combat_results WHERE student_id=ANY($1::uuid[]) LIMIT 1', [studentIds])).rows.length, 0, 'History only seeds fresh run-owned learners');
    await query(`INSERT INTO live_combat_sessions(session_id,fight_id,teacher_id,guild_id,status)
      SELECT id,$2,$3,$4,'completed' FROM unnest($1::text[]) AS id`, [sessions,fightId,teacherId,guildId]);
    const totals = JSON.stringify({damageDealt:100,damageBlocked:10,healingDone:20,questionsAnswered:20,questionsCorrect:15,questionsIncorrect:5,accuracy:75});
    const inserted = await query(`INSERT INTO combat_results(session_id,student_id,fight_id,guild_id,character_class,victory,survived,is_solo_mode,totals,xp_earned,gold_reward,loot_table,reward_claim,completed_at)
      SELECT l.session_id,s.id,l.fight_id,l.guild_id,s.character_class,true,true,false,$3::jsonb,0,0,'[]','automatic',1700000000000
      FROM live_combat_sessions l CROSS JOIN students s WHERE l.session_id=ANY($1::text[]) AND s.id=ANY($2::uuid[]) RETURNING id`, [sessions,studentIds,totals]);
    assert.equal(inserted.rows.length, history * studentIds.length);
    const keys = fight[0].questions.map(questionKey);
    const evidence = await query(`INSERT INTO quest_fight_evidence(session_id,student_id,guild_id,fight_id,is_solo_mode,victory,answered,correct,correct_keys,bank_keys,revision,updated_at)
      SELECT session_id,student_id,guild_id,fight_id,false,true,20,15,$2::jsonb,$3::jsonb,1,completed_at FROM combat_results WHERE session_id=ANY($1::text[]) RETURNING student_id`,
      [sessions.filter((_,i) => i % 2 === 0),JSON.stringify(keys.slice(0,15)),JSON.stringify(keys)]);
    assert.equal(evidence.rows.length, history * studentIds.length / 2);
    // Level-four starter jobs exercise class abilities without unlocking advanced jobs.
    await query(`INSERT INTO student_job_levels(student_id,job_class,level,experience)
      SELECT id,character_class,4,$2 FROM students WHERE id=ANY($1::uuid[])
      ON CONFLICT(student_id,job_class) DO UPDATE SET level=4,experience=EXCLUDED.experience`, [studentIds,getTotalXPForLevel(4)]);
    await query('COMMIT');
    const counts = { sessions:history, results:inserted.rows.length, evidence:evidence.rows.length, perStudent:history, jobLevel:4 };
    fixtures.finishHistory(intent, counts);
    return counts;
  } catch (error) {
    // Even if ROLLBACK succeeds, an ambiguous COMMIT may have persisted. Retain
    // the journal intent rather than guessing that nothing was written.
    try { await query('ROLLBACK'); } catch { /* original error and journal survive */ }
    throw error;
  }
}
