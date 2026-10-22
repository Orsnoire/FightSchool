import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizePerformance } from '../../scripts/release/performance-report.mjs';
const stats=(count,p95=800)=>({count,p50:100,p95,max:1200});
function samples() {return [30,60].flatMap(players=>[1,2,3].map(repetition=>({players,repetition,path:'retained.json',manifest:{
  mode:'isolated',status:'passed',pending:[],runId:`${players}-${repetition}`,isolationId:'fixture',origin:'https://fixture.invalid',release:{commit:'same',workerVersion:'same'},
  answerAckMs:stats(players),history:{perStudent:100,results:players*100},metrics:{guildQuests:stats(players),classActions:stats(players),classSupport:stats(players),reconnect:stats(1),completion:stats(1)},
}})));}
test('performance report never averages away a slow classroom repetition or declares signoff',()=>{
  const input=samples(); input[0].manifest.answerAckMs=stats(30,1100);
  const report=summarizePerformance(input,3);
  assert.equal(report.groups[0].medianRunP95Ms,800);assert.equal(report.groups[0].worstRunP95Ms,1100);
  assert.equal(report.proposedTargetMet,false);assert.match(report.signoff,/pending/);
});
test('performance report rejects missing, duplicate, failed or mixed-release samples',()=>{
  assert.throws(()=>summarizePerformance(samples().slice(1),3));
  for(const mutate of [
    a=>a[1]=a[0], a=>a[0].manifest.status='failed', a=>a[0].manifest.pending.push({id:'lost-write'}),
    a=>a[0].manifest.release.commit='different', a=>a[0].manifest.history.results=0,
    a=>a[0].manifest.metrics.classActions.count=0, a=>a[0].manifest.answerAckMs.p95=NaN,
  ]) {const input=samples();mutate(input);assert.throws(()=>summarizePerformance(input,3));}
});
