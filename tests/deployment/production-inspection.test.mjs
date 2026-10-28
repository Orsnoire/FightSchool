import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectProduction, PRODUCTION_ORIGIN } from '../../scripts/inspect-production-release.mjs';
import { canonicalCampaignLedger } from '../../scripts/campaign-preview-migration-bridge.mjs';
import { productionReleaseLedger } from '../../scripts/production-release-ledger.mjs';

test('production inspection is read-only, redacts credentials and rejects target/history drift', async () => {
  for (const scenario of ['valid','question-bank','old-ledger','unknown-stage','worker','version','ledger']) {
    const request={ mode:'inspect',expectedVersion:'975be8fc-972e-4738-98e0-c36b7cb5f8d1',challenge:'a'.repeat(64) };
    if (['question-bank','old-ledger'].includes(scenario)) request.schemaStage='question-bank';
    if (scenario==='unknown-stage') request.schemaStage='latest';
    let queries=0;
    const task=inspectProduction({request,databaseUrl:'postgresql://role:private-password@ep-test.c-6.us-east-2.aws.neon.tech/test',accountId:'20c65b1c6253b39f80070e380d7cf3d4',token:'secret-token',
      fetcher:async(url,options)=>{assert.equal(options.method,'GET');return Response.json({success:true,result:url.endsWith('/settings')?{bindings:[
        {name:'PUBLIC_ORIGIN',text:scenario==='worker'?'https://other.invalid':PRODUCTION_ORIGIN},{name:'ENVIRONMENT',text:'staging'},
        {name:'COMBAT_SESSIONS',namespace_id:'58bae273b1834618a37c272b5f6d6478'},{name:'OBJECTS',bucket_name:'questacademy-objects'}]}:
        {deployments:[{versions:[{version_id:scenario==='version'?'wrong':request.expectedVersion,percentage:100}]}]}});},
      query:async(sql)=>{queries++;assert.match(sql,/^SELECT /);if(sql.includes('current_database'))return[{database:'test',role:'role',version:'Postgres fixture'}];
        if(sql.includes('__drizzle'))return scenario==='question-bank'?productionReleaseLedger('question-bank'):canonicalCampaignLedger.slice(0,scenario==='old-ledger'?25:scenario==='ledger'?18:20);return[{students:'2',aa_purchases:'1',combat_sessions:'3'}];}});
    if(['valid','question-bank'].includes(scenario)){const result=await task;assert.equal(result.ledgerRows,scenario==='question-bank'?26:20);assert.equal(JSON.stringify(result).includes('private-password'),false);assert.equal(queries,3);}
    else {await assert.rejects(task,/Production|production/);if(['worker','version'].includes(scenario))assert.equal(queries,0);}
  }
});

test('production release stages stay bounded and reject unknown stages',()=>{
 assert.deepEqual(productionReleaseLedger('before'),canonicalCampaignLedger.slice(0,20));
 assert.deepEqual(productionReleaseLedger('after'),canonicalCampaignLedger);
 const current=productionReleaseLedger('question-bank');
 assert.equal(current.length,26);assert.deepEqual(current.slice(0,25),canonicalCampaignLedger);
 assert.throws(()=>productionReleaseLedger('latest'),/Unknown/);
});
