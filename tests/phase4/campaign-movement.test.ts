import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCampaignController } from '../../client/src/features/campaign/movement';
import { generateCampaignLayout } from '../../shared/campaign/generation';
import { campaignPath, campaignStep } from '../../shared/campaign/movement';
import type { CampaignProgress, CampaignView } from '../../shared/campaign/model';
const fixture = () => ({ id: 'prediction', layout: generateCampaignLayout('prediction', []), gates: [], revision: 0, progressRevision: 0,
  progress: { zone: 'overworld', position: { x: 4, y: 6 }, steps: 0, health: 10, explored: [], claimedUnlocks: [], activeSessionId: null },
}) as unknown as CampaignView;
const tick = () => new Promise(resolve => setImmediate(resolve));

test('campaign paths stop at the first encounter and validate each step', () => {
  const world = fixture();
  const p = { ...world.progress, zone: 'dungeon', position: world.layout.dungeon.spawn } as CampaignProgress;
  const options = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
  const step = options.find(s => { try { campaignStep(world, p, s); return true; } catch { return false; } })!;
  let before = p;
  for (let n = 0; n < 100; n++) {
    before = { ...p, steps: n };
    if (campaignStep(world, before, step).encounter) break;
  }
  const result = campaignPath(world, before, [step, { dx: -step.dx, dy: -step.dy }]);
  assert.equal(result.encounter, true); assert.equal(result.progress.steps, before.steps + 1);
  assert.throws(() => campaignPath(world, p, [{ dx: 1, dy: 1 }]), /one tile/);
  assert.throws(() => campaignPath(world, { ...p, health: 0 }, [step]), /inn/);
});

test('movement predicts immediately, batches queued inputs and ignores stale polling', async () => {
  let server = fixture(); const sent: any[] = []; const resolvers: Array<() => void> = [];
  const controller = createCampaignController({ cancelPoll: async () => {}, read: async () => server, committed: () => {}, encounter: () => assert.fail('town encounter'),
    send: (revision, action) => new Promise(resolve => {
      sent.push(action); assert.equal(revision, server.progressRevision);
      resolvers.push(() => { server = { ...server, progressRevision: revision + 1, progress: campaignPath(server, server.progress, action.steps as any).progress }; resolve(server); });
    }) });
  controller.observe(server);
  controller.move({ dx: 1, dy: 0 });
  assert.deepEqual(controller.getSnapshot().view!.progress.position, { x: 5, y: 6 });
  await tick();
  for (let i = 0; i < 7; i++) controller.move({ dx: i % 2 ? 1 : -1, dy: 0 });
  const predicted = controller.getSnapshot().view!.progress.steps;
  controller.move({ dx: -1, dy: 0 });
  assert.equal(controller.getSnapshot().view!.progress.steps, predicted, 'unacknowledged steps bounded to eight');
  controller.observe(fixture()); assert.equal(controller.getSnapshot().view!.progress.steps, 8, 'poll cannot reset prediction');
  assert.equal(sent.length, 1); resolvers.shift()!(); await tick();
  assert.equal(sent.length, 2); assert.equal(sent[1].steps.length, 7);
  resolvers.shift()!(); await tick();
  assert.equal(server.progress.steps, 8); assert.equal(controller.getSnapshot().busy, false);
  assert.deepEqual(controller.getSnapshot().view!.progress, server.progress);
  controller.observe(fixture()); assert.equal(controller.getSnapshot().view!.progress.steps, 8, 'late stale poll ignored');
});

test('rejected movement resynchronizes and an encounter clears queued input', async () => {
  const view = fixture(); let reads = 0;
  const controller = createCampaignController({ cancelPoll: async () => {}, committed: () => {}, encounter: () => {},
    read: async () => { reads++; return view; }, send: async () => { throw new Error('Adventure changed'); } });
  controller.observe(view); controller.move({ dx: 1, dy: 0 }); await tick();
  assert.equal(reads, 1); assert.deepEqual(controller.getSnapshot().view!.progress.position, view.progress.position);
  assert.equal(controller.getSnapshot().busy, false);
  let release!: (value: CampaignView) => void; let encounters = 0, sends = 0;
  const next = createCampaignController({ cancelPoll: async () => {}, committed: () => {}, read: async () => view,
    encounter: () => { encounters++; }, send: () => { sends++; return new Promise(resolve => { release = resolve; }); } });
  next.observe(view); next.move({ dx: 1, dy: 0 }); await tick(); next.move({ dx: -1, dy: 0 });
  release({ ...view, progressRevision: 1, progress: { ...view.progress, activeSessionId: 'CPTEST' } }); await tick();
  next.move({ dx: 1, dy: 0 });
  assert.equal(encounters, 1); assert.equal(sends, 1); assert.equal(next.getSnapshot().view!.progress.activeSessionId, 'CPTEST');
});
