import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { dataCostFixture, fixtureId } from '../support/data-costs.ts';
import { fight } from './fixtures.ts';
import { cleanupDatabase, validateIsolation } from '../../scripts/release/fixture-cleanup.mjs';

test('scoped cleanup preserves outsiders, rolls back faults, rejects cross-room references and retries safely', async () => {
  const f = await dataCostFixture(2, 2);
  try {
    const runId = randomUUID(), suffix = `c12-${runId}`;
    const teacherAlias = `qa-${suffix}@example.invalid`;
    await f.pg.query('UPDATE teachers SET email=$1,email_normalized=$1 WHERE id=$2', [teacherAlias,fight.teacherId]);
    const students = f.students.map((s,i)=>({ id:s.id, alias:`qa-${suffix}-${i}` }));
    for (const s of students) await f.pg.query('UPDATE students SET nickname=$1,nickname_normalized=$1 WHERE id=$2', [s.alias,s.id]);
    const sessions = (await f.pg.query<{session_id:string}>('SELECT session_id FROM live_combat_sessions')).rows.map(r=>r.session_id);
    const manifest: any = { schemaVersion:1,runId,suffix,mode:'isolated',origin:'https://fixture.invalid',status:'failed',
      teachers:[{id:fight.teacherId,alias:teacherAlias}],students,fights:[f.bank.id],guilds:[f.guildId,f.otherGuildId],equipment:[],sessions,objects:[] };
    const outsider = fixtureId(999);
    await f.pg.query("INSERT INTO students(id,nickname,nickname_normalized,password_hash,gold) VALUES($1,'Existing learner','existing learner','unchanged',123)", [outsider]);
    const before = await f.pg.query('SELECT * FROM students ORDER BY id');
    const query = (sql:string, params?:any[])=>f.pg.query(sql,params);
    const dry = await cleanupDatabase(query,manifest);
    assert.equal(dry.applied,false); assert.equal(dry.counts.students,2);
    assert.deepEqual((await f.pg.query('SELECT * FROM students ORDER BY id')).rows,before.rows);
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM combat_results')).rows[0].n,8);
    // Even an otherwise unrelated learner joining one fixture guild blocks cleanup.
    await f.pg.query('INSERT INTO guild_memberships(student_id,guild_id) VALUES($1,$2)',[outsider,f.guildId]);
    await assert.rejects(cleanupDatabase(query,manifest,{apply:true}), /Unowned reference/);
    await f.pg.query('DELETE FROM guild_memberships WHERE student_id=$1',[outsider]);
    // Wrong identity and a missing session in a partial manifest must never cascade away data.
    await assert.rejects(cleanupDatabase(query,{...manifest,teachers:[{id:fight.teacherId,alias:`wrong-${suffix}@example.invalid`}]},{apply:true}), /identity changed/);
    await assert.rejects(cleanupDatabase(query,{...manifest,sessions:sessions.slice(1)},{apply:true}), /Unowned reference/);
    // Fail after evidence deletion and prove the transaction restores it all.
    await assert.rejects(cleanupDatabase((sql:string,params?:any[])=>{
      if(sql.startsWith('DELETE FROM students')) throw new Error('injected connection failure');
      return query(sql,params);
    },manifest,{apply:true}), /injected connection failure/);
    assert.deepEqual((await f.pg.query('SELECT * FROM students ORDER BY id')).rows,before.rows);
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM combat_results')).rows[0].n,8);
    const result = await cleanupDatabase(query,manifest,{apply:true});
    assert.equal(result.counts.students,2); assert.equal(result.counts.combat_results,8);
    assert.deepEqual((await f.pg.query('SELECT * FROM students')).rows,[before.rows.find((r:any)=>r.id===outsider)]);
    assert.equal((await f.pg.query('SELECT count(*)::int AS n FROM teachers')).rows[0].n,0);
    const retry = await cleanupDatabase(query,manifest,{apply:true});
    assert.ok(Object.values(retry.counts).every(n=>n===0));
  } finally { await f.pg.close(); }
});

test('cleanup rejects production aliases, pooled production endpoints, foreign R2 keys and missing isolation proof', () => {
  const id='12345678-1234-1234-1234-123456789abc';
  const target={id,workerName:'questacademy-rehearsal-12345678',bucketName:'questacademy-rehearsal-12345678',origin:'https://questacademy-rehearsal-12345678.example.workers.dev',databaseHost:'ep-rehearsal.neon.tech',neonBranchId:'br-rehearsal'};
  const m:any={schemaVersion:1,runId:id,suffix:`c12-${id}`,mode:'isolated',isolationId:id,origin:target.origin,status:'running',teachers:[],students:[],fights:[],guilds:[],equipment:[],sessions:[],objects:[]};
  const url='postgres://example:unused@ep-rehearsal.neon.tech/test';
  assert.equal(validateIsolation(target,m,url,'ep-live.neon.tech'),target);
  assert.throws(()=>validateIsolation(target,{...m,mode:'live'},url,'ep-live.neon.tech'));
  assert.throws(()=>validateIsolation(target,m,url,'ep-rehearsal-pooler.neon.tech'));
  assert.throws(()=>validateIsolation(target,{...m,objects:[`${id}/${id}`]},url,'ep-live.neon.tech'));
  assert.throws(()=>validateIsolation({...target,bucketName:'questacademy-objects'},m,url,'ep-live.neon.tech'));
  assert.throws(()=>validateIsolation(target,m,url,''));
});
