import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { combatReplayTraces } from './combat-replay-fixture.ts';
const baseline = JSON.parse(readFileSync(new URL('./data/c10-combat-baseline.json', import.meta.url), 'utf8'));
const historicalScaling = JSON.parse(readFileSync(new URL('./data/pre-role-weighted-hp.json', import.meta.url), 'utf8')).starts;
// The owner explicitly changed Fireball's cost from 1 to 2 MP. Its resource
// delta is covered directly in combat-resources; every unaffected C10 trace
// must retain its original hash. Do not regenerate the historical baseline.
// October 26 explicitly changes Hex magnitudes/timing and corrects Hemorrhage's
// duration/timing. Exact arithmetic, tick counts, recasts and recovery are asserted
// independently in periodic-effects.test.ts; all other historical traces stay pinned.
const changed = new Set(['wizard:fireball', 'warlock:hex', 'blood_knight:hemorrhage']);
const unaffected = <T extends { scenario: string }>(traces: T[]) => traces.filter(t => !changed.has(t.scenario));

test('already-started pre-balance rooms preserve C10 seeded outcomes, resources, events and public projections', () => {
  assert.deepEqual(unaffected(combatReplayTraces(false, historicalScaling)), unaffected(baseline.traces));
});
test('C10 replay remains identical when every command and phase crosses JSON storage', () => {
  assert.deepEqual(unaffected(combatReplayTraces(true, historicalScaling)), unaffected(baseline.traces));
});
test('new additive HP encounters replay identically across JSON storage at every command and phase', () => {
  assert.deepEqual(combatReplayTraces(true), combatReplayTraces());
});
