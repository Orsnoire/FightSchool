import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../worker/db/schema";
import { calculateXP } from "../../shared/jobSystem";
import { combatReward, persistCombatResults } from "../../worker/db/game-repository";
import { CombatSessionObject } from "../../worker/combat/session-object";
import { endFight } from "../../worker/combat/host-controls";
import { fight, started, student } from "./fixtures";

const id = student().id;
function earned() {
  const s = started();
  s.round = 4; s.completedRounds = 3; s.phaseDeadline = Date.now() + 100000;
  s.enemies[0].maxHealth = 100; s.enemies[0].health = 50;
  Object.assign(s.players[id].totals, {questionsAnswered:3, questionsCorrect:2, questionsIncorrect:1,
    damageDealt:20, bonusDamage:8, damageBlocked:4, healingDone:3});
  s.players[id].roundsParticipated = 3;
  return s;
}

test("one XP formula counts correct answers and actual role contributions without double counting bonus damage", () => {
  const p = earned().players[id];
  const input = {...p.totals, baseFightXP:5};
  assert.equal(calculateXP(input), 33); // 5 + 2 - 1 + 20 + 4 + 3
  for (const field of ["questionsCorrect", "damageDealt", "damageBlocked", "healingDone"] as const)
    assert.equal(calculateXP({...input, [field]:input[field] + 1}), 34, field);
  assert.equal(calculateXP({...input, questionsIncorrect:100}), 0);
  assert.deepEqual(combatReward(endFight(earned()), p, fight),
    combatReward(endFight(earned(), "Solo fight ended by student"), p, fight));
});

function harness(snapshot = earned(), soloStudentId: string | null = id, persist = async (s:any) =>
  Object.values(s.players).map((p:any)=>({studentId:p.studentId,xpEarned:combatReward(s,p,fight).xp})), role:"student"|"teacher"="student") {
  const actorId=role==="teacher"?fight.teacherId:id;
  let room:any = {fight, snapshot:structuredClone(snapshot), receipts:[]};
  let alarm:number|null = null;
  const messages:any[] = [];
  const socket:any = {send:(raw:string)=>messages.push(JSON.parse(raw)),close:()=>{},serializeAttachment:()=>{},
    deserializeAttachment:()=>({actorId,role,sessionId:snapshot.sessionId,tokenHash:id})};
  const state:any = {storage:{get:async()=>structuredClone(room),put:async(_:string,r:any)=>{room=structuredClone(r)},
    setAlarm:async(n:number)=>{alarm=n},deleteAlarm:async()=>{alarm=null}},getWebSockets:()=>[socket]};
  const create = () => {
    const object = new CombatSessionObject(state,{DATABASE_URL:"unused"});
    object.setRepository({findActiveSession:async()=>({actorId,actorType:role}),
      findLiveCombatSession:async()=>({teacherId:fight.teacherId,soloStudentId,status:"active"}),
      persistResults:persist} as any);
    return object;
  };
  let object=create();
  return {room:()=>room,messages,alarm:()=>alarm,restore:()=>{object=create()},alarmNow:()=>object.alarm(),
    end:()=>object.webSocketMessage(socket,JSON.stringify({type:"end_fight",commandId:"teacher-end-001"})),
    leave:(commandId="solo-exit-001", targetId=id)=>object.webSocketMessage(socket,JSON.stringify({type:"leave_fight",commandId,targetId}))};
}

test("solo host exit keeps the rewarded roster; normal departures and forged targets cannot end other hosts' fights", async () => {
  const h=harness(); await h.leave();
  assert.equal(h.room().snapshot.endedByHost,true);
  assert.equal(h.room().snapshot.victory,false);
  assert.equal(h.room().results[0].xpEarned,33);
  assert.ok(h.room().snapshot.players[id]);
  assert.equal(h.messages.at(-1).type,"fight_left");
  const teacher=harness(earned(),null,undefined,"teacher");await teacher.end();
  assert.deepEqual(teacher.room().results,h.room().results,"both command paths invoke the same reward calculation");
  const untouched=harness(started());await untouched.leave();assert.equal(untouched.room().results[0].xpEarned,0);

  for (const host of [null, "another-student"]) {
    const snapshot=earned(); snapshot.players.other={...structuredClone(snapshot.players[id]),studentId:"other"};
    const group=harness(snapshot,host); await group.leave("nonhost-leave-001",host||"other");
    assert.equal(group.room().snapshot.endedByHost,undefined);
    assert.equal(group.room().snapshot.players[id],undefined);
    assert.ok(group.room().snapshot.players.other);
  }
  const waiting=earned();waiting.currentPhase="waiting";
  const lobby=harness(waiting); await lobby.leave();
  assert.equal(lobby.room().snapshot.currentPhase,"waiting");
  const completed=endFight(earned());completed.victory=true;
  const done=harness(completed);await done.leave();assert.equal(done.room().snapshot.victory,true);
});

test("solo exit survives SQL failure and lost SQL acknowledgement, with exactly one result and stamina charge", async () => {
  const pg=new PGlite(); const db=drizzle(pg,{schema});
  try {
    const journal=JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json",import.meta.url),"utf8"));
    for(const {tag} of journal.entries)await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`,import.meta.url),"utf8"));
    await db.insert(schema.teachers).values({id:fight.teacherId,firstName:"Test",lastName:"Teacher",email:"solo@example.invalid",emailNormalized:"solo@example.invalid",passwordHash:"unused",guildCode:"SOLOXP",billingAddress:"Test",schoolDistrict:"Test",school:"Test",subject:"Math",gradeLevel:"5"});
    await db.insert(schema.students).values(student());await db.insert(schema.fights).values(fight);
    await db.insert(schema.liveCombatSessions).values({sessionId:"ABC234",fightId:fight.id,teacherId:fight.teacherId,soloStudentId:id});
    let attempt=0;
    const h=harness(earned(),id,async(s:any)=>{
      if(++attempt===1)throw new Error("SQL unavailable");
      const results=await persistCombatResults(db as any,s,{...fight,lootTable:[{itemId:"unearned"}]});
      if(attempt===2)throw new Error("Lost acknowledgement after SQL commit");
      return results;
    });
    await h.leave();assert.ok(h.alarm());assert.equal(h.room().resultsPersisted,undefined);
    h.restore();await h.leave();assert.ok(h.alarm());
    h.restore();await h.alarmNow();await h.leave();await h.leave("solo-exit-002");
    assert.equal(h.room().resultsPersisted,true);
    const results=await db.select().from(schema.combatResults);
    assert.equal(results.length,1);assert.equal(results[0].xpEarned,33);assert.equal(results[0].baseXp,33);
    assert.equal(results[0].goldReward,0);assert.deepEqual(results[0].lootTable,[]);
    const [saved]=await db.select().from(schema.students);assert.equal(saved.dailyCombats,1);assert.equal(saved.gold,0);
    const jobs=await db.select().from(schema.studentJobLevels);assert.equal(jobs[0].experience,33);
  } finally {await pg.close()}
});
