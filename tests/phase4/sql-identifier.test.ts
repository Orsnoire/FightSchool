import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

test('Postgres identifiers escape embedded quotes as identifiers, not SQL', () => {
  const dialect = new PgDialect();
  const query = dialect.sqlToQuery(sql`select ${sql.identifier('column"; DROP TABLE students; --')}`);
  assert.equal(query.sql, 'select "column""; DROP TABLE students; --"');
  assert.deepEqual(query.params, []);
});
