import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as s from '../../worker/db/schema';
import { persistCombatResults, claimReward, combatProfile } from '../../worker/db/game-repository';
import { initialCombatState, addStudent } from '../../worker/combat/engine';
import { instanceLoot } from '../../shared/combat/instance-loot';
import { fight, student } from './fixtures';

test('fallback equipment is persisted per result, claimable exactly once, and never awarded on defeat',async()=>{
 const pg=new PGlite();const db=drizzle(pg,{schema:s});
 try{
  const journal=JSON.parse(readFileSync(new URL('../../migrations/cloudflare/meta/_journal.json',import.meta.url),'utf8'));
  for(const {tag} of journal.entries)await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`,import.meta.url),'utf8'));
  await db.insert(s.teachers).values({id:fight.teacherId,firstName:'Test',lastName:'Teacher',email:'tier@example.invalid',emailNormalized:'tier@example.invalid',passwordHash:'unused',guildCode:'TIER01',billingAddress:'Test',schoolDistrict:'Test',school:'Test',subject:'Test',gradeLevel:'5'});
  await db.insert(s.fights).values(fight);
  const [record]=await db.insert(s.students).values({...student('priest'),weapon:'t1_healer_ankh',offhand:'t1_healer_potion'}).returning();
  const profile=await combatProfile(db as any,record);
  assert.deepEqual(profile.equipmentEffects,{healingBonus:1,potionAttackBonus:1});
  for(const victory of [true,false]){
   const sessionId= victory?'WIN001':'LOSE01';
   await db.insert(s.liveCombatSessions).values({sessionId,fightId:fight.id,teacherId:fight.teacherId});
   const roomFight={...fight,lootTable:instanceLoot([],sessionId)};
   const state=addStudent(initialCombatState(sessionId,roomFight),record,profile);
   state.currentPhase='game_over';state.victory=victory;state.completedRounds=1;
   state.players[record.id].roundsParticipated=1;
   state.players[record.id].totals.questionsCorrect=1;
   const [result]=await persistCombatResults(db as any,state,roomFight);
   await persistCombatResults(db as any,JSON.parse(JSON.stringify(state)),roomFight);
   assert.deepEqual(result.lootTable,victory?roomFight.lootTable:[]);
   if(victory){
    await assert.rejects(()=>claimReward(db as any,record.id,fight.id,'unearned',result.id),/earned loot table/);
    const itemId=roomFight.lootTable[0].itemId;
    await claimReward(db as any,record.id,fight.id,itemId,result.id);
    await claimReward(db as any,record.id,fight.id,itemId,result.id);
    await assert.rejects(()=>claimReward(db as any,record.id,fight.id,roomFight.lootTable[1].itemId,result.id),/already/);
    const [saved]=await db.select().from(s.students);
    assert.equal(saved.inventory.filter(id=>id===itemId).length,1);
   }else await assert.rejects(()=>claimReward(db as any,record.id,fight.id,roomFight.lootTable[0].itemId,result.id),/No reward choice/);
  }
 }finally{await pg.close();}
});
