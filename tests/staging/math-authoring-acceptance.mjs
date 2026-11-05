import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
// Run only after explicit approval to create the dedicated production QA fixtures.
assert.equal(process.env.MATH_AUTHORING_QA_APPROVED,'yes','Production authoring QA fixtures require explicit owner approval.');
const origin='https://questacademy.bookwyrminteractive.studio';
const suffix=Date.now().toString(36)+randomUUID().slice(0,6);
const base='/api/math/templates';
const actors=[];const checks=[];const fixtures=[];
async function api(path,{method='GET',cookie,body,status=200,requestOrigin=origin}={}) {
 const r=await fetch(origin+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Origin:requestOrigin,Accept:'application/json',...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();assert.equal(r.status,status,`${method} ${path}: expected ${status}, got ${r.status}`);
 return {data,cookie:r.headers.get('set-cookie')?.split(';')[0],cache:r.headers.get('cache-control')};
}
async function teacher(tag){const t=await api('/api/teacher/signup',{method:'POST',status:201,body:{firstName:'Acceptance',lastName:'MathAuthoring',email:`qa-math02-${tag}-${suffix}@example.invalid`,password:`Acceptance-${randomUUID()}!`,billingAddress:'Acceptance fixture',schoolDistrict:'Acceptance',school:'Acceptance',subject:'Math',gradeLevel:'11'}});actors.push(t);return t;}
function pass(name){checks.push(name);console.log(`PASS: ${name}`);}
try {
 await api(base+'/catalog',{status:401});
 const owner=await teacher('owner'),other=await teacher('other');const cookie=owner.cookie;
 const catalog=await api(base+'/catalog',{cookie});assert.equal(catalog.data.length,3);assert.match(catalog.cache,/no-store/);pass('teacher-only catalog and non-cacheable responses');
 for(const rule of ['product','quotient','power']) {
  const preset={schemaVersion:1,familyId:'integer-exponent',familyVersion:1,generatorVersion:1,graderVersion:'exact-rational-v1',title:`Acceptance ${rule} ${suffix}`,note:'Release validation fixture',rule,m:{min:-6,max:6},n:{min:-6,max:6},includeIdentityCases:true,resultSign:'any'};
  const options={seed:7,count:10};const input={preset,...options};
  const preview=(await api(base+'/preview',{method:'POST',cookie,body:input})).data;
  assert.deepEqual((await api(base+'/preview',{method:'POST',cookie,body:input})).data,preview);assert.equal(preview.variants.length,10);assert.equal(new Set(preview.variants.map(v=>v.id)).size,10);
  for(const variant of preview.variants){const {m,n}=variant.parameters;const k=rule==='product'?m+n:rule==='quotient'?m-n:m*n;assert.equal(variant.answerContract.expected,String(k));assert.match(variant.prompt,/for every/);assert.match(variant.prompt,/x > 0/);
   assert.deepEqual((await api('/api/fights/math/grade-preview',{method:'POST',cookie,body:{answerContract:variant.answerContract,submitted:String(k)}})).data,{status:'correct'});
  }
  const answerContract=preview.variants[0].answerContract;
  for(const [submitted,expected] of [[String(Number(answerContract.expected)+1),{status:'incorrect',reason:'not_equal'}],[answerContract.expected+'.0',{status:'incorrect',reason:'required_form'}],['x^2',{status:'indeterminate',reason:'unsupported_notation'}]]) assert.deepEqual((await api('/api/fights/math/grade-preview',{method:'POST',cookie,body:{answerContract,submitted}})).data,expected);
  const create={mutationId:randomUUID(),expectedRevision:0,preset,preview:options};
  const saved=(await api(base,{method:'POST',cookie,body:create,status:201})).data;fixtures.push(saved.id);assert.equal(saved.latestRevision,1);
  assert.deepEqual((await api(base,{method:'POST',cookie,body:create,status:201})).data,saved);
  const path=base+'/'+saved.id;assert.deepEqual((await api(path,{cookie})).data,saved);
  await api(path,{cookie:other.cookie,status:404});await api(path+'/revisions',{cookie:other.cookie,status:404});await api(path+'/approve',{method:'POST',cookie:other.cookie,body:{},status:404});
  const approval={mutationId:randomUUID(),expectedRevision:1,confirmed:true,contentHash:saved.revision.contentHash,previewHash:saved.revision.preview.previewHash,preview:options};
  await api(path+'/approve',{method:'POST',cookie,body:{...approval,previewHash:'0'.repeat(64)},status:409});
  const approved=(await api(path+'/approve',{method:'POST',cookie,body:approval,status:201})).data;
  assert.equal(approved.latestRevision,2);assert.equal(approved.latestApprovedRevision,2);assert.equal(approved.revision.approvedBy,owner.data.id);assert.equal(approved.revision.state,'approved');assert.deepEqual(approved.revision.preview,preview);
  assert.deepEqual((await api(path+'/approve',{method:'POST',cookie,body:approval,status:201})).data,approved);
  assert.deepEqual((await api(path,{cookie})).data,approved);assert.deepEqual((await api(path+'?revision=1',{cookie})).data.revision,saved.revision);
  assert.deepEqual((await api(path+'/revisions',{cookie})).data.map(r=>[r.revision,r.state]),[[2,'approved'],[1,'draft']]);
  await api(path+'/revisions',{method:'POST',cookie,body:{...create,mutationId:randomUUID(),expectedRevision:1},status:409});
  pass(`${rule}: deterministic preview, 10 exact answers, wrong/form/symbolic outcomes, save/retry/approve/reopen/history/ownership/stale-write checks`);
 }
 assert.equal((await api(base+'?q='+encodeURIComponent(suffix)+'&state=approved',{cookie:owner.cookie})).data.items.length,3);
 assert.deepEqual((await api(base,{cookie:other.cookie})).data.items,[]);
 await api(base+'/preview',{method:'POST',cookie:owner.cookie,body:{},requestOrigin:'https://untrusted.example',status:403});
 pass('saved-template search, cross-owner isolation, and origin protection');
 const preset={schemaVersion:1,familyId:'integer-exponent',familyVersion:1,generatorVersion:1,graderVersion:'exact-rational-v1',title:'Invalid fixture',note:'',rule:'quotient',m:{min:2,max:2},n:{min:2,max:2},includeIdentityCases:false,resultSign:'any'};
 await api(base+'/preview',{method:'POST',cookie:owner.cookie,body:{preset,seed:7,count:5},status:400});
 await api(base+'/preview',{method:'POST',cookie:owner.cookie,body:{preset:{...preset,generatorVersion:99},seed:7,count:5},status:400});
 pass('empty pools and unsupported versions rejected');
} finally {for(const actor of actors) await api('/api/teacher/logout',{method:'POST',cookie:actor.cookie});}
console.log(JSON.stringify({passed:checks.length,origin,templates:fixtures.length,generatedAnswers:30,liveCombatEnabled:false}));
