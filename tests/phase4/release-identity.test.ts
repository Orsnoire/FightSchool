import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../../worker/index.ts';

test('live health exposes only immutable release identity and is never cached', async t => {
  t.mock.method(console, 'log', () => {});
  const sha = 'a'.repeat(40), id = '12345678-1234-1234-1234-123456789abc';
  const env: any = { ENVIRONMENT: 'staging', RELEASE_SHA: sha, CF_VERSION_METADATA: { id, tag: 'private-canary' }, DATABASE_URL: 'secret-canary' };
  const response = await worker.fetch(new Request('https://example.invalid/api/health/live'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok', environment: 'staging', release: { commit: sha, workerVersion: id } });
  const legacy = await worker.fetch(new Request('https://example.invalid/api/health/live'), { ENVIRONMENT: 'local' } as any);
  assert.deepEqual((await legacy.json() as any).release, { commit: null, workerVersion: null });
});
