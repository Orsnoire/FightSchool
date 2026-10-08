import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createCanvas, Image } from '@napi-rs/canvas';
import { avatarEquipment, armorStyle, headStyle, propStyle, unknownEquipment } from '../../shared/avatar/equipment-visuals';
import { STARTER_LOADOUTS, snapshotEquipmentLoadout } from '../../shared/equipment-catalog';
import { TIER_ONE_EQUIPMENT } from '../../shared/tier-one-equipment';
import { initialAppearance, STARTER_JOBS } from '../../shared/avatar/appearance';
import { composeStaticAvatar } from '../../shared/avatar/static-renderer';
import { addStudent, removeStudent, initialCombatState } from '../../worker/combat/engine';
import { fight, student } from './fixtures';

test('visual slots preserve empty choices, distinguish the laurel, and retain approved head budgets',()=>{
 assert.deepEqual(avatarEquipment('warrior'),STARTER_LOADOUTS.warrior);
 const empty=avatarEquipment('warrior',{});
 assert.ok(Object.values(empty).every(v=>v===null));
 assert.equal(headStyle(null),null);assert.equal(headStyle('custom-hat'),null);
 assert.equal(headStyle('t1_healer_headgear'),'herbalist');
 assert.equal(TIER_ONE_EQUIPMENT.t1_healer_headgear.name,"Healer's Laurel");
 for(const family of ['healer','caster','forester'])assert.deepEqual(TIER_ONE_EQUIPMENT[`t1_${family}_headgear`].stats,{def:1});
 assert.deepEqual(TIER_ONE_EQUIPMENT.t1_fighter_headgear.stats,{def:1,str:1});
 assert.equal(armorStyle('t1_caster_arms'),'caster');assert.equal(armorStyle('custom-arms'),'linen');
 assert.equal(propStyle('t1_caster_book'),'spellbook');assert.equal(propStyle(null),null);
 assert.deepEqual(unknownEquipment({...empty,weapon:'custom-weapon'}),['weapon']);
});

test('combat equipment is frozen, serialized, and preserved on duplicate join and rejoin',()=>{
 const record=student('warrior'),loadout={...STARTER_LOADOUTS.warrior,headgear:null,weapon:'t1_fighter_sword'};
 const profile={levels:{warrior:2},equipmentLoadout:loadout};
 let state=addStudent(initialCombatState('GEAR01',fight),record,profile);
 const frozen=snapshotEquipmentLoadout(loadout);
 loadout.weapon='basic_sword';
 assert.deepEqual(state.players[record.id].equipmentLoadout,frozen);
 state=JSON.parse(JSON.stringify(state));
 state=addStudent(state,record,profile);assert.deepEqual(state.players[record.id].equipmentLoadout,frozen);
 state=removeStudent(state,record.id);
 state=addStudent(state,record,profile);assert.deepEqual(state.players[record.id].equipmentLoadout,frozen);
 // Older rooms deliberately lack a snapshot and use a deterministic starter visual fallback.
 const legacy=addStudent(initialCombatState('GEAR02',fight),record);
 assert.equal(legacy.players[record.id].equipmentLoadout,undefined);
});

test('production renderer changes individual slots without repainting identity, on both bodies',async()=>{
 (globalThis as any).Image=Image;(globalThis as any).document={createElement:()=>createCanvas(1,1)};
 const root=new URL('../../attached_assets/characters/human/',import.meta.url);
 const urls=Object.fromEntries([
  ...['male','female'].flatMap(model=>['neutral','hair','eyes','skin'].map(channel=>[`${model}-${channel}`,new URL(`v1/recolor/${channel==='neutral'?`neutral/human-${model}-front.png`:`masks/human-${model}-front-${channel}.png`}`,root).pathname])),
  ...[...STARTER_JOBS,'empty-bodies'].map(name=>[name,new URL(`static-starters-v1/source/${name}.png`,root).pathname]),
  ...['tier-one-outfits','tier-one-caster','props','starter-harp'].map(name=>[name,new URL(`equipment-static-v1/source/${name}.png`,root).pathname]),
 ]);
 for(const model of ['human-male-v1','human-female-v1'] as const) {
  const appearance=initialAppearance(null,model,()=>.35),gear={...STARTER_LOADOUTS.wizard};
  const original=await composeStaticAvatar(urls,appearance,'wizard',gear);
  const gloves=await composeStaticAvatar(urls,appearance,'wizard',{...gear,hands:'t1_caster_hands'});
  const pixels=(c:HTMLCanvasElement,y:number,h:number)=>Buffer.from(c.getContext('2d')!.getImageData(0,y,1200,h).data);
  assert.deepEqual(pixels(original,0,1200),pixels(gloves,0,1200),'gloves must not change head, hair, skin palette or chest');
  assert.notDeepEqual(pixels(original,1250,400),pixels(gloves,1250,400),'equipped glove color must appear');
  const hatless=await composeStaticAvatar(urls,appearance,'wizard',{...gear,headgear:null});
  assert.notDeepEqual(pixels(original,0,1050),pixels(hatless,0,1050));
  assert.deepEqual(pixels(original,1200,700),pixels(hatless,1200,700),'headgear must not replace the body or held gear');
  assert.strictEqual(await composeStaticAvatar(urls,appearance,'wizard',gear),original,'identical loadouts reuse the cached canvas');
 }
 // Source originals remain immutable; the package adds separate revisioned candidates.
 const manifest=JSON.parse(readFileSync(new URL('../../attached_assets/characters/human/equipment-static-v1/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.status,'review');assert.equal(manifest.animationReady,false);
});
