import {test}from'node:test';import assert from'node:assert/strict';
import{mkdtempSync,mkdirSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
import{run,PRODUCTION,ledgerDigest,validateSettings}from'../../scripts/deploy-campaign-preview.mjs';
const request={mode:'pause',sourceSha:'b'.repeat(40),expectedPreviousSha:'a'.repeat(40),expectedVersion:'11111111-1111-4111-8111-111111111111',
  pauseId:'production-test',probeToken:'1'.repeat(64),databaseFingerprint:'2'.repeat(64),ledgerDigest:ledgerDigest([])};
function settings(){return{compatibility_date:'2026-09-21',bindings:[
  ...Object.entries({ENVIRONMENT:'staging',PUBLIC_ORIGIN:PRODUCTION.origin,ADDITIONAL_PUBLIC_ORIGINS:'https://questacademy-staging.coxsonator.workers.dev',SESSION_COOKIE_NAME:'qa_staging_session',SESSION_TTL_SECONDS:'28800'}).map(([name,text])=>({name,text,type:'plain_text'})),
  ...['DATABASE_URL','PASSWORD_PEPPER','SESSION_SECRET','STAGING_AUTH_TOKEN'].map(name=>({name,type:'secret_text'})),
  {name:'COMBAT_SESSIONS',type:'durable_object_namespace',class_name:'CombatSession',namespace_id:'production-fixture'},
  {name:'OBJECTS',type:'r2_bucket',bucket_name:'questacademy-objects'},{name:'ASSETS',type:'assets'}]};}
test('production pause retains all resources, never migrates, and checks version races before upload',async()=>{
 for(const scenario of ['success','wrong-version','version-race','wrong-origin']){
  const dir=mkdtempSync(join(tmpdir(),'production-release-'));
  try{mkdirSync(join(dir,'dist/worker'),{recursive:true});mkdirSync(join(dir,'dist/public'),{recursive:true});writeFileSync(join(dir,'dist/worker/index.js'),'export default {}');writeFileSync(join(dir,'dist/public/index.html'),'<main>fixture</main>');
   let current=settings(),metadata,writes=0,versions=0;const logs=[];
   if(scenario==='wrong-origin')current.bindings.find(b=>b.name==='PUBLIC_ORIGIN').text='https://other.invalid';
   const task=run({request,target:'production',accountId:'c'.repeat(32),token:'fixture',runtimeDir:dir,log:s=>logs.push(s),fetcher:async(url,options)=>{
    if(url.includes('/workers/scripts/'))assert.ok(url.includes('/workers/scripts/questacademy-staging'));
    if(url.endsWith('/settings'))return Response.json({success:true,result:structuredClone(current)});
    if(url.endsWith('/deployments')){versions++;return Response.json({success:true,result:{deployments:[{versions:[{percentage:100,version_id:scenario==='wrong-version'||scenario==='version-race'&&versions>1?'changed':request.expectedVersion}]}]}});}
    if(url.endsWith('/assets-upload-session'))return Response.json({success:true,result:{buckets:[],jwt:'assets-fixture'}});
    if(options.method==='PUT'){writes++;metadata=JSON.parse(await options.body.get('metadata').text());assert.ok(metadata.keep_bindings.includes('secret_text'));assert.ok(metadata.keep_bindings.includes('durable_object_namespace'));assert.equal(metadata.migrations,undefined);
      current.bindings=[...current.bindings.filter(b=>b.type!=='plain_text'),...metadata.bindings];return Response.json({success:true,result:{}});}
    if(url.includes('/api/health/release?')){const b=Object.fromEntries(current.bindings.map(x=>[x.name,x]));return Response.json({source:request.sourceSha,valid:true,paused:true,windows:JSON.parse(b.RELEASE_WINDOWS.text),fingerprint:request.databaseFingerprint,ledger:[],rooms:[]});}
    if(url.startsWith(PRODUCTION.origin))return Response.json({status:'maintenance'},{status:503});throw Error('Unexpected request');}});
   if(scenario==='success'){await task;assert.equal(writes,1);assert.equal(validateSettings(current,request,'production').COMBAT_SESSIONS.namespace_id,'production-fixture');assert.equal(JSON.stringify(logs).includes(request.probeToken),false);assert.equal(JSON.stringify(logs).includes(request.databaseFingerprint),false);}
   else{await assert.rejects(task,/runtime changed|origin/);assert.equal(writes,0);}
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
});
