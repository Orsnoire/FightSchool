import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateIsolation } from './fixture-cleanup.mjs';
import { commitSha } from './gates.mjs';
// Input is an independently verified inventory, not evidence that resources exist.
const sha = commitSha(process.env.RELEASE_SHA);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha,'Rehearsal checkout must match RELEASE_SHA');
execFileSync('git',['diff','--exit-code','HEAD','--','worker','client','shared','migrations','wrangler.jsonc','package.json','package-lock.json'],{stdio:'pipe'});
const target = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const manifest = { schemaVersion:1,runId:target.id,suffix:`c12-${target.id}`,mode:'isolated',isolationId:target.id,origin:target.origin,status:'running',teachers:[],students:[],fights:[],guilds:[],equipment:[],sessions:[],objects:[] };
validateIsolation(target,manifest,process.env.ISOLATED_DATABASE_URL,process.env.PRODUCTION_DATABASE_HOST);
const base = JSON.parse(readFileSync('wrangler.jsonc','utf8'));
const config = { ...base, name:target.workerName, routes:[], preview_urls:false, main:resolve('worker/index.ts'),
  assets:{...base.assets,directory:resolve('dist/public')},
  vars:{ENVIRONMENT:'rehearsal',PUBLIC_ORIGIN:target.origin,SESSION_COOKIE_NAME:'qa_rehearsal_session',SESSION_TTL_SECONDS:'3600',RELEASE_SHA:sha},
  r2_buckets:[{binding:'OBJECTS',bucket_name:target.bucketName}] };
assert.ok(!JSON.stringify(config).includes('questacademy-objects'));
mkdirSync('artifacts/rehearsal',{recursive:true});
writeFileSync('artifacts/rehearsal/wrangler.json',JSON.stringify(config,null,2)+'\n');
console.log('Prepared isolated configuration only. No resources created, migrated, deployed or destroyed.');
