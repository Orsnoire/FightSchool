// Run in both revisions with identical fixtures: node --import tsx tests/support/measure-avatar-rendering.ts before|after
import { createCanvas, Image } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { composeStaticAvatar } from '../../shared/avatar/static-renderer';
import { avatarFixture, avatarAssetPaths } from './avatar-rendering-fixture';
const label = process.argv[2] || 'measurement';
let created = 0, allocatedBytes = 0;
(globalThis as any).Image = Image;
(globalThis as any).document = { createElement() {
  const c = createCanvas(1, 1); created++;
  // Count requested backing allocations, not heap residency or native/GPU memory.
  const proto = Object.getPrototypeOf(c), logical={width:1,height:1};
  for (const name of ['width','height'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, name)!;
    Object.defineProperty(c, name, { get() { return logical[name]; }, set(value) {
      logical[name]=value;
      // Native canvas treats zero as its default size; emulate browser release.
      descriptor.set!.call(c, Math.max(1,value)); allocatedBytes += logical.width * logical.height * 4;
    } });
  }
  return c;
} };
const measurements = [];
mkdirSync(`artifacts/c08/${label}`, { recursive: true });
for (const count of [30, 60]) {
  const urls = avatarAssetPaths(); // Separate asset-set/cache namespace for each case.
  let firstSource:HTMLCanvasElement|undefined, mountedBackingBytes=0;
  const start = performance.now(), startCreated = created, startAllocated = allocatedBytes;
  for (let i = 0; i < count; i++) {
    const f = avatarFixture(i);
    const result = await (composeStaticAvatar as any)(urls, f.appearance, f.job, f.loadout, {}, { width:48, height:78 });
    firstSource ||= result;
    mountedBackingBytes += result.width*result.height*4;
    if (count === 30 && i < 24) {
      const preview = createCanvas(48, 78);
      preview.getContext('2d').drawImage(result as any, 0, 0, 48, 78);
      writeFileSync(`artifacts/c08/${label}/${i}.png`, preview.toBuffer('image/png'));
    }
  }
  const coldMs = performance.now() - start, coldCreated = created - startCreated;
  const requestedAllocationBytes = allocatedBytes - startAllocated;
  const first = avatarFixture(0), warmStart = performance.now(), warmCreated = created;
  const again = await (composeStaticAvatar as any)(urls, first.appearance, first.job, first.loadout, {}, { width:48, height:78 });
  measurements.push({ count, distinctAppearances: new Set(Array.from({length:count}, (_,i)=>JSON.stringify(avatarFixture(i).appearance))).size,
    requestedSize: {width:48,height:78}, actualSize:{width:firstSource!.width,height:firstSource!.height},
    mountedBackingBytes: mountedBackingBytes,
    coldCreatedCanvases:coldCreated, requestedAllocationBytes, coldMs:Math.round(coldMs),
    firstAvatarReused:again===firstSource, warmCreatedCanvases:created-warmCreated, warmMs:Math.round(performance.now()-warmStart) });
}
const report = { label, source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), node:process.version, rendererSha256:createHash('sha256').update(readFileSync('shared/avatar/static-renderer.ts')).digest('hex'),
  limits:'Native canvas fixture, sequential compositions; sums per-avatar output sizes without retaining a whole mounted DOM. RGBA backing bytes and requested allocations are not heap/GPU residency. Cold timing includes image decoding; no browser/hardware latency claim.', measurements };
writeFileSync(`docs/reviews/c08/${label}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
