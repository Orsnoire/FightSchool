// Isolated DO boundary benchmark. No network, live users or database operations.
import { roomFixture } from './room-costs.ts';
const log=console.log;console.log=()=>{};
const reports=[];
for(const players of [30,60]){
  const samples=[];
  for(let run=0;run<12;run++){
    const f=roomFixture(players,false);let encodes=0,encodedBytes=0;
    const stringify=JSON.stringify;
    JSON.stringify=((v:any,...rest:any[])=>{const raw=(stringify as any)(v,...rest);if(v?.type==='combat_state'){encodes++;encodedBytes+=Buffer.byteLength(raw);}return raw;}) as any;
    const start=performance.now();
    try{
      for(let i=0;i<10;i++){f.room.snapshot.revision++;await f.obj.publish(f.room);await f.obj.publish(f.room);}
      const publishMs=performance.now()-start;
      f.save(f.room);
      const reconnectStart=performance.now();
      for(let i=0;i<players;i++)await f.obj.webSocketMessage(f.players[i],stringify({type:'join',commandId:`benchmark-rejoin-${i}`}));
      samples.push({publishMs,reconnectMs:performance.now()-reconnectStart,encodes,encodedBytes,...f.costs});
    }finally{JSON.stringify=stringify;}
  }
  const median=(key:string)=>samples.map((s:any)=>s[key]).sort((a,b)=>a-b)[6];
  reports.push({players,runs:12,changedPublishes:10,unchangedPublishes:10,...Object.fromEntries(Object.keys(samples[0]).map(k=>[k,median(k)]))});
}
console.log=log;console.log(JSON.stringify(reports,null,2));
