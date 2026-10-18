import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commitSha, observeRelease, reviewedRelease, requiredChecks } from '../../scripts/release/gates.mjs';
const sha = 'a'.repeat(40), head = 'b'.repeat(40), tree = 'c'.repeat(40);
function evidence() {
  const values = {
    '/pulls/75': { merged: true, merge_commit_sha: sha, base: { ref: 'main', repo: { full_name: 'Orsnoire/FightSchool' } }, head: { sha: head, repo: { full_name: 'Orsnoire/FightSchool' } } },
    [`/git/commits/${sha}`]: { tree: { sha: tree } },
    [`/git/commits/${head}`]: { tree: { sha: tree } },
    [`/actions/runs?head_sha=${head}&event=pull_request&per_page=100`]: { workflow_runs: [] },
  };
  Object.entries(requiredChecks).forEach(([path, names], i) => {
    values[`/actions/runs?head_sha=${head}&event=pull_request&per_page=100`].workflow_runs.push({ id: i + 1, path, head_sha: head, status: 'completed', conclusion: 'success', run_attempt: 1 });
    values[`/actions/runs/${i+1}/jobs?filter=latest&per_page=100`] = { jobs: names.map(name => ({ name, conclusion: 'success' })) };
  });
  return { values, run: () => reviewedRelease({ sha, prNumber: 75, repository: 'Orsnoire/FightSchool', get: async path => structuredClone(values[path]) }) };
}
test('release gate accepts the exact reviewed merge tree with every required job', async () => {
  const result = await evidence().run();
  assert.equal(result.commit, sha); assert.equal(result.reviewedHead, head); assert.equal(result.checks.length, 2);
});
for (const [name, mutate] of [
  ['unmerged PR', v => { v['/pulls/75'].merged = false; }],
  ['different merge commit', v => { v['/pulls/75'].merge_commit_sha = head; }],
  ['unreviewed merge tree', v => { v[`/git/commits/${sha}`].tree.sha = head; }],
  ['foreign repository', v => { v['/pulls/75'].head.repo.full_name = 'fork/FightSchool'; }],
  ['failed newest rerun', v => { const r = v[`/actions/runs?head_sha=${head}&event=pull_request&per_page=100`].workflow_runs; r.push({ ...r[0], id: 9, conclusion: 'failure' }); }],
  ['skipped browser job', v => { v['/actions/runs/2/jobs?filter=latest&per_page=100'].jobs[0].conclusion = 'skipped'; }],
  ['different checked SHA', v => { v[`/actions/runs?head_sha=${head}&event=pull_request&per_page=100`].workflow_runs[0].head_sha = sha; }],
]) test(`release gate rejects ${name}`, async () => { const f = evidence(); mutate(f.values); await assert.rejects(f.run); });
test('mutable refs and command fragments are rejected as release inputs', () => {
  for (const value of ['main', 'HEAD', 'a'.repeat(7), `${sha};echo token`, undefined]) assert.throws(() => commitSha(value));
});
test('live identity requires both the intended commit and immutable Worker version', async () => {
  const workerVersion = '12345678-1234-1234-1234-123456789abc';
  const fetcher = async () => Response.json({ status: 'ok', release: { commit: sha, workerVersion } });
  const options = { origin: 'https://example.invalid', sha, workerVersion, fetcher };
  assert.equal((await observeRelease(options)).commit, sha);
  await assert.rejects(observeRelease({ ...options, sha: head }));
  await assert.rejects(observeRelease({ ...options, workerVersion: workerVersion.replace('abc', 'def') }));
  await assert.rejects(observeRelease({ ...options, origin: 'https://example.invalid/path' }));
  await assert.rejects(observeRelease({ ...options, fetcher: async () => Response.json({ status: 'ok' }) }));
});
