import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { issueSession } from '../../worker/auth/session.ts';
import { handleFights } from '../../worker/routes/fights.ts';
import { fightListFixture } from './fight-list-fixture.ts';

const f = await fightListFixture();
try {
  const config = { cookieName: 'fixture', secret: 'test-only-c07-measurement-secret-1234567890', ttlSeconds: 300 };
  const cookie = (await issueSession(f.repository, config, 'teacher', f.owner)).split(';')[0];
  const workloads = [];
  for (const view of ['full', 'summary']) {
    f.calls.length = 0;
    const url = new URL(`https://qa.example/api/teacher/${f.owner}/fights${view === 'summary' ? '?view=summary' : ''}`);
    const response = (await handleFights(new Request(url, { headers: { Cookie: cookie } }), url, f.repository, config))!;
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    const payload = await response.text();
    const calls = [...f.calls];
    const plans = [];
    for (const call of calls) plans.push((await f.pg.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${call.sql}`, call.params)).rows);
    workloads.push({ view, httpBytes: Buffer.byteLength(payload), httpGzipBytes: gzipSync(payload).length,
      sqlQueries: calls.length, sqlRows: calls.reduce((n, c) => n + c.rows, 0),
      sqlBytes: calls.reduce((n, c) => n + c.bytes, 0), queries: calls.map(c => c.sql), plans });
  }
  const report = { sourceRef: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    method: 'Migrated local PostgreSQL (PGlite), both compatible HTTP views over identical data. SQL bytes serialize driver rows; HTTP bytes serialize response; gzip default level. EXPLAIN timings are illustrative, not production latency.',
    fixture: { ownedActiveFights: f.count, archived: 1, otherTeacherFights: 1, questionsPerPopulatedFight: f.questions, emptyFights: 1 }, workloads };
  const output = process.argv[2] || '/tmp/c07-lists.json';
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, workloads: workloads.map(({ plans, queries, ...w }) => w) }));
} finally { await f.pg.close(); }
