import { createCanvas, Image } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeStaticAvatar } from '../../shared/avatar/static-renderer';
import { initialAppearance, STARTER_JOBS, type AvatarJob } from '../../shared/avatar/appearance';
import { STARTER_LOADOUTS, type EquipmentLoadout } from '../../shared/equipment-catalog';
(globalThis as any).Image=Image;
(globalThis as any).document={createElement:()=>createCanvas(1,1)};
const root=resolve('attached_assets/characters/human');
const urls=Object.fromEntries([
 ...['male','female'].flatMap(model=>['neutral','hair','eyes','skin'].map(channel=>[`${model}-${channel}`,`${root}/v1/recolor/${channel==='neutral'?`neutral/human-${model}-front.png`:`masks/human-${model}-front-${channel}.png`}`])),
 ...[...STARTER_JOBS,'empty-bodies'].map(name=>[name,`${root}/static-starters-v1/source/${name}.png`]),
 ...['tier-one-outfits','tier-one-caster','props','starter-harp'].map(name=>[name,`${root}/equipment-static-v1/source/${name}.png`]),
]);
const out=process.argv[2]||'artifacts/equipment-review';mkdirSync(out,{recursive:true});
const cases:Array<[string,AvatarJob,EquipmentLoadout]> = [];
for(const [family,job,weapon,offhand] of [
 ['fighter','warrior','t1_fighter_sword','t1_fighter_shield'],['caster','wizard','t1_caster_wand','t1_caster_book'],
 ['forester','scout','t1_forester_bow','t1_forester_quiver'],['healer','priest','t1_healer_ankh',null],
] as const) {
 cases.push([`${family} T0`,job,STARTER_LOADOUTS[job]]);
 const loadout={...STARTER_LOADOUTS[job],weapon,offhand};
 for(const slot of ['headgear','armor','arms','hands','legs','feet'] as const)loadout[slot]=`t1_${family}_${slot}`;
 cases.push([`${family} T1`,job,loadout]);
}
cases.push(['Mixed slots','warrior',{...cases[1][2],headgear:'t1_forester_headgear',armor:'t1_caster_armor',arms:'basic_leather_arms',hands:'t1_healer_hands',legs:'t1_forester_legs',feet:'basic_plate_boots'}]);
cases.push(['Empty slots','warrior',Object.fromEntries(Object.keys(STARTER_LOADOUTS.warrior).map(s=>[s,null])) as EquipmentLoadout]);
cases.push(['Bard lute','bard',{...STARTER_LOADOUTS.bard,weapon:'t1_bard_lute'}]);
cases.push(['Claymore','blood_knight',{...STARTER_LOADOUTS.blood_knight,weapon:'t1_fighter_claymore'}]);
if(process.argv[3]==='props') {
 cases.length=0;
 for(const [job,weapon,offhand] of [
  ['monk','basic_fist',null],['monk','t1_fighter_claws',null],['bard','basic_harp',null],['bard','basic_spoon',null],
  ['herbalist','t1_healer_herbs','t1_healer_potion'],['wizard','t1_caster_staff',null],
 ] as const)cases.push([weapon,job,{...STARTER_LOADOUTS[job],weapon,offhand}]);
}
for(const [row,model] of ['human-male-v1','human-female-v1'].entries()) {
 const c=createCanvas(1800,Math.ceil(cases.length/6)*530),ctx=c.getContext('2d');ctx.fillStyle='#f4f0e6';ctx.fillRect(0,0,c.width,c.height);
 for(const [i,[label,job,loadout]] of cases.entries()) {
  const avatar=await composeStaticAvatar(urls,initialAppearance(null,model as any,()=>.35),job,loadout);
  const x=(i%6)*300,y=Math.floor(i/6)*530;
  ctx.drawImage(avatar as any,x,y+32,300,487.5);ctx.fillStyle='#302b25';ctx.font='18px sans-serif';ctx.fillText(label,x+12,y+26);
 }
 writeFileSync(`${out}/${process.argv[3]==='props'?'props-':''}${row?'female':'male'}.png`,c.toBuffer('image/png'));
}
console.log(out);
