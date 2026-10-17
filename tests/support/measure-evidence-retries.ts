// Run in a checkout containing the pinned baseline commit. Isolated room storage;
// repository failures are injected, so these counts are not network latency.
import { execFileSync } from 'node:child_process';
import { writeFileSync,unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { roomFixture } from './room-costs.ts';
import { CombatSessionObject } from '../../worker/combat/session-object.ts';
const path=new URL(`../../worker/combat/.c06-baseline-${randomUUID()}.ts`,import.meta.url);
writeFileSync(path,execFileSync('git',['show','d18d1b5c29e2b758a6bf523ad3c15b6b8285c842:worker/combat/session-object.ts']));
let Baseline:any;
try{Baseline=(await import(path.href)).CombatSessionObject;}finally{unlinkSync(path);}
const reports=[];const log=console.log;console.log=()=>{};
try{
  for(const count of [30,60])for(const [version,Class] of [['before',Baseline],['after',CombatSessionObject]] as const){
    const f=roomFixture(count,false,Class);let projections=0,fail=true;
    f.room.snapshot.round=2;f.room.evidencePending=true;
    for(const p of Object.values(f.room.snapshot.players) as any[]){p.questGuildId='10000000-0000-4000-8000-000000000001';p.totals.questionsAnswered=1;p.totals.questionsCorrect=1;}
    f.save(f.room);
    f.repository.recordQuestEvidence=async()=>{projections++;if(fail)throw Error('injected database interruption');};
    for(let i=0;i<count;i++)await f.obj.webSocketMessage(f.players[i],JSON.stringify({type:'answer',commandId:`c06-measure-${i}`,round:2,questionId:'q1',answer:'4'}));
    const callsDuringBurst=projections;
    fail=false;await f.object().alarm();
    reports.push({version,players:count,callsDuringBurst,recoveryCalls:projections-callsDuringBurst,durableReceipts:f.saved().receipts.length,evidencePending:f.saved().evidencePending,checkpointCount:f.costs.writes,checkpointBytes:f.costs.checkpointBytes});
  }
}finally{console.log=log;}
writeFileSync('docs/reviews/c06/evidence-retries.json',JSON.stringify({baseline:'d18d1b5c29e2b758a6bf523ad3c15b6b8285c842',scenario:'Previous resolved question awaiting evidence projection; database unavailable during next 30/60-answer burst, then restored room alarm succeeds.',reports},null,2)+'\n');console.log(reports);
