import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AA_CATALOG, aaWallet, resolveAAEffects, aaTier, preserveCombo } from '../../shared/aa';
import { calculateCharacterStats, calculatePlayerBaseDamage, ALL_CHARACTER_CLASSES, getStartingEquipment, calculateLoadoutEquipmentStats } from '../../shared/schema';
import { equipmentExclusion, handConflict } from '../../shared/equipment-rules';
import { abilityHealing, abilityDot } from '../../shared/combat/abilityValues';
import { prepareStatusActions, naturalAgilityAttack } from '../../shared/combat/status-effects';
import { applyAbility } from '../../worker/combat/ability-execution';
import { damagePlayer } from '../../worker/combat/health';
import { started, student } from './fixtures';

test('AA catalog retains exact stat costs, lower chance curves, conversion and tier rank limits', () => {
  assert.equal(new Set(AA_CATALOG.map(x => x.id)).size, AA_CATALOG.length);
  const all = Object.fromEntries(AA_CATALOG.filter(x => x.kind !== 'cosmetic').map(x => [x.id, x.costs.length]));
  for (const [tier, cap] of [[1, 1], [2, 2], [3, 4], [4, 10]]) {
    const effect = resolveAAEffects(all, tier, 'staff');
    assert.equal(effect.primary.int, cap);
    assert.equal(effect.flat.mat, Math.min(5, cap) + Math.min(6, cap));
    assert.equal(effect.extraSlots, Math.min(3, cap));
    for (const upgrade of AA_CATALOG.filter(x => x.kind !== 'cosmetic'))
      assert.equal(effect.ranks[upgrade.id], Math.min(upgrade.costs.length, cap));
  }
  assert.equal(resolveAAEffects(all, 4).dodgeChance, .4);
  assert.equal(resolveAAEffects(all, 4).potionChance, .5);
  assert.equal(resolveAAEffects(all, 4).agilityChance, .75);
  assert.equal(AA_CATALOG.find(x => x.id === 'stat:str')!.costs.reduce((a, b) => a + b, 0), 110);
  assert.equal(aaTier({ guildTier: 2, campaignTier: 3 }), 2);
  for (const xp of [0, 59, 60, 61, 125, 2147483647]) {
    const wallet = aaWallet(xp);
    assert.equal(wallet.total * 60 + wallet.xpTowardNext, xp);
  }
  assert.equal(preserveCombo(0, 0, 3), 0);
  assert.equal(preserveCombo(2, 1, 2), 2);
  assert.equal(preserveCombo(3, 2, 2), 2);
});

test('AA stats feed shared class, ability and healing formulas once; licenses preserve other equipment rules', () => {
  for (const job of ALL_CHARACTER_CLASSES) {
    const gear = calculateLoadoutEquipmentStats(getStartingEquipment(job));
    const effects = resolveAAEffects({ 'stat:int': 3, 'natural:arcane-knowledge': 2, health: 2, mana: 2, 'specialization:staff': 2 }, 2, 'staff');
    const base = calculateCharacterStats(job, gear, {});
    const stats = calculateCharacterStats(job, gear, {}, {}, effects);
    assert.equal(stats.int - base.int, 2);
    assert.equal(stats.mat - base.mat, 4);
    assert.equal(stats.maxMp - base.maxMp, 26);
    assert.equal(stats.maxHp - base.maxHp, 20);
    assert.ok(Number.isFinite(calculatePlayerBaseDamage(stats, job)));
  }
  const s = started('warlock'), p = s.players[student().id];
  p.advancement = resolveAAEffects({ 'natural:wisdom': 2 }, 2);
  assert.equal(abilityHealing(p, 'healing_potion'), p.stats.mnd + 3);
  assert.equal(abilityHealing(p, 'inner_peace'), p.maxHealth);
  assert.equal(abilityDot(p, 'hex')!.damage, Math.max(0, p.stats.mat + p.stats.int - 1));
  const staff = { id: 'staff', slot: 'weapon' as const, weaponType: 'staff', classRestriction: ['wizard' as const] };
  assert.ok(equipmentExclusion('warrior', staff));
  assert.equal(equipmentExclusion('warrior', staff, { 'weapon:staff': 1 }), null);
  assert.equal(equipmentExclusion('wizard', { id: 'heavy', slot: 'hands', armorCategory: 'heavy_armor' }, { 'armor:heavy_armor:hands': 1 }), null);
  assert.ok(equipmentExclusion('wizard', { id: 'heavy', slot: 'armor', armorCategory: 'heavy_armor' }, { 'armor:heavy_armor:hands': 1 }));
  assert.equal(handConflict(staff, { id: 'shield', slot: 'offhand', offhandType: 'shield' }), true);
});

test('Natural Agility prepares once, attacks through eligible control, and never enables support or Priest healing', () => {
  for (const [roll, allowed] of [[.249999, true], [.25, false]] as const) {
    const s = started('wizard'), p = s.players[student().id]; s.round = 2;
    p.advancement = resolveAAEffects({ 'natural:agility': 1 }, 1);
    p.lastAnswerCorrect = true; p.statuses = [{ type: 'stun', sourceId: 'e1', appliedRound: 1 }];
    p.questionAction = { ability: 'fireball', targetId: 'e1' };
    let calls = 0;
    prepareStatusActions(s, () => { calls++; return roll; });
    prepareStatusActions(s, () => { throw new Error('rerolled'); });
    assert.equal(calls, 1); assert.equal(naturalAgilityAttack(p, s.round), allowed);
    assert.ok(p.statuses.some(x => x.type === 'stun'));
    const mp = p.mp, hp = s.enemies[0].health;
    applyAbility(s, p, 'fireball', 'e1'); assert.equal(p.mp, mp);
    applyAbility(s, p, 'attack', 'e1');
    assert.equal(s.enemies[0].health < hp, allowed);
  }
  for (const job of ['wizard', 'priest'] as const) {
    const s = started(job), p = s.players[student().id]; s.round = 2;
    p.advancement = resolveAAEffects({ 'natural:agility': 3 }, 3); p.lastAnswerCorrect = true;
    p.statuses = [{ type: 'stun', sourceId: 'e1', appliedRound: 1 }, ...(job === 'wizard' ? [{ type: 'fear' as const, sourceId: 'e1', appliedRound: 1 }] : [])];
    prepareStatusActions(s, () => { throw new Error('ineligible roll'); });
    assert.equal(naturalAgilityAttack(p, 2), false);
  }
});

test('AA dodge does not consume shields or award blocked XP, and excludes periodic/self damage', () => {
  for (const cause of ['monster_attack', 'wrong_answer', 'periodic', 'self'] as const) {
    const s = started(), p = s.players[student().id];
    p.advancement = { ...resolveAAEffects({}, 1), dodgeChance: 1 };
    p.buffs.shield = { amount: 2, rounds: 2 };
    const damage = damagePlayer(s, p.studentId, 3, 'e1', true, Infinity, false, cause);
    if (cause === 'periodic' || cause === 'self') { assert.equal(damage, 1); assert.equal(p.totals.damageBlocked, 2); }
    else { assert.equal(damage, 0); assert.ok(p.buffs.shield); assert.equal(p.totals.damageBlocked, 0); }
  }
});

test('potion preservation uses one charge roll per real action, never per party target or failed action', () => {
  const s = started('herbalist'), p = s.players[student().id];
  p.advancement = { ...resolveAAEffects({}, 1), potionChance: 1 };
  p.health = 1; p.healingPotions = 1; p.availableAbilities.push('potion_diffuser');
  applyAbility(s, p, 'healing_potion', p.studentId); assert.equal(p.healingPotions, 1);
  const seed = s.seed;
  applyAbility(s, p, 'healing_potion', 'missing'); assert.equal(s.seed, seed); assert.equal(p.healingPotions, 1);
  p.healingPotions = 0;
  applyAbility(s, p, 'healing_potion', p.studentId); assert.equal(s.seed, seed); assert.equal(p.healingPotions, 0);
});
