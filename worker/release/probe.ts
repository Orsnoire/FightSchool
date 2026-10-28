import { neon } from '@neondatabase/serverless';
import { releaseState, type ReleaseEnv } from './maintenance';

/** Only an explicitly configured release probe can reveal these non-personal receipts. */
export async function releaseProbe(request: Request, env: ReleaseEnv & { DATABASE_URL: string; COMBAT_SESSIONS: DurableObjectNamespace }): Promise<Response> {
  const url = new URL(request.url), challenge = url.searchParams.get('challenge');
  if (!env.RELEASE_PROBE || !/^[a-f0-9]{64}$/.test(env.RELEASE_PROBE) || challenge !== env.RELEASE_PROBE)
    return new Response(null, { status: 404 });
  try {
    const room = url.searchParams.get('room');
    if (room !== null) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(room)) return new Response(null, { status: 400 });
      return env.COMBAT_SESSIONS.get(env.COMBAT_SESSIONS.idFromName(room)).fetch('https://internal/release-probe',
        { headers: { 'x-questacademy-release-probe': env.RELEASE_PROBE } });
    }
    const sql = neon(env.DATABASE_URL);
    const [identity] = await sql`SELECT current_database() AS database, current_user AS role`;
    const ledger = await sql`SELECT hash, created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
    // Include completed sessions: their final reward/report retry may still be pending.
    const rooms = await sql`SELECT session_id FROM live_combat_sessions ORDER BY session_id`;
    const host = new URL(env.DATABASE_URL).hostname.replace('-pooler.', '.');
    const encoded = new TextEncoder().encode(JSON.stringify([challenge, host, identity.database, identity.role]));
    const fingerprint = [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoded))].map(x => x.toString(16).padStart(2, '0')).join('');
    return Response.json({ source: env.RELEASE_SHA, ...releaseState(env), fingerprint, ledger, rooms: rooms.map(row => row.session_id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Release verification unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
