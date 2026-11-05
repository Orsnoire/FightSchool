import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTarget, assertAward, expectedAward, nextStep } from '../staging/campaign-acceptance-contract.mjs';

const target = () => ({ schemaVersion: 1, origin: 'https://qa-campaign.example.invalid',
  environment: 'isolated-campaign-acceptance', providerIsolationReviewed: true, executionApproved: true,
  sourceSha: 'a'.repeat(40), workerVersion: 'isolated-version', databaseBranch: 'isolated-branch',
  durableObjectNamespace: 'isolated-do', r2Bucket: 'isolated-r2', reviewedBy: 'test owner' });

test('campaign acceptance refuses live aliases, missing approval and unreviewed isolation', () => {
  for (const host of ['questacademy.link', 'questacademy.bookwyrminteractive.studio',
    'questacademy-staging.coxsonator.workers.dev', 'questacademy-campaign-preview.coxsonator.workers.dev']) {
    assert.throws(() => validateTarget({ ...target(), origin: `https://${host}` }), /Reserved/);
  }
  assert.throws(() => validateTarget({ ...target(), executionApproved: false }), /approval/);
  assert.throws(() => validateTarget({ ...target(), providerIsolationReviewed: false }), /mapping/);
  assert.throws(() => validateTarget({ ...target(), origin: 'https://qa.example/path' }), /exact origin/);
  assert.throws(() => validateTarget({ ...target(), databaseBranch: 'TODO' }), /databaseBranch/);
  assert.deepEqual(validateTarget(target()), target());
});

test('acceptance oracle distinguishes pre-fight rate, ordinary cost, capped recovery and replay', () => {
  const before = { completedCombats: 0, xpMultiplier: 1, resetsAt: 123 };
  const receipt = { xpMultiplier: 1, staminaRestored: 0.1, staminaFightNumber: 1 };
  assertAward(before, { ...before, completedCombats: 1 }, receipt, true);
  assert.throws(() => assertAward(before, before, receipt, true));
  assert.throws(() => assertAward(before, { ...before, completedCombats: 1, resetsAt: 456 }, receipt, true), /midnight/);
  assert.equal(expectedAward(before, false).after, 0.9);
  const reduced = { ...before, completedCombats: 2, xpMultiplier: 0.691 };
  const expected = expectedAward(reduced, true);
  assert.ok(Math.abs(expected.restored - 0.2) < 1e-12);
  assert.ok(expected.after < reduced.xpMultiplier, 'Reward need not make final stamina higher than pre-fight stamina');
});

test('acceptance route walks around walls and fails for an unreachable keeper', () => {
  const view = { progress: { zone: 'overworld', position: { x: 0, y: 1 } },
    layout: { overworld: { width: 4, height: 3, tiles: [
      'path', 'path', 'path', 'path', 'path', 'wall', 'wall', 'path', 'wall', 'wall', 'wall', 'wall',
    ] } } };
  assert.equal(nextStep(view, { x: 3, y: 1 }).direction, 'north');
  view.layout.overworld.tiles[0] = 'wall';
  assert.throws(() => nextStep(view, { x: 3, y: 1 }), /No reachable/);
});
