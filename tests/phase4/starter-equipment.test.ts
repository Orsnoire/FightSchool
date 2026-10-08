import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_CHARACTER_CLASSES, EQUIPMENT_ITEMS, calculateLoadoutEquipmentStats, getStartingEquipment } from '../../shared/schema.ts';
import { EQUIPMENT_SLOTS, SLOT_LABELS, STARTER_ITEM_IDS, ownedEquipment } from '../../shared/equipment-catalog.ts';
import { equipmentExclusion, handConflict } from '../../shared/equipment-rules.ts';
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
