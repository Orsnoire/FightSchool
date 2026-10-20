// Bounded synthetic acceptance for PR #79; state file contains temporary cookies.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';
import {encounterTierForLevels} from '../../shared/encounter-tiers.ts';
import {encounterHpPool} from '../../shared/combat/encounters.ts';
const origin='https://questacademy.bookwyrminteractive.studio';
const file=process.env.PROBE_STATE;
assert.ok(file,'PROBE_STATE must point outside the repository');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const stateRelative=relative(root,resolve(file));
assert.ok(stateRelative==='..'||stateRelative.startsWith('../')||isAbsolute(stateRelative),'PROBE_STATE must be outside the repository');
assert.ok(['before','resume-before','after','progression'].includes(process.argv[2]),'Explicit probe mode required; see release report before running');
const sockets=[];
let agent;
if(process.env.HTTPS_PROXY){
  const {HttpsProxyAgent}=await import(process.env.PROBE_PROXY_MODULE);
  agent=new HttpsProxyAgent(process.env.HTTPS_PROXY);
}
async function api(path,method='GET',cookie,body){
  const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const p=await r.json(); assert.ok(r.ok,`${method} ${path}: ${r.status} ${JSON.stringify(p)}`);
  return {payload:p,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
class Actor{
  constructor(cookie,room){this.messages=[];this.ws=new WebSocket(origin.replace('https:','wss:')+`/ws?sessionId=${room}`,{headers:{Cookie:cookie},origin,agent,handshakeTimeout:20000});sockets.push(this.ws);this.ws.on('message',b=>this.messages.push(JSON.parse(b)));}
  async open(){await new Promise((ok,no)=>{this.ws.once('open',ok);this.ws.once('error',no)});}
  async wait(fn){const end=Date.now()+30000;while(Date.now()<end){const m=this.messages.find(fn);if(m)return m;await new Promise(r=>setTimeout(r,50));}throw new Error('State timeout');}
  async send(type,fields={}){const commandId=randomUUID();this.ws.send(JSON.stringify({type,commandId,...fields}));const m=await this.wait(m=>m.commandId===commandId&&['command_ack','protocol_error'].includes(m.type));assert.equal(m.type,'command_ack',JSON.stringify(m));}
  async state(phase){return (await this.wait(m=>m.type==='combat_state'&&m.state.currentPhase===phase)).state;}
}
async function connect(cookie,room,role){const a=new Actor(cookie,room);await a.open();a.ws.send(JSON.stringify({type:role,commandId:randomUUID()}));await a.wait(m=>role==='host'?m.type==='session_created':m.type==='combat_state');return a;}
async function makeFight(data,tier=1){
  const f=await api('/api/fights','POST',data.teacher.cookie,{teacherId:data.teacher.payload.id,title:`PR79 probe ${data.suffix} tier ${tier}`,questions:Array.from({length:10},(_,i)=>({id:`q${i}`,type:'short_answer',question:'2+2?',correctAnswer:'4',timeLimit:300})),enemies:[{id:'swarm',name:'Probe goblin',image:'/enemies/goblin-v1.png',enemyType:'goblin',role:'trash',quantity:5,wave:1,swarm:{enemiesPerFourPlayers:3},difficultyMultiplier:1,ai:{mode:'basic'}},{id:'boss',name:'Probe Samhain',image:'/enemies/samhain-v1.png',enemyType:'samhain',role:'boss',quantity:1,wave:2,difficultyMultiplier:1,ai:{mode:'basic'}}],baseXP:10,baseEnemyDamage:1,encounterTier:tier,enemyDisplayMode:'consecutive'});
  data.fights.push(f.payload.id);save(data);
  if(data.guildId)await api(`/api/guilds/${data.guildId}/fights`,'POST',data.teacher.cookie,{fightId:f.payload.id});
  const r=await api(`/api/fights/${f.payload.id}/sessions`,'POST',data.teacher.cookie);return {fight:f.payload.id,room:r.payload.sessionId};
}
function save(data){writeFileSync(file,JSON.stringify(data,null,2),{mode:0o600});}
try{
 if(process.argv[2]==='resume-before'){
  const data=JSON.parse(readFileSync(file));const host=await connect(data.teacher.cookie,data.old.room,'host');const player=await connect(data.student.cookie,data.old.room,'join');await host.send('start_fight');data.old.snapshot=await player.state('question');save(data);assert.equal(data.old.snapshot.encounterTier,undefined);console.log('PASS: old room started, baseline saved',data.old.room);
 }else if(process.argv[2]==='before'){
  const suffix=randomUUID(),password=`Probe-${randomUUID()}!`;
  const teacher=await api('/api/teacher/signup','POST',undefined,{firstName:'Release',lastName:'Probe',email:`qa-pr79-${suffix}@example.invalid`,password,billingAddress:'Synthetic fixture',schoolDistrict:'Acceptance',school:'Acceptance',subject:'Math',gradeLevel:'5'});
  const data={suffix,teacher,fights:[]};save(data);
  data.student=await api('/api/student/login','POST',undefined,{nickname:`qa-pr79-${suffix}`,password});save(data);
  await api(`/api/student/${data.student.payload.id}/character`,'PATCH',data.student.cookie,{characterClass:'wizard',gender:'A'});
  data.old=await makeFight(data);save(data);
  const host=await connect(teacher.cookie,data.old.room,'host');
  const player=await connect(data.student.cookie,data.old.room,'join');
  await host.send('start_fight');data.old.snapshot=await player.state('question');save(data);
  assert.equal(data.old.snapshot.encounterTier,undefined);
  console.log(JSON.stringify({stage:'before',room:data.old.room,tier:data.old.snapshot.encounterTier??null,enemies:data.old.snapshot.enemies.map(e=>({id:e.id,hp:e.maxHealth}))}));
 }else if(process.argv[2]==='after'){
  const data=JSON.parse(readFileSync(file));
  const host=await connect(data.teacher.cookie,data.old.room,'host');
  const player=await connect(data.student.cookie,data.old.room,'join');
  const restored=(await player.wait(m=>m.type==='combat_state')).state;
  assert.equal(restored.encounterTier,undefined);
  assert.deepEqual(restored.enemies.map(e=>[e.id,e.maxHealth]),data.old.snapshot.enemies.map(e=>[e.id,e.maxHealth]));
  console.log('PASS: pre-deployment room reconnect retains original tier, enemy IDs/counts and maximum HP');
  await host.send('end_fight');
  for(const tier of [1,2,3,4]){
   const f=await makeFight(data,tier),h=await connect(data.teacher.cookie,f.room,'host'),p=await connect(data.student.cookie,f.room,'join');
   const preview=await p.state('waiting');await h.send('start_fight');const started=await p.state('question');
   assert.equal(started.encounterTier,tier);assert.deepEqual(preview.enemies,started.enemies);
   assert.equal(started.enemies.length,5*tier+1);
   const pool=encounterHpPool(1,tier,10);
   for(const e of started.enemies)assert.equal(e.maxHealth,Math.max(1,Math.floor(Math.floor(pool*(e.role==='boss'?0.5:0.1))/(e.role==='boss'?1:5*tier))));
   console.log(JSON.stringify({stage:'after',tier,room:f.room,count:started.enemies.length,pool,hp:started.enemies.map(e=>e.maxHealth)}));
   await h.send('end_fight');
  }
 }else if(process.argv[2]==='progression'){
  const data=JSON.parse(readFileSync(file));
  const guild=await api('/api/guilds','POST',data.teacher.cookie,{name:`PR79 acceptance ${data.suffix}`,description:'Synthetic release acceptance'});data.guildId=guild.payload.id;save(data);
  await api(`/api/guilds/${data.guildId}/members`,'POST',data.student.cookie,{studentId:data.student.payload.id});
  await api(`/api/guilds/${data.guildId}/progression`,'PATCH',data.teacher.cookie,{limitTier:4});
  // A real answer and victory must persist job XP, then raise a minimum-tier-1 lobby.
  const training=await api('/api/fights','POST',data.teacher.cookie,{teacherId:data.teacher.payload.id,title:`PR79 progression ${data.suffix}`,questions:[{id:'gain',type:'short_answer',question:'2+2?',correctAnswer:'4',timeLimit:300}],enemies:[{id:'gain-enemy',name:'Progression slime',image:'/enemies/slime-v2.png',enemyType:'slime',role:'boss',quantity:1,difficultyMultiplier:1,ai:{mode:'basic'}}],baseXP:100,baseEnemyDamage:1,encounterTier:1,enemyDisplayMode:'simultaneous'});
  data.fights.push(training.payload.id);save(data);
  await api(`/api/guilds/${data.guildId}/fights`,'POST',data.teacher.cookie,{fightId:training.payload.id});
  const room=(await api(`/api/fights/${training.payload.id}/sessions`,'POST',data.teacher.cookie)).payload.sessionId;
  const h=await connect(data.teacher.cookie,room,'host'),p=await connect(data.student.cookie,room,'join');
  await h.send('start_fight');await p.state('question');await new Promise(r=>setTimeout(r,3100));
  await p.send('answer',{round:1,questionId:'gain',answer:'4'});
  await p.state('actions');await p.send('ready',{round:1});await p.state('abilities');await p.send('ready',{round:1});
  const resolution=await p.state('question_resolution');
  if(resolution.enemies[0].health>0)await h.send('eliminate_enemy',{round:1,targetId:resolution.enemies[0].id});
  else await p.send('playback_complete',{round:1,batchId:resolution.playback.id});
  await p.wait(m=>m.type==='game_over'&&m.results?.length);
  const levels=(await api(`/api/student/${data.student.payload.id}/job-levels`,'GET',data.student.cookie)).payload;
  const actual=levels.find(x=>x.jobClass==='wizard');assert.ok(actual.level>=2,JSON.stringify(levels));
  const auto=await makeFight(data,1),ah=await connect(data.teacher.cookie,auto.room,'host'),ap=await connect(data.student.cookie,auto.room,'join');
  const preview=await ap.state('waiting');const effective=preview.players[data.student.payload.id].jobLevels.wizard;
  assert.equal(preview.encounterTier,encounterTierForLevels([effective]));assert.ok(preview.encounterTier>=2);
  await ah.send('start_fight');const opened=await ap.state('question');assert.equal(opened.encounterTier,preview.encounterTier);assert.equal(opened.enemies.length,5*opened.encounterTier+1);
  console.log(JSON.stringify({check:'durable progression raises automatic tier',jobLevel:actual.level,effectiveLevel:effective,tier:opened.encounterTier,room:auto.room}));
  await ah.send('end_fight');
  for(const id of data.fights)await api(`/api/fights/${id}`,'DELETE',data.teacher.cookie);
  console.log('PASS: tier minimum, swarm count, full coefficient HP, preview/start parity; only probe fights archived');
 }
}finally{for(const s of sockets)s.terminate();}
