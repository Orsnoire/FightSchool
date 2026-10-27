import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TIER_TWO_EQUIPMENT } from '../../shared/tier-two-equipment';
import { equipmentEffects, equipmentEffectText } from '../../shared/tier-one-equipment';
import { equipmentExclusion } from '../../shared/equipment-rules';
import { abilityHealing } from '../../shared/combat/abilityValues';
import { armorStyle, headStyle, unknownEquipment } from '../../shared/avatar/equipment-visuals';
import { snapshotEquipmentLoadout } from '../../shared/equipment-catalog';
import { started, student } from './fixtures';
import { applyAnswer, selectAction } from '../../worker/combat/engine';
import { advanceTo, fight } from './fixtures';

test('Tier 2 six-piece sets match approved budgets, names and armor permissions', () => {
  assert.equal(Object.keys(TIER_TWO_EQUIPMENT).length, 24);
  const families = [
    ['soldier', "Soldier's", {def:12,str:6,atk:3,vit:3}, 'heavy_armor', 'warrior', 'fighter'],
    ['ranger', "Ranger's", {def:6,agi:6,rtk:6}, 'leather_armor', 'scout', 'forester'],
    ['acolyte', "Acolyte's", {def:6,int:6,mat:6}, 'light_armor', 'wizard', 'caster'],
    ['ascetic', "Ascetic's", {def:6,mnd:6}, 'light_armor', 'herbalist', 'healer'],
  ] as const;
  for (const [family, prefix, expected, category, job, style] of families) {
    const items = Object.values(TIER_TWO_EQUIPMENT).filter(i => i.id.startsWith(`t2_${family}_`));
    assert.equal(items.length,6);
    assert.equal(new Set(items.map(i => i.slot)).size,6);
    const totals: Record<string,number> = {};
    for (const item of items) {
      for (const [stat,value] of Object.entries(item.stats)) totals[stat]=(totals[stat]||0)+value;
      assert.ok(item.name.startsWith(prefix)); assert.equal(item.tier,2); assert.equal(item.rarity,'common');
      assert.equal(item.armorCategory,category); assert.equal(equipmentExclusion(job,item),null);
      assert.equal(armorStyle(item.id),style);
    }
    assert.deepEqual(totals,expected);
    assert.deepEqual(unknownEquipment(snapshotEquipmentLoadout(Object.fromEntries(items.map(i=>[i.slot,i.id])))),[]);
    assert.equal(headStyle(`t2_${family}_headgear`),job);
  }
  assert.ok(equipmentExclusion('wizard',TIER_TWO_EQUIPMENT.t2_soldier_armor));
});

test('Ascetic healing stacks per worn piece and with Ankh, survives recovery and caps at missing HP', () => {
  const gear = {arms:'t2_ascetic_arms',hands:'t2_ascetic_hands',legs:'t2_ascetic_legs'};
  assert.equal(equipmentEffects(gear).healingBonus,3);
  assert.equal(equipmentEffects({...gear,hands:null}).healingBonus,2);
  assert.equal(equipmentEffects({headgear:'t2_ascetic_headgear'}).healingBonus,0);
  assert.equal(equipmentEffects({headgear:'t2_ascetic_hands'}).healingBonus,0);
  assert.match(equipmentEffectText(gear.hands),/\+1 HP/);
  for (const missing of [0,1,20]) {
    let state=started('priest'); const id=student().id; const p=state.players[id];
    p.stats.mnd=6; p.maxHealth=100; p.health=100-missing;
    p.equipmentEffects=equipmentEffects({...gear,weapon:'t1_healer_ankh'});
    assert.equal(abilityHealing(p,'first_aid'),6);
    state=JSON.parse(JSON.stringify(state));
    state=selectAction(applyAnswer(state,id,'4',fight.questions[0]),id,'first_aid',id);
    state=advanceTo(state,'question_resolution');
    assert.equal(state.players[id].totals.healingDone,Math.min(missing,6));
  }
});
