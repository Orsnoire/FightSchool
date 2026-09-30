import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { recolorAvatar, hexToRgb } from '../../shared/avatar-recolor.mjs';

const folder = new URL('../../attached_assets/characters/human/v1/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
const channels = ['hair', 'eyes', 'skin'];
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');

for (const model of manifest.models) for (const [key, view] of Object.entries<any>(model.views)) {
  test(`${model.id}/${key}: masks register to source, exclude ink/clothing, and preserve alpha`, () => {
    const sourceBytes = readFileSync(new URL(view.file, folder));
    assert.equal(hash(sourceBytes), view.sha256);
    const source = PNG.sync.read(sourceBytes);
    const neutralBytes = readFileSync(new URL(view.neutralBaseFile, folder));
    assert.equal(hash(neutralBytes), view.recolorAssetSha256.neutral);
    const neutral = PNG.sync.read(neutralBytes), count = source.width * source.height;
    assert.equal(neutral.width, source.width);assert.equal(neutral.height, source.height);
    const masks: Record<string, Uint8Array> = {};
    for (const c of channels) {
      const bytes = readFileSync(new URL(view.recolorMasks[c], folder));
      assert.equal(hash(bytes), view.recolorAssetSha256[c]);
      assert.equal(bytes[25], 0, 'Masks are grayscale PNG data textures');
      const image = PNG.sync.read(bytes);
      assert.equal(image.width, source.width);assert.equal(image.height, source.height);
      masks[c] = Uint8Array.from({length:count},(_,i)=>image.data[i*4]);
      assert.ok(masks[c].some(v=>v===255));
    }
    const result = recolorAvatar(neutral.data, masks, {hair:[255,0,255],eyes:[255,255,0],skin:[0,255,0]});
    for (let i=0;i<count;i++) {
      const p=i*4, selected=channels.filter(c=>masks[c][i]);
      assert.ok(selected.length<=1, 'Channels cannot overlap');
      assert.equal(neutral.data[p+3],source.data[p+3]);
      assert.equal(result[p+3],source.data[p+3]);
      if(!source.data[p+3])assert.equal(selected.length,0,'No selection outside original alpha');
      if(!selected.length) {
        for(let k=0;k<3;k++)assert.equal(result[p+k],source.data[p+k],'Untargeted pixels must remain exact');
      } else {
        assert.equal(neutral.data[p],neutral.data[p+1]);assert.equal(neutral.data[p],neutral.data[p+2]);
        if(selected[0]==='hair')assert.equal(result[p+1],0);
        if(selected[0]==='eyes')assert.equal(result[p+2],0);
        if(selected[0]==='skin'){assert.equal(result[p],0);assert.equal(result[p+2],0);}
      }
      if(source.data[p]<=10 && source.data[p+1]<=10 && source.data[p+2]<=10)
        assert.equal(selected.length,0,'Solid pen ink and dark pupils are excluded');
    }
    // Semantic probes independently identify important regions in the approved
    // originals, rather than merely repeating the builder's classification.
    const probes: Record<string, Array<[number,number,string|null]>> = {
      'human-male-front.png': [[500,100,'hair'],[410,327,'hair'],[500,500,'skin'],[420,460,'eyes'],[421,426,null],[500,800,null]],
      'human-female-front.png': [[500,100,'hair'],[408,307,'hair'],[500,480,'skin'],[420,447,'eyes'],[421,409,null],[500,760,null]],
      'human-male-right-80.png': [[400,150,'hair'],[615,301,'hair'],[600,490,'skin'],[618,435,'eyes'],[570,700,null]],
      'human-female-right-80.png': [[480,120,'hair'],[612,275,'hair'],[610,465,'skin'],[630,410,'eyes'],[550,680,null]],
    };
    for(const [x,y,wanted] of probes[view.file]) {
      const selected=channels.filter(c=>masks[c][y*source.width+x]);
      assert.deepEqual(selected,wanted?[wanted]:[],`Wrong region at ${x},${y}`);
    }
  });
}

test('renderer handles independent palettes and rejects invalid/overlapping masks', () => {
  const base=new Uint8Array([255,255,255,137, 100,100,100,250, 220,220,220,253, 12,18,25,255]);
  const masks={hair:new Uint8Array([255,0,0,0]),eyes:new Uint8Array([0,255,0,0]),skin:new Uint8Array([0,0,255,0])};
  const colors={hair:hexToRgb('#D3AE63'),eyes:hexToRgb('#668CAA'),skin:hexToRgb('#3F2A22')};
  const out=recolorAvatar(base,masks,colors);
  assert.deepEqual(Array.from(out.slice(0,4)),[211,174,99,137]);
  assert.deepEqual(Array.from(out.slice(4,8)),[40,55,67,250]);
  assert.deepEqual(Array.from(out.slice(8,12)),[54,36,29,253]);
  assert.deepEqual(Array.from(out.slice(12)),[12,18,25,255]);
  assert.throws(()=>recolorAvatar(base,{...masks,skin:new Uint8Array([255,0,0,0])},colors),/overlap/);
  assert.throws(()=>recolorAvatar(base,{...masks,hair:new Uint8Array(1)},colors),/length/);
  assert.throws(()=>hexToRgb('blue'),/#RRGGBB/);
});
