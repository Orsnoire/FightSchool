import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AA_CATALOG, aaWallet, resolveAAEffects, aaTier, preserveCombo } from '../../shared/aa';
import { calculateCharacterStats, calculatePlayerBaseDamage, ALL_CHARACTER_CLASSES, getStartingEquipment, calculateLoadoutEquipmentStats } from '../../shared/schema';
import { equipmentExclusion, handConflict } from '../../shared/equipment-rules';
import { abilityHealing, abilityDot } from '../../shared/combat/abilityValues';
import { prepareStatusActions, naturalAgilityAttack } from '../../shared/combat/status-effects';
import { applyAbility } from '../../worker/combat/ability-execution';
import { publicSnapshot } from '../../worker/combat/public-snapshot';
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
    s.currentPhase = 'actions';
    const publicPlayer = publicSnapshot(s).players[p.studentId];
    assert.deepEqual(publicPlayer.advancement,p.advancement);
    assert.equal(naturalAgilityAttack(publicPlayer as any,s.round),allowed);
    assert.equal(publicSnapshot(s).seed,0,'private RNG state remains hidden');
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

// Invert the persisted LCG to put its next roll immediately below/at each boundary.
function seedBefore(numerator: number) {
  const modulus = 4294967296n;
  return Number((((BigInt(numerator) - 1013904223n) * 4276115653n) % modulus + modulus) % modulus);
}
test('each purchased dodge/potion threshold has strict deterministic boundaries, single Diffuser consumption and JSON recovery', () => {
  for (const [id, thresholds] of [['dodging',[.1,.2,.3,.4]],['potion-preservation',[.1,.25,.5]]] as const) {
    thresholds.forEach((chance,index) => {
      for (const success of [true,false]) {
        const state = started('herbalist'), p = state.players[student().id];
        const numerator = Math.ceil(chance * 4294967296) - (success ? 1 : 0);
        state.seed = seedBefore(numerator);
        p.advancement = resolveAAEffects({[id]:index+1},4);
        p.health = 1; p.healingPotions = 1; p.availableAbilities.push('potion_diffuser');
        state.players.ally = {...structuredClone(p),studentId:'ally',nickname:'Ally'};
        const recovered = JSON.parse(JSON.stringify(state));
        for (const run of [state,recovered]) {
          const actor = run.players[p.studentId];
          if (id === 'dodging') {
            const actual = damagePlayer(run,actor.studentId,1,'e1',true,Infinity,false,'monster_attack');
            assert.equal(actual,success ? 0 : 1);
            assert.equal(actor.totals.damageBlocked,0);
          } else {
            applyAbility(run,actor,'potion_diffuser',actor.studentId);
            assert.equal(actor.healingPotions,success ? 1 : 0);
            assert.ok(run.players.ally.health > 1);
          }
          assert.equal(run.seed,numerator,'exactly one roll, including party potion');
        }
        assert.deepEqual(state,recovered,'persisted RNG and effects reproduce after recovery');
      }
    });
  }
});

test('all Natural Agility thresholds cover stun/hypnosis, incorrect answers, normal recovery, and restart without a reroll', () => {
  for (const [index,chance] of [.25,.5,.75].entries()) for (const type of ['stun','hypnosis'] as const) {
    for (const roll of [chance-1e-8,chance]) {
      const state = started('wizard'),p=state.players[student().id]; state.round=2;
      p.advancement=resolveAAEffects({'natural:agility':index+1},4);
      p.lastAnswerCorrect=true; p.statuses=[{type,sourceId:'e1',appliedRound:1}];
      prepareStatusActions(state,()=>roll);
      assert.equal(naturalAgilityAttack(p,2),roll<chance);
      const recovered=JSON.parse(JSON.stringify(state));
      prepareStatusActions(recovered,()=>{throw new Error('recovery rerolled');});
      assert.deepEqual(recovered,state);
      p.lastAnswerCorrect=false; delete p.statusPreparedRound; delete p.agilityAttack;
      prepareStatusActions(state,()=>{throw new Error('wrong answer rolled');});
      assert.equal(naturalAgilityAttack(p,2),false);
    }
  }
  const state=started('wizard'),p=state.players[student().id]; state.round=2;
  p.advancement=resolveAAEffects({'natural:agility':3},4); p.lastAnswerCorrect=true;
  p.statuses=[{type:'stun',sourceId:'e1',appliedRound:1}]; p.recoveryCorrectAnswers=1;
  prepareStatusActions(state,()=>{throw new Error('normal recovery should not roll');});
  assert.equal(p.statuses.length,0);
});

test('an old saved participant with no advancement retains damage, resources and RNG sequence', () => {
  const old=started('herbalist'), modern=structuredClone(old);
  modern.players[student().id].advancement=resolveAAEffects({},1);
  for (const room of [old,modern]) {
    const p=room.players[student().id]; p.health=1;
    applyAbility(room,p,'healing_potion',p.studentId);
    damagePlayer(room,p.studentId,3,'e1',true,Infinity,false,'monster_attack');
    applyAbility(room,p,'attack','e1');
  }
  delete modern.players[student().id].advancement;
  assert.deepEqual(modern,old);
});

test('every active cross-class unlock has a real effect, while Soul Echo is passive', async () => {
  const { getCrossClassAbilities } = await import('../../shared/jobSystem');
  const { canonicalAbility, SUPPORT, ALLIES, PASSIVE_ABILITIES, availableAbilities } = await import('../../shared/combat/abilities');
  const { addStudent, initialCombatState, startQuestion, applyAnswer, selectAction } = await import('../../worker/combat/engine');
  const { fight } = await import('./fixtures');
  const levels=Object.fromEntries(ALL_CHARACTER_CLASSES.map(job=>[job,15]));
  const abilities=new Map([...getCrossClassAbilities('warrior',levels as any),...getCrossClassAbilities('wizard',levels as any)].map(a=>[a.id,a]));
  assert.equal(abilities.size,24);
  for(const [equipped] of abilities){
    const job=['block_crossclass','unbreakable'].includes(equipped)?'wizard':'warrior';
    const ability=canonicalAbility(equipped);
    if(PASSIVE_ABILITIES.has(ability))continue;
    let room=startQuestion(addStudent(initialCombatState('CROSS',fight,0),student(job),{levels,crossClass:[equipped]}),100,30);
    const p=room.players[student().id];
    assert.ok(p.availableAbilities.includes(ability),equipped);
    p.health=1; p.comboPoints=p.maxComboPoints; p.mp=100; p.stats.rtk=1; room.seed=seedBefore(0);
    room.enemies[0].health=room.enemies[0].maxHealth=10000;
    room.players.ally={...structuredClone(p),studentId:'ally',nickname:'Ally',health:0,isDead:true};
    room=applyAnswer(room,p.studentId,'4',fight.questions[0]); room.currentPhase=SUPPORT.has(ability)?'abilities':'actions';
    room=selectAction(room,p.studentId,ability,ALLIES.has(ability)?p.studentId:'e1');
    const before=JSON.stringify({hp:room.players[p.studentId].health,stats:room.players[p.studentId].stats,buffs:room.players[p.studentId].buffs,enemies:room.enemies,ally:room.players.ally.health});
    applyAbility(room,room.players[p.studentId],ability,ALLIES.has(ability)?p.studentId:'e1');
    const after=JSON.stringify({hp:room.players[p.studentId].health,stats:room.players[p.studentId].stats,buffs:room.players[p.studentId].buffs,enemies:room.enemies,ally:room.players.ally.health});
    assert.notEqual(after,before,`${equipped} must change combat, not just consume a cost`);
    assert.ok(!availableAbilities(job,{},[equipped]).includes(ability),`${equipped} cannot bypass its source class level`);
  }
});
