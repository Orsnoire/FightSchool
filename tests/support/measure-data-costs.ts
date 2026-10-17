import { baselineQuests } from './baseline-quests.ts';
import { writeFileSync } from 'node:fs';
import { evaluateQuests, readQuestViews } from '../../worker/progression/quests.ts';
import { dataCostFixture,summarizeCalls } from './data-costs.ts';
const reports=[];
const baseline=process.argv.includes('--baseline');
const evaluate=baseline?await baselineQuests():evaluateQuests;
for(const members of [30,60]) {
  const f=await dataCostFixture(members,100,baseline?16:Infinity);
  try {
    const samples=[];
    for(let i=0;i<3;i++) {
      await f.pg.exec('BEGIN');f.calls.length=0;
      const start=performance.now();const views=await evaluate(f.db,f.guildId);
      samples.push({quests:views.length,...summarizeCalls(f.calls),elapsedMs:Number((performance.now()-start).toFixed(2))});
      await f.pg.exec('ROLLBACK');
    }
    const workloads=[];
    if(!baseline)for(const [name,run] of [
      ['studentRead',()=>readQuestViews(f.db,f.guildId,f.students[0].id)],
      ['oneStudentResultEvent',()=>evaluateQuests(f.db,f.guildId,undefined,{kind:'results',studentIds:[f.students[0].id],fightId:f.bank.id})],
      ['oneQuestionEvidenceEvent',()=>evaluateQuests(f.db,f.guildId,undefined,{kind:'evidence',studentIds:f.students.map(s=>s.id),fightId:f.bank.id})],
    ] as const){
      await f.pg.exec('BEGIN');f.calls.length=0;const start=performance.now();const views=await run();
      workloads.push({name,quests:views.length,...summarizeCalls(f.calls),elapsedMs:Number((performance.now()-start).toFixed(2))});await f.pg.exec('ROLLBACK');
    }
    const plans={};
    for(const [name,query,params] of [
      ['membership','SELECT * FROM guild_memberships WHERE student_id=$1',[f.students[0].id]],
      ['studentHistory','SELECT * FROM combat_results WHERE student_id=$1 ORDER BY completed_at DESC,id DESC LIMIT 50',[f.students[0].id]],
      ['guildTotals','SELECT sum((totals->>\'questionsCorrect\')::numeric) FROM combat_results WHERE guild_id=$1',[f.guildId]],
      ['fightEvidence','SELECT correct_keys FROM quest_fight_evidence WHERE guild_id=$1 AND fight_id=$2 AND student_id=$3',[f.guildId,f.bank.id,f.students[0].id]],
    ] as const) (plans as any)[name]=(await f.pg.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${query}`,params as any)).rows;
    reports.push({members,historyPerMember:100,seededQuests:68*members+11,samples,workloads,plans});
  } finally {await f.pg.close();}
}
const json=JSON.stringify({environment:{node:process.version,database:'disposable PGlite PostgreSQL; no production traffic'},reports},null,2);
const path=process.argv.find(x=>x.endsWith('.json'));if(path)writeFileSync(path,json+'\n');console.log(json);
