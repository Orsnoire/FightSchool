// Offline SQL generator only: no credentials, connections or provider operations.
// Apply its output only after separately authorized preview identity/backup checks.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { campaignSchemaFingerprintSQL } from './campaign-preview-schema.mjs';

const root = new URL('../migrations/cloudflare/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const journal = JSON.parse(read('meta/_journal.json')).entries;
const legacy = JSON.parse(read('legacy-campaign-preview/_journal.json')).entries;
const contract = JSON.parse(read('legacy-campaign-preview/schema-contract.json'));
const digest = sql => createHash('sha256').update(sql).digest('hex');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const ledgerRow = (entry, sql) => ({ hash: digest(sql), created_at: entry.when });
const legacySQL = entry => read(`${entry.idx < 18 ? '' : 'legacy-campaign-preview/'}${entry.tag}.sql`);
export const legacyPreviewLedger = legacy.map(entry => ledgerRow(entry, legacySQL(entry)));
// This bridge ends at 0023. Future migrations use the normal migrator after it;
// they must never silently expand this one-time, separately reviewed operation.
export const canonicalCampaignLedger = journal.slice(0, 24).map(entry => ledgerRow(entry, read(`${entry.tag}.sql`)));

export function campaignPreviewBridgeSQL() {
  if (digest(JSON.stringify(legacyPreviewLedger)) !== contract.legacyLedgerSHA256 ||
      digest(JSON.stringify(canonicalCampaignLedger)) !== contract.canonicalLedgerSHA256)
    throw new Error('Reviewed bridge migration history changed; review contract before use');
  const assertSchema = stage => `IF (${campaignSchemaFingerprintSQL}) IS DISTINCT FROM ${quote(JSON.stringify(contract[stage]))}::jsonb THEN
    RAISE EXCEPTION 'Campaign preview ${stage} schema differs from reviewed contract; no changes applied';
  END IF;`;
  // Renumbered campaign SQL is byte-for-byte identical. A verified legacy ledger
  // proves it already ran; append aliases instead of replaying DDL or data updates.
  for (let i = 18; i <= 21; i++) {
    if (digest(legacySQL(legacy[i])) !== canonicalCampaignLedger[i + 1].hash)
      throw new Error('Legacy campaign SQL changed: review bridge before use');
  }
  const appended = canonicalCampaignLedger.slice(18);
  const complete = [...legacyPreviewLedger, ...appended].sort((a, b) => a.created_at - b.created_at);
  const commands = [];
  for (const entry of journal.slice(18, 24)) {
    if (entry.idx === 18 || entry.idx > 22) {
      for (const statement of read(`${entry.tag}.sql`).split('--> statement-breakpoint').filter(s => s.trim()))
        commands.push(`EXECUTE ${quote(statement)};`);
    }
    const row = canonicalCampaignLedger[entry.idx];
    commands.push(`INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES (${quote(row.hash)}, ${row.created_at});`);
  }
  return `-- ISOLATED CAMPAIGN PREVIEW ONLY. Never run on production or C12.
-- Exact legacy ledger required; all old rows/IDs/timestamps/hashes remain intact.
BEGIN;
SET LOCAL search_path TO public, pg_catalog;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';
LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
DO $campaign_bridge$
DECLARE actual jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('hash',hash,'created_at',created_at) ORDER BY created_at,id),'[]'::jsonb)
    INTO actual FROM drizzle.__drizzle_migrations;
  IF actual = ${quote(JSON.stringify(complete))}::jsonb THEN
    ${assertSchema('canonical')}
    RETURN;
  END IF;
  IF actual IS DISTINCT FROM ${quote(JSON.stringify(legacyPreviewLedger))}::jsonb THEN
    RAISE EXCEPTION 'Unrecognized campaign preview migration ledger; no changes applied';
  END IF;
  ${assertSchema('legacy')}
  ${commands.join('\n  ')}
  ${assertSchema('canonical')}
END $campaign_bridge$;
COMMIT;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.stdout.write(campaignPreviewBridgeSQL());
