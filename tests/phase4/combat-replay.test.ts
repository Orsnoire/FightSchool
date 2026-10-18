import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { combatReplayTraces } from './combat-replay-fixture.ts';
const baseline = JSON.parse(readFileSync(new URL('./data/c10-combat-baseline.json', import.meta.url), 'utf8'));

test('C10 preserves pre-extraction seeded outcomes, resources, events and public projections', () => {
  assert.deepEqual(combatReplayTraces(), baseline.traces);
});
test('C10 replay remains identical when every command and phase crosses JSON storage', () => {
  assert.deepEqual(combatReplayTraces(true), baseline.traces);
});
