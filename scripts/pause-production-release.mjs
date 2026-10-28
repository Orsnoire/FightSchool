// Operator request contains source/mode only. Live verification values never enter Git or artifacts.
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { run, ledgerDigest, PRODUCTION } from './deploy-campaign-preview.mjs';
import { canonicalCampaignLedger } from './campaign-preview-migration-bridge.mjs';

try {
  const request=JSON.parse(readFileSync('deploy/production-release.json','utf8'));
  if(!['preflight','pause','verify'].includes(request.mode))throw Error('Production workflow only inspects or pauses');
  const accountId=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
  if(accountId!=='20c65b1c6253b39f80070e380d7cf3d4'||!token)throw Error('Wrong production account');
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${PRODUCTION.worker}/settings`,
    {headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});
  const settings=await response.json();if(!response.ok||!settings.success)throw Error('Production settings unavailable');
  const bindings=Object.fromEntries(settings.result.bindings.map(b=>[b.name,b]));
  const probeToken=bindings.RELEASE_PROBE?.text??randomBytes(32).toString('hex');
  const db=neon(process.env.DATABASE_URL);
  const [identity]=await db`SELECT current_database() AS database,current_user AS role`;
  const ledger=await db`SELECT hash,created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
  const expected=canonicalCampaignLedger.slice(0,request.schemaStage==='after'?25:20);
  if(ledgerDigest(ledger)!==ledgerDigest(expected))throw Error('Production canonical ledger mismatch');
  const host=new URL(process.env.DATABASE_URL).hostname.replace('-pooler.','.');
  const databaseFingerprint=createHash('sha256').update(JSON.stringify([probeToken,host,identity.database,identity.role])).digest('hex');
  await run({request:{...request,probeToken,databaseFingerprint,ledgerDigest:ledgerDigest(expected),
    expectedVersion:JSON.parse(readFileSync('deploy/production-preflight.json','utf8')).expectedVersion},
    accountId,token,runtimeDir:'runtime',target:'production',log:()=>{}});
  console.log(`Production ${request.mode} verified. Private operational values were not logged or exported.`);
} catch { console.error('Production release safeguard stopped the operation; inspect provider state privately before continuing.');process.exitCode=1; }
