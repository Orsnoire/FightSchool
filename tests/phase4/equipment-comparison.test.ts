import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareEquipment, type ComparisonLoadout } from '../../shared/equipment-comparison';
import { EQUIPMENT_ITEMS } from '../../shared/schema';
const gear=EQUIPMENT_ITEMS;
const context:ComparisonLoadout={student:{characterClass:'paladin',weapon:'t1_fighter_sword',offhand:'t1_fighter_shield'},items:gear,level:2};
test('comparisons include lost offhand bonuses, signed and removed stats, and do not mutate gear',()=>{
 const before=JSON.stringify(context);
 const r=compareEquipment(gear.t1_fighter_claymore,context);
 assert.ok(!('unavailable' in r));
 assert.equal(r.removedOffhand?.id,'t1_fighter_shield');
 assert.deepEqual(r.rows,[{stat:'STR',before:2,after:3,delta:1},{stat:'DEF',before:2,after:0,delta:-2},{stat:'ATK',before:1,after:2,delta:1}]);
 assert.match(r.blocker!,/off-hand/);
 const penalty=compareEquipment({...gear.basic_sword,stats:{str:-2}},context);
 assert.ok(!('unavailable' in penalty));assert.equal(penalty.rows.find(x=>x.stat==='STR')?.delta,-4);
 assert.equal(JSON.stringify(context),before);
});
test('empty slots, same items, special effects and restrictions stay explicit',()=>{
 const empty=compareEquipment(gear.t1_healer_ankh,{...context,student:{characterClass:'priest'},level:1});
 assert.ok(!('unavailable' in empty));assert.equal(empty.current,null);assert.match(empty.gainedEffect!,/First Aid/);assert.match(empty.blocker!,/level 2/);
 const loss=compareEquipment(gear.basic_staff,{...context,student:{characterClass:'priest',weapon:'t1_healer_ankh'}});
 assert.ok(!('unavailable' in loss));assert.equal(loss.lostEffects.length,1);
 const same=compareEquipment(gear.t1_fighter_sword,context);
 assert.ok(!('unavailable' in same));assert.equal(same.equipped,true);assert.ok(same.rows.every(row=>row.delta===0));
 const potion=compareEquipment(gear.basic_potion,{...context,student:{characterClass:'herbalist',weapon:'basic_herbs',offhand:'t1_healer_potion'}});
 assert.ok(!('unavailable' in potion));assert.match(potion.lostEffects[0],/3 rounds/);
});
test('unknown or refreshing loadouts never masquerade as empty slots',()=>{
 for(const patch of [{loading:true},{error:true},{items:{}},{student:undefined}]){
  assert.ok('unavailable' in compareEquipment(gear.basic_sword,{...context,...patch}));
 }
});
