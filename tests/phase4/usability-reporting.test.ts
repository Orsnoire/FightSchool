import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as s from '../../worker/db/schema';
import { fight, student } from './fixtures';
import { initialCombatState, addStudent, startQuestion, applyAnswer, advancePhase } from '../../worker/combat/engine';
import { recordSessionReporting } from '../../worker/db/session-reporting';
import { sessionReport } from '../../worker/reporting/session-report';
import { publicSnapshot } from '../../worker/combat/public-snapshot';
import type { GameDatabase } from '../../worker/db/game-repository';

test('session reports retain immutable attempts, compose filters and preserve legacy totals',async()=>{
 const pg=new PGlite(),db=drizzle(pg,{schema:s}) as unknown as GameDatabase;
 try {
  const journal=JSON.parse(readFileSync(new URL('../../migrations/cloudflare/meta/_journal.json',import.meta.url),'utf8'));
  for(const {tag} of journal.entries)await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`,import.meta.url),'utf8'));
  await db.insert(s.teachers).values({id:fight.teacherId,firstName:'Test',lastName:'Teacher',email:'report@example.invalid',emailNormalized:'report@example.invalid',passwordHash:'unused',guildCode:'REPORT',billingAddress:'Test',schoolDistrict:'Test',school:'Test',subject:'Math',gradeLevel:'9'});
  await db.insert(s.fights).values(fight);
  const p=student('warrior'),p2=student('wizard','00000000-0000-4000-8000-000000000002');
  p2.nickname='Second';p2.nicknameNormalized='second';
  await db.insert(s.students).values([p,p2]);
  await db.insert(s.liveCombatSessions).values({sessionId:'REPORT01',fightId:fight.id,teacherId:fight.teacherId});
  let state=startQuestion(addStudent(addStudent(initialCombatState('REPORT01',fight),p),p2));
  state=applyAnswer(state,p.id,fight.questions[0].correctAnswer,fight.questions[0]);
  state=advancePhase(state,fight);state.revision=10;
  assert.deepEqual(state.pendingAttempts?.map(a=>a.outcome),['correct','unanswered']);
  assert.equal('pendingAttempts' in publicSnapshot(state),false);
  await recordSessionReporting(db,state,fight);await recordSessionReporting(db,state,fight);
  const get=(query='')=>sessionReport(db,fight.teacherId,new URLSearchParams(query));
  let report=await get();assert.equal(report.total,1);assert.equal(report.summary.sessions,1);assert.equal(report.summary.players,2);assert.equal(report.summary.correct,1);assert.equal(report.summary.attempts,2);
  report=await get('view=players&job=warrior');assert.equal(report.total,1);assert.equal(report.rows[0].studentId,p.id);
  report=await get(`view=questions&playerId=${p.id}&questionId=${fight.questions[0].id}&sessionId=REPORT01`);assert.equal(report.total,1);assert.equal(report.rows[0].question?.question,fight.questions[0].question);
  const changed=structuredClone(state);changed.pendingAttempts![0].question.question='New question';await recordSessionReporting(db,changed,fight);
  assert.equal((await get('view=questions')).rows[0].question?.question,fight.questions[0].question);
  assert.equal((await get('search=REPORT01')).total,1);assert.equal((await get('search=impossiblemissing')).total,0);
  assert.equal((await get('view=questions&pageSize=1&page=2')).rows.length,1);
  assert.equal((await sessionReport(db,'00000000-0000-4000-8000-000000000099',new URLSearchParams())).total,0);
  await db.insert(s.liveCombatSessions).values({sessionId:'LEGACY01',fightId:fight.id,teacherId:fight.teacherId});
  await db.insert(s.combatResults).values({sessionId:'LEGACY01',studentId:p.id,fightId:fight.id,characterClass:'warrior',victory:false,survived:true,totals:{...state.players[p.id].totals,questionsCorrect:3,questionsAnswered:5,questionsIncorrect:2},xpEarned:3,goldReward:0});
  report=await get();assert.equal(report.summary.sessions,2);assert.equal(report.summary.historicalParticipants,1);assert.equal(report.summary.correct,4);assert.equal(report.summary.attempts,7);
  assert.equal((await get(`questionId=${fight.questions[0].id}`)).total,1);
  assert.equal((await get('view=players&sessionId=LEGACY01')).rows[0].unanswered,null);
 } finally {await pg.close();}
});
