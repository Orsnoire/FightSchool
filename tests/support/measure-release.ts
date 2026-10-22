// Repeatable local boundary measurements. These are NOT provider latency tests.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { roomFixture } from './room-costs.ts';
const percentile = (values:number[], fraction:number) => [...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*fraction)-1)];
const reports = [];
const log = console.log;
try {
  for (const players of [30,60]) {
    const samples = [];
    for (let repetition=0;repetition<12;repetition++) {
      const diagnostics:any[]=[];
      console.log=(raw:string)=>diagnostics.push(JSON.parse(raw));
      const f=roomFixture(players);
      const ack:number[]=[];
      let start=0;
      for(const [i,ws] of f.players.entries()) {
        const send=ws.send;
        ws.send=(raw:string)=>{ const message=JSON.parse(raw); if(message.type==='command_ack'&&message.commandId===`c12-answer-${i}`)ack.push(performance.now()-start); send(raw); };
      }
      start=performance.now();
      await Promise.all(f.players.map((ws:any,i:number)=>f.obj.webSocketMessage(ws,JSON.stringify({type:'answer',commandId:`c12-answer-${i}`,round:f.room.snapshot.round,questionId:'q1',answer:'4'}))));
      assert.equal(ack.length,players); assert.equal(f.saved().receipts.length,players);
      assert.equal(f.saved().snapshot.currentPhase,'answer_feedback');
      const afterBurst=structuredClone(f.costs);
      const commands=diagnostics.filter(d=>d.event==='combat_command');
      const snapshot=structuredClone(f.saved());
      // A replay and rehydrated reconnect must preserve every durable receipt/deadline.
      const recovered=f.object();
      await recovered.webSocketMessage(f.players[0],JSON.stringify({type:'answer',commandId:'c12-answer-0',round:f.room.snapshot.round,questionId:'q1',answer:'4'}));
      await recovered.webSocketMessage(f.players[1],JSON.stringify({type:'join',commandId:'recovered-join'}));
      assert.deepEqual(f.saved(),snapshot);
      samples.push({repetition:repetition+1,ackP50Ms:percentile(ack,.5),ackP95Ms:percentile(ack,.95),ackMaxMs:Math.max(...ack),queueP95Ms:percentile(commands.map(d=>d.queueMs),.95),repositoryMs:commands.reduce((n,d)=>n+d.repositoryMs,0),checkpointMs:commands.reduce((n,d)=>n+d.checkpointMs,0),...afterBurst});
    }
    reports.push({players,repetitions:samples.length,fixture:'four jobs, saved distinct Human appearances, scaled goblin swarm, simultaneous answers, duplicate retry and reconstructed-object reconnect; repository stub, no network or SQL',samples,medianP95Ms:percentile(samples.map(s=>s.ackP95Ms),.5),worstP95Ms:Math.max(...samples.map(s=>s.ackP95Ms))});
  }
} finally { console.log=log; }
const report={schemaVersion:1,node:process.version,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Local DO command boundary only. DB/history and browser backing/render metrics are measured separately. Never compare these in-process timings to the live <1-second target.',reports};
const file=process.argv[2]; if(file)writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
