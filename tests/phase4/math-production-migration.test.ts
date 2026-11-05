import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { productionMathMigrationSQL } from '../../scripts/production-math-migration.mjs';
import { productionReleaseLedger } from '../../scripts/production-release-ledger.mjs';

test('MATH-02 production upgrade is bounded, data-preserving, atomic and idempotent', async () => {
  const pg = new PGlite();
  const read = (name: string) => readFileSync(`migrations/cloudflare/${name}`, 'utf8');
  const ledger = async () => (await pg.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows;
  try {
    await pg.exec('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)');
    const journal = JSON.parse(read('meta/_journal.json')).entries.slice(0, 26);
    const expected = productionReleaseLedger('question-bank');
    for (const entry of journal) {
      await pg.exec(read(`${entry.tag}.sql`));
      await pg.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)', [expected[entry.idx].hash, entry.when]);
    }
    await pg.exec(`INSERT INTO students (id,nickname,nickname_normalized,password_hash,gold)
      VALUES ('11111111-1111-4111-8111-111111111111','Preserved','preserved','test-only',321)`);
    const students = async () => (await pg.query('SELECT to_jsonb(t) AS row FROM students t')).rows;
    const saved = await students(), original = await ledger(), sql = productionMathMigrationSQL();
    await assert.rejects(pg.exec(sql.replace('END $production_math$', "RAISE EXCEPTION 'late failure'; END $production_math$")), /late failure/);
    await pg.exec('ROLLBACK'); assert.deepEqual(await ledger(), original); assert.deepEqual(await students(), saved);
    assert.equal((await pg.query("SELECT to_regclass('public.math_templates') AS name")).rows[0].name, null);
    await assert.rejects(pg.exec(sql.replace('FOR table_name IN', 'UPDATE students SET gold=0; FOR table_name IN')), /changed existing records/);
    await pg.exec('ROLLBACK'); assert.deepEqual(await students(), saved); assert.deepEqual(await ledger(), original);
    await pg.exec("UPDATE drizzle.__drizzle_migrations SET hash='changed' WHERE id=26");
    await assert.rejects(pg.exec(sql), /canonical 26-row/); await pg.exec('ROLLBACK');
    await pg.query('UPDATE drizzle.__drizzle_migrations SET hash=$1 WHERE id=26', [expected[25].hash]);
    await pg.exec('CREATE INDEX unreviewed_math_drift ON students(nickname)');
    await assert.rejects(pg.exec(sql), /schema drift/); await pg.exec('ROLLBACK');
    await pg.exec('DROP INDEX unreviewed_math_drift');
    await pg.exec(sql);
    const after = await ledger(); assert.equal(after.length, 27); assert.deepEqual(after.slice(0,26), original);
    assert.deepEqual(await students(), saved);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM math_templates')).rows[0].n, 0);
    await pg.exec(sql); assert.deepEqual(await ledger(), after); assert.deepEqual(await students(), saved);
    await pg.exec('CREATE INDEX unreviewed_math_drift ON students(nickname)');
    await assert.rejects(pg.exec(sql), /schema drift/); await pg.exec('ROLLBACK');
  } finally { await pg.close(); }
});
