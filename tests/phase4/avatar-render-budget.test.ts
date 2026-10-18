import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCanvas, Image } from '@napi-rs/canvas';
import { avatarSurface, ByteLru, stableVisualKey } from '../../shared/avatar/render-budget';
import { composeStaticAvatar } from '../../shared/avatar/static-renderer';
import { avatarFixture, avatarAssetPaths } from '../support/avatar-rendering-fixture';

test('avatar backing covers contained device pixels, adapts to DPR and is bounded by source detail',()=>{
  assert.deepEqual(avatarSurface(72,72,1),{width:48,height:78});
  assert.deepEqual(avatarSurface(72,72,2),{width:96,height:156});
  for(const [w,h,dpr] of [[43.2,43.2,3],[180,180,2],[200,460,1.25],[4000,3000,4]]) {
    const s=avatarSurface(w,h,dpr)!;
    assert.ok(s.width<=1200&&s.height<=1950);
    assert.ok(s.width>=Math.min(1200,Math.min(w,h*1200/1950)*dpr));
    assert.ok(Math.abs(s.width/s.height-1200/1950)<.01);
  }
  for(const args of [[0,10,1],[10,0,1],[NaN,10,1],[10,10,Infinity],[10,10,-1]])assert.equal(avatarSurface(...args as [number,number,number]),null);
});

test('composition LRU evicts by bytes and recency without invalidating caller-owned surfaces',()=>{
  const cache=new ByteLru<object>(100,3),a={},b={},c={},d={};
  cache.set('a',a,30);cache.set('b',b,30);cache.set('c',c,30);
  assert.equal(cache.get('a'),a);
  cache.set('d',d,35);
  assert.equal(cache.get('b'),undefined);assert.equal(cache.get('c'),c);
  assert.equal(cache.get('a'),a);assert.equal(cache.bytes,95);
  cache.set('a',a,90);assert.equal(cache.get('d'),undefined);assert.equal(cache.bytes,90);
  cache.set('too-large',{},101);assert.equal(cache.size,1);
  const small=new ByteLru<object>(100,2);small.set('a',a,1);small.set('b',b,1);small.set('c',c,1);
  assert.equal(small.size,2);assert.equal(small.get('a'),undefined);
  assert.deepEqual(a,{});assert.equal(stableVisualKey({b:2,a:{z:3,x:1}}),stableVisualKey({a:{x:1,z:3},b:2}));
});

test('real composition coalesces requests, keys sizes/palettes, releases scratch, and recovers after asset failure',async()=>{
  const allocated:any[]=[];
  (globalThis as any).Image=Image;
  (globalThis as any).document={createElement:()=>{const c=createCanvas(1,1);allocated.push(c);return c;}};
  const urls=avatarAssetPaths(),f=avatarFixture(1),size={width:96,height:156};
  const first=composeStaticAvatar(urls,f.appearance,f.job,f.loadout,{},size);
  const same=composeStaticAvatar(urls,{...f.appearance},f.job,{...f.loadout},{},size);
  assert.strictEqual(first,same,'in-flight work is shared');
  const cancelled=new AbortController();
  const skipped=composeStaticAvatar(urls,avatarFixture(2).appearance,f.job,f.loadout,{}, {...size,signal:cancelled.signal});
  cancelled.abort();const rejected=assert.rejects(skipped,{name:'AbortError'});
  const output=await first;await rejected;
  assert.equal(output.width,96);assert.equal(output.height,156);
  assert.strictEqual(await composeStaticAvatar(urls,f.appearance,f.job,f.loadout,{},size),output);
  assert.notEqual(await composeStaticAvatar(urls,f.appearance,f.job,f.loadout,{}, {width:48,height:78}),output);
  // @napi-rs/canvas resets zero-sized buffers to its tiny default; browsers use zero.
  assert.ok(allocated.filter(c=>c!==output&&c.width>350).length===0,'private full-size tint buffers are released');
  const broken={...urls,'male-hair':'/missing/c08-fixture.png'};
  await assert.rejects(composeStaticAvatar(broken,f.appearance,f.job,f.loadout,{},size));
  broken['male-hair']=urls['male-hair'];
  const recovered=await composeStaticAvatar(broken,f.appearance,f.job,f.loadout,{},size);
  assert.equal(recovered.width,96,'a rejected job does not poison its key or the queue');
  const swapped={...f.appearance,hairColorId:avatarFixture(2).appearance.hairColorId};
  const changed=await composeStaticAvatar(urls,swapped,f.job,f.loadout,{},size);
  assert.notDeepEqual(Buffer.from(changed.getContext('2d')!.getImageData(0,0,96,156).data),Buffer.from(output.getContext('2d')!.getImageData(0,0,96,156).data));
});

test('sized compositions retain both bodies, headwear and custom colors against full-detail rendering',async()=>{
  (globalThis as any).Image=Image;(globalThis as any).document={createElement:()=>createCanvas(1,1)};
  const urls=avatarAssetPaths();
  for(const index of [0,1,2,3,12,13,14,15]) {
    const f=avatarFixture(index),visuals={hands:{baseItemId:'t1_caster_hands',palette:{primary:'#2266aa',secondary:'#ddaa55'}}};
    const full=await composeStaticAvatar(urls,f.appearance,f.job,f.loadout,visuals);
    const size={width:96,height:156};
    const low=await composeStaticAvatar(urls,f.appearance,f.job,f.loadout,visuals,size);
    const reference=createCanvas(size.width,size.height),ctx=reference.getContext('2d');
    ctx.drawImage(full as any,0,0,size.width,size.height);
    const a=ctx.getImageData(0,0,size.width,size.height).data,b=low.getContext('2d')!.getImageData(0,0,size.width,size.height).data;
    let difference=0;
    // Compare visible colors over white; RGB in fully transparent pixels is immaterial.
    for(let i=0;i<a.length;i+=4)for(let channel=0;channel<3;channel++)difference+=Math.abs((a[i+channel]*a[i+3]/255+255-a[i+3])-(b[i+channel]*b[i+3]/255+255-b[i+3]));
    assert.ok(difference/(size.width*size.height*3)<2,`fixture ${index} retains rendered colors and silhouette`);
    const reordered={hands:{palette:{secondary:'#ddaa55',primary:'#2266aa'},baseItemId:'t1_caster_hands'}};
    assert.strictEqual(await composeStaticAvatar(urls,Object.fromEntries(Object.entries(f.appearance).reverse()) as typeof f.appearance,f.job,f.loadout,reordered,size),low);
  }
});
