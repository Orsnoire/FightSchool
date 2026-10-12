import { CombatSessionObject } from '../../worker/combat/session-object.ts';
import { addStudent, initialCombatState, scaleEncounter, startQuestion } from '../../worker/combat/engine.ts';
import { PALETTES } from '../../shared/avatar/appearance.ts';
import { fight, student } from '../phase4/fixtures.ts';

export function roomFixture(count:number, capture=true) {
  const now=Date.now();
  const authored={...structuredClone(fight),questions:[{...fight.questions[0],question:'<p>Explain the relationship.</p>'.repeat(20)}],
    enemies:[{id:'goblins',name:'Goblin',image:'',enemyType:'goblin',difficultyMultiplier:1,quantity:5,swarm:{enemiesPerFourPlayers:2}}]};
  let snapshot=initialCombatState('ABC234',authored as any,now);
  const students=Array.from({length:count},(_,i)=>({...student(['warrior','wizard','scout','priest'][i%4] as any,`00000000-0000-4000-8000-${String(i+10).padStart(12,'0')}`),nickname:`Fixture ${i}`}));
  for(const [i,s] of students.entries())snapshot=addStudent(snapshot,s,{levels:{[s.characterClass!]:4},appearance:{modelId:i%2?'human-female-v1':'human-male-v1',hairColorId:PALETTES.hair[i%8].id,skinColorId:PALETTES.skin[Math.floor(i/8)%8].id,eyeColorId:PALETTES.eyes[(i+4)%8].id}});
  snapshot=startQuestion(scaleEncounter(snapshot,authored as any),now-4000,300);
  const room:any={fight:authored,snapshot,receipts:[]};
  let saved=structuredClone(room);
  const costs={auth:0,student:0,profile:0,live:0,writes:0,checkpointBytes:0,sends:0,wireBytes:0};
  const sockets:any[]=[];
  function socket(actorId:string,role='student') {
    let attachment={actorId,role,sessionId:'ABC234',tokenHash:actorId,expiresAt:Date.now()+3600000};
    const ws:any={messages:[] as any[],closed:false,fail:false,deserializeAttachment:()=>({...attachment}),serializeAttachment:(a:any)=>{attachment=a;},
      send:(raw:string)=>{if(ws.fail)throw Error('closed');costs.sends++;costs.wireBytes+=Buffer.byteLength(raw);if(capture)ws.messages.push(JSON.parse(raw));},close:()=>{ws.closed=true;}};
    sockets.push(ws);return ws;
  }
  const host=socket(fight.teacherId,'teacher');
  const players=students.map(s=>socket(s.id));
  const storage={get:async()=>structuredClone(saved),put:async(_key:string,value:any)=>{costs.writes++;costs.checkpointBytes+=Buffer.byteLength(JSON.stringify(value));saved=structuredClone(value);},setAlarm:async()=>{},deleteAlarm:async()=>{}};
  let revoked=false;
  const repository:any={findActiveSession:async(id:string)=>{costs.auth++;return revoked?null:{actorId:id,actorType:id===fight.teacherId?'teacher':'student'};},
    findStudentById:async(id:string)=>{costs.student++;return students.find(s=>s.id===id)||student('warrior',id);},
    getCombatProfile:async()=>{costs.profile++;return{levels:{}};},
    findLiveCombatSession:async()=>{costs.live++;return{teacherId:fight.teacherId,status:'active'};},updateLiveCombatSessionStatus:async()=>{},
    persistResults:async()=>Object.values(saved.snapshot.players).map((p:any)=>({studentId:p.studentId,xpEarned:1}))};
  function object(){const obj=new CombatSessionObject({storage,getWebSockets:()=>sockets} as any,{DATABASE_URL:'unused'});obj.setRepository(repository);return obj as any;}
  const obj=object();
  return {obj,object,room,students,players,host,socket,costs,repository,revoked:()=>{revoked=true;},save:(r:any)=>{saved=structuredClone(r);},saved:()=>saved};
}
