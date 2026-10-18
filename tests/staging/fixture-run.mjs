import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { observeRelease } from '../../scripts/release/gates.mjs';

export const liveOrigins = new Set(['https://questacademy.bookwyrminteractive.studio', 'https://questacademy-staging.coxsonator.workers.dev']);
export function acceptanceTarget(env) {
  const origin = env.STAGING_ORIGIN;
  assert.ok(origin, 'STAGING_ORIGIN must be explicit');
  assert.equal(new URL(origin).origin, origin);
  assert.equal(new URL(origin).protocol, 'https:');
  assert.ok(['live', 'isolated'].includes(env.ACCEPTANCE_MODE), 'Explicit live or isolated acceptance mode required');
  if (env.ACCEPTANCE_MODE === 'live') assert.ok(liveOrigins.has(origin), 'Unknown live target');
  else {
    assert.ok(!liveOrigins.has(origin), 'The staging-named Worker is production, not isolated');
    assert.equal(env.ISOLATED_ORIGIN, origin, 'Isolated target must match its independently configured origin');
  }
  assert.ok(env.WORKER_VERSION, 'Expected deployed Worker version is required');
  return { origin, mode: env.ACCEPTANCE_MODE };
}
export function fixtureJournal({ suite, target, release, directory = 'artifacts/acceptance', runId = randomUUID(), now = Date.now() }) {
  assert.match(suite, /^[a-z-]+$/);
  assert.match(runId, /^[0-9a-f-]{36}$/);
  const suffix = `c12-${runId}`;
  const manifest = { schemaVersion: 1, suite, runId, suffix, ...target, release,
    createdAt: new Date(now).toISOString(), reviewBy: new Date(now + 24*60*60*1000).toISOString(),
    status: 'running', teachers: [], students: [], fights: [], guilds: [], equipment: [], sessions: [], objects: [],
    cleanup: 'pending; archiving fights does not remove accounts, evidence, R2 objects or room storage' };
  mkdirSync(directory, { recursive: true });
  const file = `${directory}/${suite}-${runId}.json`;
  const persist = () => { writeFileSync(`${file}.tmp`, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 }); renameSync(`${file}.tmp`, file); };
  const add = (kind, value) => { if (!manifest[kind].some(x => JSON.stringify(x) === JSON.stringify(value))) manifest[kind].push(value); };
  persist();
  return { suffix, manifest, file, record(path, method, body, payload, status) {
    if (method !== 'POST' || status < 200 || status >= 300) return;
    if (path === '/api/teacher/signup') {
      assert.ok(body.email.includes(suffix) && body.email.endsWith('@example.invalid'));
      add('teachers', { id: payload.id || payload.teacher?.id, alias: body.email.toLowerCase() });
    } else if (path === '/api/student/login') {
      assert.ok(body.nickname.includes(suffix));
      add('students', { id: payload.id, alias: body.nickname.toLowerCase() });
    } else if (path === '/api/fights') add('fights', payload.id);
    else if (path === '/api/guilds') add('guilds', payload.id);
    else if (path === '/api/equipment-items') add('equipment', payload.id);
    else if (/^\/api\/fights\/[^/]+\/(?:solo-)?sessions$/.test(path)) add('sessions', payload.sessionId);
    else if (path === '/api/objects/upload') add('objects', payload.objectPath?.replace(/^\/objects\//, ''));
    persist();
  }, finish(status) { manifest.status = status; manifest.finishedAt = new Date().toISOString(); persist(); } };
}
export async function startFixtureRun(suite, env = process.env) {
  const target = acceptanceTarget(env);
  const release = await observeRelease({ origin: target.origin, sha: env.RELEASE_SHA, workerVersion: env.WORKER_VERSION });
  return fixtureJournal({ suite, target, release });
}
