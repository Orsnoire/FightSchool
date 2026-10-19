import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import { validateIsolation, cleanupDatabase, cleanupObjects } from './fixture-cleanup.mjs';
import { validateCloudflareAccount } from './isolation.mjs';

const [targetFile, manifestFile, option] = process.argv.slice(2);
assert.ok(targetFile && manifestFile && (!option || option === '--apply'), 'Usage: cleanup-fixtures.mjs <isolated-target.json> <fixture-manifest.json> [--apply]');
const target = JSON.parse(readFileSync(targetFile, 'utf8'));
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
validateIsolation(target, manifest, process.env.ISOLATED_DATABASE_URL, process.env.PRODUCTION_DATABASE_HOST);
const account = process.env.CLOUDFLARE_ACCOUNT_ID, token = process.env.CLOUDFLARE_API_TOKEN;
validateCloudflareAccount(target.cloudflareAccountId, account); assert.ok(token);
// No room may resurrect rows after deletion. A 403 is not evidence of absence.
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${target.workerName}`, {
  headers: { Authorization: `Bearer ${token}` }, redirect:'error', signal: AbortSignal.timeout(30_000),
});
assert.equal(response.status, 404, 'Remove the independently isolated Worker before fixture cleanup; it must be confirmed absent');
neonConfig.webSocketConstructor = WebSocket;
const pool = new Pool({ connectionString: process.env.ISOLATED_DATABASE_URL });
const client = await pool.connect();
try {
  const query = (sql, params) => client.query(sql, params);
  const plan = await cleanupDatabase(query, manifest); // Validate full closure before any R2 writes.
  console.log(JSON.stringify({ runId: manifest.runId, ...plan, objects: manifest.objects.length }));
  if (option === '--apply') {
    // Exact keys only; there is no bucket listing, prefix deletion or bucket reset.
    await cleanupObjects(manifest, async key => {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${target.bucketName}/objects/${key}`, {
        method:'DELETE', headers:{Authorization:`Bearer ${token}`, 'cf-r2-data-catalog-check':'true'}, redirect:'error', signal:AbortSignal.timeout(30_000),
      });
      return response.status;
    });
    const result = await cleanupDatabase(query, manifest, { apply: true });
    writeFileSync(`${manifestFile}.cleanup.json`, JSON.stringify({ runId: manifest.runId, isolationId: target.id, ...result, objects: manifest.objects, completedAt: new Date().toISOString(), roomStorage: 'Provider namespace disposal still requires independent confirmation' }, null, 2)+'\n');
    console.log(`Cleaned exact fixture scope ${manifest.runId}; retain the cleanup receipt`);
  }
} finally { client.release(); await pool.end(); }
