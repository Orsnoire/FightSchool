import assert from 'node:assert/strict';

// This draft deliberately cannot target any known production alias or the
// retained preview. A fresh target distinct from C12 must also be reviewed.
const reserved = new Set([
  'questacademy.link', 'www.questacademy.link',
  'questacademy.bookwyrminteractive.studio',
  'questacademy-staging.coxsonator.workers.dev',
  'questacademy-campaign-preview.coxsonator.workers.dev',
]);
export function validateTarget(m) {
  assert.equal(m.schemaVersion, 1);
  const url = new URL(m.origin);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.origin, m.origin, 'Use an exact origin without path or credentials');
  assert.ok(!reserved.has(url.hostname), 'Reserved live/retained environment');
  assert.equal(m.environment, 'isolated-campaign-acceptance');
  assert.equal(m.providerIsolationReviewed, true, 'Independent Worker/DB/DO/R2 mapping is required');
  assert.equal(m.executionApproved, true, 'Explicit approval is required before fixture writes');
  assert.match(m.sourceSha, /^[a-f0-9]{40}$/);
  for (const key of ['workerVersion', 'databaseBranch', 'durableObjectNamespace', 'r2Bucket', 'reviewedBy']) {
    assert.equal(typeof m[key], 'string');
    assert.ok(m[key].trim() && !/^(TODO|REPLACE)/.test(m[key]), `Missing ${key}`);
  }
  return m;
}

const rate = -Math.log(0.89 / 0.99);
const power = Math.log(Math.log(990) / rate) / Math.log(10);
const curve = position => 0.01 + 0.99 * Math.exp(-rate * Math.max(0, position) ** power);
export const close = (actual, expected, label) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9,
  `${label}: ${actual} != ${expected}`,
);

// Independent oracle: infer effective curve position from the public pre-fight
// rate, rather than importing the implementation or assuming recovery is zero.
export function expectedAward(before, boss) {
  assert.ok(before.xpMultiplier > 0.01 && before.xpMultiplier <= 1, 'Rate at numerical floor; use a fresh fixture');
  const position = before.xpMultiplier === 1 ? 0
    : (-Math.log((before.xpMultiplier - 0.01) / 0.99) / rate) ** (1 / power);
  const afterCost = curve(position + 1);
  const after = boss ? Math.min(1, afterCost + 0.2) : afterCost;
  return { afterCost, after, restored: after - afterCost };
}

export function assertAward(before, after, result, boss) {
  assert.equal(after.resetsAt, before.resetsAt, 'Denver midnight crossed; this run is inconclusive');
  assert.equal(after.completedCombats, before.completedCombats + 1);
  assert.equal(result.staminaFightNumber, after.completedCombats);
  close(result.xpMultiplier, before.xpMultiplier, 'Winning fight retains pre-recovery XP rate');
  const expected = expectedAward(before, boss);
  close(result.staminaRestored, expected.restored, 'Persisted stamina reward');
  close(after.xpMultiplier, expected.after, 'Next-fight stamina');
  return expected;
}

// Only inspect public map topology. Do not predict rolls, teleport, mutate saves,
// or avoid encounters: the real server decides what happens along this route.
export function nextStep(view, target) {
  const map = view.layout[view.progress.zone], start = view.progress.position;
  const near = p => Math.abs(p.x - target.x) + Math.abs(p.y - target.y) <= 1;
  if (near(start)) return null;
  const queue = [{ p: start, first: null }], visited = new Set([`${start.x},${start.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const { p, first } = queue[i];
    for (const [dx, dy, direction] of [[0, -1, 'north'], [1, 0, 'east'], [0, 1, 'south'], [-1, 0, 'west']]) {
      const q = { x: p.x + dx, y: p.y + dy }, key = `${q.x},${q.y}`;
      if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height || visited.has(key)
        || ['wall', 'water', 'mountain'].includes(map.tiles[q.y * map.width + q.x])) continue;
      const step = first || { dx, dy, direction };
      if (near(q)) return step;
      visited.add(key); queue.push({ p: q, first: step });
    }
  }
  throw new Error('No reachable route to service/objective');
}
