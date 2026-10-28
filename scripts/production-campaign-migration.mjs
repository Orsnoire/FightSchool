// Offline, exact 20 -> 25 canonical upgrade. Never use the preview history bridge here.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { canonicalCampaignLedger } from './campaign-preview-migration-bridge.mjs';
import { campaignSchemaFingerprintSQL } from './campaign-preview-schema.mjs';
const root = new URL('../migrations/cloudflare/', import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const quote = value => `'${String(value).replaceAll("'","''")}'`;

export function productionCampaignMigrationSQL() {
  // This reviewed historical upgrader ends at 0024. Later migrations run normally.
  const journal=JSON.parse(read('meta/_journal.json')).entries.slice(0,25);
  const contract=JSON.parse(read('production-campaign-contract.json'));
  if (journal.length !== 25) throw Error('Review the production campaign upgrader before adding migrations');
  const checkSchema=stage=>`IF (${campaignSchemaFingerprintSQL}) IS DISTINCT FROM ${quote(JSON.stringify(contract[stage]))}::jsonb THEN
    RAISE EXCEPTION 'Production ${stage} schema drift; no changes applied'; END IF;`;
  const commands=[];
  for (const entry of journal.slice(20)) {
    for (const statement of read(`${entry.tag}.sql`).split('--> statement-breakpoint').filter(s=>s.trim()))commands.push(`EXECUTE ${quote(statement)};`);
    const row=canonicalCampaignLedger[entry.idx];
    commands.push(`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES (${quote(row.hash)},${row.created_at});`);
  }
  return `BEGIN;
SET LOCAL search_path TO public, pg_catalog;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';
LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;
DO $production_campaign$
DECLARE actual jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('hash',hash,'created_at',created_at) ORDER BY created_at,id),'[]'::jsonb)
    INTO actual FROM drizzle.__drizzle_migrations;
  IF actual = ${quote(JSON.stringify(canonicalCampaignLedger))}::jsonb THEN
    ${checkSchema('after')}
    RETURN;
  END IF;
  IF actual IS DISTINCT FROM ${quote(JSON.stringify(canonicalCampaignLedger.slice(0,20)))}::jsonb THEN
    RAISE EXCEPTION 'Production requires the exact canonical 20-row history; no changes applied';
  END IF;
  ${checkSchema('before')}
  ${commands.join('\n  ')}
  ${checkSchema('after')}
END $production_campaign$;
COMMIT;
`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(productionCampaignMigrationSQL());
