import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '../../worker/db/schema.ts';

// Use Kit's CJS API with the same installed ORM that loads the declarations.
const { generateDrizzleJson, generateMigration } = createRequire(import.meta.url)('drizzle-kit/api');
const root = fileURLToPath(new URL('../../', import.meta.url));
const migrationsFolder = join(root, 'migrations/cloudflare');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const history = json(join(root, 'tests/phase4/fixtures/migration-history.json'));

function files(directory: string): Record<string, string> {
  return Object.fromEntries(readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
    .sort().map(path => [path.slice(directory.length), digest(path)]));
}

test('shipped migration SQL and journal entries through 0014 remain immutable', () => {
  for (const [name, hash] of Object.entries(history.sha256)) {
    assert.equal(digest(join(migrationsFolder, name)), hash, name);
  }
  const journal = json(join(migrationsFolder, 'meta/_journal.json'));
  assert.deepEqual(journal.entries.slice(0, history.entries.length), history.entries);
});

test('Drizzle generation is a no-op in a disposable migration copy', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'quest-schema-'));
  try {
    const out = join(temporary, 'migrations');
    cpSync(migrationsFolder, out, { recursive: true });
    const before = files(out);
    const config = join(temporary, 'drizzle.config.ts');
    writeFileSync(config, `import config from ${JSON.stringify(join(root, 'drizzle.cloudflare.config.ts'))};
export default {...config, out: ${JSON.stringify(relative(root, out))}};
`);
    const output = execFileSync(process.execPath, [
      join(root, 'node_modules/drizzle-kit/bin.cjs'), 'generate',
      '--config', config,
    ], {
      cwd: root, encoding: 'utf8', timeout: 60_000,
      // Generation is offline; never inherit a real database connection.
      env: { ...process.env, DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused' },
    });
    assert.match(output, /No schema changes/);
    assert.deepEqual(files(out), before, 'no SQL, snapshot or journal may be written');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

// PostgreSQL canonicalizes expressions, so compare parsed catalogs rather than
// loosely normalizing SQL strings. Names and FK delete/update actions matter.
const catalogQueries = {
  columns: `SELECT c.relname AS table_name, a.attname AS column_name,
    format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null,
    pg_get_expr(d.adbin,d.adrelid) AS default_expression, a.attidentity, a.attgenerated
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY c.relname,a.attname`,
  constraints: `SELECT c.relname AS table_name, con.conname, con.contype,
    pg_get_constraintdef(con.oid) AS definition, con.convalidated
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    ORDER BY c.relname,con.conname`,
  indexes: `SELECT tablename,indexname,indexdef FROM pg_indexes
    WHERE schemaname='public' ORDER BY tablename,indexname`,
  tables: `SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
};

test('all migrations match the declared catalog and explicitly owned SQL routines', async () => {
  const migrated = new PGlite();
  const declared = new PGlite();
  try {
    const journal = json(join(migrationsFolder, 'meta/_journal.json'));
    for (const { tag } of journal.entries) {
      await migrated.exec(readFileSync(join(migrationsFolder, `${tag}.sql`), 'utf8'));
    }
    const current = generateDrizzleJson(schema);
    for (const sql of await generateMigration(generateDrizzleJson({}), current)) await declared.exec(sql);
    for (const [name, query] of Object.entries(catalogQueries)) {
      assert.deepEqual((await migrated.query(query)).rows, (await declared.query(query)).rows, name);
    }
    const routines = (await migrated.query<{ signature: string }>(`SELECT p.oid::regprocedure::text AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' ORDER BY signature`)).rows;
    assert.deepEqual(routines.map(row => row.signature), [
      'apply_campaign_action(jsonb)',
      'award_combat_results_with_stamina(jsonb)', 'award_quest_batch(uuid,jsonb)',
      'purchase_aa(uuid,uuid,text,integer,integer,integer,integer,jsonb)', 'settle_campaign_encounter(jsonb)', 'sync_cross_class_abilities()', 'sync_initial_avatar_gender()',
    ], 'SQL-owned routines must have explicit ownership; update docs with intentional changes');
  } finally {
    await migrated.close();
    await declared.close();
  }
});
