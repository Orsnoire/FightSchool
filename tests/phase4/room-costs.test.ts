import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roomFixture } from '../support/room-costs.ts';

test('room fan-out encodes at most once per role and suppresses unchanged state',async t=>{
  t.mock.method(console,'log',()=>{});
  const f=roomFixture(30);let encodes=0;
  const stringify=JSON.stringify;
  t.mock.method(JSON,'stringify',((value:any,...rest:any[])=>{if(value?.type==='combat_state')encodes++;return (stringify as any)(value,...rest);}) as any);
  await f.obj.publish(f.room);
  assert.equal(f.costs.sends,31);assert.ok(encodes<=2,`encoded ${encodes} full snapshots`);
  await f.obj.publish(structuredClone(f.room));assert.equal(f.costs.sends,31);
  const fresh=f.socket(f.students[0].id);await f.obj.publish(f.room);
  assert.equal(fresh.messages.length,1);assert.equal(f.costs.sends,32);
});

test('same-revision moderation/results changes and failed sends are not suppressed',async t=>{
  t.mock.method(console,'log',()=>{});const f=roomFixture(2);
  await f.obj.publish(f.room);
  f.room.removals={removed:{nickname:'Request',requestedAt:1,blocked:false}};
  await f.obj.publish(f.room);
  assert.equal(f.host.messages.length,2);assert.equal(f.players[0].messages.length,1);
  assert.equal(f.host.messages.at(-1).rejoinRequests[0].nickname,'Request');
  assert.equal(f.players[0].messages[0].rejoinRequests,undefined);
  f.players[0].fail=true;f.room.snapshot.revision++;
  await f.obj.publish(f.room);f.players[0].fail=false;await f.obj.publish(f.room);
  assert.equal(f.players[0].messages.at(-1).state.revision,f.room.snapshot.revision);
  f.room.snapshot.currentPhase='game_over';await f.obj.publish(f.room);
  f.room.results=[{studentId:f.students[0].id,xpEarned:7,privateCanary:'secret'}];
  await f.obj.publish(f.room);assert.equal(f.players[0].messages.at(-1).results[0].xpEarned,7);
  assert.equal(JSON.stringify(f.players[0].messages).includes('secret'),false);
  const n=f.costs.sends;await f.object().publish(f.room);assert.ok(f.costs.sends>n,'hibernated object sends full state');
});

test('established and pending reconnects keep frozen state without profile reads/checkpoints',async t=>{
  t.mock.method(console,'log',()=>{});
  for(const pending of [false,true]){
    const f=roomFixture(2);const id=f.students[0].id;
    if(pending){f.room.snapshot.pendingPlayers={[id]:f.room.snapshot.players[id]};delete f.room.snapshot.players[id];f.save(f.room);}
    const before=structuredClone(f.saved());
    await f.obj.webSocketMessage(f.players[0],JSON.stringify({type:'join',commandId:'reconnect-costs-1'}));
    assert.equal(f.costs.auth,1);assert.equal(f.costs.student,0);assert.equal(f.costs.profile,0);assert.equal(f.costs.writes,0);
    assert.deepEqual(f.saved(),before);assert.equal(f.players[0].messages.at(-1).state.phaseDeadline,before.snapshot.phaseDeadline);
    assert.equal(f.host.messages.length,0,'reconnect does not rebroadcast unchanged roster');
    f.revoked();const n=f.players[0].messages.length;
    await f.obj.webSocketMessage(f.players[0],JSON.stringify({type:'join',commandId:'reconnect-costs-2'}));
    assert.equal(f.players[0].closed,true);assert.equal(f.players[0].messages.length,n);
  }
});

test('new admission still loads a profile and checkpoints before publishing',async t=>{
  t.mock.method(console,'log',()=>{});const f=roomFixture(2);const ws=f.socket('00000000-0000-4000-8000-000000000099');
  await f.obj.webSocketMessage(ws,JSON.stringify({type:'join',commandId:'new-player-costs'}));
  assert.equal(f.costs.student,1);assert.equal(f.costs.profile,1);assert.ok(f.costs.writes>0);assert.ok(ws.messages.some((m:any)=>m.type==='combat_state'));
});

test('30/60-player answer bursts acknowledge durable receipts and advance immediately',async t=>{
  const logs:any[]=[];t.mock.method(console,'log',(raw:string)=>logs.push(JSON.parse(raw)));
  for(const n of [30,60]){
    const f=roomFixture(n);
    await Promise.all(f.players.map((ws:any,i:number)=>f.obj.webSocketMessage(ws,JSON.stringify({type:'answer',commandId:`burst-answer-${i}`,round:f.room.snapshot.round,questionId:'q1',answer:'4'}))));
    assert.equal(f.saved().snapshot.currentPhase,'actions');
    assert.equal(f.saved().receipts.length,n);assert.equal(f.costs.auth,n);
    for(const [i,ws] of f.players.entries()){
      assert.ok(ws.messages.some((m:any)=>m.type==='command_ack'&&m.commandId===`burst-answer-${i}`));
      assert.equal(ws.messages.at(-1).state.currentPhase,'actions');
    }
    const before=structuredClone(f.saved());
    await f.obj.webSocketMessage(f.players[0],JSON.stringify({type:'answer',commandId:'burst-answer-0',round:f.room.snapshot.round,questionId:'q1',answer:'4'}));
    assert.deepEqual(f.saved(),before,'retry does not mutate totals or receipts');
    const command=logs.find(m=>m.event==='combat_command'&&m.checkpointCount>0);
    assert.ok(command);assert.equal(command.repositoryCalls,1);assert.equal(command.storageReads,1);
    assert.ok(command.queueMs>=0);assert.ok(command.repositoryMs>=0);assert.ok(command.checkpointMs>=0);
    const publish=logs.find(m=>m.event==='combat_publish');assert.ok(publish.encodedMessages<=2);assert.ok(publish.bytes>0);
  }
});

test('waiting reconnect, expired sockets and blocked membership keep admission safeguards',async t=>{
  t.mock.method(console,'log',()=>{});const f=roomFixture(2);
  f.room.snapshot.currentPhase='waiting';f.save(f.room);
  await f.obj.webSocketMessage(f.players[0],JSON.stringify({type:'join',commandId:'waiting-reconnect'}));
  assert.equal(f.costs.profile,0);assert.equal(f.costs.student,0);assert.equal(f.costs.writes,0);
  assert.equal(f.players[0].messages.at(-1).state.currentPhase,'waiting');
  const expired=f.socket(f.students[1].id);expired.serializeAttachment({...expired.deserializeAttachment(),expiresAt:1});
  const auth=f.costs.auth;await f.obj.webSocketMessage(expired,JSON.stringify({type:'join',commandId:'expired-reconnect'}));
  assert.equal(expired.closed,true);assert.equal(f.costs.auth,auth);assert.equal(expired.messages.length,0);
  f.room.removals={[f.students[0].id]:{nickname:'Removed',blocked:true}};f.save(f.room);
  await f.obj.webSocketMessage(f.players[0],JSON.stringify({type:'join',commandId:'blocked-reconnect'}));
  assert.equal(f.players[0].messages.at(-1).status,'blocked');
});
