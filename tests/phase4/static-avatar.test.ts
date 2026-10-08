import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialAppearance, selectAvatarJob, STARTER_JOBS, AVATAR_JOBS, starterVisual, PALETTES, validAppearance } from '../../shared/avatar/appearance.ts';

test('job switches derive gear from the latest shared appearance without rerolling', () => {
 let rolls=0;
 const original=initialAppearance(null,'human-female-v1',()=>{rolls++;return 0.25;});
 assert.equal(rolls,3);
 const changed={...original,hairColorId:PALETTES.hair[7].id,skinColorId:PALETTES.skin[6].id};
 for(const job of [...STARTER_JOBS,'warrior'] as const) {
   const selected=selectAvatarJob(changed,job);
   assert.deepEqual(selected.appearance,changed);
   assert.equal(selected.job,job);
 }
 assert.equal(selectAvatarJob(changed,'warrior').kit.left,'Shield');
 assert.equal(selectAvatarJob(changed,'herbalist').kit.right,'Herbs');
 assert.equal(selectAvatarJob(changed,'herbalist').kit.left,'Potion');
 assert.equal(selectAvatarJob(changed,'wizard').kit.right,'Staff');
 assert.equal(selectAvatarJob(changed,'scout').kit.left,'Bow');
 assert.deepEqual(initialAppearance(changed,undefined,()=>{throw new Error('Do not reroll');}),changed);
 assert.equal(validAppearance({...changed,hairColorId:PALETTES.skin[0].id}),false);
});

test('legacy atlas selection remains stable while starter descriptions cover advanced weapons',()=>{
 const appearance=initialAppearance(null,'human-male-v1',()=>0.35);
 assert.equal(AVATAR_JOBS.length,12);
 for(const job of AVATAR_JOBS)assert.deepEqual(selectAvatarJob(appearance,job).appearance,appearance);
 assert.equal(starterVisual('priest').body,'wizard');
 assert.equal(starterVisual('priest').headwear,'herbalist');
 assert.equal(starterVisual('ranger').body,'scout');
 assert.equal(starterVisual('paladin').body,'warrior');
 for(const job of ['blood_knight','monk','bard'] as const) {
  assert.equal(starterVisual(job).body,'empty-bodies');
  assert.ok(starterVisual(job).missingWeapon);
  assert.notEqual(selectAvatarJob(appearance,job).kit.right,'Empty');
  assert.equal(selectAvatarJob(appearance,job).kit.missingWeapon,null);
  assert.equal(selectAvatarJob(appearance,job).kit.left,'Empty');
 }
 assert.equal(starterVisual('blood_knight').armor,'plate');
 assert.equal(starterVisual('monk').armor,'leather');
});
