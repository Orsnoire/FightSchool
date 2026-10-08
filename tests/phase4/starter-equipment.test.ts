import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_CHARACTER_CLASSES, EQUIPMENT_ITEMS, calculateLoadoutEquipmentStats, getStartingEquipment } from '../../shared/schema.ts';
import { EQUIPMENT_SLOTS, SLOT_LABELS, STARTER_ITEM_IDS, ownedEquipment } from '../../shared/equipment-catalog.ts';
import { equipmentExclusion, handConflict, equipmentPermissions, equipmentUnavailable, armorClassificationError } from '../../shared/equipment-rules.ts';
import { JOB_TREE } from '../../shared/jobSystem.ts';
test('every job has an owned, compatible starter loadout and explicit armor exclusions',()=>{
 for(const job of ALL_CHARACTER_CLASSES) {
  const loadout=getStartingEquipment(job);
  assert.ok(Array.isArray(JOB_TREE[job].armorExclusions));
  for(const slot of EQUIPMENT_SLOTS) {
   const id=loadout[slot];if(!id)continue;
   assert.ok(STARTER_ITEM_IDS.includes(id),`${job} ${slot} ${id} must be permanent`);
   assert.equal(EQUIPMENT_ITEMS[id].slot,slot);
   assert.equal(equipmentExclusion(job,EQUIPMENT_ITEMS[id]),null,`${job} ${id}`);
  }
  assert.equal(handConflict(loadout.weapon?EQUIPMENT_ITEMS[loadout.weapon]:null,loadout.offhand?EQUIPMENT_ITEMS[loadout.offhand]:null),false);
 }
 const inventory=ownedEquipment(['owned-upgrade','basic_sword','owned-upgrade']);
 assert.deepEqual(ownedEquipment(inventory),inventory);
 assert.ok(inventory.includes('owned-upgrade'));
 assert.equal(equipmentExclusion('wizard',EQUIPMENT_ITEMS.basic_armor),'This armor category is excluded for this job');
 assert.equal(equipmentExclusion('scout',EQUIPMENT_ITEMS.basic_robe),null);
 assert.equal(handConflict(EQUIPMENT_ITEMS.basic_claymore,EQUIPMENT_ITEMS.basic_shield),true);
 assert.equal(handConflict(EQUIPMENT_ITEMS.basic_bow,EQUIPMENT_ITEMS.basic_quiver),false);
 assert.deepEqual(EQUIPMENT_ITEMS.basic_potion.stats,{});
});

test('eight equipment slots include distinct arms and hands, with Tier 0 starters and preserved stats', () => {
 assert.deepEqual(EQUIPMENT_SLOTS.map(slot => SLOT_LABELS[slot]), ['Weapon','Off hand','Head','Chest','Arms','Hands','Pants','Feet']);
 for (const id of STARTER_ITEM_IDS) assert.equal(EQUIPMENT_ITEMS[id].tier, 0);
 for (const job of ALL_CHARACTER_CLASSES) {
  const loadout = getStartingEquipment(job);
  assert.ok(loadout.arms);
  assert.deepEqual(EQUIPMENT_ITEMS[loadout.arms!].stats, {});
 }
 assert.equal(calculateLoadoutEquipmentStats(getStartingEquipment('warrior')).def, 2);
 assert.equal(calculateLoadoutEquipmentStats(getStartingEquipment('warrior')).atk, 1);
 assert.equal(calculateLoadoutEquipmentStats(getStartingEquipment('priest')).mat, 1);
 assert.equal(calculateLoadoutEquipmentStats({arms:null}).str, 0);
});

test('Tier 0 completes every armor material and supported weapon family without changing starter balance', () => {
 for (const category of ['heavy_armor','leather_armor','light_armor']) {
  for (const slot of ['headgear','armor','arms','hands','legs','feet']) {
   assert.ok(STARTER_ITEM_IDS.some(id => EQUIPMENT_ITEMS[id].slot === slot && EQUIPMENT_ITEMS[id].armorCategory === category), `${category} ${slot}`);
  }
 }
 for (const weapon of ['sword','staff','bow','herbs','two-handed-sword','fist','claws','harp','spoon']) {
  assert.ok(STARTER_ITEM_IDS.some(id=>EQUIPMENT_ITEMS[id].weaponType===weapon && EQUIPMENT_ITEMS[id].tier===0),weapon);
 }
 const claymore=EQUIPMENT_ITEMS.basic_claymore;
 assert.equal(claymore.name,'Starter Claymore (Two-Handed Sword)');
 assert.equal(claymore.weaponType,'two-handed-sword');
 assert.equal(equipmentExclusion('blood_knight',claymore),null);
 assert.equal(getStartingEquipment('blood_knight').weapon,claymore.id);
 assert.deepEqual(claymore.stats,{atk:2});
 for (const job of ALL_CHARACTER_CLASSES) {
  const loadout=getStartingEquipment(job);
  for (const slot of ['headgear','armor','arms','hands','legs','feet'] as const) assert.ok(loadout[slot],`${job} ${slot}`);
 }
});

test('permissions match enforcement and unavailable gear explains job, tier and hand conflicts',()=>{
 assert.deepEqual(equipmentPermissions('priest'),{weapons:['Staff','Wand'],armor:['Cloth / light'],offhands:[]});
 assert.deepEqual(equipmentPermissions('blood_knight').offhands,[]);
 assert.deepEqual(equipmentPermissions('ranger').offhands,['quiver']);
 assert.equal(equipmentUnavailable('paladin',EQUIPMENT_ITEMS.basic_claymore,1,EQUIPMENT_ITEMS.basic_sword,EQUIPMENT_ITEMS.basic_shield),'Remove the incompatible off-hand item first.');
 assert.equal(equipmentUnavailable('warrior',{...EQUIPMENT_ITEMS.basic_sword,tier:2},1,null,null),'Requires job level 2 (Tier 2).');
 assert.match(equipmentUnavailable('priest',EQUIPMENT_ITEMS.basic_plate_gloves,1,null,null)!,/armor category/);
 for(const slot of ['headgear','armor','arms','hands','legs','feet'] as const) {
  assert.ok(armorClassificationError({slot}));
  assert.equal(armorClassificationError({slot,armorCategory:'heavy_armor'}),null);
 }
 assert.ok(armorClassificationError({slot:'weapon',armorCategory:'heavy_armor'}));
 assert.equal(armorClassificationError({slot:'weapon'}),null);
});
