// Preview-only deployment. Never import classroom wrangler/database configuration.
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const WORKER = 'questacademy-campaign-preview';
export const ORIGIN = 'https://questacademy-campaign-preview.coxsonator.workers.dev';
const shaPattern = /^[a-f0-9]{40}$/;
const expectedTypes = {
  ENVIRONMENT: 'plain_text', PUBLIC_ORIGIN: 'plain_text', SESSION_COOKIE_NAME: 'plain_text',
  SESSION_TTL_SECONDS: 'plain_text', RELEASE_SHA: 'plain_text',
  DATABASE_URL: 'secret_text', PASSWORD_PEPPER: 'secret_text', SESSION_SECRET: 'secret_text',
  STAGING_AUTH_TOKEN: 'secret_text', COMBAT_SESSIONS: 'durable_object_namespace',
  OBJECTS: 'r2_bucket', ASSETS: 'assets', CF_VERSION_METADATA: 'version_metadata',
};
function requireThat(condition, message) { if (!condition) throw new Error(message); }
export function validateRequest(request) {
  requireThat(['preflight', 'deploy'].includes(request.mode), 'Invalid preview release mode');
  requireThat(shaPattern.test(request.sourceSha) && shaPattern.test(request.expectedPreviousSha), 'Release SHAs must be full commit hashes');
  requireThat(request.mode !== 'deploy' || request.migration0020Applied === true, 'Preview migration 0020 must be verified before deployment');
  return request;
}
export function validateSettings(settings, request) {
  const bindings = settings.bindings ?? [];
  const byName = Object.fromEntries(bindings.map(b => [b.name, b]));
  requireThat(bindings.length === Object.keys(expectedTypes).length, 'Unexpected preview binding count; inspect configuration before retrying');
  for (const [name, type] of Object.entries(expectedTypes)) {
    requireThat(byName[name]?.type === type, `Missing or changed preview binding: ${name}`);
  }
  requireThat(byName.ENVIRONMENT.text === 'campaign-preview', 'Refusing non-preview environment');
  requireThat(byName.PUBLIC_ORIGIN.text === ORIGIN, 'Refusing non-preview origin');
  requireThat(byName.SESSION_COOKIE_NAME.text === 'qa_campaign_preview_session', 'Refusing shared session cookie');
  requireThat(byName.OBJECTS.bucket_name === WORKER, 'Refusing non-preview object storage');
  const combat = byName.COMBAT_SESSIONS;
  requireThat(combat.class_name === 'CombatSession' && combat.namespace_id &&
    (!combat.script_name || combat.script_name === WORKER) && !combat.environment,
    'Refusing changed combat namespace binding');
  requireThat([request.expectedPreviousSha, request.sourceSha].includes(byName.RELEASE_SHA.text),
    'Preview release advanced unexpectedly; review before retrying');
  return byName;
}
export function uploadMetadata(settings, sourceSha, jwt) {
  return {
    main_module: 'index.js', compatibility_date: settings.compatibility_date,
    ...(settings.compatibility_flags ? { compatibility_flags: settings.compatibility_flags } : {}),
    // Keep resource identity and all four secrets server-side. No values are downloaded or rotated.
    keep_bindings: ['secret_text', 'durable_object_namespace', 'r2_bucket', 'assets', 'version_metadata'],
    bindings: settings.bindings.filter(b => b.type === 'plain_text').map(b => ({
      name: b.name, type: b.type, text: b.name === 'RELEASE_SHA' ? sourceSha : b.text,
    })),
    exports: { CombatSession: { type: 'durable-object', storage: 'sqlite' } },
    observability: settings.observability ?? { enabled: true },
    ...(settings.tags ? { tags: settings.tags } : {}),
    annotations: { 'workers/message': `Campaign preview only; source ${sourceSha}; PR81.` },
    assets: { jwt, config: {
      not_found_handling: 'single-page-application',
      run_worker_first: ['/api', '/api/*', '/ws', '/objects', '/objects/*'],
    } },
  };
}
const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
function assetManifest(root) {
  const manifest = {}, files = new Map();
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      requireThat(!entry.isSymbolicLink(), 'Asset symlinks are not allowed');
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        const bytes = readFileSync(path), type = mimeTypes[extname(path)] ?? 'application/octet-stream';
        // Include MIME type so identical bytes with different types remain separate assets.
        const hash = createHash('sha256').update(type).update(bytes).digest('hex').slice(0, 32);
        manifest[`/${relative(root, path).replaceAll('\\', '/')}`] = { hash, size: bytes.length };
        files.set(hash, { bytes, type });
      }
    }
  }
  visit(root);
  requireThat(manifest['/index.html'], 'Client build is missing index.html');
  return { manifest, files };
}
export async function run({ request, accountId, token, runtimeDir, fetcher = fetch, log = console.log }) {
  validateRequest(request);
  requireThat(/^[a-f0-9]{32}$/.test(accountId ?? '') && token, 'GitHub Cloudflare deployment credentials are unavailable');
  const apiRoot = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  const scriptPath = `/workers/scripts/${WORKER}`;
  async function api(path, { method = 'GET', body, bearer = token } = {}) {
    const response = await fetcher(`${apiRoot}${path}`, {
      method, headers: { Authorization: `Bearer ${bearer}`,
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      redirect: 'error', signal: AbortSignal.timeout(60000),
    });
    const result = await response.json().catch(() => ({}));
    requireThat(response.ok && result.success, `Cloudflare ${method} failed (HTTP ${response.status}; codes ${(result.errors ?? []).map(e => e.code).join(',')})`);
    return result.result;
  }
  const settings = await api(`${scriptPath}/settings`);
  const bindings = validateSettings(settings, request);
  log(`Preview preflight passed; current release ${bindings.RELEASE_SHA.text}.`);
  if (request.mode === 'preflight') {
    log('Read-only preflight complete. No database or Worker changes made.');
    return;
  }
  const worker = readFileSync(resolve(runtimeDir, 'dist/worker/index.js'));
  const { manifest, files } = assetManifest(resolve(runtimeDir, 'dist/public'));
  const session = await api(`${scriptPath}/assets-upload-session`, { method: 'POST', body: { manifest } });
  let completion = session.buckets.length === 0 ? session.jwt : undefined;
  for (const bucket of session.buckets) {
    const form = new FormData();
    for (const hash of bucket) {
      const file = files.get(hash);
      requireThat(file, 'Cloudflare requested an unknown asset');
      form.append(hash, new Blob([file.bytes.toString('base64')], { type: file.type }), hash);
    }
    const uploaded = await api('/workers/assets/upload?base64=true', { method: 'POST', body: form, bearer: session.jwt });
    if (uploaded.jwt) completion = uploaded.jwt;
  }
  requireThat(completion, 'Cloudflare did not return an asset completion token');
  // Check again after asset upload, before replacing the Worker.
  const latest = await api(`${scriptPath}/settings`);
  validateSettings(latest, request);
  requireThat(JSON.stringify(latest.bindings) === JSON.stringify(settings.bindings), 'Preview bindings changed during upload');
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(uploadMetadata(latest, request.sourceSha, completion))], { type: 'application/json' }));
  form.append('index.js', new Blob([worker], { type: 'application/javascript+module' }), 'index.js');
  await api(scriptPath, { method: 'PUT', body: form });
  const deployed = await api(`${scriptPath}/settings`);
  const after = validateSettings(deployed, request);
  requireThat(after.RELEASE_SHA.text === request.sourceSha, 'Deployed source verification failed');
  requireThat(after.COMBAT_SESSIONS.namespace_id === bindings.COMBAT_SESSIONS.namespace_id, 'Combat namespace identity changed');
  const response = await fetcher(`${ORIGIN}/api/health/live`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  requireThat(response.ok, `Preview health check failed (HTTP ${response.status})`);
  const health = await response.json();
  requireThat(health.status === 'ok' && health.environment === 'campaign-preview', 'Preview health response is incorrect');
  log(`Deployed campaign preview source ${request.sourceSha}. ${ORIGIN}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const request = JSON.parse(readFileSync('deploy/campaign-preview.json', 'utf8'));
    await run({ request, accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN, runtimeDir: resolve('runtime') });
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `Campaign preview **${request.mode}** succeeded. Source: \`${request.sourceSha}\`.\n\n${ORIGIN}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
