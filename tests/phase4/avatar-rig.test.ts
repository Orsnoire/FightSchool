import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { validateRig, sampleRig, transformPoint } from '../../shared/avatar/rig.mjs';
import { drawAvatar } from '../../shared/avatar/render.mjs';

const folder = 'attached_assets/characters/human/rig-prototype-v1/';
const rig = JSON.parse(fs.readFileSync(folder + 'rig.json', 'utf8'));
const clips = JSON.parse(fs.readFileSync(folder + 'clips.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync(folder + 'manifest.json', 'utf8'));
const near = (a: number, b: number, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);

test('rig sources and atlas regions are valid while production readiness stays false', () => {
  assert.equal(validateRig(rig, clips), true);
  assert.equal(manifest.runtimeIntegrated, false);assert.equal(manifest.rigReady, false);
  const dimensions: Record<string, { width: number; height: number }> = {};
  for (const [id, source] of Object.entries(manifest.sources) as [string, { path: string; sha256: string }][]) {
    const bytes = fs.readFileSync(source.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256);
    dimensions[id] = PNG.sync.read(bytes);
  }
  for (const sprite of Object.values(rig.sprites) as { source: string; crop: number[] }[]) {
    const [x, y, w, h] = sprite.crop, image = dimensions[sprite.source];
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= image.width && y + h <= image.height);
  }
  for (const channel of ['hair', 'eyes', 'skin']) assert.ok(manifest.palettes[manifest.channels[channel].paletteId].some((option: {hex:string}) => option.hex === manifest.defaultColors[channel]));
});

test('all clips keep feet planted and held props rigidly attached across every sampled pose', () => {
  for (const [id, clip] of Object.entries(clips) as [string, { duration: number }][]) {
    for (let i = 0; i <= 120; i++) {
      const frame = sampleRig(rig, clips, id, clip.duration * i / 120, { loop: false });
      for (const constraint of rig.feet) {
        const target = transformPoint(frame.world.root, { x: constraint.target[0], y: constraint.target[1] });
        near(frame.world[constraint.foot].x, target.x);near(frame.world[constraint.foot].y, target.y);
        near(frame.world[constraint.foot].rotation, 0);
      }
      for (const side of ['left', 'right']) {
        const bone = rig.bones.find((b: {id:string}) => b.id === side + '_grip');
        const expected = transformPoint(frame.world[side + '_hand'], bone);
        near(frame.world[bone.id].x, expected.x);near(frame.world[bone.id].y, expected.y);
      }
    }
  }
});

test('loops join at rest, seeking is deterministic, and reduced motion cannot change source data', () => {
  const before = JSON.stringify({ rig, clips });
  for (const [id, clip] of Object.entries(clips) as [string, {duration:number}][]) {
    const start = sampleRig(rig, clips, id, 0), end = sampleRig(rig, clips, id, clip.duration, {loop:false});
    assert.deepEqual(start.world, end.world);
    assert.deepEqual(sampleRig(rig, clips, id, .7).world, sampleRig(rig, clips, id, .7).world);
    assert.deepEqual(sampleRig(rig, clips, id, .7, {reducedMotion:true}).world, start.world);
  }
  assert.equal(JSON.stringify({rig, clips}), before);
  assert.throws(() => sampleRig(rig, clips, 'missing', 0));
  assert.throws(() => sampleRig(rig, clips, 'idle', NaN));
});

test('equipment swaps select replacement pieces without changing skeleton motion', () => {
  const textures = Object.fromEntries(Object.keys(rig.sprites).map(id => [id, { id }]));
  const draw = (outfit: string) => {
    const painted: string[] = [];
    const ctx = { save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},bezierCurveTo(){},closePath(){},clip(){},drawImage(texture: {id:string}){painted.push(texture.id);} };
    const frame = drawAvatar(ctx, {rig,clips}, textures, {outfit,clip:'attack',time:.9});
    return {painted,frame};
  };
  const starter = draw('starter'), armor = draw('armor');
  assert.deepEqual(starter.frame.world, armor.frame.world);
  assert.ok(starter.painted.includes('tunic'));assert.ok(!starter.painted.includes('cuirass'));
  assert.ok(armor.painted.includes('cuirass'));assert.ok(!armor.painted.includes('tunic'));
  assert.ok(armor.painted.includes('bracer'));assert.ok(armor.painted.includes('sabatons'));
  assert.ok(armor.painted.indexOf('shield') > armor.painted.indexOf('cuirass'));
  assert.ok(rig.feet[0].target[1] < rig.feet[1].target[1]);
  for (const side of ['left', 'right']) {
    const index = (id: string) => rig.parts.findIndex((p: {id:string}) => p.id === `${side}-${id}`);
    assert.ok(index('sleeve-back') < index('upperarm'));
    assert.ok(index('upperarm') < index('sleeve'));
  }
  const invalid = structuredClone(rig);invalid.bones[1].parent = 'head';assert.throws(() => validateRig(invalid,clips));
  const badLeg = structuredClone(rig);badLeg.feet[0].lengths[0] = 1;assert.throws(() => validateRig(badLeg,clips));
});
