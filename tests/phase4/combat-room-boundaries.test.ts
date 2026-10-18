import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { CombatSessionObject } from '../../worker/combat/session-object.ts';
import { assertCommandText, decodeCommandText, parseCombatCommand, applyStudentCommand } from '../../worker/combat/commands.ts';
import { recoverRoom } from '../../worker/combat/room-recovery.ts';
import { snapshotMessage } from '../../worker/combat/room-messages.ts';
import { roomAlarmAt } from '../../worker/combat/room-persistence.ts';
import { addStudent } from '../../worker/combat/engine.ts';
import type { StoredRoom } from '../../worker/combat/room-state.ts';
import { fight, student, started } from './fixtures.ts';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function harness(initial: StoredRoom, repository: Record<string, unknown> = {}) {
  let stored = json(initial), failPut = false, alarm: number | null = null;
  const order: string[] = [], messages: any[] = [];
  const socket = {
    deserializeAttachment: () => ({ actorId: student().id, role: 'student', sessionId: 'ABC234', tokenHash: 'test-token' }),
    serializeAttachment() {}, close() {},
    send(raw: string) { const message = JSON.parse(raw); messages.push(message); order.push(message.type); },
  };
  const state = {
    storage: {
      get: async () => json(stored),
      put: async (_: string, value: StoredRoom) => {
        order.push('checkpoint');
        if (failPut) { failPut = false; throw new Error('Injected storage outage'); }
        stored = json(value);
      },
      setAlarm: async (at: number) => { alarm = at; }, deleteAlarm: async () => { alarm = null; },
    },
    getWebSockets: () => [socket], acceptWebSocket() {},
  };
  const restore = () => {
    const object = new CombatSessionObject(state as any, { DATABASE_URL: 'unused' });
    object.setRepository({ findActiveSession: async () => ({ actorId: student().id, actorType: 'student' }), ...repository } as any);
    return object;
  };
  return { restore, saved: () => json(stored), failNextPut: () => { failPut = true; }, alarm: () => alarm, socket, order, messages };
}

test('combat command decoding rejects binary/oversized/invalid frames and preserves atomic ready selection', () => {
  assert.throws(() => assertCommandText(new ArrayBuffer(1)), /Text command/);
  assert.throws(() => assertCommandText('é'.repeat(8001)), /Text command/);
  assert.doesNotThrow(() => assertCommandText('é'.repeat(8000)));
  assert.throws(() => decodeCommandText('{'), /Invalid combat command/);
  assert.throws(() => parseCombatCommand({ type: 'answer', answer: '4' }), /Invalid combat command/);
  const s = started('wizard'); s.players[student().id].hasAnswered = true;
  const before = json(s);
  const command = parseCombatCommand({ type: 'action', commandId: 'c10-select-ready', round: 1, ability: 'fireball', targetId: 'e1', ready: true });
  const selected = applyStudentCommand(s, fight, student().id, command, 5000);
  assert.deepEqual(json(s), before);
  assert.equal(selected.players[student().id].questionAction?.ability, 'fireball');
  assert.equal(selected.players[student().id].ready, true);
  s.players[student().id].mp = 0;
  assert.throws(() => applyStudentCommand(s, fight, student().id, command, 5000), /MP/);
  assert.equal(s.players[student().id].ready, false);
});

test('failed command checkpoint publishes no acknowledgement or SQL; restored simultaneous retries execute once', async () => {
  let s = started();
  s.players.other = { ...json(s.players[student().id]), studentId: 'other', hasAnswered: false };
  s.phaseDeadline = Date.now() + 100000;
  let reports = 0;
  const h = harness({ fight, snapshot: s, receipts: [] }, { recordSessionReporting: async () => { reports++; h.order.push('sql'); } });
  const command = JSON.stringify({ type: 'answer', commandId: 'c10-storage-answer', round: 1, questionId: 'q1', answer: '4' });
  h.failNextPut();
  await h.restore().webSocketMessage(h.socket as any, command);
  assert.deepEqual(h.order, ['checkpoint', 'protocol_error']);
  assert.equal(reports, 0);
  assert.equal(h.saved().receipts.length, 0);
  assert.equal(h.saved().snapshot.players[student().id].hasAnswered, false);
  h.order.length = 0;
  const restored = h.restore();
  await Promise.all([restored.webSocketMessage(h.socket as any, command), restored.webSocketMessage(h.socket as any, command)]);
  assert.equal(h.saved().receipts.length, 1);
  assert.equal(reports, 1);
  assert.equal(h.messages.filter(m => m.type === 'command_ack').length, 2);
  assert.ok(h.order.indexOf('checkpoint') < h.order.indexOf('sql'));
  assert.ok(h.order.lastIndexOf('checkpoint') < h.order.indexOf('command_ack'));
});

test('SQL success followed by checkpoint failure retries after eviction without double reward or premature results', async () => {
  const s = started(); s.currentPhase = 'game_over'; s.victory = true; s.phaseDeadline = null;
  const receipts = new Map<string, unknown[]>(); let attempts = 0, awards = 0;
  const h = harness({ fight, snapshot: s, receipts: ['preserved:command'] }, {
    persistResults: async (snapshot: typeof s) => {
      attempts++;
      if (!receipts.has(snapshot.sessionId)) { awards++; receipts.set(snapshot.sessionId, [{ studentId: student().id, xpEarned: 10, secret: 'private' }]); }
      return receipts.get(snapshot.sessionId);
    },
  });
  h.failNextPut();
  await h.restore().alarm();
  assert.equal(awards, 1);
  assert.equal(h.saved().resultsPersisted, undefined);
  assert.ok(h.alarm());
  assert.deepEqual(h.messages.map(m => m.type), ['result_pending']);
  await h.restore().alarm();
  await h.restore().alarm();
  assert.equal(attempts, 2);
  assert.equal(awards, 1);
  assert.equal(h.saved().resultsPersisted, true);
  assert.deepEqual(h.saved().receipts, ['preserved:command']);
  assert.ok(h.messages.some(m => m.type === 'game_over' && m.results[0].xpEarned === 10));
  assert.ok(!JSON.stringify(h.messages).includes('private'));
});

test('legacy room adapter preserves answers, resources and clocks; completed legacy rooms never replay rewards', async () => {
  for (const phase of ['question', 'game_over'] as const) {
    const snapshot: any = json(started('wizard'));
    delete snapshot.schemaVersion;
    snapshot.currentPhase = phase;
    Object.assign(snapshot.players[student().id], { health: 3, mp: 2, hasAnswered: true, currentAnswer: '4', lastAnswerCorrect: true, threat: 8 });
    const room = { fight, snapshot, receipts: [] } as StoredRoom;
    const order: string[] = [];
    const result = await recoverRoom(room, { repository: { findStudentById: async () => student('wizard') } as any,
      save: async () => { order.push('save'); }, syncAlarm: async () => { order.push('alarm'); } });
    const p = result.snapshot.players[student().id];
    assert.equal(result.snapshot.schemaVersion, 2);
    assert.deepEqual([p.health, p.mp, p.currentAnswer, p.lastAnswerCorrect, p.threat], [3, 2, '4', true, 8]);
    assert.equal(result.snapshot.questionStartTime, snapshot.questionStartTime);
    assert.equal(result.snapshot.phaseStartTime, snapshot.phaseStartTime);
    assert.deepEqual(order, ['save', 'alarm']);
    if (phase === 'question') assert.equal(result.snapshot.phaseDeadline, snapshot.questionStartTime + 30000);
    else assert.equal(result.resultsPersisted, true);
    await recoverRoom(result, { repository: null, save: async () => { throw Error('unexpected rewrite'); }, syncAlarm: async () => {} });
  }
});

test('version-2 recovery retains pending/departed players, receipts, playback and outboxes byte for byte', async () => {
  let s = addStudent(started(), student('wizard', 'late'));
  s.departedPlayers = { departed: { ...json(s.players[student().id]), studentId: 'departed', roundsParticipated: 2 } };
  s.pendingAttempts = [{ id: 'durable-attempt' }] as any;
  s.playback = { id: 'batch', round: 1, phase: 'question_resolution', eventIds: ['1:0'], initialHealth: {} };
  s.currentPhase = 'question_resolution'; s.phaseDeadline = null;
  const room: StoredRoom = { fight, snapshot: s, receipts: ['student:durable-command'], reportingPending: true, evidencePending: true,
    playbackGate: { batchId: 'batch', pending: ['student:late'], recoveryAt: 9000 } as any };
  const before = json(room);
  await recoverRoom(room, { repository: null, save: async () => { throw Error('unexpected rewrite'); }, syncAlarm: async () => {} });
  assert.deepEqual(json(room), before);
  assert.equal(roomAlarmAt(room, 1000), 6000);
  room.snapshot.phaseDeadline = 4000;
  assert.equal(roomAlarmAt(room, 1000), 4000);
});

test('public room envelopes conceal pending requests and answers until authorized phase/role', () => {
  const s = started(); s.players[student().id].currentAnswer = '4'; s.players[student().id].lastAnswerCorrect = true;
  const room: StoredRoom = { fight, snapshot: s, receipts: ['secret'], removals: { removed: { nickname: 'Waiting', blocked: false, requestedAt: 1 } },
    results: [{ id: 'result', studentId: student().id, xpEarned: 10, passwordHash: 'secret', lootTable: [{ itemId: 'item', privateRoll: 99 }] }] };
  const studentMessage = snapshotMessage(room, 'student', undefined, 1234);
  assert.equal(studentMessage.serverTime, 1234);
  assert.equal(studentMessage.question?.correctAnswer, undefined);
  assert.equal(studentMessage.rejoinRequests, undefined);
  assert.ok(!JSON.stringify(studentMessage).includes('secret'));
  assert.ok(!JSON.stringify(studentMessage).includes('privateRoll'));
  assert.deepEqual(snapshotMessage(room, 'teacher').rejoinRequests, [{ studentId: 'removed', nickname: 'Waiting' }]);
  room.snapshot.currentPhase = 'answer_feedback';
  assert.equal(snapshotMessage(room).question?.correctAnswer, '4');
});

test('combat rule bundle has no runtime room authority, database, route or transport dependencies', async () => {
  const result = await build({ entryPoints: ['worker/combat/engine.ts'], bundle: true, write: false, metafile: true, platform: 'neutral', packages: 'external', logLevel: 'silent' });
  const files = Object.keys(result.metafile!.inputs);
  assert.ok(files.some(path => path.endsWith('/phases.ts')));
  assert.deepEqual(files.filter(path => /worker\/(db|routes|auth)\/|worker\/combat\/(session-object|room-|commands)/.test(path)), []);
});
