// Fixed-target release transport. Never import ambient Wrangler configuration.
import { readFileSync, readdirSync, appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const WORKER = 'questacademy-campaign-preview';
export const ORIGIN = 'https://questacademy-campaign-preview.coxsonator.workers.dev';
export const PRODUCTION = { worker: 'questacademy-staging', origin: 'https://questacademy.bookwyrminteractive.studio',
  environment: 'staging', cookie: 'qa_staging_session', bucket: 'questacademy-objects' };
function targetInfo(target) {
  requireThat(['preview','production'].includes(target),'Unknown release target');
  return target === 'production' ? PRODUCTION : {worker:WORKER,origin:ORIGIN,environment:'campaign-preview',cookie:'qa_campaign_preview_session',bucket:WORKER};
}
const shaPattern = /^[a-f0-9]{40}$/;
const expectedTypes = {
  ENVIRONMENT: 'plain_text', PUBLIC_ORIGIN: 'plain_text', SESSION_COOKIE_NAME: 'plain_text',
  SESSION_TTL_SECONDS: 'plain_text', RELEASE_SHA: 'plain_text',
  DATABASE_URL: 'secret_text', PASSWORD_PEPPER: 'secret_text', SESSION_SECRET: 'secret_text',
  STAGING_AUTH_TOKEN: 'secret_text', COMBAT_SESSIONS: 'durable_object_namespace',
  OBJECTS: 'r2_bucket', ASSETS: 'assets', CF_VERSION_METADATA: 'version_metadata',
};
function requireThat(condition, message) { if (!condition) throw new Error(message); }
export function validateRequest(request, target = 'preview') {
  targetInfo(target);
  requireThat(['preflight', 'pause', 'verify', 'deploy'].includes(request.mode), 'Invalid preview release mode');
  requireThat(shaPattern.test(request.sourceSha) && shaPattern.test(request.expectedPreviousSha), 'Release SHAs must be full commit hashes');
  if(target==='preview') {
  requireThat(request.mode !== 'deploy' || request.migration0020Applied === true, 'Preview migration 0020 must be verified before deployment');
  requireThat(request.mode !== 'deploy' || request.migration0021Applied === true, 'Preview migration 0021 must be verified before deployment');
  requireThat(request.mode !== 'deploy' || request.campaignAACompatibilityApplied === true,
    'Preview AA compatibility bridge and canonical migration 0024 must be verified before deployment');
  } else requireThat(request.mode !== 'deploy' || request.canonicalMigrationApplied === true, 'Canonical production migration must be verified');
  if (request.mode !== 'preflight') {
    requireThat(/^[a-zA-Z0-9_-]{8,80}$/.test(request.pauseId ?? ''), 'A maintenance window ID is required');
    for (const field of ['probeToken', 'databaseFingerprint', 'ledgerDigest'])
      requireThat(/^[a-f0-9]{64}$/.test(request[field] ?? ''), `A verified ${field} is required`);
    if (request.mode === 'deploy') requireThat(/^[a-f0-9]{64}$/.test(request.roomDigest ?? ''), 'Verified paused room digest is required');
  }
  return request;
}
export function validateSettings(settings, request, target = 'preview') {
  const config=targetInfo(target);
  const types={...expectedTypes};
  if(target==='production'){delete types.RELEASE_SHA;delete types.CF_VERSION_METADATA;types.ADDITIONAL_PUBLIC_ORIGINS='plain_text';}
  const bindings = settings.bindings ?? [];
  const byName = Object.fromEntries(bindings.map(b => [b.name, b]));
  const optional = ['RELEASE_WINDOWS', 'RELEASE_PROBE', ...(target==='production'?['RELEASE_SHA', 'CAMPAIGN_BETA_GUILD_IDS']:[])];
  requireThat(new Set(bindings.map(b => b.name)).size === bindings.length &&
    bindings.every(b => Object.hasOwn(types, b.name) || optional.includes(b.name) && b.type === 'plain_text'),
    'Unexpected preview bindings; inspect configuration before retrying');
  for (const [name, type] of Object.entries(types)) {
    requireThat(byName[name]?.type === type, `Missing or changed preview binding: ${name}`);
  }
  requireThat(byName.ENVIRONMENT.text === config.environment, 'Refusing changed environment');
  requireThat(byName.PUBLIC_ORIGIN.text === config.origin, 'Refusing changed origin');
  requireThat(byName.SESSION_COOKIE_NAME.text === config.cookie, 'Refusing shared session cookie');
  requireThat(byName.OBJECTS.bucket_name === config.bucket, 'Refusing changed object storage');
  if(target==='production')requireThat(byName.ADDITIONAL_PUBLIC_ORIGINS.text==='https://questacademy-staging.coxsonator.workers.dev','Changed production secondary origin');
  const combat = byName.COMBAT_SESSIONS;
  requireThat(combat.class_name === 'CombatSession' && combat.namespace_id &&
    (!combat.script_name || combat.script_name === config.worker) && !combat.environment,
    'Refusing changed combat namespace binding');
  requireThat(target==='production' && !byName.RELEASE_SHA || [request.expectedPreviousSha, request.sourceSha].includes(byName.RELEASE_SHA?.text),
    'Preview release advanced unexpectedly; review before retrying');
  return byName;
}
export function uploadMetadata(settings, sourceSha, jwt, releaseBindings = []) {
  if(!settings.bindings.some(b=>b.name==='RELEASE_SHA')) releaseBindings=[...releaseBindings,{name:'RELEASE_SHA',type:'plain_text',text:sourceSha}];
  return {
    main_module: 'index.js', compatibility_date: settings.compatibility_date,
    ...(settings.compatibility_flags ? { compatibility_flags: settings.compatibility_flags } : {}),
    // Keep resource identity and all four secrets server-side. No values are downloaded or rotated.
    keep_bindings: ['secret_text', 'durable_object_namespace', 'r2_bucket', 'assets', 'version_metadata'],
    bindings: [...settings.bindings.filter(b => b.type === 'plain_text' && !releaseBindings.some(next => next.name === b.name)).map(b => ({
      name: b.name, type: b.type, text: b.name === 'RELEASE_SHA' ? sourceSha : b.text,
    })), ...releaseBindings],
    exports: { CombatSession: { type: 'durable-object', storage: 'sqlite' } },
    observability: settings.observability ?? { enabled: true },
    ...(settings.tags ? { tags: settings.tags } : {}),
    annotations: { 'workers/message': `Verified campaign release; source ${sourceSha}; PR88.` },
    assets: { jwt, config: {
      not_found_handling: 'single-page-application',
      run_worker_first: ['/api', '/api/*', '/ws', '/objects', '/objects/*'],
    } },
  };
}
export function releaseBindings(bindings, request, now = Date.now()) {
  const windows = JSON.parse(bindings.RELEASE_WINDOWS?.text ?? '[]');
  requireThat(Array.isArray(windows) && windows.length < 64, 'Invalid or full maintenance history');
  const current = windows.at(-1);
  if (request.mode === 'pause') {
    if (current?.resumedAt === null) requireThat(current.id === request.pauseId, 'Another maintenance window is active');
    else {
      requireThat(!windows.some(window => window.id === request.pauseId), 'Cannot reuse a completed maintenance ID');
      windows.push({ id: request.pauseId, startedAt: now, resumedAt: null });
    }
  } else {
    requireThat(current?.id === request.pauseId && current.resumedAt === null, 'Deployment requires the matching active pause');
    requireThat(bindings.RELEASE_PROBE?.text === request.probeToken && bindings.RELEASE_SHA.text === request.sourceSha,
      'Resume must use the verified paused runtime and probe');
    current.resumedAt = now;
  }
  return [{ name: 'RELEASE_WINDOWS', type: 'plain_text', text: JSON.stringify(windows) },
    { name: 'RELEASE_PROBE', type: 'plain_text', text: request.probeToken }];
}
export function ledgerDigest(rows) {
  return createHash('sha256').update(JSON.stringify(rows.map(row => [row.hash, String(row.created_at)]))).digest('hex');
}
export async function verifyRelease(request, fetcher, paused, expectedWindows, origin = ORIGIN) {
  const probeUrl = `${origin}/api/health/release?challenge=${request.probeToken}`;
  async function read(url) {
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    requireThat(response.ok, `Release probe failed (HTTP ${response.status})`);
    return response.json();
  }
  const probe = await read(probeUrl);
  requireThat(probe.source === request.sourceSha && probe.valid && probe.paused === paused, 'Runtime or maintenance verification failed');
  requireThat(probe.fingerprint === request.databaseFingerprint && ledgerDigest(probe.ledger) === request.ledgerDigest,
    'Database identity or migration history does not match the independently verified target');
  requireThat(JSON.stringify(probe.windows) === JSON.stringify(expectedWindows), 'Maintenance history mismatch');
  requireThat(Array.isArray(probe.rooms), 'Missing combat room inventory');
  const roomDigests = {};
  async function verifyRoom(id) {
    requireThat(/^[A-Za-z0-9_-]{1,64}$/.test(id), 'Invalid combat room ID');
    const room = await read(`${probeUrl}&room=${encodeURIComponent(id)}`);
    requireThat(room.source === request.sourceSha && room.valid && room.paused &&
      JSON.stringify(room.windows) === JSON.stringify(expectedWindows) && /^[a-f0-9]{64}$/.test(room.digest),
      'Combat room has not reached the paused runtime');
    roomDigests[createHash('sha256').update(id).digest('hex')] = room.digest;
  }
  // Bound read concurrency for large classroom histories; no room writes occur.
  if(paused)for(let index=0;index<probe.rooms.length;index+=8)await Promise.all(probe.rooms.slice(index,index+8).map(verifyRoom));
  return { source: probe.source, fingerprint: probe.fingerprint, ledgerDigest: ledgerDigest(probe.ledger), windows: probe.windows,
    roomDigests, roomDigest: createHash('sha256').update(JSON.stringify(Object.entries(roomDigests).sort())).digest('hex') };
}
export async function verifyReleaseEventually(request, fetcher, paused, windows, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), origin = ORIGIN) {
  for (let attempt=0; ; attempt++) {
    try { return await verifyRelease(request,fetcher,paused,windows,origin); }
    catch (error) {
      // A 100% deployment can still be propagating to a POP or Durable Object.
      // Retry reads only; identity/ledger mismatches always stop immediately.
      if (attempt>=11 || !/Release probe failed \(HTTP (401|404|503)\)|Runtime or maintenance verification failed|Combat room has not reached the paused runtime|Maintenance history mismatch/.test(error.message)) throw error;
      await wait(2500);
    }
  }
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
export async function run({ request, accountId, token, runtimeDir, fetcher = fetch, log = console.log, target = 'preview' }) {
  validateRequest(request,target);
  const config=targetInfo(target);
  requireThat(/^[a-f0-9]{32}$/.test(accountId ?? '') && token, 'GitHub Cloudflare deployment credentials are unavailable');
  const apiRoot = `https://api.cloudflare.com/client/v4/accounts/${accountId}`;
  const scriptPath = `/workers/scripts/${config.worker}`;
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
  const bindings = validateSettings(settings, request,target);
  let productionVersion;
  if(target==='production') {
    const versions=(await api(`${scriptPath}/deployments`)).deployments[0]?.versions;
    const alreadyPaused=bindings.RELEASE_SHA?.text===request.sourceSha && JSON.parse(bindings.RELEASE_WINDOWS?.text??'[]').at(-1)?.id===request.pauseId;
    requireThat(versions?.length===1&&versions[0].percentage===100&&(alreadyPaused||versions[0].version_id===request.expectedVersion),'Production runtime changed before release');
    productionVersion=versions[0].version_id;
  }
  async function verifyPublicPause() {
    for (const path of ['/api/health/ready', '/api/student/login', '/ws?sessionId=release-probe']) {
      const response = await fetcher(`${config.origin}${path}`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      requireThat(response.status === 503 && (await response.json()).status === 'maintenance', 'Public maintenance gate failed');
    }
  }
  log('Provider target and release settings verified.');
  if (request.mode === 'preflight') {
    log('Read-only preflight complete. No database or Worker changes made.');
    return;
  }
  if (request.mode === 'verify') {
    const windows = JSON.parse(bindings.RELEASE_WINDOWS?.text ?? '[]');
    requireThat(windows.at(-1)?.id === request.pauseId && windows.at(-1)?.resumedAt === null, 'Expected active pause missing');
    const receipt = await verifyRelease(request, fetcher, true, windows,config.origin);
    await verifyPublicPause();
    log('Read-only pause verification succeeded; private receipt retained in memory.');
    return receipt;
  }
  // Resume is forbidden until the already paused runtime observes the new ledger.
  const beforeWindows = JSON.parse(bindings.RELEASE_WINDOWS?.text ?? '[]');
  if (request.mode === 'deploy') {
    const before = await verifyRelease(request, fetcher, true, beforeWindows,config.origin);
    requireThat(before.roomDigest === request.roomDigest, 'Saved combat rooms changed during the migration pause');
  }
  releaseBindings(bindings, request); // Validate the transition before any provider write.
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
  validateSettings(latest, request,target);
  requireThat(JSON.stringify(latest.bindings) === JSON.stringify(settings.bindings), 'Preview bindings changed during upload');
  if(target==='production') {
    const versions=(await api(`${scriptPath}/deployments`)).deployments[0]?.versions;
    requireThat(versions?.length===1&&versions[0].percentage===100&&versions[0].version_id===productionVersion,'Production runtime changed during upload');
  }
  const form = new FormData();
  const nextBindings = releaseBindings(bindings, request);
  form.append('metadata', new Blob([JSON.stringify(uploadMetadata(latest, request.sourceSha, completion, nextBindings))], { type: 'application/json' }));
  form.append('index.js', new Blob([worker], { type: 'application/javascript+module' }), 'index.js');
  await api(scriptPath, { method: 'PUT', body: form });
  const deployed = await api(`${scriptPath}/settings`);
  const after = validateSettings(deployed, request,target);
  requireThat(after.RELEASE_SHA.text === request.sourceSha, 'Deployed source verification failed');
  requireThat(after.COMBAT_SESSIONS.namespace_id === bindings.COMBAT_SESSIONS.namespace_id, 'Combat namespace identity changed');
  for (const binding of nextBindings) requireThat(after[binding.name]?.text === binding.text, 'Release controls changed during deployment');
  const windows = JSON.parse(nextBindings[0].text);
  const receipt = await verifyReleaseEventually(request, fetcher, request.mode === 'pause', windows,undefined,config.origin);
  if (request.mode === 'pause') {
    await verifyPublicPause();
    log('Maintenance and every persisted room verified; private receipt retained in memory.');
    return receipt;
  }
  const response = await fetcher(`${config.origin}/api/health/live`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  requireThat(response.ok, `Preview health check failed (HTTP ${response.status})`);
  const health = await response.json();
  requireThat(health.status === 'ok' && health.environment === config.environment, 'Health response is incorrect');
  const readyResponse = await fetcher(`${config.origin}/api/health/ready`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  requireThat(readyResponse.ok, `Preview readiness check failed (HTTP ${readyResponse.status})`);
  const ready = await readyResponse.json();
  requireThat(ready.status === 'ready' && ready.environment === config.environment, 'Readiness response is incorrect');
  log(`Deployed verified source ${request.sourceSha}.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const request = JSON.parse(readFileSync('deploy/campaign-preview.json', 'utf8'));
    const receipt = await run({ request, accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN, runtimeDir: resolve('runtime') });
    if (receipt) { mkdirSync('artifacts/release', { recursive: true }); writeFileSync('artifacts/release/preview-pause-receipt.json', JSON.stringify({ verified: true }, null, 2) + '\n'); }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `Campaign preview **${request.mode}** succeeded. Source: \`${request.sourceSha}\`.\n\n${ORIGIN}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
