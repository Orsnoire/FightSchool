import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSUMABLE_IDS, bagWeight, consumeItem, tickItemProtections } from '../../shared/campaign/consumables';
import { addStatus, combatActionBlock } from '../../shared/combat/status-effects';
import { applyStudentCommand, parseCombatCommand } from '../../worker/combat/commands';
import { publicSnapshot } from '../../worker/combat/public-snapshot';
import { useCombatItem } from '../../worker/combat/consumables';
import { started, student, fight } from './fixtures';

const actorId = student().id;
function equipped() {
  const state = started(), p = state.players[actorId];
  p.consumables = Object.fromEntries(CONSUMABLE_IDS.map(id => [id, 2]));
  p.itemProtections = {};
  return { state, p };
}
test('shop potion heals any job, spends quantity/weight and never spends Herbalist charges', () => {
  const { p } = equipped(); p.health = 1;
  const charges = p.healingPotions;
  assert.equal(bagWeight(p.consumables), 16);
  consumeItem(p, 'potion');
  assert.equal(p.health, 6); assert.equal(p.consumables?.potion, 1);
  assert.equal(bagWeight(p.consumables), 15); assert.equal(p.healingPotions, charges);
  p.health = p.maxHealth;
  assert.throws(() => consumeItem(p, 'potion'), /full/); assert.equal(p.consumables?.potion, 1);
  p.health = 0; assert.throws(() => consumeItem(p, 'potion'), /knocked out/);
});
test('item cures remove only their named status, including recovery from a current action lock', () => {
  for (const [id, type] of [['antivenom', 'poison'], ['ennervator', 'stun'], ['silver_knife', 'web']] as const) {
    const { state, p } = equipped();
    p.statuses = [{ type, sourceId: 'e1', appliedRound: 0 }, { type: 'fear', sourceId: 'e1', appliedRound: 0 }];
    p.actionBlocked = { round: 1, reason: type };
    const next = useCombatItem(state, actorId, id), healed = next.players[actorId];
    assert.deepEqual(healed.statuses?.map(x => x.type), ['fear']);
    assert.equal(combatActionBlock(next, healed)?.reason, 'fear');
    assert.equal(healed.consumables?.[id], 1); assert.equal(p.consumables?.[id], 2, 'original snapshot untouched');
    assert.throws(() => useCombatItem(next, actorId, id), /One item/);
  }
  const { p } = equipped(); p.statuses = [{ type: 'paralysis', sourceId: 'e1', appliedRound: 0 }];
  assert.throws(() => consumeItem(p, 'ennervator'), /Not stunned/);
});
test('Psychic Needle costs exactly 1 HP, ignores defense/shield, cures both hypnosis types and prevents accidental KO', () => {
  const { state, p } = equipped(); p.health = 2; p.buffs.shield = { rounds: 2, amount: 99 };
  p.statuses = [{ type: 'hypnosis', sourceId: 'e1', appliedRound: 0 }, { type: 'stare', sourceId: 'e1', appliedRound: 0 }];
  p.actionBlocked = { round: 1, reason: 'hypnosis' };
  const next = useCombatItem(state, actorId, 'psychic_needle'), healed = next.players[actorId];
  assert.equal(healed.health, 1); assert.deepEqual(healed.statuses, []);
  assert.equal(healed.buffs.shield.amount, 99); assert.equal(combatActionBlock(next, healed), undefined);
  p.health = 1; assert.throws(() => useCombatItem(state, actorId, 'psychic_needle'), /at least 2/);
  assert.equal(p.consumables?.psychic_needle, 2);
});
test('protections block exactly five enemy turns, do not cure existing statuses, and do not broaden to other effects', () => {
  for (const [id, type] of [['sticky_shoes', 'trip'], ['stun_ward', 'stun'], ['psychic_crown', 'hypnosis']] as const) {
    const { state, p } = equipped();
    p.statuses = [{ type, sourceId: 'e1', appliedRound: 0 }];
    consumeItem(p, id); assert.equal(p.statuses.length, 1);
    p.statuses = [];
    assert.throws(() => consumeItem(p, id), /Already protected/);
    for (let turn = 1; turn <= 5; turn++) {
      state.round = turn;
      assert.equal(addStatus(state, p, { type, sourceId: 'e1', appliedRound: turn }), false);
      if (type === 'hypnosis') assert.equal(addStatus(state, p, { type: 'stare', sourceId: 'e1', appliedRound: turn }), false);
      tickItemProtections(p);
    }
    state.round = 6;
    assert.equal(addStatus(state, p, { type, sourceId: 'e1', appliedRound: 6 }), true);
    assert.equal(addStatus(state, p, { type: 'poison', sourceId: 'e1', appliedRound: 6 }), true);
  }
});
test('item commands are campaign-only, phase-limited and exposed through the public bag without answer leakage', () => {
  const { state, p } = equipped(); p.health = 1;
  const cmd = parseCombatCommand({ type: 'use_item', commandId: 'consume-1', round: 1, itemId: 'potion' });
  assert.throws(() => applyStudentCommand(state, fight, actorId, cmd, 10000), /Campaign items/);
  const authored = { ...fight, campaignContext: { campaignId: 'c', studentId: actorId, objective: false, fixedTier: 1 } };
  const result = applyStudentCommand(state, authored, actorId, cmd, 10000);
  (result.players[actorId].consumables as any).internalSecret = 'hidden';
  assert.equal(publicSnapshot(result).players[actorId].consumables?.potion, 1);
  assert.equal(JSON.stringify(publicSnapshot(result)).includes('hidden'), false);
  assert.equal(result.players[actorId].hasAnswered, false);
  for (const phase of ['answer_feedback', 'question_resolution', 'enemy_ai', 'game_over'] as const)
    assert.throws(() => useCombatItem({ ...state, currentPhase: phase }, actorId, 'potion'), /before confirming/);
  assert.throws(() => parseCombatCommand({ type: 'use_item', commandId: 'consume-2', round: 1, itemId: 'forged' }), /Invalid/);
});
