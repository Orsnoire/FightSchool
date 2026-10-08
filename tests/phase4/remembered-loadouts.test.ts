import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureLoadout, restoreLoadout } from '../../shared/job-loadouts';
import { getStartingEquipment } from '../../shared/schema';
import { getCrossClassAbilities } from '../../shared/jobSystem';

test('remembered loadouts retain empty slots and sanitize removed, unowned, wrong-slot, class and tier-invalid equipment', () => {
  const start = captureLoadout(getStartingEquipment('warrior'));
  const armor = {id:'upgrade', slot:'armor' as const, armorCategory:'heavy_armor', tier:2};
  const saved = {...start, weapon:'missing', headgear:'basic_sword', armor:'upgrade', hands:null, offhand:null};
  const restored = restoreLoadout('warrior', saved, ['upgrade'], {warrior:1}, {upgrade:armor});
  assert.equal(restored.weapon,start.weapon);
  assert.equal(restored.headgear,start.headgear);
  assert.equal(restored.armor,start.armor);
  assert.equal(restored.hands,null);
  assert.equal(restored.offhand,null);
  assert.equal(restoreLoadout('warrior',saved,['upgrade'],{warrior:2},{upgrade:armor}).armor,'upgrade');
  assert.equal(restoreLoadout('warrior',saved,[],{warrior:2},{upgrade:armor}).armor,start.armor);
  assert.equal(restoreLoadout('wizard',saved,['upgrade'],{wizard:2},{upgrade:armor}).armor,getStartingEquipment('wizard').armor);
  assert.deepEqual(restoreLoadout('warrior',undefined,[],{},{}),start);
});

test('restoration rechecks held-item pairs and cross-class unlocks, including duplicates and native-job abilities', () => {
  const levels = {warrior:15, wizard:15, herbalist:15};
  const abilities = getCrossClassAbilities('warrior', levels as any);
  const saved = {...captureLoadout(getStartingEquipment('warrior')), crossClassAbility1:abilities[0].id, crossClassAbility2:abilities[1].id};
  assert.deepEqual(restoreLoadout('warrior',saved,[],levels,{}),saved);
  assert.equal(restoreLoadout('warrior',{...saved,crossClassAbility2:abilities[0].id},[],levels,{}).crossClassAbility2,null);
  const revoked = restoreLoadout('warrior',saved,[],{},{});
  assert.equal(revoked.crossClassAbility1,null);
  assert.equal(revoked.crossClassAbility2,null);
  const native = restoreLoadout('wizard',saved,[],levels,{});
  assert.equal(native.crossClassAbility1,null);
  const twoHanded = restoreLoadout('paladin',{...saved,weapon:'basic_claymore'},[],{paladin:1},{});
  assert.equal(twoHanded.weapon,'basic_claymore');
  assert.equal(twoHanded.offhand,null);
});
