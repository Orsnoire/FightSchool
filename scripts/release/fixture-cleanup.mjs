import assert from 'node:assert/strict';
import { liveOrigins, isolationUuid as uuid, rehearsalOrigin, validateDatabaseEndpoint } from './isolation.mjs';
export function validateManifest(m) {
  assert.equal(m.schemaVersion, 1);
  assert.ok(Array.isArray(m.pending) && m.pending.length === 0, 'Unresolved creation intent: reconcile exact request/identity before cleanup');
  assert.match(m.runId, uuid);
  assert.equal(m.suffix, `c12-${m.runId}`);
  assert.equal(m.mode, 'isolated', 'Cleanup never accepts a live fixture manifest');
  assert.ok(!liveOrigins.has(m.origin), 'Classroom origins cannot be cleaned by this tool');
  assert.ok(['passed', 'failed', 'running'].includes(m.status));
  for (const kind of ['teachers', 'students']) {
    assert.ok(Array.isArray(m[kind]));
    for (const row of m[kind]) {
      assert.match(row.id, uuid);
      assert.ok(row.alias.includes(m.suffix), 'Identity is not owned by this run');
      if (kind === 'teachers') assert.ok(row.alias.endsWith('@example.invalid'));
    }
  }
  for (const kind of ['fights', 'guilds', 'equipment']) {
    assert.ok(Array.isArray(m[kind]));
    for (const id of m[kind]) assert.match(id, uuid);
  }
  assert.ok(Array.isArray(m.sessions));
  for (const id of m.sessions) assert.match(id, /^[A-Za-z0-9_-]{1,64}$/);
  assert.ok(Array.isArray(m.objects));
  for (const key of m.objects) {
    const parts = key.split('/');
    assert.equal(parts.length, 2); parts.forEach(id => assert.match(id, uuid));
    assert.ok(m.teachers.some(t => t.id === parts[0]), 'R2 key belongs to another owner');
  }
  return m;
}
export function validateIsolation(target, manifest, databaseUrl, productionHost) {
  validateManifest(manifest);
  assert.match(target.id, uuid);
  assert.equal(manifest.isolationId, target.id);
  assert.equal(target.workerName, `questacademy-rehearsal-${target.id.slice(0,8)}`);
  assert.equal(target.bucketName, target.workerName);
  assert.match(target.cloudflareAccountId ?? '', /^[a-f0-9]{32}$/, 'Cloudflare account ID is required in the independent inventory');
  assert.equal(target.origin, manifest.origin);
  rehearsalOrigin(target.origin, target.id);
  assert.match(target.neonBranchId, /^br-[a-z0-9-]+$/);
  validateDatabaseEndpoint(databaseUrl, target.databaseHost, productionHost);
  return target;
}

// Caller must validate the independently configured database/Worker/R2 target first.
// All SQL identifiers below are constants. Manifest values are bound parameters.
// This function is also exercised against migrated, populated disposable PostgreSQL.
export async function cleanupDatabase(query, manifest, { apply = false } = {}) {
  const m = validateManifest(manifest);
  const scopes = { T: m.teachers.map(x=>x.id), S: m.students.map(x=>x.id), F: m.fights, G: m.guilds, E: m.equipment, L: m.sessions };
  const relations = [
    ['fights', {id:'F',teacher_id:'T'}], ['guilds', {id:'G',teacher_id:'T'}],
    ['equipment_items', {id:'E',teacher_id:'T'}], ['students', {id:'S',guild_id:'G'}],
    ['live_combat_sessions', {session_id:'L',fight_id:'F',teacher_id:'T',guild_id:'G',solo_student_id:'S'}],
    ['guild_memberships', {student_id:'S',guild_id:'G'}], ['guild_fights', {fight_id:'F',guild_id:'G'}],
    ...['combat_results','quest_fight_evidence'].map(t=>[t,{session_id:'L',student_id:'S',fight_id:'F',guild_id:'G'}]),
    ...['session_participants','question_attempts'].map(t=>[t,{session_id:'L',student_id:'S',fight_id:'F',guild_id:'G',teacher_id:'T'}]),
    ['quests', {student_id:'S',guild_id:'G'}],
  ];
  const counts = {};
  await query('BEGIN');
  try {
    // Block competing writes during inspection/deletion. The CLI additionally
    // requires the isolated Worker to be absent before opening this transaction.
    await query('LOCK TABLE teachers, students, fights, guilds, equipment_items, live_combat_sessions, guild_memberships, guild_fights, combat_results, quest_fight_evidence, session_participants, question_attempts, quests, quest_completions, app_sessions, personal_quest_receipts, guild_settings, avatar_equipment IN SHARE ROW EXCLUSIVE MODE');
    for (const [table, column, kind] of [['teachers','email_normalized','teachers'], ['students','nickname_normalized','students']]) {
      const { rows } = await query(`SELECT id, ${column} AS alias FROM ${table} WHERE id = ANY($1::uuid[])`, [m[kind].map(x=>x.id)]);
      for (const row of rows) assert.equal(row.alias, m[kind].find(x=>x.id===row.id)?.alias, 'Fixture identity changed; aborting cleanup');
    }
    // If ANY reference touches the run, EVERY non-null reference must be owned.
    // This catches new/unrecorded children and cross-room/guild participation.
    for (const [table, columns] of relations) {
      const entries = Object.entries(columns);
      const params = entries.map(([,scope])=>scopes[scope]);
      const where = entries.map(([column,scope],i)=>`${column} = ANY($${i+1}::${scope==='L'?'text':'uuid'}[])`).join(' OR ');
      const { rows } = await query(`SELECT ${entries.map(([column])=>column).join(',')} FROM ${table} WHERE ${where}`, params);
      for (const row of rows) for (const [column,scope] of entries)
        assert.ok(row[column] === null || scopes[scope].includes(row[column]), `Unowned reference in ${table}.${column}; aborting cleanup`);
    }
    const externalStudents = await query('SELECT id FROM students WHERE NOT (id = ANY($1::uuid[])) AND guild_code IN (SELECT guild_code FROM teachers WHERE id = ANY($2::uuid[]))', [scopes.S,scopes.T]);
    assert.equal(externalStudents.rows.length, 0, 'External student uses the fixture teacher code');
    const questIds = (await query('SELECT id FROM quests WHERE student_id = ANY($1::uuid[]) OR guild_id = ANY($2::uuid[])', [scopes.S,scopes.G])).rows.map(x=>x.id);
    const completions = await query('SELECT quest_id,student_id FROM quest_completions WHERE quest_id = ANY($1::uuid[]) OR student_id = ANY($2::uuid[])', [questIds,scopes.S]);
    for (const row of completions.rows) assert.ok(questIds.includes(row.quest_id) && scopes.S.includes(row.student_id), 'External quest completion');
    // Custom equipment is stored in JSON as well as relational columns.
    for (const [table, scope] of [['students','S'],['fights','F'],['guild_settings','G']]) {
      const idColumn = table==='guild_settings'?'guild_id':'id';
      for (const id of scopes.E) {
        const { rows } = await query(`SELECT 1 FROM ${table} AS r WHERE NOT (${idColumn} = ANY($1::uuid[])) AND to_jsonb(r)::text LIKE $2 LIMIT 1`, [scopes[scope], `%${id}%`]);
        assert.equal(rows.length, 0, 'External equipment reference');
      }
    }
    assert.equal((await query('SELECT 1 FROM avatar_equipment WHERE gameplay_item_id = ANY($1::uuid[]) LIMIT 1', [scopes.E])).rows.length, 0, 'Custom item acquired an art mapping');
    const remove = async (table, column, values, type='uuid') => {
      counts[table] = (await query(`DELETE FROM ${table} WHERE ${column} = ANY($1::${type}[]) RETURNING 1`, [values])).rows.length;
    };
    for (const table of ['question_attempts','session_participants','quest_fight_evidence','combat_results']) await remove(table,'session_id',scopes.L,'text');
    await remove('personal_quest_receipts','student_id',scopes.S);
    counts.app_sessions = (await query("DELETE FROM app_sessions WHERE (actor_type='student' AND actor_id = ANY($1::uuid[])) OR (actor_type='teacher' AND actor_id = ANY($2::uuid[])) RETURNING 1", [scopes.S,scopes.T])).rows.length;
    await remove('live_combat_sessions','session_id',scopes.L,'text');
    await remove('students','id',scopes.S);
    await remove('guilds','id',scopes.G);
    await remove('fights','id',scopes.F);
    await remove('equipment_items','id',scopes.E);
    await remove('teachers','id',scopes.T);
    await query(apply ? 'COMMIT' : 'ROLLBACK');
    return { applied: apply, counts };
  } catch (error) { await query('ROLLBACK'); throw error; }
}

// Retry-safe exact-key deletion: absent is already clean; denied/failed is not.
export async function cleanupObjects(manifest, remove) {
  validateManifest(manifest);
  for (const key of manifest.objects) {
    const status = await remove(key);
    assert.ok([200, 204, 404].includes(status), `R2 cleanup failed (${status}); retain the manifest and retry`);
  }
  return manifest.objects.length;
}
