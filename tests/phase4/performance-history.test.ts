import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataCostFixture } from '../support/data-costs.ts';
import { fight, student, advanceTo } from './fixtures.ts';
import { fixtureJournal } from '../staging/fixture-run.mjs';
import { seedHistory } from '../../scripts/release/seed-history.mjs';
import { cleanupDatabase, validateManifest } from '../../scripts/release/fixture-cleanup.mjs';
import { classroomCharacter, exerciseClassActions, exerciseClassSupport } from '../staging/representative-profile.mjs';
import { validAppearance } from '../../shared/avatar/appearance.ts';
import { initialCombatState, addStudent, scaleEncounter, startQuestion, applyAnswer } from '../../worker/combat/engine.ts';
import { applyStudentCommand } from '../../worker/combat/commands.ts';

const id='12345678-1234-1234-1234-123456789abc';
const target={id,cloudflareAccountId:'a'.repeat(32),workerName:'questacademy-rehearsal-12345678',bucketName:'questacademy-rehearsal-12345678',origin:'https://questacademy-rehearsal-12345678.example.workers.dev',databaseHost:'ep-rehearsal.neon.tech',neonBranchId:'br-rehearsal'};
async function setup() {
  const f=await dataCostFixture(30,0), directory=mkdtempSync(join(tmpdir(),'c12-history-'));
  const fixtures=fixtureJournal({suite:'operations',directory,target:{mode:'isolated',origin:target.origin,isolationId:id},release:{}});
  const teacherAlias=`qa-${fixtures.suffix}@example.invalid`;
  await f.pg.query('UPDATE teachers SET email=$1,email_normalized=$1 WHERE id=$2',[teacherAlias,fight.teacherId]);
  fixtures.record('/api/teacher/signup','POST',{email:teacherAlias},{id:fight.teacherId},201);
  for (const [i,s] of f.students.entries()) {
    const nickname=`qa-${fixtures.suffix}-${i}`;
    await f.pg.query('UPDATE students SET nickname=$1,nickname_normalized=$1,character_class=$3 WHERE id=$2',[nickname,s.id,classroomCharacter(i).job]);
    fixtures.record('/api/student/login','POST',{nickname},{id:s.id},200);
  }
  for (const guild of [f.guildId,f.otherGuildId]) fixtures.record('/api/guilds','POST',{}, {id:guild},201);
  fixtures.record('/api/fights','POST',{}, {id:f.bank.id},201);
  const args={query:(sql:string,params?:any[])=>f.pg.query(sql,params),fixtures,target,databaseUrl:'postgres://fixture:unused@ep-rehearsal.neon.tech/test',productionHosts:['ep-live.neon.tech'],teacherId:fight.teacherId,guildId:f.guildId,fightId:f.bank.id,studentIds:f.students.map(s=>s.id)};
  return {f,fixtures,args,close:async()=>{await f.pg.close();rmSync(directory,{recursive:true,force:true});}};
}

test('representative history is scoped, bounded, retained by exact IDs and compatible with cleanup', async () => {
  const {f,fixtures,args,close}=await setup();
  try {
    const counts=await seedHistory(args);
    assert.deepEqual(counts,{sessions:100,results:3000,evidence:1500,perStudent:100,jobLevel:4});
    assert.equal(fixtures.manifest.pending.length,0);
    assert.equal(fixtures.manifest.sessions.length,100);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM combat_results WHERE guild_id=$1',[f.otherGuildId])).rows[0].n,0);
    const levels=(await f.pg.query('SELECT level,experience FROM student_job_levels WHERE level=4')).rows;
    assert.equal(levels.length,30); assert.ok(levels.every((r:any)=>r.experience===36));
    const dry=await cleanupDatabase(args.query,fixtures.manifest);
    assert.equal(dry.applied,false); assert.equal(dry.counts.combat_results,3000);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM combat_results')).rows[0].n,3000);
  } finally {await close();}
});

test('history refuses production targets and foreign identities before creating any history', async () => {
  const {f,fixtures,args,close}=await setup();
  try {
    let queries=0;
    const query=async()=>{queries++;throw Error('Must not reach SQL');};
    await assert.rejects(seedHistory({...args,query,productionHosts:['ep-rehearsal-pooler.neon.tech']}));
    await assert.rejects(seedHistory({...args,query,fixtures:{...fixtures,manifest:{...fixtures.manifest,mode:'live'}}}));
    await assert.rejects(seedHistory({...args,query,studentIds:['unowned',...args.studentIds.slice(1)]}));
    assert.equal(queries,0);
    await f.pg.query('UPDATE students SET nickname_normalized=$1 WHERE id=$2',['changed-owner',args.studentIds[0]]);
    await assert.rejects(seedHistory(args),/Student identity changed/);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM live_combat_sessions')).rows[0].n,0);
    assert.equal(fixtures.manifest.pending.length,1);
  } finally {await close();}
});

test('a lost history COMMIT acknowledgement keeps exact scope and blocks cleanup', async () => {
  const {f,fixtures,args,close}=await setup();
  try {
    await assert.rejects(seedHistory({...args,query:async(sql:string,params?:any[])=>{
      const result=await args.query(sql,params);
      if(sql==='COMMIT') throw Error('lost commit acknowledgement');
      return result;
    }}),/lost commit acknowledgement/);
    const retained=JSON.parse(readFileSync(fixtures.file,'utf8'));
    assert.equal(retained.pending.length,1); assert.equal(retained.sessions.length,100);
    assert.equal((await f.pg.query('SELECT count(*)::int n FROM combat_results')).rows[0].n,3000);
    assert.throws(()=>validateManifest(retained),/Unresolved creation intent/);
    assert.ok(!JSON.stringify(retained).includes('postgres:'));
  } finally {await close();}
});

test('30/60-player profiles contain four starter jobs and a unique valid appearance for every learner', () => {
  for(const count of [30,60]) {
    const characters=Array.from({length:count},(_,i)=>classroomCharacter(i));
    assert.equal(new Set(characters.map(c=>c.job)).size,4);
    assert.equal(new Set(characters.map(c=>JSON.stringify(c.appearance))).size,count);
    assert.ok(characters.every(c=>validAppearance(c.appearance)));
  }
});

test('representative class choices resolve through the real engine for both classroom sizes', async () => {
  for(const count of [30,60]) {
    const authored={...fight,baseEnemyDamage:1,questions:Array.from({length:20},(_,i)=>({...fight.questions[0],id:`q${i+1}`})),enemyDisplayMode:'simultaneous' as const,enemies:[{id:'goblins',name:'Goblins',image:'/enemies/goblin-v1.png',enemyType:'goblin' as const,difficultyMultiplier:1,quantity:5,swarm:{enemiesPerFourPlayers:2}}]};
    let state=initialCombatState('C12CLASSES',authored,0);
    const students=Array.from({length:count},(_,i)=>({payload:student(classroomCharacter(i).job,`10000000-0000-4000-8000-${String(i+100).padStart(12,'0')}`)}));
    students.forEach(({payload:s},i)=>{state=addStudent(state,s,{levels:{[s.characterClass!]:4},appearance:classroomCharacter(i).appearance});});
    state=startQuestion(scaleEncounter(state,authored),0,300);
    const actors=students.map(s=>({ack:async(type:string,fields:any)=>{
      state=applyStudentCommand(state,authored,s.payload.id,{type,commandId:'fixture-command',...fields} as any,4000);
      return 1;
    }}));
    const journal={recordMetric:(_name:string,times:number[])=>assert.equal(times.length,count)};
    for(let round=1;round<=2;round++) {
      for(const s of students) state=applyAnswer(state,s.payload.id,'4',authored.questions[state.currentQuestionIndex]);
      state=advanceTo(state,'actions',authored,round*10000);
      await exerciseClassActions(actors,students,state,journal);
      assert.ok(Object.values(state.players).every(p=>p.ready));
      state=advanceTo(state,'abilities',authored,round*10000+1000);
      await exerciseClassSupport(actors,students,journal,round);
      state=advanceTo(state,'question_resolution',authored,round*10000+2000);
      assert.ok(Object.values(state.players).every(p=>p.totals.questionsAnswered===round));
      // Goblins can trip individual actors; the cohort must still exercise
      // damaging spells and healing rather than assuming every action succeeds.
      const cohort=Object.values(state.players);
      assert.ok(cohort.some(p=>p.characterClass==='wizard' && p.mp<=p.maxMp-2*round));
      assert.ok(cohort.some(p=>p.characterClass==='herbalist' && p.healingPotions<=5-round));
      if(round===1)state=advanceTo(state,'question',authored,20000);
    }
  }
});
