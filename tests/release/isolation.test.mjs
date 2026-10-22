import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { Client } from '@neondatabase/serverless';
import { validateCloudflareAccount } from '../../scripts/release/isolation.mjs';
import { validateIsolation } from '../../scripts/release/fixture-cleanup.mjs';
import { acceptanceTarget, liveOrigins, fixtureFetch } from '../staging/fixture-run.mjs';

const id = '12345678-1234-1234-1234-123456789abc';
const target = {
  id, workerName: 'questacademy-rehearsal-12345678', bucketName: 'questacademy-rehearsal-12345678',
  cloudflareAccountId: 'a'.repeat(32),
  origin: 'https://questacademy-rehearsal-12345678.example.workers.dev',
  databaseHost: 'ep-rehearsal.neon.tech', neonBranchId: 'br-rehearsal',
};
const manifest = {
  schemaVersion: 1, pending: [], runId: id, suffix: `c12-${id}`, mode: 'isolated', isolationId: id,
  origin: target.origin, status: 'running', teachers: [], students: [], fights: [], guilds: [], equipment: [], sessions: [], objects: [],
};
const databaseUrl = 'postgres://example:unused@ep-rehearsal.neon.tech/test';
const productionHost = 'ep-live.neon.tech';
const acceptanceEnv = {
  STAGING_ORIGIN: target.origin, ISOLATED_ORIGIN: target.origin, ACCEPTANCE_MODE: 'isolated',
  ISOLATION_ID: id, WORKER_VERSION: id,
};

test('all acceptance entry points refuse missing targets before any network call', () => {
  for (const script of ['live-combat-acceptance.mjs', 'operational-acceptance.mjs', 'static-avatar-acceptance.mjs']) {
    const url = pathToFileURL(resolve('tests/staging', script)).href;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval',
      `globalThis.fetch = async () => { throw new Error('NETWORK_CALL_REACHED'); }; await import(${JSON.stringify(url)});`],
      { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STAGING_ORIGIN must be explicit/);
    assert.ok(!result.stderr.includes('Error: NETWORK_CALL_REACHED'));
  }
});

test('production endpoint comparison rejects DNS aliases and malformed inventory hostnames', () => {
  for (const host of ['ep-rehearsal.neon.tech', 'EP-REHEARSAL.NEON.TECH', 'ep-rehearsal-pooler.neon.tech',
    'ep-rehearsal.neon.tech.', 'ep-rehearsal-pooler.neon.tech.', 'ep-rehearsal.neon.tech:5432',
    ' ep-rehearsal.neon.tech', 'ep-rehearsal.neon.tech ', 'ep-rehearsal.neon.tech?ignored']) {
    assert.throws(() => validateIsolation(target, manifest, databaseUrl, host), `Accepted production alias ${host}`);
  }
  const dotted = { ...target, databaseHost: 'ep-live.neon.tech.' };
  assert.throws(() => validateIsolation(dotted, manifest, 'postgres://example:unused@ep-live.neon.tech./test', productionHost));
});

test('database URL routing overrides cannot bypass the independently checked hostname', () => {
  // Constructing the installed driver proves its parser behavior without connecting.
  assert.equal(new Client({ connectionString: `${databaseUrl}?host=${productionHost}` }).host, productionHost);
  for (const query of ['host=ep-live.neon.tech', 'hostaddr=127.0.0.1', 'port=5433',
    'options=endpoint%3Dep-live', 'dbname=production', 'user=production', 'password=canary',
    'sslmode=require&host=ep-live.neon.tech', '%68ost=ep-live.neon.tech', 'sslmode=require&sslmode=disable']) {
    assert.throws(() => validateIsolation(target, manifest, `${databaseUrl}?${query}`, productionHost));
  }
  assert.equal(validateIsolation(target, manifest, `${databaseUrl}?sslmode=require&channel_binding=require`, productionHost), target);
  assert.equal(validateIsolation(target, manifest, databaseUrl, productionHost), target);
});

test('cleanup account must match inventory before an absence check can be trusted', () => {
  assert.doesNotThrow(() => validateCloudflareAccount(target.cloudflareAccountId, 'a'.repeat(32)));
  for (const account of [undefined, '', 'b'.repeat(32)]) {
    assert.throws(() => validateCloudflareAccount(target.cloudflareAccountId, account));
  }
  for (const account of [undefined, '']) assert.throws(() => validateIsolation({ ...target, cloudflareAccountId: account }, manifest, databaseUrl, productionHost));
});

test('fixture POSTs and R2 PUTs never follow redirects after the health check', async () => {
  let destinationWrites = 0;
  const server = createServer((request, response) => {
    if (request.url === '/destination') { destinationWrites++; response.end('unexpected'); }
    else { response.writeHead(Number(request.url.slice(1)), { Location: '/destination' }); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const method of ['POST', 'PUT']) for (const status of [301, 302, 303, 307, 308]) {
      await assert.rejects(fixtureFetch(`${origin}/${status}`, { method, body: 'synthetic', redirect: 'follow' }));
    }
    assert.equal(destinationWrites, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('isolated acceptance and cleanup share the exact UUID-named workers.dev boundary', () => {
  assert.equal(acceptanceTarget(acceptanceEnv).origin, target.origin);
  const origins = [
    ...[...liveOrigins].flatMap(origin => [origin, `${origin}.`, `${origin}:8443`]),
    'https://arbitrary.example',
    'https://questacademy-rehearsal-87654321.example.workers.dev',
    `${target.origin}.`, `${target.origin}:8443`, `${target.origin}/path`,
    'https://questacademy-rehearsal-12345678.extra.example.workers.dev',
  ];
  for (const origin of origins) {
    assert.throws(() => acceptanceTarget({ ...acceptanceEnv, STAGING_ORIGIN: origin, ISOLATED_ORIGIN: origin }), origin);
    assert.throws(() => validateIsolation({ ...target, origin }, { ...manifest, origin }, databaseUrl, productionHost), origin);
  }
});

const base = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'));
const generator = resolve('scripts/release/prepare-rehearsal.mjs');
function generate(config, inspect) {
  const directory = mkdtempSync(join(tmpdir(), 'qa-rehearsal-config-'));
  try {
    writeFileSync(join(directory, 'wrangler.jsonc'), JSON.stringify(config));
    writeFileSync(join(directory, 'target.json'), JSON.stringify(target));
    const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git(['init']); git(['add', 'wrangler.jsonc']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic configuration']);
    const sha = git(['rev-parse', 'HEAD']).trim();
    const result = spawnSync(process.execPath, [generator, join(directory, 'target.json')], {
      cwd: directory, encoding: 'utf8', env: {
        PATH: process.env.PATH, RELEASE_SHA: sha, ISOLATED_DATABASE_URL: databaseUrl, PRODUCTION_DATABASE_HOST: productionHost,
      },
    });
    inspect(result, directory, sha);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('generator preserves required runtime settings and emits only isolated bindings without credentials', () => {
  const withProductionVars = structuredClone(base);
  withProductionVars.vars.DATABASE_URL = 'production-secret-canary';
  withProductionVars.vars.SESSION_SECRET = 'production-secret-canary';
  generate(withProductionVars, (result, directory, sha) => {
    assert.equal(result.status, 0, result.stderr);
    const raw = readFileSync(join(directory, 'artifacts/rehearsal/wrangler.json'), 'utf8');
    const config = JSON.parse(raw);
    assert.equal(config.name, target.workerName);
    assert.equal(config.account_id, target.cloudflareAccountId);
    assert.deepEqual(config.routes, []);
    assert.equal(config.workers_dev, true); assert.equal(config.preview_urls, false);
    assert.equal(config.vars.PUBLIC_ORIGIN, target.origin); assert.equal(config.vars.RELEASE_SHA, sha);
    assert.equal(config.main, join(directory, 'worker/index.ts'));
    assert.equal(config.assets.directory, join(directory, 'dist/public'));
    assert.equal(config.compatibility_date, base.compatibility_date);
    assert.deepEqual(config.durable_objects, { bindings: [{ name: 'COMBAT_SESSIONS', class_name: 'CombatSession' }] });
    assert.deepEqual(config.exports, { CombatSession: { type: 'durable-object', storage: 'sqlite' } });
    assert.deepEqual(config.r2_buckets, [{ binding: 'OBJECTS', bucket_name: target.bucketName }]);
    for (const value of ['production-secret-canary', 'questacademy-objects', 'questacademy-staging', 'bookwyrminteractive.studio']) assert.ok(!raw.includes(value));
  });
});

for (const [name, mutate] of [
  ['external Durable Object namespace', c => { c.durable_objects.bindings[0].script_name = 'questacademy-staging'; }],
  ['Durable Object environment', c => { c.durable_objects.bindings[0].environment = 'production'; }],
  ['Durable Object transfer', c => { c.migrations = [{ tag: 'v1', transferred_classes: [{ from: 'CombatSession', from_script: 'questacademy-staging', to: 'CombatSession' }] }]; }],
  ['export namespace transfer', c => { c.exports.CombatSession.from = { script: 'questacademy-staging', class_name: 'CombatSession' }; }],
  ['named environment routes and secrets', c => { c.env = { production: { name: 'questacademy-staging', routes: base.routes, vars: { DATABASE_URL: 'secret-canary' } } }; }],
  ['singular route', c => { c.route = 'questacademy.bookwyrminteractive.studio/*'; }],
  ['service binding', c => { c.services = [{ binding: 'PRODUCTION', service: 'questacademy-staging' }]; }],
  ['Hyperdrive binding', c => { c.hyperdrive = [{ binding: 'DB', id: 'production-id' }]; }],
  ['secret store binding', c => { c.secrets_store_secrets = [{ binding: 'SESSION_SECRET', store_id: 'production-id', secret_name: 'production' }]; }],
]) test(`generator fails closed on ${name} rather than carrying production configuration`, () => {
  const config = structuredClone(base); mutate(config);
  generate(config, result => assert.notEqual(result.status, 0, `Unsafe config accepted: ${name}`));
});
