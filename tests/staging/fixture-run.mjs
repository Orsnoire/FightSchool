import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { observeRelease } from '../../scripts/release/gates.mjs';
import { liveOrigins, rehearsalOrigin } from '../../scripts/release/isolation.mjs';

export { liveOrigins };
// Keep every fixture request on its checked endpoint. A subsequent redirect
// must not carry a signup, mutation or upload to the classroom application.
export function fixtureFetch(url, options = {}) {
  return fetch(url, { ...options, redirect: 'error' });
}
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
    rehearsalOrigin(origin, env.ISOLATION_ID);
  }
  assert.ok(env.WORKER_VERSION, 'Expected deployed Worker version is required');
  return { origin, mode: env.ACCEPTANCE_MODE, ...(env.ACCEPTANCE_MODE === 'isolated' ? { isolationId: env.ISOLATION_ID } : {}) };
}
export function acceptancePlayers(env, target) {
  const count = Number(env.ACCEPTANCE_PLAYERS || 30);
  assert.ok([30, 60].includes(count), 'Only 30- and 60-player fixtures are supported');
  assert.ok(target.mode === 'isolated' || count === 30, '60-player stress requires isolated resources');
  return count;
}
export function fixtureJournal({ suite, target, release, directory = 'artifacts/acceptance', runId = randomUUID(), now = Date.now() }) {
  assert.match(suite, /^[a-z-]+$/);
  assert.match(runId, /^[0-9a-f-]{36}$/);
  const suffix = `c12-${runId}`;
  const manifest = { schemaVersion: 1, suite, runId, suffix, ...target, release,
    createdAt: new Date(now).toISOString(), reviewBy: new Date(now + 24*60*60*1000).toISOString(),
    status: 'running', pending: [], teachers: [], students: [], fights: [], guilds: [], equipment: [], sessions: [], objects: [],
    cleanup: 'pending; archiving fights does not remove accounts, evidence, R2 objects or room storage' };
  mkdirSync(directory, { recursive: true });
  const file = `${directory}/${suite}-${runId}.json`;
  const persist = () => { writeFileSync(`${file}.tmp`, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 }); renameSync(`${file}.tmp`, file); };
  const add = (kind, value) => { if (!manifest[kind].some(x => JSON.stringify(x) === JSON.stringify(value))) manifest[kind].push(value); };
  persist();
  return { suffix, manifest, file, begin(path, method, body) {
    if (method !== 'POST' || !(['/api/teacher/signup','/api/student/login','/api/fights','/api/guilds','/api/equipment-items','/api/objects/upload'].includes(path) || /^\/api\/fights\/[^/]+\/(?:solo-)?sessions$/.test(path))) return;
    const alias = path === '/api/teacher/signup' ? body.email : path === '/api/student/login' ? body.nickname : undefined;
    if (alias) assert.ok(alias.includes(suffix), 'Only run-owned identities may be created');
    const id = randomUUID();
    manifest.pending.push({ id, path, ...(alias ? { alias:alias.toLowerCase() } : {}) });
    persist();
    return id;
  }, record(path, method, body, payload, status, requestId) {
    if (method !== 'POST') return;
    // A server error can follow a committed write: leave the intent unresolved.
    if (status < 200 || status >= 300) {
      if (status >= 400 && status < 500) { manifest.pending = manifest.pending.filter(p => p.id !== requestId); persist(); }
      return;
    }
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
    manifest.pending = manifest.pending.filter(p => p.id !== requestId);
    persist();
  }, recordAnswerTimes(times) {
    assert.ok(times.length > 0 && times.every(n => Number.isFinite(n) && n >= 0));
    const sorted = [...times].sort((a,b)=>a-b);
    manifest.answerAckMs = { count:sorted.length, p50:sorted[Math.ceil(sorted.length*.5)-1], p95:sorted[Math.ceil(sorted.length*.95)-1], max:sorted.at(-1) };
    persist();
  }, finish(status) { manifest.status = manifest.pending.length ? 'failed' : status; manifest.finishedAt = new Date().toISOString(); persist(); } };
}
export async function startFixtureRun(suite, env = process.env) {
  const target = acceptanceTarget(env);
  const release = await observeRelease({ origin: target.origin, sha: env.RELEASE_SHA, workerVersion: env.WORKER_VERSION });
  return fixtureJournal({ suite, target, release });
}
