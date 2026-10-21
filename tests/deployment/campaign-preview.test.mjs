import test from 'node:test';
import assert from 'node:assert/strict';
import { run, validateRequest, validateSettings, uploadMetadata, ORIGIN, WORKER } from '../../scripts/deploy-campaign-preview.mjs';
const request = { mode: 'preflight', sourceSha: 'b'.repeat(40), expectedPreviousSha: 'a'.repeat(40), migration0020Applied: false };
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
    await assert.rejects(run({ request: { ...request, mode: 'deploy', migration0020Applied: true },
      accountId: 'c'.repeat(32), token: 'test', runtimeDir: '/nonexistent', log() {},
      fetcher: async (url, options) => { if (options.method !== 'GET') writes++; return Response.json({ success: true, result: s }); } }));
    assert.equal(writes, 0);
  }
});
test('deployment requires explicit migration attestation and full SHAs', () => {
  assert.throws(() => validateRequest({ ...request, mode: 'deploy' }), /migration/);
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
