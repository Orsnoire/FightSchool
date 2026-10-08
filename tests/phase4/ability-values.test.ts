import assert from "node:assert/strict";
import { test } from "node:test";
import { abilityDamage, abilityHealing, abilityPreview } from "../../shared/combat/abilityValues.ts";
import { SUPPORT, ALLIES } from "../../shared/combat/abilities.ts";
import { applyAnswer, selectAction, advancePhase } from "../../worker/combat/engine.ts";
import { started, student, fight } from "./fixtures.ts";

const id = student().id;
function setup() {
  const s = started("priest");
  const p = s.players[id];
  Object.assign(p.stats, {atk: 3, rtk: 3, str: 4, int: 5, agi: 2, mnd: 9, vit: 7});
  Object.assign(p, {health: 1, maxHealth: 200, mp: 20, maxMp: 20, comboPoints: 50, maxComboPoints: 50});
  s.enemies[0].health = s.enemies[0].maxHealth = 10000;
  return s;
}

test("calculated damage matches real resolution across direct, group and multi-hit abilities", () => {
  const cases: [string, number][] = [["fireball",15], ["frostbolt",5], ["fireblast",300], ["manabomb",10], ["headshot",10],
    ["aim",10], ["killshot",12], ["crushing_blow",7], ["siphon",5], ["sacred_strike",49], ["holy_judgment",5],
    ["ruin_strike",37], ["blood_price",75], ["shadow_requiem",37], ["crimson_slash",11], ["raining_blood",37],
    ["focused_palm",27], ["twin_shot",20], ["hunters_volley",50], ["arrowstorm",50], ["finale",56], ["crescendo",56]];
  for (const [ability, expected] of cases) {
    let s = setup();
    s.players[id].availableAbilities.push(ability);
    s = applyAnswer(s, id, "4", fight.questions[0]);
    if (SUPPORT.has(ability)) {
      s = advancePhase(advancePhase(s, fight), fight);
      s.players[id].questionAction = null;
    }
    s = selectAction(s, id, ability, "e1");
    if (!SUPPORT.has(ability)) s = advancePhase(advancePhase(s, fight), fight);
    s = advancePhase(s, fight);
    assert.equal(s.players[id].totals.damageDealt, expected, ability);
    assert.match(abilityPreview(setup().players[id], ability, true), /Base damage:/, ability);
  }
});

test("healing previews use current stats, preserve floor rounding and match capped engine heals", () => {
  const cases: [string, number][] = [["first_aid",3], ["mend",9], ["healing_potion",10], ["potion_diffuser",10],
    ["holy_light",4], ["healing_guard",9], ["lay_on_hands",8], ["holy_judgment",16], ["cleansing_chorus",1]];
  for (const [ability, expected] of cases) {
    let s = setup();
    s.players[id].availableAbilities.push(ability);
    s = applyAnswer(s, id, "4", fight.questions[0]);
    if (SUPPORT.has(ability)) {
      s = advancePhase(advancePhase(s, fight), fight);
      s.players[id].questionAction = null;
    }
    s = selectAction(s, id, ability, ALLIES.has(ability) ? id : "e1");
    if (!SUPPORT.has(ability)) s = advancePhase(advancePhase(s, fight), fight);
    s = advancePhase(s, fight);
    assert.equal(s.players[id].totals.healingDone, expected, ability);
    assert.equal(Math.floor(abilityHealing(setup().players[id], ability)!), expected);
  }
  const p = setup().players[id];
  assert.equal(abilityPreview(p, "mend_crossclass"), "Heals up to 9 HP");
  p.stats.mnd = 12;
  assert.equal(abilityPreview(p, "first_aid"), "Heals up to 4 HP");
});

test("Headshot includes the upcoming correct answer without inspecting hidden answer correctness", () => {
  const p = setup().players[id];
  p.consecutiveCorrectAnswers = 3;
  assert.equal(abilityDamage(p, "headshot"), 11);
  assert.equal(abilityPreview(p, "headshot", true), "Base damage: 12 on a correct answer (streak 4)");
  p.lastAnswerCorrect = false;
  assert.equal(abilityPreview(p, "headshot", true), "Base damage: 12 on a correct answer (streak 4)");
  let s = setup();
  s.players[id].consecutiveCorrectAnswers = 3;
  s.players[id].availableAbilities.push("headshot");
  s = selectAction(applyAnswer(s, id, "4", fight.questions[0]), id, "headshot", "e1");
  for (let i = 0; i < 3; i++) s = advancePhase(s, fight);
  assert.equal(s.players[id].totals.damageDealt, 12);
});

test("resource-dependent and conditional previews remain explicit and never mutate combat", () => {
  const p = setup().players[id];
  p.mp = 2;
  p.healingPotions = 0;
  const before = structuredClone(p);
  assert.equal(abilityPreview(p, "fireblast"), "Base damage: 30 to one enemy using all 2 MP");
  assert.equal(abilityPreview(p, "craft_healing_potion"), "Creates 1 healing potion; inventory 0 → 1/5");
  assert.equal(abilityPreview(p, "warrior_block"), "Blocks up to 4 damage per hit");
  assert.match(abilityPreview(p, "killshot"), /execute chance depends on target HP/);
  assert.match(abilityPreview(p, "shadow_requiem"), /self-healing equals total damage dealt/);
  assert.deepEqual(p, before);
  p.healingPotions = 5;
  assert.match(abilityPreview(p, "craft_healing_potion"), /Creates 0 healing potions/);
});
