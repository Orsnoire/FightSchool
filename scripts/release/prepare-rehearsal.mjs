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
const manifest = { schemaVersion:1,pending:[],runId:target.id,suffix:`c12-${target.id}`,mode:'isolated',isolationId:target.id,origin:target.origin,status:'running',teachers:[],students:[],fights:[],guilds:[],equipment:[],sessions:[],objects:[] };
validateIsolation(target,manifest,process.env.ISOLATED_DATABASE_URL,process.env.PRODUCTION_DATABASE_HOST);
const base = JSON.parse(readFileSync('wrangler.jsonc','utf8'));
// Fail closed when production gains configuration this rehearsal has not been
// reviewed for. In particular, never inherit env/routes, external bindings,
// namespace transfers, secret stores or build commands through a base spread.
const allowed = new Set(['$schema','name','main','compatibility_date','workers_dev','preview_urls','routes',
  'assets','durable_objects','exports','version_metadata','vars','secrets','observability','r2_buckets']);
assert.ok(Object.keys(base).every(key => allowed.has(key)), 'Unreviewed Wrangler configuration; review rehearsal isolation before generating');
const durableObjects = { bindings:[{name:'COMBAT_SESSIONS',class_name:'CombatSession'}] };
const exports = { CombatSession:{type:'durable-object',storage:'sqlite'} };
assert.deepEqual(base.durable_objects,durableObjects,'Only the local CombatSession namespace is supported; external bindings require isolation review');
assert.deepEqual(base.exports,exports,'DO lifecycle/transfer changes require isolation review');
assert.deepEqual(base.secrets,{required:['DATABASE_URL','PASSWORD_PEPPER','SESSION_SECRET','STAGING_AUTH_TOKEN']},'Secret configuration requires isolation review');
assert.deepEqual(base.r2_buckets,[{binding:'OBJECTS',bucket_name:'questacademy-objects'}],'Changed R2 bindings require isolation review');
assert.ok(Object.keys(base.assets).every(key => ['directory','binding','not_found_handling','run_worker_first'].includes(key)), 'Changed asset configuration requires isolation review');
const config = { name:target.workerName, account_id:target.cloudflareAccountId, compatibility_date:base.compatibility_date,
  workers_dev:true, routes:[], preview_urls:false, main:resolve('worker/index.ts'),
  assets:{binding:base.assets.binding,not_found_handling:base.assets.not_found_handling,run_worker_first:base.assets.run_worker_first,directory:resolve('dist/public')},
  durable_objects:durableObjects, exports, version_metadata:{binding:'CF_VERSION_METADATA'},
  secrets:{required:['DATABASE_URL','PASSWORD_PEPPER','SESSION_SECRET','STAGING_AUTH_TOKEN']}, observability:{enabled:true},
  vars:{ENVIRONMENT:'rehearsal',PUBLIC_ORIGIN:target.origin,SESSION_COOKIE_NAME:'qa_rehearsal_session',SESSION_TTL_SECONDS:'3600',RELEASE_SHA:sha},
  r2_buckets:[{binding:'OBJECTS',bucket_name:target.bucketName}] };
assert.ok(!JSON.stringify(config).includes('questacademy-objects'));
mkdirSync('artifacts/rehearsal',{recursive:true});
writeFileSync('artifacts/rehearsal/wrangler.json',JSON.stringify(config,null,2)+'\n');
console.log('Prepared isolated configuration only. No resources created, migrated, deployed or destroyed.');
