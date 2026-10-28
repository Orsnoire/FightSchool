import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BORDER_MASKS, canonicalMask, neighbourMask, borderMaskSvg } from '../../client/src/features/campaign/autotiles';
import { initialCombatState } from '../../worker/combat/encounter-setup';
import { publicSnapshot } from '../../worker/combat/public-snapshot';
import { fight } from './fixtures';

test('border vocabulary covers every cardinal/diagonal arrangement without orphan corners', () => {
  assert.equal(BORDER_MASKS.length, 47);
  assert.equal(new Set(BORDER_MASKS.map(borderMaskSvg)).size, 47);
  for (let mask = 0; mask < 256; mask++) {
    const canonical = canonicalMask(mask);
    assert.ok(BORDER_MASKS.includes(canonical));
    assert.equal(canonical & 15, mask & 15, 'cardinal passages are never changed');
    assert.equal(canonicalMask(canonical), canonical);
    [3, 6, 12, 9].forEach((pair, i) => {
      assert.equal(!!(canonical & (16 << i)), !!(mask & (16 << i)) && (mask & pair) === pair);
    });
  }
});

test('adjacent border blocks agree on connections, including inner corners and narrow strips', () => {
  const occupied = new Set(['0,0','1,0','2,0','0,1','2,1','0,2','1,2','2,2','3,2','4,2']);
  const joins = (x: number,y: number) => occupied.has(`${x},${y}`);
  assert.equal(neighbourMask(0,0,joins), 6, 'missing SE diagonal makes an inward corner');
  assert.equal(neighbourMask(3,2,joins), 10, 'one-tile horizontal connector');
  assert.equal(neighbourMask(4,2,joins), 8, 'dead-end cap');
  assert.equal(neighbourMask(7,7,joins), 0, 'isolated tile');
  for (const key of occupied) {
    const [x,y] = key.split(',').map(Number), mask = neighbourMask(x,y,joins);
    if (joins(x+1,y)) assert.equal(!!(mask&2), !!(neighbourMask(x+1,y,joins)&8));
    if (joins(x,y+1)) assert.equal(!!(mask&4), !!(neighbourMask(x,y+1,joins)&1));
  }
});

test('battle scenery follows frozen campaign context and is safely public without campaign identifiers', () => {
  for (const environment of ['grassland','normal_cave'] as const) {
    const state = initialCombatState('art', { ...fight, campaignContext: { campaignId:'private-campaign',studentId:'private-student',objective:false,fixedTier:1,environment } });
    assert.equal(state.battleEnvironment, environment);
    const restored = JSON.parse(JSON.stringify(state));
    const publicState = publicSnapshot(restored);
    assert.equal(publicState.battleEnvironment, environment);
    assert.ok(!JSON.stringify(publicState).includes('private-campaign'));
    assert.ok(!JSON.stringify(publicState).includes('private-student'));
  }
  assert.equal(initialCombatState('classroom', fight).battleEnvironment, undefined, 'classroom snapshots retain their original shape');
  const legacy = initialCombatState('legacy', fight); delete legacy.battleEnvironment;
  assert.equal(publicSnapshot(legacy).battleEnvironment, undefined, 'old saves remain untouched');
});
