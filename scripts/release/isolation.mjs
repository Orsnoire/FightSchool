import assert from 'node:assert/strict';

export const liveOrigins = new Set(['https://questacademy.bookwyrminteractive.studio', 'https://questacademy-staging.coxsonator.workers.dev']);
export const isolationUuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;

// Used by both acceptance and cleanup. An arbitrary non-live origin is not an
// isolated target; tie it to the independently inventoried disposable Worker.
export function rehearsalOrigin(value, id) {
  assert.match(id ?? '', isolationUuid, 'Isolation identity required');
  const origin = new URL(value);
  assert.equal(origin.protocol, 'https:');
  assert.equal(origin.origin, value, 'Use the exact rehearsal origin without credentials, path or query');
  assert.equal(origin.port, '', 'Rehearsal origin must use the default HTTPS port');
  assert.match(origin.hostname, new RegExp(`^questacademy-rehearsal-${id.slice(0, 8)}\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.workers\\.dev$`),
    'Rehearsal origin must be the UUID-named Worker on workers.dev');
  return value;
}

export function validateCloudflareAccount(inventoryAccount, configuredAccount) {
  assert.match(inventoryAccount ?? '', /^[a-f0-9]{32}$/, 'Cloudflare account ID is required in the independent inventory');
  assert.equal(configuredAccount, inventoryAccount, 'Configured Cloudflare account does not match the independent inventory');
}

function hostname(value) {
  assert.equal(typeof value, 'string', 'Independent database hostname is required');
  // A final DNS root dot and case do not identify a different database. Ports,
  // whitespace, userinfo and URL/query fragments are invalid inventory input.
  const host = value.toLowerCase().replace(/\.$/, '');
  assert.ok(host.length <= 253 && host.split('.').length >= 2 && host.split('.').every(label =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)), 'Expected a bare database hostname');
  return host;
}
const endpoint = host => hostname(host).replace(/-pooler(?=\.)/, '');

export function validateDatabaseEndpoint(databaseUrl, expectedHost, productionHost) {
  const production = endpoint(productionHost);
  let database;
  try { database = new URL(databaseUrl); } catch { throw new Error('Invalid isolated database URL'); }
  assert.ok(['postgres:', 'postgresql:'].includes(database.protocol));
  assert.equal(hostname(database.hostname), hostname(expectedHost), 'Database URL does not match inventory');
  assert.notEqual(endpoint(database.hostname), production, 'Rehearsal database is the production endpoint');
  assert.equal(database.hash, '', 'Database URL fragments are not supported');
  // The Neon driver's PostgreSQL parser accepts query overrides such as host
  // and options. Validate what the driver will use, not only URL.hostname.
  const allowed = { sslmode: ['require', 'verify-ca', 'verify-full'], channel_binding: ['require', 'prefer', 'disable'] };
  const seen = new Set();
  for (const [key, value] of database.searchParams) {
    assert.ok(Object.hasOwn(allowed, key) && !seen.has(key) && allowed[key].includes(value),
      'Unsupported or duplicate database connection option; only sslmode and channel_binding are allowed');
    seen.add(key);
  }
}
