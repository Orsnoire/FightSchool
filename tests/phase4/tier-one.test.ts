import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TIER_ONE_EQUIPMENT, TIER_ONE_LOOT_POOLS, equipmentEffects } from '../../shared/tier-one-equipment';
import { instanceLoot } from '../../shared/combat/instance-loot';
import { equipmentExclusion, equipmentUnavailable, handConflict } from '../../shared/equipment-rules';
import { ownedEquipment } from '../../shared/equipment-catalog';
import { abilityDamage, abilityHealing, abilityPreview } from '../../shared/combat/abilityValues';
import { applyAnswer, selectAction, advancePhase } from '../../worker/combat/engine';
import { fight, started, student } from './fixtures';
const id = student().id;

test('Tier 1 budgets, ownership, level gates and wand/book permissions match the approved collection',()=>{
 assert.equal(Object.keys(TIER_ONE_EQUIPMENT).length,37);
 for (const set of ['healer','caster','forester','fighter']) {
  const armor = Object.values(TIER_ONE_EQUIPMENT).filter(item=>item.id.startsWith(`t1_${set}_`) && !['weapon','offhand'].includes(item.slot));
  assert.equal(armor.length,6);
  const totals:Record<string,number>={};
  for(const item of armor)for(const [key,n] of Object.entries(item.stats))totals[key]=(totals[key]||0)+n;
  assert.deepEqual(totals,set==='fighter'?{def:3,str:3,vit:3}: {def:3,[set==='healer'?'mnd':set==='caster'?'int':'agi']:3});
 }
 const gear=TIER_ONE_EQUIPMENT;
 assert.ok(Object.keys(gear).every(id=>!ownedEquipment().includes(id)));
 assert.match(equipmentUnavailable('wizard',gear.t1_caster_wand,1,null,null)!,/level 2/);
 assert.equal(equipmentUnavailable('wizard',gear.t1_caster_wand,2,null,null),null);
 assert.equal(handConflict(gear.t1_caster_staff,gear.t1_caster_book),true);
 assert.equal(handConflict(gear.t1_caster_wand,gear.t1_caster_book),false);
 assert.equal(equipmentExclusion('priest',gear.t1_healer_ankh),null);
 assert.ok(equipmentExclusion('wizard',gear.t1_healer_ankh));
 assert.ok(equipmentExclusion('priest',gear.t1_caster_book));
 assert.deepEqual(gear.t1_bard_lute.stats,{rtk:1,agi:1,str:1,vit:1});
});

test('each unassigned room draws once per family, preserves assigned rewards and uses no combat RNG',()=>{
 const assigned=[{itemId:'custom-assigned'}];
 assert.deepEqual(instanceLoot(assigned,'one'),assigned);
 assert.notEqual(instanceLoot(assigned,'one'),assigned);
 const first=instanceLoot([],'one');
 assert.equal(new Set(first.map(x=>x.itemId)).size,4);
 assert.deepEqual(instanceLoot([],'one'),first);
 Object.values(TIER_ONE_LOOT_POOLS).forEach((pool,i)=>assert.ok(pool.includes(first[i].itemId)));
 const draws=new Set(Array.from({length:40},(_,i)=>JSON.stringify(instanceLoot([],String(i)))));
 assert.ok(draws.size>30);
 const reachable=new Set(Array.from({length:300},(_,i)=>instanceLoot([],String(i))).flat().map(x=>x.itemId));
 assert.ok(Object.keys(TIER_ONE_EQUIPMENT).every(id=>reachable.has(id)));
});

test('ankh adds one after First Aid rounding in previews and actual heals, capped by missing HP',()=>{
 for(const mnd of [1,5,8])for(const missing of [0,1,10]){
  let state=started('priest');
  const p=state.players[id];
  p.stats.mnd=mnd; p.maxHealth=100; p.health=100-missing;
  p.equipmentEffects=equipmentEffects({weapon:'t1_healer_ankh'});
  const expected=Math.max(1,Math.floor(mnd/3))+1;
  assert.equal(abilityHealing(p,'first_aid'),expected);
  assert.match(abilityPreview(p,'first_aid'),new RegExp(`${expected} HP`));
  state=selectAction(applyAnswer(state,id,'4',fight.questions[0]),id,'first_aid',id);
  for(let i=0;i<3;i++)state=advancePhase(state,fight);
  assert.equal(state.players[id].totals.healingDone,Math.min(missing,expected));
 }
 const p=started('priest').players[id];p.equipmentEffects=equipmentEffects({weapon:'t1_healer_ankh'});
 assert.equal(abilityHealing(p,'mend'),p.stats.mnd+1);
 assert.equal(abilityHealing(p,'healing_potion'),p.stats.mnd+2);
});

test('VIT damage weight halves while direct healing retains full VIT weight',()=>{
 const p=started('paladin').players[id];Object.assign(p.stats,{atk:2,str:3,int:4,mnd:5,vit:8});
 assert.equal(abilityDamage(p,'sacred_strike'),24);
 assert.equal(abilityDamage(p,'ruin_strike'),22);
 assert.equal(abilityDamage(p,'blood_price'),44);
 assert.equal(abilityDamage(p,'crimson_slash'),7);
 assert.equal(abilityHealing(p,'lay_on_hands'),6);
 assert.equal(abilityHealing(p,'holy_judgment'),13);
});

test('potion attack buff refreshes without stacking, survives serialization and expires after three rounds',()=>{
 const longFight={...fight,questions:Array.from({length:8},(_,i)=>({...fight.questions[0],id:`q${i}`}))};
 let state=started('herbalist');state.enemies[0].health=state.enemies[0].maxHealth=100000;
 const p=state.players[id];p.maxHealth=p.health=1000;p.equipmentEffects=equipmentEffects({offhand:'t1_healer_potion'});
 const base=p.stats.atk;
 const round=(potion:boolean)=>{
  const question=longFight.questions[state.currentQuestionIndex];
  state=applyAnswer(state,id,'4',question);
  state=selectAction(state,id,potion?'healing_potion':'attack',potion?id:'e1');
  state=advancePhase(advancePhase(advancePhase(state,longFight),longFight),longFight);
 };
 round(true);
 assert.equal(state.players[id].stats.atk,base+1);
 assert.equal(state.players[id].buffs['stat:atk'].rounds,3);
 state=JSON.parse(JSON.stringify(state));
 state=advancePhase(advancePhase(state,longFight),longFight);
 round(true);
 assert.equal(state.players[id].stats.atk,base+1);
 for(let i=0;i<3;i++){
  state=advancePhase(advancePhase(state,longFight),longFight);
  if(i<2)round(false);
 }
 assert.equal(state.players[id].stats.atk,base);
 assert.equal(state.players[id].buffs['stat:atk'],undefined);
});
