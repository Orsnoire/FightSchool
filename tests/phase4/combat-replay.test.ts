import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { combatReplayTraces } from './combat-replay-fixture.ts';
const baseline = JSON.parse(readFileSync(new URL('./data/c10-combat-baseline.json', import.meta.url), 'utf8'));
const historicalScaling = JSON.parse(readFileSync(new URL('./data/pre-role-weighted-hp.json', import.meta.url), 'utf8')).starts;
const comboReset = JSON.parse(readFileSync(new URL('./data/2026-10-26-combo-reset.json', import.meta.url), 'utf8'));
// The owner explicitly changed Fireball's cost from 1 to 2 MP. Its resource
// delta is covered directly in combat-resources; every unaffected C10 trace
// must retain its original hash. Do not regenerate the historical baseline.
// October 26 explicitly changes Hex magnitudes/timing and corrects Hemorrhage's
// duration/timing. Exact arithmetic, tick counts, recasts and recovery are asserted
// independently in periodic-effects.test.ts; all other historical traces stay pinned.
const changed = new Set(['wizard:fireball', 'warlock:hex', 'blood_knight:hemorrhage']);
const unaffected = <T extends { scenario: string }>(traces: T[]) => traces.filter(t => !changed.has(t.scenario));
// The owner's full combo reset applies to existing rooms too. Only the nine
// mixed-answer encounter traces change; retain the original C10 artifact and
// all its unaffected ability hashes. Explicit 1,536-case coverage lives in
// advancement.test.ts; these new hashes also pin the complete encounter output.
const expected = baseline.traces.map((trace: { scenario: string }) =>
  comboReset.traces.find((replacement: { scenario: string }) => replacement.scenario === trace.scenario) ?? trace);

test('already-started pre-balance rooms preserve C10 seeded outcomes, resources, events and public projections', () => {
  assert.deepEqual(unaffected(combatReplayTraces(false, historicalScaling)), unaffected(expected));
});
test('C10 replay remains identical when every command and phase crosses JSON storage', () => {
  assert.deepEqual(unaffected(combatReplayTraces(true, historicalScaling)), unaffected(expected));
});
test('new additive HP encounters replay identically across JSON storage at every command and phase', () => {
  assert.deepEqual(combatReplayTraces(true), combatReplayTraces());
});
