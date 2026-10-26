import assert from "node:assert/strict";
import { test } from "node:test";
import { abilityDamage, abilityDot, abilityPreview } from "../../shared/combat/abilityValues";
import { applyAbility } from "../../worker/combat/ability-execution";
import { advancePhase } from "../../worker/combat/engine";
import { combatReward } from "../../worker/db/game-repository";
import { endFight } from "../../worker/combat/host-controls";
import { started, student, fight } from "./fixtures";

const id=student().id;
function room() {
  const s=started("warlock");const p=s.players[id];
  Object.assign(p.stats,{mat:5,int:4,atk:8,agi:0});p.health=p.maxHealth=1000;p.mp=100;
  p.availableAbilities.push("hemorrhage","mend");p.stats.mnd=9;
  s.enemies[0].health=s.enemies[0].maxHealth=1000;
  s.enemies[0].defense=100;s.enemies[0].magicDefense=2;
  return s;
}
function resolve(s:ReturnType<typeof room>, ability:string|null=null) {
  s.currentPhase="abilities"; const p=s.players[id];p.hasAnswered=true;p.lastAnswerCorrect=true;
  p.questionAction=ability?{ability,targetId:"e1"}:null;p.supportActions=[];
  return advancePhase(s,{...fight,baseEnemyDamage:0});
}
function next(s:ReturnType<typeof room>) {
  return advancePhase(advancePhase(s,{...fight,baseEnemyDamage:0}),{...fight,baseEnemyDamage:0});
}

test("Hex initial hit and full subsequent duration share MAT-based values, use MDF and credit actual tick damage",()=>{
  let s=room();const p=s.players[id];
  assert.equal(abilityDamage(p,"hex"),9);assert.deepEqual(abilityDot(p,"hex"),{damage:8,rounds:2});
  assert.equal(abilityPreview(p,"hex"),"Base damage: 9 initially; 8 base damage per subsequent round × 2; reduced by MDF");
  s=resolve(s,"hex");assert.equal(s.players[id].totals.damageDealt,7);
  assert.equal(s.enemies[0].effects[0].rounds,2);
  s=next(s);assert.equal(s.enemies[0].effects[0].rounds,2);
  const recovered=JSON.parse(JSON.stringify(s));
  assert.deepEqual(resolve(structuredClone(s)),resolve(recovered));
  s=resolve(s);assert.equal(s.players[id].totals.damageDealt,13);
  assert.ok(s.events.some(e=>e.abilityId==="hex"&&e.effect==="curse"&&e.message.startsWith("Hex tick:")));
  s=resolve(next(s));assert.equal(s.players[id].totals.damageDealt,19);
  s=next(s);assert.equal(s.enemies[0].effects.length,0);
  s=resolve(s);assert.equal(s.players[id].totals.damageDealt,19);
  assert.equal(combatReward(endFight(s),s.players[id],{...fight,baseXP:0}).xp,23,"four correct + actual initial/tick damage exactly once");
});

test("Hex recasts refresh without stacking or cancelling a due tick; independent casters retain separate effects",()=>{
  let s=resolve(room(),"hex");s=resolve(next(s),"hex");
  assert.equal(s.players[id].totals.damageDealt,20,"7 initial + 7 recast + 6 due tick");
  assert.equal(s.enemies[0].effects.length,1);assert.equal(s.enemies[0].effects[0].rounds,2);
  const other={...structuredClone(s.players[id]),studentId:"other"};s.players.other=other;
  applyAbility(s,other,"hex","e1");assert.equal(s.enemies[0].effects.length,2);
  const before=s.players[id].totals.damageDealt;
  s=resolve(next(s));assert.equal(s.players[id].totals.damageDealt-before,6);
});

test("Hex rank upgrades affect duration and Soul Echo initial damage; Hemorrhage stays physical for two later rounds",()=>{
  let s=room();const p=s.players[id];p.jobLevels.warlock=15;
  assert.deepEqual(abilityDot(p,"hex"),{damage:8,rounds:5});assert.equal(abilityDamage(p,"hex"),29);
  assert.deepEqual(abilityDot(p,"hemorrhage"),{damage:4,rounds:2});
  s.enemies[0].defense=1;s.enemies[0].magicDefense=100;
  s=resolve(s,"hemorrhage");assert.equal(s.players[id].totals.damageDealt,7);
  s=resolve(next(s));assert.equal(s.players[id].totals.damageDealt,10);
  s=resolve(next(s));assert.equal(s.players[id].totals.damageDealt,13);
  s=resolve(next(s));assert.equal(s.players[id].totals.damageDealt,13);
});

test("Hex is fully mitigated by sufficient MDF and caps overkill credit; a wrong answer cannot apply it",()=>{
  let s=room();s.enemies[0].magicDefense=100;
  s=resolve(s,"hex");s=resolve(next(s));assert.equal(s.players[id].totals.damageDealt,0);
  s=room();s.enemies[0].health=3;s=resolve(s,"hex");assert.equal(s.players[id].totals.damageDealt,3);
  s=room();s.currentPhase="abilities";s.players[id].hasAnswered=true;s.players[id].lastAnswerCorrect=false;
  s.players[id].questionAction={ability:"hex",targetId:"e1"};s=advancePhase(s,fight);
  assert.equal(s.enemies[0].effects.length,0);assert.equal(s.players[id].totals.damageDealt,0);
});

test("current direct healing credits only HP restored and does not silently become a HoT",()=>{
  let s=room();s.players[id].health=996;
  applyAbility(s,s.players[id],"mend",id);assert.equal(s.players[id].totals.healingDone,4);
  s=resolve(s);s=next(s);s.players[id].health=990;s=resolve(s);
  assert.equal(s.players[id].health,990);assert.equal(s.players[id].totals.healingDone,4);
});
