import assert from 'node:assert/strict';
import { test } from 'node:test';
import { insertFightSchema } from '../../shared/schema.ts';
import { publicSnapshot } from '../../worker/combat/session-object.ts';
import { started, student, fight } from './fixtures.ts';

test('shared fight contract rejects inputs the HTTP boundary cannot accept', () => {
  assert.equal(insertFightSchema.safeParse({...fight,enemies:[]}).success,false);
  assert.equal(insertFightSchema.safeParse({...fight,title:'x'.repeat(201)}).success,false);
  assert.equal(insertFightSchema.safeParse({...fight,baseXP:1.5}).success,false);
});

test('public snapshot allowlists exclude future internal fields at every boundary', () => {
  const state=started();
  const player=state.players[student().id];
  Object.assign(state,{privateCanary:'private-root'});
  Object.assign(player,{privateCanary:'private-player'});
  Object.assign(state.enemies[0],{privateCanary:'private-enemy'});
  Object.assign(player.totals,{privateCanary:'private-totals'});
  const before=structuredClone(state);
  assert.equal(JSON.stringify(publicSnapshot(state)).includes('private-'),false);
  assert.deepEqual(state,before);
});
