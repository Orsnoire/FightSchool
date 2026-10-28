import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, validateRequest, validateSettings, uploadMetadata, releaseBindings, verifyRelease, ledgerDigest, ORIGIN, WORKER } from '../../scripts/deploy-campaign-preview.mjs';
const request = { mode: 'preflight', sourceSha: 'b'.repeat(40), expectedPreviousSha: 'a'.repeat(40), migration0020Applied: false };
const release = { pauseId: 'test-release-01', probeToken: '1'.repeat(64), databaseFingerprint: '2'.repeat(64), ledgerDigest: ledgerDigest([]), roomDigest: ledgerDigest([]) };
const windows = [{ id: release.pauseId, startedAt: 1, resumedAt: null }];
function settings() {
  return { compatibility_date: '2026-09-21', bindings: [
    ...Object.entries({ ENVIRONMENT: 'campaign-preview', PUBLIC_ORIGIN: ORIGIN,
      SESSION_COOKIE_NAME: 'qa_campaign_preview_session', SESSION_TTL_SECONDS: '28800', RELEASE_SHA: 'a'.repeat(40) })
      .map(([name, text]) => ({ name, text, type: 'plain_text' })),
    ...['DATABASE_URL', 'PASSWORD_PEPPER', 'SESSION_SECRET', 'STAGING_AUTH_TOKEN'].map(name => ({ name, type: 'secret_text' })),
    { name: 'COMBAT_SESSIONS', type: 'durable_object_namespace', class_name: 'CombatSession', namespace_id: 'preview-namespace' },
    { name: 'OBJECTS', type: 'r2_bucket', bucket_name: WORKER },
    { name: 'ASSETS', type: 'assets' }, { name: 'CF_VERSION_METADATA', type: 'version_metadata' },
  ] };
}
test('preflight uses only GET and does not require a build or database credentials', async () => {
  const calls = [];
  await run({ request, accountId: 'c'.repeat(32), token: 'test', runtimeDir: '/nonexistent', log() {},
    fetcher: async (url, options) => { calls.push([url, options.method]); return Response.json({ success: true, result: settings() }); } });
  assert.deepEqual(calls, [[`https://api.cloudflare.com/client/v4/accounts/${'c'.repeat(32)}/workers/scripts/${WORKER}/settings`, 'GET']]);
});
test('wrong environment, storage, source and secret configuration stop before any write', async () => {
  for (const change of [
    s => { s.bindings.find(b => b.name === 'ENVIRONMENT').text = 'staging'; },
    s => { s.bindings.find(b => b.name === 'PUBLIC_ORIGIN').text = 'https://questacademy.link'; },
    s => { s.bindings.find(b => b.name === 'OBJECTS').bucket_name = 'classroom'; },
    s => { s.bindings.find(b => b.name === 'RELEASE_SHA').text = 'd'.repeat(40); },
    s => { s.bindings.find(b => b.name === 'COMBAT_SESSIONS').script_name = 'classroom'; },
    s => { s.bindings = s.bindings.filter(b => b.name !== 'DATABASE_URL'); },
  ]) {
    const s = settings(); change(s); let writes = 0;
    await assert.rejects(run({ request: { ...request, ...release, mode: 'deploy', migration0020Applied: true, migration0021Applied: true, campaignAACompatibilityApplied: true },
      accountId: 'c'.repeat(32), token: 'test', runtimeDir: '/nonexistent', log() {},
      fetcher: async (url, options) => { if (options.method !== 'GET') writes++; return Response.json({ success: true, result: s }); } }));
    assert.equal(writes, 0);
  }
});
test('deployment requires explicit migration attestation and full SHAs', () => {
  assert.throws(() => validateRequest({ ...request, mode: 'deploy' }), /migration/);
  assert.throws(() => validateRequest({ ...request, mode: 'deploy', migration0020Applied: true }), /0021/);
  assert.throws(() => validateRequest({ ...request, mode: 'deploy', migration0020Applied: true, migration0021Applied: true }), /compatibility/);
  assert.throws(() => validateRequest({ ...request, sourceSha: 'main' }), /hash/);
  assert.throws(() => validateRequest({ ...request, mode: 'production' }), /mode/);
  assert.doesNotThrow(() => validateSettings(settings(), request));
});
test('upload preserves resource identities and secrets without resubmitting values', () => {
  const s = settings(); s.bindings.find(b => b.name === 'DATABASE_URL').text = 'never-upload-this';
  const metadata = uploadMetadata(s, request.sourceSha, 'asset-token');
  assert.equal(JSON.stringify(metadata).includes('never-upload-this'), false);
  assert.equal(metadata.bindings.find(b => b.name === 'RELEASE_SHA').text, request.sourceSha);
  assert.ok(metadata.keep_bindings.includes('secret_text'));
  assert.ok(metadata.keep_bindings.includes('durable_object_namespace'));
  assert.ok(metadata.keep_bindings.includes('r2_bucket'));
  assert.equal(metadata.migrations, undefined);
});

test('pause/resume keeps immutable history and refuses wrong windows or runtime', () => {
  const bindings = validateSettings(settings(), request);
  const pauseRequest = {...request,...release,mode:'pause'};
  const first = releaseBindings(bindings,pauseRequest,100);
  const paused = {...bindings,...Object.fromEntries(first.map(b=>[b.name,b]))};
  assert.deepEqual(releaseBindings(paused,pauseRequest,200),first,'retry cannot extend the start time');
  assert.throws(()=>releaseBindings(paused,{...pauseRequest,pauseId:'another-release'}),/Another/);
  assert.throws(()=>releaseBindings(paused,{...pauseRequest,mode:'deploy'}),/runtime/);
  paused.RELEASE_SHA = {...paused.RELEASE_SHA,text:request.sourceSha};
  const reopened = releaseBindings(paused,{...pauseRequest,mode:'deploy'},300);
  assert.deepEqual(JSON.parse(reopened[0].text),[{id:release.pauseId,startedAt:100,resumedAt:300}]);
  assert.throws(()=>releaseBindings({...paused,RELEASE_WINDOWS:reopened[0]},pauseRequest),/reuse/);
  assert.throws(()=>validateRequest({...pauseRequest,probeToken:undefined}),/probeToken/);
});

test('release verification refuses wrong database, history, old objects and changed rooms', async () => {
  const base = { source:request.sourceSha,valid:true,paused:true,fingerprint:release.databaseFingerprint,ledger:[],windows,rooms:['ABC234'] };
  const room = { source:request.sourceSha,valid:true,paused:true,windows,digest:'3'.repeat(64) };
  for (const scenario of ['valid','database','ledger','runtime','object','windows']) {
    const probe=structuredClone(base), object=structuredClone(room);
    if(scenario==='database')probe.fingerprint='4'.repeat(64);
    if(scenario==='ledger')probe.ledger=[{hash:'changed',created_at:'1'}];
    if(scenario==='runtime')probe.source='a'.repeat(40);
    if(scenario==='object')object.paused=false;
    if(scenario==='windows')object.windows=[];
    const operation=verifyRelease({...request,...release},async url=>Response.json(url.includes('&room=')?object:probe),true,windows);
    if(scenario==='valid') {
      const receipt=await operation;assert.equal(Object.keys(receipt.roomDigests).length,1);
      assert.equal(JSON.stringify(receipt).includes('ABC234'),false,'saved receipt contains only hashed room IDs');
    } else await assert.rejects(operation,/verification|identity|paused/);
  }
});

test('full deploy rechecks bindings, retains resources and requires database/combat readiness', async () => {
  for (const scenario of ['success', 'binding-drift', 'not-ready']) {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'campaign-deploy-'));
    try {
      mkdirSync(join(runtimeDir, 'dist/worker'), { recursive: true });
      mkdirSync(join(runtimeDir, 'dist/public'), { recursive: true });
      writeFileSync(join(runtimeDir, 'dist/worker/index.js'), 'export default {}');
      writeFileSync(join(runtimeDir, 'dist/public/index.html'), '<main>Test build</main>');
      let reads = 0, writes = 0, readiness = 0, deployedBindings;
      const initialBindings = [{ name: 'RELEASE_WINDOWS', type: 'plain_text', text: JSON.stringify(windows) }, { name: 'RELEASE_PROBE', type: 'plain_text', text: release.probeToken }];
      const operation = run({ request: { ...request, ...release, mode: 'deploy', migration0020Applied: true,
        migration0021Applied: true, campaignAACompatibilityApplied: true },
        accountId: 'c'.repeat(32), token: 'test', runtimeDir, log() {},
        fetcher: async (url, options) => {
          assert.equal(options.redirect, 'error');
          if (url.endsWith('/settings')) {
            const s = settings(); reads++;
            s.bindings.find(b => b.name === 'RELEASE_SHA').text = request.sourceSha;
            s.bindings.push(...(deployedBindings ?? initialBindings));
            if (scenario === 'binding-drift' && reads === 2) s.bindings.find(b => b.name === 'COMBAT_SESSIONS').namespace_id = 'changed';
            if (writes) s.bindings.find(b => b.name === 'RELEASE_SHA').text = request.sourceSha;
            return Response.json({ success: true, result: s });
          }
          if (url.endsWith('/assets-upload-session')) return Response.json({ success: true, result: { buckets: [], jwt: 'complete' } });
          if (options.method === 'PUT') {
            writes++;
            assert.ok(url.endsWith(`/workers/scripts/${WORKER}`));
            const metadata = JSON.parse(await options.body.get('metadata').text());
            assert.ok(metadata.keep_bindings.includes('secret_text'));
            deployedBindings = metadata.bindings.filter(b => ['RELEASE_WINDOWS', 'RELEASE_PROBE'].includes(b.name));
            assert.equal(metadata.migrations, undefined);
            return Response.json({ success: true, result: {} });
          }
          if (url.includes('/api/health/release?')) return Response.json({ source: request.sourceSha, valid: true, paused: !writes, fingerprint: release.databaseFingerprint, ledger: [], rooms: [], windows: JSON.parse((deployedBindings ?? initialBindings)[0].text) });
          if (url === `${ORIGIN}/api/health/live`) return Response.json({ status: 'ok', environment: 'campaign-preview' });
          if (url === `${ORIGIN}/api/health/ready`) {
            readiness++;
            return Response.json({ status: scenario === 'not-ready' ? 'not_ready' : 'ready', environment: 'campaign-preview' }, { status: scenario === 'not-ready' ? 503 : 200 });
          }
          throw new Error(`Unexpected request ${url}`);
        } });
      if (scenario === 'success') await operation;
      else await assert.rejects(operation, scenario === 'binding-drift' ? /bindings changed/ : /readiness/);
      assert.equal(writes, scenario === 'binding-drift' ? 0 : 1);
      assert.equal(readiness, scenario === 'binding-drift' ? 0 : 1);
    } finally { rmSync(runtimeDir, { recursive: true, force: true }); }
  }
});
