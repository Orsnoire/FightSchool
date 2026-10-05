import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialAppearance, selectAvatarJob, STARTER_JOBS, PALETTES, validAppearance } from '../../shared/avatar/appearance.ts';

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
