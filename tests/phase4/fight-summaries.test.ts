import assert from 'node:assert/strict';
import { test } from 'node:test';
import { issueSession } from '../../worker/auth/session.ts';
import { handleFights } from '../../worker/routes/fights.ts';
import { fightListFixture } from '../support/fight-list-fixture.ts';

const config = { cookieName: 'fixture_session', secret: 'test-only-c07-secret-not-deployed-1234567890', ttlSeconds: 300 };
test('migrated summaries enforce ownership, archive filtering and SQL counts without returning definitions', async () => {
  const f = await fightListFixture();
  try {
    const cookie = async (role: 'teacher' | 'student', actorId: string) =>
      (await issueSession(f.repository, config, role, actorId)).split(';')[0];
    const owner = await cookie('teacher', f.owner), other = await cookie('teacher', f.other), student = await cookie('student', f.owner);
    const request = async (path: string, cookie = owner) => {
      const url = new URL('https://qa.example' + path);
      return (await handleFights(new Request(url, { headers: { Cookie: cookie } }), url, f.repository, config))!;
    };
    const path = `/api/teacher/${f.owner}/fights`;
    assert.equal((await request(path + '?view=summary', '')).status, 401);
    assert.equal((await request(path + '?view=summary', student)).status, 401);
    assert.equal((await request(path + '?view=summary', other)).status, 403);
    assert.equal((await request(path + '?view=unknown')).status, 400);
    assert.equal(f.calls.length, 0, 'unauthorized requests do not issue list SQL');
    const summary = await request(path + '?view=summary');
    assert.equal(summary.status, 200);
    assert.equal(summary.headers.get('cache-control'), 'no-store');
    const rows = await summary.json() as any[];
    assert.equal(rows.length, f.count);
    assert.equal(f.calls.length, 1);
    assert.match(f.calls[0].sql, /jsonb_array_length\("questions"\)/);
    assert.match(f.calls[0].sql, /jsonb_array_length\("enemies"\)/);
    assert.equal(rows[0].title, 'Battle 039', 'stable ID tie-breaker for equal creation times');
    assert.equal(rows.at(-1).questionCount, 0);
    assert.equal(rows.at(-1).enemyCount, 0);
    for (const row of rows.slice(0, -1)) {
      assert.equal(row.questionCount, f.questions);
      assert.equal(row.enemyCount, 1, 'counts enemy definitions, preserving existing cards, not swarm quantity');
      assert.equal(row.createdAt, 1_700_000_000_000);
      assert.equal(row.teacherId, f.owner);
      assert.deepEqual(Object.keys(row).sort(), ['createdAt', 'encounterTier', 'enemyCount', 'guildCode', 'id', 'questionCount', 'teacherId', 'title', 'updatedAt'].sort());
    }
    const full = await (await request(path)).json() as any[];
    assert.equal(full.length, f.count);
    assert.equal(full.find(row => row.id === f.fullId).questions.length, f.questions);
    const detail = await (await request(`/api/fights/${f.fullId}`)).json() as any;
    assert.deepEqual(detail.questions, full.find(row => row.id === f.fullId).questions, 'editing retains all academic content');
    assert.equal((await request(`/api/fights/${f.fullId}`, other)).status, 403);
    assert.equal((await request(`/api/fights/${f.fullId}`, student)).status, 401);
    assert.equal((await (await request(`/api/teacher/${f.other}/fights?view=summary`, other)).json() as any[]).length, 1);
  } finally { await f.pg.close(); }
});
