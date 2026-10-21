import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveRoom, completeRoom } from '../../worker/combat/room-persistence';
import { advancePhase } from '../../worker/combat/phases';
import { started, fight, student } from './fixtures';
import type { StoredRoom } from '../../worker/combat/room-state';

test('campaign resolution is published after its checkpoint while a reporting write is still pending', async () => {
  const snapshot = started(); snapshot.currentPhase = 'abilities';
  snapshot.players[student().id].hasAnswered = true;
  snapshot.players[student().id].lastAnswerCorrect = true;
  const room: StoredRoom = { snapshot: advancePhase(snapshot, fight), fight, receipts: [] };
  let resolveSQL!: () => void;
  const blockedSQL = new Promise<void>(resolve => resolveSQL = resolve);
  const order: string[] = [];
  const saving = saveRoom(room, {
    checkpoint: async () => { order.push('durable'); },
    checkpointed: async r => { assert.equal(r.snapshot.currentPhase, 'question_resolution'); order.push('visible'); },
    repository: { recordSessionReporting: async () => { order.push('sql'); await blockedSQL; } } as any,
    syncAlarm: async () => {}, activeRenderers: () => [],
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(order, ['durable', 'visible', 'sql']);
  resolveSQL(); await saving;
  assert.deepEqual(order, ['durable', 'visible', 'sql', 'durable']);
});

test('checkpoint failure cannot expose a campaign choice; result publication still waits for its durable receipt', async () => {
  const room: StoredRoom = { snapshot: started(), fight, receipts: [] };
  let shown = 0;
  await assert.rejects(saveRoom(room, {
    checkpoint: async () => { throw new Error('disk failure'); }, checkpointed: async () => { shown++; },
    repository: null, syncAlarm: async () => {}, activeRenderers: () => [],
  }), /disk failure/);
  assert.equal(shown, 0);
  room.snapshot.currentPhase = 'game_over';
  const order: string[] = [];
  await completeRoom(room, {
    repository: { persistResults: async () => { order.push('awarded'); return []; } } as any,
    save: async () => { assert.equal(room.resultsPersisted, true); order.push('receipt'); },
    syncAlarm: async () => {}, publish: async () => { order.push('rewards visible'); },
    scheduleRetry: async () => {}, broadcast: () => {},
  });
  assert.deepEqual(order, ['awarded', 'receipt', 'rewards visible']);
});
