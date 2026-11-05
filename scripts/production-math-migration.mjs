// Exact, atomic 26 -> 27 upgrade. Run only after the protected writer/room pause.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { productionReleaseLedger } from './production-release-ledger.mjs';
import { campaignSchemaFingerprintSQL } from './campaign-preview-schema.mjs';

const read = name => readFileSync(new URL(`../migrations/cloudflare/${name}`, import.meta.url), 'utf8');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const rowDigest = `SELECT jsonb_build_object('count', count(*), 'digest',
  md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')))
  FROM %I.%I t`;

export function productionMathMigrationStatements() {
  const before = productionReleaseLedger('question-bank');
  const after = productionReleaseLedger('math-authoring');
  const previousSchema = JSON.parse(read('campaign-question-bank-contract.json'));
  const nextSchema = JSON.parse(read('math-authoring-contract.json'));
  const checkSchema = contract => `IF (${campaignSchemaFingerprintSQL}) IS DISTINCT FROM ${quote(JSON.stringify(contract))}::jsonb THEN
    RAISE EXCEPTION 'MATH-02 schema drift; no changes applied'; END IF;`;
  const commands = read('0026_math_templates.sql').split('--> statement-breakpoint').filter(s => s.trim())
    .map(s => `EXECUTE ${quote(s)};`).join('\n');
  return [
    'SET LOCAL search_path TO public, pg_catalog',
    "SET LOCAL lock_timeout = '15s'",
    "SET LOCAL statement_timeout = '120s'",
    'LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE',
    `DO $production_math$
DECLARE actual jsonb; original_ledger jsonb; old_rows jsonb := '{}'::jsonb;
  relation record; digest jsonb; table_name text;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('hash',hash,'created_at',created_at) ORDER BY id),'[]'::jsonb)
    INTO actual FROM drizzle.__drizzle_migrations;
  IF actual = ${quote(JSON.stringify(after))}::jsonb THEN
    ${checkSchema(nextSchema)}
    RETURN;
  END IF;
  IF actual IS DISTINCT FROM ${quote(JSON.stringify(before))}::jsonb THEN
    RAISE EXCEPTION 'MATH-02 requires exact canonical 26-row history; no changes applied';
  END IF;
  ${checkSchema(previousSchema)}
  SELECT jsonb_agg(to_jsonb(t) ORDER BY id) INTO original_ledger FROM drizzle.__drizzle_migrations t;
  FOR relation IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
    EXECUTE format('LOCK TABLE %I.%I IN SHARE MODE', relation.schemaname, relation.tablename);
    EXECUTE format(${quote(rowDigest)}, relation.schemaname, relation.tablename) INTO digest;
    old_rows := old_rows || jsonb_build_object(relation.tablename, digest);
  END LOOP;
  ${commands}
  INSERT INTO drizzle.__drizzle_migrations(hash, created_at) VALUES (${quote(after[26].hash)}, ${after[26].created_at});
  ${checkSchema(nextSchema)}
  IF (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM
      (SELECT * FROM drizzle.__drizzle_migrations ORDER BY id LIMIT 26) t) IS DISTINCT FROM original_ledger THEN
    RAISE EXCEPTION 'MATH-02 changed existing migration receipts';
  END IF;
  FOR table_name IN SELECT jsonb_object_keys(old_rows) LOOP
    EXECUTE format(${quote(rowDigest)}, 'public', table_name) INTO digest;
    IF digest IS DISTINCT FROM old_rows->table_name THEN
      RAISE EXCEPTION 'MATH-02 changed existing records';
    END IF;
  END LOOP;
END $production_math$`,
  ];
}
export const productionMathMigrationSQL = () => `BEGIN;\n${productionMathMigrationStatements().join(';\n')};\nCOMMIT;\n`;
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(productionMathMigrationSQL());
