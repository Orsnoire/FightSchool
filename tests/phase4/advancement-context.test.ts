import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as s from '../../worker/db/schema';
import { AA_CATALOG, aaTier, resolveAAEffects } from '../../shared/aa';
import { ALL_CHARACTER_CLASSES, getStartingEquipment } from '../../shared/schema';
import { getCrossClassAbilities } from '../../shared/jobSystem';
import { createLobbyPreview } from '../../client/src/features/lobby/preview';
import { combatProfile } from '../../worker/db/game-repository';
import { switchStudentJob } from '../../worker/db/job-loadouts';
import { updateStudentEquipment } from '../../worker/services/equipment';
import { purchaseAdvancement } from '../../worker/services/advancement';
import { addStudent, initialCombatState, removeStudent, startQuestion, applyAnswer, selectAction, advancePhase } from '../../worker/combat/engine';
import { canonicalAbility, SUPPORT, ALLIES, PASSIVE_ABILITIES } from '../../shared/combat/abilities';
import { abilityDamage, abilityDot } from '../../shared/combat/abilityValues';
import { publicSnapshot } from '../../worker/combat/public-snapshot';
import { fight, student } from './fixtures';

const allRanks = Object.fromEntries(AA_CATALOG.filter(u => u.kind !== 'cosmetic').map(u => [u.id, u.costs.length]));
test('fight power caps, five slots and client previews agree; purchases cannot alter a saved encounter', async () => {
  const pg = new PGlite(), db = drizzle(pg, {schema:s}) as any;
  try {
    const journal = JSON.parse(readFileSync('migrations/cloudflare/meta/_journal.json','utf8'));
    for (const {tag} of journal.entries) await pg.exec(readFileSync(`migrations/cloudflare/${tag}.sql`,'utf8'));
    await db.insert(s.teachers).values({id:fight.teacherId,firstName:'AA',lastName:'Test',email:'aa@invalid.test',emailNormalized:'aa@invalid.test',passwordHash:'unused',guildCode:'AACTXT',billingAddress:'Test',schoolDistrict:'Test',school:'Test',subject:'Test',gradeLevel:'5'});
    await db.insert(s.fights).values({...fight,encounterTier:4});
    const guildId = crypto.randomUUID(), otherId = crypto.randomUUID(), id = student().id;
    await db.insert(s.guilds).values([{id:guildId,teacherId:fight.teacherId,name:'Hosting',code:'AAHOST',limitTier:4}, {id:otherId,teacherId:fight.teacherId,name:'Primary',code:'AAPRM',limitTier:1}]);
    await db.insert(s.students).values({...student(),...getStartingEquipment('warrior'),aaExperience:12000,aaRanks:allRanks,guildId:otherId});
    await db.insert(s.guildMemberships).values([{guildId,studentId:id},{guildId:otherId,studentId:id}]);
    await db.insert(s.studentJobLevels).values(ALL_CHARACTER_CLASSES.map(jobClass=>({studentId:id,jobClass,level:15,experience:630})));
    const levels = await db.select().from(s.studentJobLevels);
    const current = async () => (await db.select().from(s.students).where(eq(s.students.id,id)))[0];
    const choices = getCrossClassAbilities('warrior',Object.fromEntries(ALL_CHARACTER_CLASSES.map(j=>[j,15])) as any).slice(0,5).map(a=>a.id);
    assert.equal(choices.length,5);
    const saved = await updateStudentEquipment(db,await current(),{crossClassAbilities:choices});
    assert.deepEqual(saved.crossClassAbilities,choices);
    await assert.rejects(updateStudentEquipment(db,saved,{crossClassAbilities:[choices[0],choices[0]]}),/different/);
    await assert.rejects(updateStudentEquipment(db,{...saved,aaRanks:{}},{crossClassAbilities:choices}),/not unlocked/);
    const legacy = await updateStudentEquipment(db,await current(),{crossClassAbility1:null});
    assert.deepEqual(legacy.crossClassAbilities,[null,...choices.slice(1)],'legacy edit retains three extra assignments');
    await updateStudentEquipment(db,await current(),{crossClassAbilities:choices});
    for (const tier of [1,2,3,4]) {
      const sessionId = `AA-TIER-${tier}`;
      await db.insert(s.liveCombatSessions).values({sessionId,fightId:fight.id,teacherId:fight.teacherId,guildId,guildLimitTier:tier});
      for (const job of ALL_CHARACTER_CLASSES) {
        const record = {...await current(),...getStartingEquipment(job),characterClass:job};
        const profile = await combatProfile(db,record,sessionId);
        assert.equal(profile.advancement!.tier,tier,'room cap overrides primary guild and authored enemy tier');
        assert.equal(profile.crossClass!.length,2+Math.min(3,[0,1,2,4,10][tier]));
        const preview = createLobbyPreview(record,levels,[],tier);
        let room = addStudent(initialCombatState(sessionId,fight,0),record,profile);
        assert.deepEqual(room.players[id].stats,preview.previewStats,`${job} tier ${tier}`);
        const frozen = structuredClone(room.players[id]);
        room = addStudent(room,{...record,aaRanks:{},characterName:'Changed'}, {...profile,advancement:resolveAAEffects({},1)});
        assert.deepEqual(room.players[id],frozen,'reconnect does not reapply ranks or refill resources');
        room = removeStudent(room,id);
        room = addStudent(JSON.parse(JSON.stringify(room)),{...record,aaRanks:{}},{...profile,advancement:resolveAAEffects({},1)});
        assert.deepEqual(room.players[id].advancement,frozen.advancement,'leave/rejoin retains the encounter projection');
      }
    }
    assert.equal(aaTier({guildTier:4,campaignTier:2}),2,'future campaign adapter uses the stricter power context');
    const nonguild = await combatProfile(db,await current(),'LEGACY-NO-GUILD');
    assert.equal(nonguild.advancement!.tier,1,'missing room power context fails closed');

    // Real saved fifth-slot abilities pass admission, selection and resolution, not only catalog display.
    const ids=['fireball_crossclass','healing_potion_crossclass','hex_crossclass','mend_crossclass','fortify_crossclass'];
    await updateStudentEquipment(db,await current(),{crossClassAbilities:ids});
    await switchStudentJob(db,id,'wizard','A');
    const returned=await switchStudentJob(db,id,'warrior','A');
    assert.deepEqual(returned!.crossClassAbilities,ids,'all five assignments survive a class change');
    const record=await current(), profile=await combatProfile(db,record,'AA-TIER-3');
    for (const [index, equipped] of ids.entries()) {
      const ability=canonicalAbility(equipped);
      let room=startQuestion(addStudent(initialCombatState('AA-TIER-3',fight,0),record,profile),100,30);
      room.enemies[0].health=room.enemies[0].maxHealth=10000;
      room.players[id].health=1;
      room=applyAnswer(room,id,'4',fight.questions[0]);
      room=advancePhase(room,fight,1000); room=advancePhase(room,fight,2000);
      if(SUPPORT.has(ability))room=advancePhase(room,fight,3000);
      room=selectAction(room,id,ability,ALLIES.has(ability)?id:'e1');
      if(room.currentPhase==='actions')room=advancePhase(room,fight,4000);
      room=advancePhase(room,fight,5000);
      assert.ok(room.events.some(e=>e.abilityId===ability)||room.players[id].buffs.fortify,`slot ${index+1}: ${ability} executes`);
      if(ability==='hex')assert.ok(room.enemies[0].effects.some(e=>e.type==='hex'));
      if(['healing_potion','mend'].includes(ability))assert.ok(room.players[id].health>1);
      if(ability==='fortify')assert.ok(room.players[id].buffs.fortify);
      const publicPlayer=publicSnapshot(room).players[id];
      assert.deepEqual(publicPlayer.advancement,room.players[id].advancement);
    }
    const limited=await combatProfile(db,record,'AA-TIER-2');
    const low=addStudent(initialCombatState('AA-TIER-2',fight,0),record,limited).players[id];
    assert.ok(low.availableAbilities.includes('mend')); assert.ok(!low.availableAbilities.includes('fortify'),'fifth slot is inactive at tier 2');
    assert.deepEqual((await current()).crossClassAbilities,ids,'capping never erases saved selections');
    const firstTier=addStudent(initialCombatState('AA-TIER-1',fight,0),record,await combatProfile(db,record,'AA-TIER-1')).players[id];
    assert.ok(!firstTier.availableAbilities.includes('fireball'),'class unlocks are still capped');
    const without=addStudent(initialCombatState('AA-TIER-4',fight,0),record,await combatProfile(db,record,'AA-TIER-4')).players[id];
    const baseHex=abilityDamage(without,'hex')!;
    await updateStudentEquipment(db,await current(),{crossClassAbilities:[...ids.slice(0,4),'soul_echo']});
    const echoProfile=await combatProfile(db,await current(),'AA-TIER-4');
    const echo=addStudent(initialCombatState('AA-TIER-4',fight,0),await current(),echoProfile).players[id];
    assert.equal(abilityDamage(echo,'hex')!-baseHex,abilityDot(echo,'hex')!.damage*abilityDot(echo,'hex')!.rounds/2);
    assert.ok(PASSIVE_ABILITIES.has('soul_echo'));
    let echoRoom=startQuestion(addStudent(initialCombatState('AA-TIER-4',fight,0),await current(),echoProfile),100,30);
    echoRoom=applyAnswer(echoRoom,id,'4',fight.questions[0]);
    assert.throws(()=>selectAction(echoRoom,id,'soul_echo','e1'),/Passive/);

    // The award procedure and purchase share the same student row lock. Neither may overwrite the other.
    await db.update(s.students).set({aaRanks:{},aaPointsSpent:0,aaExperience:120,xpRemainder:0.5}).where(eq(s.students.id,id));
    const payload = [{session_id:'AA-TIER-1',student_id:id,fight_id:fight.id,guild_id:guildId,character_class:'warrior',victory:true,survived:true,is_solo_mode:false,totals:{},base_xp:60.25,gold_reward:0,loot_table:[],reward_claim:'automatic',participated:true,level_cap:4,eligible_progression:true}];
    const input={requestId:crypto.randomUUID(),upgradeId:'health',rank:1,catalogVersion:1 as const};
    await Promise.all([pg.query('SELECT award_combat_results_with_stamina($1::jsonb)',[JSON.stringify(payload)]),purchaseAdvancement(db,id,input)]);
    const after = await current();
    assert.equal(after.aaExperience,180); assert.equal(after.aaPointsSpent,2); assert.equal(after.xpRemainder,0.75);
    await pg.query('SELECT award_combat_results_with_stamina($1::jsonb)',[JSON.stringify(payload)]);
    await purchaseAdvancement(db,id,input);
    assert.deepEqual(await current(),after,'recovered award and purchase cannot pay twice');
  } finally { await pg.close(); }
});
