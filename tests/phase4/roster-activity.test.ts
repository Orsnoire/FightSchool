import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as s from '../../worker/db/schema';
import type { GameDatabase } from '../../worker/db/database';
import { recordPlayerActivity } from '../../worker/services/player-activity';
import { teacherGuildRoster } from '../../worker/reporting/guild-roster';
import { ActivitySampler } from '../../client/src/features/activity/sampler';
import { ACTIVITY_WEEK_MS as WEEK, activityPulseInput } from '../../shared/contracts/player-activity';
import { fight, student } from './fixtures';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('active-time sampling excludes idle, hidden, resumed and suspended intervals', () => {
  const sampler = new ActivitySampler(0, true);
  assert.equal(sampler.sample(29_999),false);
  assert.equal(sampler.sample(30_000),true);
  assert.equal(sampler.sample(60_000),true);
  sampler.visibility(false,65_000);
  assert.equal(sampler.sample(90_000),false);
  sampler.interact(95_000); // Hidden input cannot revive the sampler.
  sampler.visibility(true,100_000);
  assert.equal(sampler.sample(120_000),false);
  assert.equal(sampler.sample(130_000),true);
  assert.equal(sampler.sample(300_000),false); // Suspended timer.
  sampler.interact(301_000);
  assert.equal(sampler.sample(310_000),false);
  assert.equal(sampler.sample(331_000),true);
  assert.equal(sampler.sample(361_000),true);
  assert.equal(sampler.sample(391_000),true);
  assert.equal(sampler.sample(421_000),false); // Exact two-minute idle cutoff.
  sampler.interact(425_000);
  assert.equal(sampler.sample(451_000),false);
  assert.equal(sampler.sample(455_000),true);
  const jitter = new ActivitySampler(0,true);
  assert.deepEqual([30_005,59_999,90_003,119_998,149_999].map(time=>{jitter.interact(time);return jitter.sample(time);}),[true,false,true,true,true]);
  assert.equal(activityPulseInput.safeParse({pulseId:id(1),active:true,seconds:999999}).success,false);
});

test('roster windows, deduplication, historical accuracy and additive activity migration', async t => {
  const pg = new PGlite();
  const db = drizzle(pg,{schema:s}) as unknown as GameDatabase;
  const now = Date.UTC(2026,9,28,12);
  const p = student('warrior',id(30));
  try {
    const journal = JSON.parse(readFileSync(new URL('../../migrations/cloudflare/meta/_journal.json',import.meta.url),'utf8'));
    for (const {tag} of journal.entries.filter((e: {idx:number}) => e.idx < 19)) await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`,import.meta.url),'utf8'));
    await db.insert(s.teachers).values({id: fight.teacherId,firstName:'Test',lastName:'Teacher',email:'activity@example.invalid',emailNormalized:'activity@example.invalid',passwordHash:'unused',guildCode:'ACTIVE',billingAddress:'Test',schoolDistrict:'Test',school:'Test',subject:'Math',gradeLevel:'9'});
    // Seed the historical schema explicitly; current Drizzle columns include
    // later campaign additions that did not exist before roster migration 0019.
    for (const player of [p,{...student('wizard',id(31)),nickname:'Fresh',nicknameNormalized:'fresh'}])
      await pg.query('INSERT INTO students(id,nickname,nickname_normalized,password_hash,character_class,gender) VALUES($1,$2,$3,$4,$5,$6)',
        [player.id,player.nickname,player.nicknameNormalized,player.passwordHash,player.characterClass,player.gender]);
    await db.insert(s.fights).values(fight);
    await db.insert(s.guilds).values([{id:id(40),teacherId:fight.teacherId,name:'Ours',code:'OURS01'},{id:id(41),teacherId:fight.teacherId,name:'Other',code:'OTHER1'}]);
    await db.insert(s.guildMemberships).values([{guildId:id(40),studentId:p.id},{guildId:id(40),studentId:id(31)}]);
    const historicalStudents = (await pg.query('SELECT * FROM students ORDER BY id')).rows;
    await pg.exec(readFileSync(new URL('../../migrations/cloudflare/0019_teacher_roster_activity.sql',import.meta.url),'utf8'));
    assert.deepEqual((await pg.query('SELECT * FROM students ORDER BY id')).rows,historicalStudents);
    for (const {tag} of journal.entries.filter((e: {idx:number}) => e.idx > 19)) await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`,import.meta.url),'utf8'));
    const before = await db.select().from(s.students);
    const roster = () => teacherGuildRoster(db,id(40),now);
    const row = async () => (await roster()).find(r=>r.studentId===p.id)!;
    await t.test('untracked, tracked zero and partial histories remain distinguishable', async () => {
      assert.equal((await row()).weeklyActiveHours,null);
      assert.equal((await row()).dailyAccuracy,null);
      await recordPlayerActivity(db,p.id,{active:false,pulseId:id(50)},now-60_000);
      assert.equal((await row()).weeklyActiveHours,0);
      assert.equal((await row()).activityHistoryPartial,true);
    });
    await t.test('same bucket across devices and retried pulse across buckets count only once', async () => {
      await Promise.all([recordPlayerActivity(db,p.id,{active:true,pulseId:id(51)},now-30_000),recordPlayerActivity(db,p.id,{active:true,pulseId:id(52)},now-30_000)]);
      // Replay BOTH requests, including the tab that lost the bucket conflict.
      await recordPlayerActivity(db,p.id,{active:true,pulseId:id(51)},now);
      await recordPlayerActivity(db,p.id,{active:true,pulseId:id(52)},now);
      assert.equal((await db.select().from(s.studentActivitySamples)).length,1);
      assert.equal((await row()).weeklyActiveHours,30/3600);
      await recordPlayerActivity(db,p.id,{active:true,pulseId:id(53)},now);
      assert.equal((await row()).weeklyActiveHours,60/3600);
      await db.update(s.studentActivityTracking).set({startedAt:now-WEEK}).where(eq(s.studentActivityTracking.studentId,p.id));
      assert.equal((await row()).activityHistoryPartial,false);
    });
    await t.test('rolling window clips the boundary and pruning preserves progression', async () => {
      await db.insert(s.studentActivitySamples).values([{studentId:p.id,bucketStart:now-WEEK,pulseId:id(54)},{studentId:p.id,bucketStart:now-WEEK-2*86400000,pulseId:id(55)}]);
      const clipped = (await teacherGuildRoster(db,id(40),now+15_000)).find(r=>r.studentId===p.id)!;
      assert.equal(clipped.weeklyActiveHours,75/3600);
      await recordPlayerActivity(db,p.id,{active:false,pulseId:id(56)},now);
      assert.equal((await db.select().from(s.studentActivitySamples)).length,3);
      assert.deepEqual(await db.select().from(s.students),before);
    });
    const session = async (name:string,guildId=id(40)) => db.insert(s.liveCombatSessions).values({sessionId:name,fightId:fight.id,teacherId:fight.teacherId,guildId});
    const attempt = async (name:string,round:number,outcome:'correct'|'incorrect'|'unanswered',recordedAt:number,guildId=id(40)) => db.insert(s.questionAttempts).values({sessionId:name,studentId:p.id,round,teacherId:fight.teacherId,fightId:fight.id,guildId,job:'warrior',questionId:'q1',questionVersion:'v1',question:fight.questions[0],outcome,recordedAt});
    const totals = {questionsAnswered:9,questionsCorrect:1,questionsIncorrect:8,damageDealt:0,damageBlocked:0,healingDone:0,bonusDamage:0,damageTaken:0,deaths:0};
    await t.test('accuracy weights questions, includes unanswered, excludes other guild and out-of-window evidence', async () => {
      await session('SHORT'); await attempt('SHORT',1,'correct',now-86400000);
      await session('LONG');
      for(let round=1;round<=9;round++) await attempt('LONG',round,round===1?'correct':round===9?'unanswered':'incorrect',now-1);
      await attempt('LONG',10,'correct',now); // exclusive upper bound
      await attempt('LONG',11,'correct',now-86400001);
      await session('OTHER',id(41)); await attempt('OTHER',1,'correct',now-1,id(41));
      await db.insert(s.combatResults).values({sessionId:'LONG',studentId:p.id,fightId:fight.id,guildId:id(40),characterClass:'warrior',victory:true,survived:true,totals,xpEarned:1,goldReward:0,completedAt:now-1});
      const r=await row();
      assert.equal(r.dailyAccuracy,20); assert.equal(r.dailyAttempts,10); assert.equal(r.dailyFights,2); assert.equal(r.dailyLegacyFights,0);
      assert.equal((await roster()).find(r=>r.studentId===id(31))!.dailyAccuracy,null);
    });
    await t.test('historical result without attempt rows is included once with explicit limitation', async () => {
      await session('LEGACY');
      await db.insert(s.combatResults).values({sessionId:'LEGACY',studentId:p.id,fightId:fight.id,guildId:id(40),characterClass:'warrior',victory:true,survived:true,totals:{...totals,questionsAnswered:2,questionsCorrect:1},xpEarned:1,goldReward:0,completedAt:now-1});
      const r=await row(); assert.equal(r.dailyAccuracy,25); assert.equal(r.dailyAttempts,12); assert.equal(r.dailyLegacyFights,1);
    });
  } finally { await pg.close(); }
});
