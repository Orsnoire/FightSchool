// Read-only PostgreSQL catalog contract. No row values, OIDs, owners, sequence
// counters or provider credentials enter the fingerprint. Use the same search
// path when recording/checking it; unknown drift requires review, never repair.
export const campaignSchemaQueries = {
  tables: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'`,
  columns: `SELECT c.relname AS table_name, a.attname AS column_name,
    format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null,
    pg_get_expr(d.adbin,d.adrelid) AS default_expression, a.attidentity, a.attgenerated
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,
  constraints: `SELECT c.relname AS table_name, con.conname, con.contype,
    pg_get_constraintdef(con.oid) AS definition, con.convalidated
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`,
  indexes: `SELECT c.relname AS index_name, pg_get_indexdef(i.indexrelid) AS definition,
    i.indisvalid, i.indisready FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`,
  routines: `SELECT p.oid::regprocedure::text AS signature, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`,
  triggers: `SELECT c.relname AS table_name, t.tgname, t.tgenabled,
    pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal`,
};

// MD5 is only a drift checksum, not an authentication or authorization check.
// Sort using C collation so database locale cannot change the aggregate order.
export const campaignSchemaFingerprintSQL = `SELECT jsonb_build_object(${Object.entries(campaignSchemaQueries)
  .map(([name, query]) => `'${name}', (SELECT md5(coalesce(jsonb_agg(row ORDER BY row::text COLLATE "C"),'[]'::jsonb)::text)
    FROM (SELECT to_jsonb(q) AS row FROM (${query}) q) rows)`).join(',\n')}) AS fingerprint`;
