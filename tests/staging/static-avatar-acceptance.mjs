// Explicit release acceptance against isolated student fixtures; never runs on app startup.
// Run: STAGING_ORIGIN=https://questacademy.bookwyrminteractive.studio node --import tsx tests/staging/static-avatar-acceptance.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { STARTER_ITEM_IDS, STARTER_LOADOUTS, EQUIPMENT_SLOTS } from '../../shared/equipment-catalog.ts';
const origin=(process.env.STAGING_ORIGIN||'https://questacademy.bookwyrminteractive.studio').replace(/\/$/,'');
const sessions=[];
async function api(path,{method='GET',cookie,body,status=200,requestOrigin=origin}={}) {
 const response=await fetch(origin+path,{method,headers:{Accept:'application/json',Origin:requestOrigin,...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal(response.status,status,`${method} ${path}: HTTP ${response.status}`);
 return {payload:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
try {
 for(const modelId of ['human-male-v1','human-female-v1']) {
  const login={nickname:`qa-avatar-${randomUUID().slice(0,18)}`,password:`Acceptance-${randomUUID()}!`};
  const student=await api('/api/student/login',{method:'POST',body:login});sessions.push(student.cookie);
  const path=`/api/student/${student.payload.id}`,avatar=path+'/avatar';
  assert.equal((await api(avatar,{cookie:student.cookie})).payload,null);
  await api(avatar,{status:401});
  const appearance={modelId,hairColorId:'chestnut',eyeColorId:'green',skinColorId:'medium-brown'};
  await api(avatar,{method:'PUT',cookie:student.cookie,body:appearance,status:409});
  assert.deepEqual((await api(avatar,{method:'POST',cookie:student.cookie,body:appearance})).payload,appearance);
  assert.deepEqual((await api(avatar,{method:'POST',cookie:student.cookie,body:{...appearance,hairColorId:'black'}})).payload,appearance);
  const changed={...appearance,hairColorId:'golden-blond',skinColorId:'fair-cool'};
  assert.deepEqual((await api(avatar,{method:'PUT',cookie:student.cookie,body:changed})).payload,changed);
  await api(avatar,{method:'PUT',cookie:student.cookie,body:{...changed,eyeColorId:'invalid'},status:400});
  await api(avatar,{method:'PUT',cookie:student.cookie,body:{...changed,modelId:modelId==='human-male-v1'?'human-female-v1':'human-male-v1'},status:409});
  await api(avatar,{method:'PUT',cookie:student.cookie,body:changed,requestOrigin:'https://untrusted.invalid',status:403});
  const before=(await api(path,{cookie:student.cookie})).payload;
  for(const job of ['warrior','wizard','scout','herbalist','warrior']) {
   const selected=(await api(path+'/character',{method:'PATCH',cookie:student.cookie,body:{characterClass:job,gender:modelId==='human-female-v1'?'B':'A'}})).payload;
   for(const slot of EQUIPMENT_SLOTS)assert.equal(selected[slot],STARTER_LOADOUTS[job][slot],`${job} ${slot}`);
   assert.ok(STARTER_ITEM_IDS.every(id=>selected.inventory.includes(id)));
   assert.equal(new Set(selected.inventory).size,selected.inventory.length);
   assert.equal(selected.gold,before.gold);assert.equal(selected.totalXP,before.totalXP);
   assert.deepEqual((await api(avatar,{cookie:student.cookie})).payload,changed);
  }
  await api(path+'/character',{method:'PATCH',cookie:student.cookie,body:{characterClass:'wizard',gender:modelId==='human-female-v1'?'B':'A'}});
  await api(path+'/equipment',{method:'PATCH',cookie:student.cookie,body:{armor:'basic_armor'},status:400});
  await api(path+'/equipment',{method:'PATCH',cookie:student.cookie,body:{headgear:'basic_laurel'}});
  await api(path+'/character',{method:'PATCH',cookie:student.cookie,body:{characterClass:'wizard',gender:modelId==='human-female-v1'?'B':'A'}});
  assert.equal((await api(path,{cookie:student.cookie})).payload.headgear,'basic_laurel');
  const restored=await api('/api/student/login',{method:'POST',body:login});sessions.push(restored.cookie);
  assert.equal(restored.payload.id,student.payload.id);
  assert.deepEqual((await api(avatar,{cookie:restored.cookie})).payload,changed);
  if(sessions.length>2)await api(avatar,{cookie:sessions[0],status:403});
 }
 console.log(JSON.stringify({passed:true,origin,models:2,checks:['create and retry safety','saved color changes and relogin persistence','starter gear for all four base jobs','permanent starter inventory without duplicates','same-job equipment retention','armor exclusions','owner-only access and foreign-origin rejection','body immutability','progress unchanged']},null,2));
} finally {
 for(const cookie of sessions)await api('/api/student/logout',{method:'POST',cookie}).catch(()=>{});
}
