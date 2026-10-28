// Read-only inspection through the existing production credential environment.
import { neon } from '@neondatabase/serverless';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { canonicalCampaignLedger } from './campaign-preview-migration-bridge.mjs';
import { ledgerDigest } from './deploy-campaign-preview.mjs';

export const PRODUCTION_WORKER = 'questacademy-staging';
export const PRODUCTION_ORIGIN = 'https://questacademy.bookwyrminteractive.studio';
export async function inspectProduction({ request, databaseUrl, accountId, token, fetcher = fetch, query }) {
  if (request.mode !== 'inspect' || !/^[a-f0-9-]{36}$/.test(request.expectedVersion))
    throw Error('Invalid read-only production inspection request');
  if (accountId !== '20c65b1c6253b39f80070e380d7cf3d4' || !token) throw Error('Production account credentials unavailable');
  const root = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${PRODUCTION_WORKER}`;
  async function api(path) {
    const response = await fetcher(root + path, { method:'GET', headers:{ Authorization:`Bearer ${token}` },redirect:'error',signal:AbortSignal.timeout(30000) });
    const body = await response.json();
    if (!response.ok || !body.success) throw Error(`Production inspection failed (HTTP ${response.status})`);
    return body.result;
  }
  const settings = await api('/settings'), deployment = (await api('/deployments')).deployments[0];
  const bindings = Object.fromEntries(settings.bindings.map(binding => [binding.name,binding]));
  if (bindings.PUBLIC_ORIGIN?.text !== PRODUCTION_ORIGIN || bindings.ENVIRONMENT?.text !== 'staging' ||
      bindings.COMBAT_SESSIONS?.namespace_id !== '58bae273b1834618a37c272b5f6d6478' || bindings.OBJECTS?.bucket_name !== 'questacademy-objects' ||
      deployment.versions.length !== 1 || deployment.versions[0].percentage !== 100 || deployment.versions[0].version_id !== request.expectedVersion)
    throw Error('Production provider identity changed; stop and inspect');
  const url = new URL(databaseUrl), host = url.hostname.replace('-pooler.', '.');
  if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host)) throw Error('Unexpected production database endpoint');
  const sql = query ?? neon(databaseUrl);
  const [identity] = await sql('SELECT current_database() AS database, current_user AS role, version() AS version', []);
  const ledger = await sql('SELECT hash, created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY id', []);
  if (ledgerDigest(ledger) !== ledgerDigest(canonicalCampaignLedger.slice(0,20))) throw Error('Production must have the exact canonical 20-row history');
  const counts = await sql('SELECT (SELECT count(*) FROM students)::text AS students, (SELECT count(*) FROM aa_purchases)::text AS aa_purchases, (SELECT count(*) FROM live_combat_sessions)::text AS combat_sessions', []);
  const fingerprint = createHash('sha256').update(JSON.stringify([request.challenge ?? randomBytes(32).toString('hex'),host,identity.database,identity.role])).digest('hex');
  return { worker:PRODUCTION_WORKER,origin:PRODUCTION_ORIGIN,version:request.expectedVersion,host,database:identity.database,role:identity.role,
    postgresVersion:identity.version,fingerprint,ledgerDigest:ledgerDigest(ledger),ledgerRows:ledger.length,counts:counts[0] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const receipt = await inspectProduction({ request:JSON.parse(readFileSync('deploy/production-preflight.json','utf8')),
      databaseUrl:process.env.DATABASE_URL,accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN });
    // Live provider identities, population counts and fingerprints stay in memory.
    const summary={providerVerified:true,canonicalHistoryVerified:true};
    mkdirSync('artifacts/release',{recursive:true});writeFileSync('artifacts/release/production-inspection.json',JSON.stringify(summary,null,2)+'\n');
    console.log('Production provider identity and canonical migration history verified.');
  } catch (error) { console.error(error.message?.includes('Production') || error.message?.startsWith('Invalid') || error.message?.startsWith('Unexpected') ? error.message : 'Production inspection failed; credentials and database errors withheld');process.exitCode=1; }
}
