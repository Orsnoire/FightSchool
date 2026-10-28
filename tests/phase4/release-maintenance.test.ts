import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../../worker/index.ts';
import { CombatSessionObject } from '../../worker/combat/session-object.ts';
import { releaseState, resumeRoomClocks } from '../../worker/release/maintenance.ts';
import { roomFixture } from '../support/room-costs.ts';

const paused = [{ id: 'release-test-01', startedAt: 10000, resumedAt: null }];
const resumed = [{ ...paused[0], resumedAt: 40000 }];

test('invalid or overlapping maintenance configuration fails closed', () => {
  assert.equal(releaseState({}).paused, false);
  for (const RELEASE_WINDOWS of ['', '{}', '[null]', JSON.stringify([...paused, ...resumed]), JSON.stringify([{...paused[0],resumedAt:1}])])
    assert.deepEqual(releaseState({ RELEASE_WINDOWS }), { valid: false, paused: true, windows: [] });
  assert.equal(releaseState({ RELEASE_WINDOWS: JSON.stringify(paused) }).paused, true);
  assert.equal(releaseState({ RELEASE_WINDOWS: JSON.stringify(resumed) }).paused, false);
});

test('maintenance blocks every public HTTP/socket route before any binding or database access', async t => {
  t.mock.method(console, 'log', () => {});
  const env = new Proxy({ RELEASE_WINDOWS: JSON.stringify(paused) }, { get(target, key) {
    if (key === 'RELEASE_WINDOWS') return target.RELEASE_WINDOWS;
    throw Error(`Unexpected access to ${String(key)}`);
  } });
  for (const path of ['/', '/api/student/login', '/api/health/live', '/api/health/ready', '/objects/test', '/ws?sessionId=ABC234']) {
    const response = await worker.fetch(new Request(`https://example.invalid${path}`), env as any);
    assert.equal(response.status, 503); assert.equal(response.headers.get('Retry-After'), '30');
    assert.equal((await response.json() as any).status, 'maintenance');
  }
});

test('paused Durable Objects preserve rooms, receipts and all pending work across each entry point', async () => {
  const f = roomFixture(2), saved = structuredClone(f.room);
  saved.reportingPending = saved.evidencePending = true;
  saved.results = [{ studentId: f.students[0].id, xpEarned: 12 }]; saved.resultsPersisted = false;
  saved.playbackGate = { batchId: 'test', pending: ['student:test'], recoveryAt: 12345 };
  let alarms = 0;
  const state: any = { storage: { get: async () => { throw Error('Room read while paused'); }, put: async () => { throw Error('Room changed while paused'); },
    setAlarm: async (at: number) => { assert.ok(at > Date.now()); alarms++; } }, getWebSockets: () => f.players };
  const obj = new CombatSessionObject(state, { DATABASE_URL: 'unused', RELEASE_WINDOWS: JSON.stringify(paused) });
  obj.setRepository(new Proxy({} as any, { get() { throw Error('Repository used while paused'); } }));
  assert.equal((await obj.fetch(new Request('https://internal/end'))).status, 503);
  await obj.webSocketMessage(f.players[0], '{"type":"answer"}');
  assert.equal(f.players[0].closed, true);
  await obj.webSocketClose(f.players[1]); await obj.alarm();
  assert.equal(alarms, 1); assert.deepEqual(f.room.snapshot, saved.snapshot);
});

test('resume shifts timers once, preserving answers, HP, inventory, receipts and retry flags', () => {
  const f = roomFixture(2), room = structuredClone(f.room);
  room.snapshot.phaseStartTime = 5000; room.snapshot.questionStartTime = 5000; room.snapshot.phaseDeadline = 65000;
  room.playbackGate = { batchId: 'batch', pending: ['student:one'], recoveryAt: 70000 };
  room.reportingPending = room.evidencePending = true; room.resultsPersisted = false; room.receipts = ['answer-one'];
  const before = structuredClone(room);
  assert.equal(resumeRoomClocks(room, resumed), true);
  assert.equal(room.snapshot.phaseDeadline, 95000); assert.equal(room.snapshot.phaseStartTime, 35000);
  assert.equal(room.snapshot.questionStartTime, 35000); assert.equal(room.playbackGate.recoveryAt, 100000);
  const after = structuredClone(room); assert.equal(resumeRoomClocks(room, resumed), false); assert.deepEqual(room, after);
  delete room.releaseWindows; room.snapshot.phaseDeadline -= 30000; room.snapshot.phaseStartTime -= 30000;
  room.snapshot.questionStartTime -= 30000; room.playbackGate.recoveryAt -= 30000; assert.deepEqual(room, before);
  const completed = {...structuredClone(before), snapshot: {...before.snapshot, currentPhase: 'game_over'}};
  resumeRoomClocks(completed, resumed); assert.deepEqual(completed.snapshot, before.snapshot = {...before.snapshot, currentPhase: 'game_over'});
});

test('hibernating rooms apply every missed pause, newer rooms keep their clocks, failed checkpoint retries safely', async t => {
  t.mock.method(console, 'log', () => {});
  const f = roomFixture(1), room = structuredClone(f.room);
  const now = Date.now(); room.snapshot.phaseStartTime = now - 100000; room.snapshot.phaseDeadline = now + 10000; room.snapshot.questionStartTime = now - 100000;
  const windows = [{ id:'first-release',startedAt:now-90000,resumedAt:now-80000 },{ id:'second-release',startedAt:now-70000,resumedAt:now-50000 }];
  let stored = structuredClone(room), fail = true;
  const obj: any = new CombatSessionObject({ storage: { get: async()=>structuredClone(stored), put:async(_key: string,value:any)=>{if(fail)throw Error('disk unavailable');stored=structuredClone(value);}, setAlarm:async()=>{}, deleteAlarm:async()=>{} }, getWebSockets:()=>[] } as any,
    { DATABASE_URL:'unused', RELEASE_WINDOWS:JSON.stringify(windows) });
  obj.setRepository(f.repository);
  await assert.rejects(obj.room(), /disk/); assert.deepEqual(stored, room);
  fail = false; await obj.room(); assert.equal(stored.snapshot.phaseDeadline, room.snapshot.phaseDeadline + 30000);
  await obj.room(); assert.equal(stored.snapshot.phaseDeadline, room.snapshot.phaseDeadline + 30000);
  const newer = structuredClone(room); newer.snapshot.phaseStartTime = now;
  resumeRoomClocks(newer,windows); assert.equal(newer.snapshot.phaseDeadline,room.snapshot.phaseDeadline);
});
