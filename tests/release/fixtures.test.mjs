import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupObjects, validateManifest } from '../../scripts/release/fixture-cleanup.mjs';
import { acceptanceTarget, acceptancePlayers, fixtureJournal, liveOrigins } from '../staging/fixture-run.mjs';
const version = '12345678-1234-1234-1234-123456789abc';
test('acceptance never silently defaults to production or calls it isolated', () => {
  assert.throws(() => acceptanceTarget({}));
  for (const origin of liveOrigins) {
    assert.throws(() => acceptanceTarget({ STAGING_ORIGIN: origin, ISOLATED_ORIGIN: origin, ACCEPTANCE_MODE: 'isolated', WORKER_VERSION: version }));
    assert.equal(acceptanceTarget({ STAGING_ORIGIN: origin, ACCEPTANCE_MODE: 'live', WORKER_VERSION: version }).mode, 'live');
  }
  assert.throws(() => acceptanceTarget({ STAGING_ORIGIN: 'https://elsewhere.invalid', ACCEPTANCE_MODE: 'live', WORKER_VERSION: version }));
});
test('interrupted fixture runs retain only exact owned identities, never credentials', () => {
  const directory = mkdtempSync(join(tmpdir(), 'qa-fixture-'));
  try {
    const f = fixtureJournal({ directory, suite: 'combat', target: { origin: 'https://example.invalid', mode: 'isolated' }, release: { commit: 'a'.repeat(40), workerVersion: version } });
    const id = '12345678-1234-1234-1234-123456789abc';
    const body = { email: `qa-${f.suffix}@example.invalid`, password: 'secret-canary', billingAddress: 'private-canary' };
    f.record('/api/teacher/signup', 'POST', body, { id, token: 'token-canary' }, 201);
    f.record('/api/objects/upload', 'POST', null, { objectPath: `/objects/${id}/${id}`, uploadURL: 'secret-canary' }, 200);
    f.record('/api/fights', 'POST', {}, { id }, 201);
    f.record(`/api/fights/${id}/sessions`, 'POST', {}, { sessionId: 'ABC234' }, 200);
    f.record('/api/student/login', 'POST', {}, { id: 'unowned' }, 401);
    let raw = readFileSync(f.file, 'utf8');
    assert.ok(!raw.includes('canary')); const saved = JSON.parse(raw);
    assert.equal(saved.status, 'running'); assert.deepEqual(saved.fights, [id]); assert.deepEqual(saved.sessions, ['ABC234']); assert.equal(saved.students.length, 0);
    assert.deepEqual(saved.objects, [`${id}/${id}`]);
    f.finish('failed'); assert.equal(JSON.parse(readFileSync(f.file, 'utf8')).status, 'failed');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('stress fixture size is bounded and cannot expand live classroom traffic', () => {
  assert.equal(acceptancePlayers({}, { mode:'live' }),30);
  assert.equal(acceptancePlayers({ACCEPTANCE_PLAYERS:'60'}, { mode:'isolated' }),60);
  assert.throws(()=>acceptancePlayers({ACCEPTANCE_PLAYERS:'60'}, {mode:'live'}));
  assert.throws(()=>acceptancePlayers({ACCEPTANCE_PLAYERS:'600'}, {mode:'isolated'}));
});

test('R2 cleanup retries exact keys and treats denial or partial failure as unfinished', async () => {
  const id='12345678-1234-1234-1234-123456789abc', other='22345678-1234-1234-1234-123456789abc';
  const m={schemaVersion:1,pending:[],runId:id,suffix:`c12-${id}`,mode:'isolated',origin:'https://fixture.invalid',status:'failed',teachers:[{id,alias:`qa-c12-${id}@example.invalid`}],students:[],fights:[],guilds:[],equipment:[],sessions:[],objects:[`${id}/${id}`,`${id}/${other}`]};
  const calls=[];
  await assert.rejects(cleanupObjects(m,async key=>{calls.push(key);return calls.length===1?204:503;}),/R2 cleanup failed/);
  assert.deepEqual(calls,m.objects);
  assert.equal(await cleanupObjects(m,async()=>404),2);
  await assert.rejects(cleanupObjects(m,async()=>403),/R2 cleanup failed/);
});

test('lost creation responses retain intent and block cleanup until reconciled', () => {
  const directory=mkdtempSync(join(tmpdir(),'qa-intent-'));
  try {
    const f=fixtureJournal({directory,suite:'combat',target:{mode:'isolated',origin:'https://fixture.invalid'},release:{}});
    const body={email:`qa-${f.suffix}@example.invalid`,password:'never-persist-this'};
    const requestId=f.begin('/api/teacher/signup','POST',body);
    const interrupted=JSON.parse(readFileSync(f.file,'utf8'));
    assert.equal(interrupted.pending[0].alias,body.email);
    assert.ok(!JSON.stringify(interrupted).includes('never-persist-this'));
    assert.throws(()=>validateManifest(interrupted),/Unresolved creation intent/);
    f.record('/api/teacher/signup','POST',body,{},503,requestId);
    assert.throws(()=>validateManifest(f.manifest),/Unresolved creation intent/);
    f.record('/api/teacher/signup','POST',body,{id:'12345678-1234-1234-1234-123456789abc'},201,requestId);
    assert.equal(validateManifest(f.manifest).pending.length,0);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
