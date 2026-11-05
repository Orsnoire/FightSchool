import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
// Run only after explicit approval to create the dedicated production QA fixtures.
assert.equal(process.env.MATH_AUTHORING_QA_APPROVED,'yes','Production authoring QA fixtures require explicit owner approval.');
const origin='https://questacademy.bookwyrminteractive.studio';
const suffix=Date.now().toString(36)+randomUUID().slice(0,6);
const base='/api/math/templates';
const actors=[];const checks=[];const fixtures=[];const reviewed=[];
async function api(path,{method='GET',cookie,body,status=200,requestOrigin=origin}={}) {
 const r=await fetch(origin+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Origin:requestOrigin,Accept:'application/json',...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();assert.ok([status].flat().includes(r.status),`${method} ${path}: expected ${status}, got ${r.status}`);
 return {data,status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],cache:r.headers.get('cache-control')};
}
async function teacher(tag){const t=await api('/api/teacher/signup',{method:'POST',status:201,body:{firstName:'Acceptance',lastName:'MathAuthoring',email:`qa-math02-${tag}-${suffix}@example.invalid`,password:`Acceptance-${randomUUID()}!`,billingAddress:'Acceptance fixture',schoolDistrict:'Acceptance',school:'Acceptance',subject:'Math',gradeLevel:'11'}});actors.push(t);return t;}
async function parallel(items,fn,width=4) {
 const values=[];
 for(let i=0;i<items.length;i+=width) {
  const results=await Promise.allSettled(items.slice(i,i+width).map(fn));
  const failed=results.filter(r=>r.status==='rejected');
  if(failed.length)throw new AggregateError(failed.map(r=>r.reason),'Parallel acceptance check failed');
  values.push(...results.map(r=>r.value));
 }
 return values;
}
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
  reviewed.push({approved,preset,preview,options});
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
 const students=await parallel(Array.from({length:12},(_,i)=>i),async i=>{
  const student=await api('/api/student/login',{method:'POST',body:{nickname:`qa-math02-${suffix}-${i}`,password:`Acceptance-${randomUUID()}!`}});
  student.role='student';actors.push(student);return student;
 });
 const first=reviewed[0],path=base+'/'+first.approved.id;
 await parallel(students,async student=>{
  for(const target of [base,base+'/catalog',path,path+'/revisions'])await api(target,{cookie:student.cookie,status:401});
  for(const [target,body] of [[base+'/preview',{preset:first.preset,...first.options}],[base,{mutationId:randomUUID(),expectedRevision:0,preset:first.preset,preview:first.options}],
   [path+'/approve',{mutationId:randomUUID(),expectedRevision:2,confirmed:true,contentHash:first.preview.contentHash,previewHash:first.preview.previewHash,preview:first.options}],
   ['/api/fights/math/grade-preview',{answerContract:first.preview.variants[0].answerContract,submitted:first.preview.variants[0].answerContract.expected}]])await api(target,{method:'POST',cookie:student.cookie,body,status:401});
 },6);
 pass('12 QA students denied all eight teacher-only authoring/grading operations in parallel');
 const mix=[...reviewed.map(item=>async()=>assert.deepEqual((await api(base+'/preview',{method:'POST',cookie,body:{preset:item.preset,...item.options}})).data,item.preview)),
  ...reviewed.map(item=>async()=>api(base+'/'+item.approved.id,{cookie:other.cookie,status:404})),
  ...students.map(student=>async()=>api(base+'/catalog',{cookie:student.cookie,status:401}))];
 await parallel(mix,fn=>fn(),8);
 pass('mixed parallel teacher previews, cross-owner reads and student denial preserve deterministic results');
 const writes=['Tab A','Tab B'].map(note=>({mutationId:randomUUID(),expectedRevision:2,preset:{...first.preset,note},preview:first.options}));
 const raced=await parallel(writes,body=>api(path+'/revisions',{method:'POST',cookie,body,status:[201,409]}),2);
 assert.deepEqual(raced.map(r=>r.status).sort(),[201,409]);
 const winner=raced.findIndex(r=>r.status===201),draft=raced[winner].data;
 assert.equal(draft.latestRevision,3);assert.equal(draft.latestApprovedRevision,2);assert.equal(draft.revision.state,'draft');
 assert.deepEqual((await api(path+'/revisions',{method:'POST',cookie,body:writes[winner],status:201})).data,draft);
 assert.deepEqual((await api(path+'?revision=2',{cookie})).data.revision,first.approved.revision);
 assert.deepEqual((await api(path+'/revisions',{cookie})).data.map(r=>[r.revision,r.state]),[[3,'draft'],[2,'approved'],[1,'draft']]);
 for(const item of reviewed.slice(1))assert.deepEqual((await api(base+'/'+item.approved.id,{cookie})).data,item.approved);
 pass('simultaneous saves commit exactly one revision; retries and prior approvals remain intact');
} finally {
 const results=await Promise.allSettled(actors.map(actor=>api(`/api/${actor.role??'teacher'}/logout`,{method:'POST',cookie:actor.cookie})));
 const failed=results.filter(r=>r.status==='rejected');
 if(failed.length)throw new AggregateError(failed.map(r=>r.reason),'Acceptance logout failed');
}
pass('all dedicated teacher and student sessions logged out');
console.log(JSON.stringify({passed:checks.length,origin,templates:fixtures.length,teachers:actors.filter(a=>!a.role).length,students:actors.filter(a=>a.role==='student').length,generatedAnswers:30,maxParallelChecks:8,liveCombatEnabled:false}));
