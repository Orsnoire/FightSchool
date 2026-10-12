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

import { readJson, BodyError } from '../../worker/http/json.ts';
import { diagnostic } from '../../worker/diagnostics.ts';
import { CombatSessionObject } from '../../worker/combat/session-object.ts';
import { combatCommandSchema } from '../../shared/contracts/combat.ts';
import { apiQueries } from '../../client/src/lib/apiQueries.ts';

function chunked(chunks:string[]) {
  let cancelled=false,reads=0;
  const stream=new ReadableStream<Uint8Array>({
    pull(controller){if(reads<chunks.length)controller.enqueue(new TextEncoder().encode(chunks[reads++]));else controller.close();},
    cancel(){cancelled=true;},
  },{highWaterMark:0});
  const request=new Request('https://qa.example/api/test',{method:'POST',body:stream,duplex:'half'} as RequestInit);
  return {request,cancelled:()=>cancelled,reads:()=>reads};
}

test('JSON limits count UTF-8 bytes and cancel oversized chunked bodies before reading the remainder', async () => {
  const body=chunked(['"','é'.repeat(6),'do-not-read']);
  await assert.rejects(readJson(body.request,10),error=>error instanceof BodyError&&error.status===413);
  assert.equal(body.cancelled(),true);assert.equal(body.reads(),2);
  const valid=chunked(['{"text":"','é','"}']);
  assert.deepEqual(await readJson(valid.request,13),{text:'é'});
  await assert.rejects(readJson(new Request('https://qa.example',{method:'POST',body:'private-secret'})),error=>error instanceof BodyError&&error.message==='Invalid JSON');
  assert.deepEqual(await readJson(new Request('https://qa.example'),64,true),{});
  await assert.rejects(readJson(new Request('https://qa.example',{method:'POST',body:'{}',headers:{'content-length':'100'}}),64),error=>error instanceof BodyError&&error.status===413);
});

test('command contracts strip forged identity fields and require discriminated payloads', () => {
  const command=combatCommandSchema.parse({type:'leave_fight',commandId:'leave-contract-1',targetId:'somebody-else',actorId:'forged'});
  assert.deepEqual(command,{type:'leave_fight',commandId:'leave-contract-1'});
  for(const payload of [null,[],{type:'answer',commandId:'answer-contract-1',round:1,questionId:'q1',answer:3},{type:'ready',commandId:'ready-contract-1',round:1.5},{type:'review_rejoin',commandId:'review-contract-1',targetId:'p1',decision:'maybe'}])assert.equal(combatCommandSchema.safeParse(payload).success,false);
});

test('diagnostics allowlist fields and redact command parse/dependency failures at the socket boundary', async (t) => {
  const logs:string[]=[];t.mock.method(console,'log',(s:string)=>logs.push(s));
  diagnostic({event:'http_request',requestId:'request-1',outcome:'failed',durationMs:2,body:'private-answer',cookie:'private-token',error:new Error('private-db')} as any);
  const messages:any[]=[];
  const socket={send:(s:string)=>messages.push(JSON.parse(s)),deserializeAttachment:()=>({actorId:student().id,role:'student',sessionId:'ABC234',tokenHash:'private-token'}),serializeAttachment:()=>{},close:()=>{}};
  const object=new CombatSessionObject({storage:{},getWebSockets:()=>[socket]} as any,{DATABASE_URL:'unused'});
  object.setRepository({findActiveSession:async()=>{throw new Error('private-db-credential');}} as any);
  await object.webSocketMessage(socket as any,'{private-submitted-answer');
  await object.webSocketMessage(socket as any,JSON.stringify({type:'ready',commandId:'contract-ready-1',round:1}));
  assert.equal(messages[0].error,'Invalid combat command');
  assert.equal(messages[1].error,'Unable to process command');
  assert.equal(JSON.parse(logs.at(-1)!).outcome,'failed');
  assert.equal(JSON.stringify([...logs,...messages]).includes('private-'),false);
  const command=logs.map(s=>JSON.parse(s)).find(s=>s.event==='combat_command');
  assert.equal(command.roomId,'ABC234');assert.ok(command.requestId);assert.ok(command.durationMs>=0);assert.ok(command.queueMs>=0);
});

test('typed query factories keep URL parameters separate from cache identity', async (t) => {
  const urls:string[]=[];
  t.mock.method(globalThis,'fetch',async (url:string)=>{urls.push(url);return Response.json([]);});
  const q=apiQueries.leaderboard('guild/with-space','accuracy & more');
  await (q.queryFn as Function)({queryKey:q.queryKey});
  assert.equal(urls[0],'/api/guilds/guild%2Fwith-space/leaderboard?metric=accuracy+%26+more');
  assert.deepEqual(q.queryKey,['/api/guilds/guild/with-space/leaderboard','accuracy & more']);
});
