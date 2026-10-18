import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acceptanceTarget, fixtureJournal, liveOrigins } from '../staging/fixture-run.mjs';
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
