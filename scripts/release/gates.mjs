import assert from 'node:assert/strict';

export const requiredChecks = {
  '.github/workflows/ci.yml': ['verify'],
  '.github/workflows/combat-ui-acceptance.yml': ['browser', 'initial-loading', 'battlefield-rendering', 'authoring-lobby'],
};
export function commitSha(value) {
  assert.match(value ?? '', /^[a-f0-9]{40}$/, 'A full lowercase commit SHA is required');
  return value;
}
export function versionId(value) {
  assert.match(value ?? '', /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/, 'An immutable Worker version ID is required');
  return value;
}
export async function reviewedRelease({ sha, prNumber, repository, get }) {
  commitSha(sha);
  assert.match(String(prNumber), /^[1-9][0-9]*$/, 'A merged PR number is required');
  const pr = await get(`/pulls/${prNumber}`);
  assert.equal(pr.merged, true, 'Release PR must be merged');
  assert.equal(pr.base.ref, 'main');
  assert.equal(pr.base.repo.full_name, repository);
  assert.equal(pr.head.repo.full_name, repository, 'Release checks must belong to this repository');
  assert.equal(pr.merge_commit_sha, sha, 'Release must be the exact PR merge commit');
  const [release, reviewed] = await Promise.all([get(`/git/commits/${sha}`), get(`/git/commits/${pr.head.sha}`)]);
  assert.equal(release.tree.sha, reviewed.tree.sha, 'Release tree differs from the reviewed PR head');
  const { workflow_runs: runs } = await get(`/actions/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`);
  const checks = [];
  for (const [path, names] of Object.entries(requiredChecks)) {
    // Inspect the newest attempt/run, never fall back to an older green run.
    const run = runs.filter(r => r.path === path && r.head_sha === pr.head.sha)
      .sort((a, b) => b.id - a.id)[0];
    assert.ok(run, `Missing ${path} on reviewed head`);
    assert.equal(run.status, 'completed', `${path} is not complete`);
    assert.equal(run.conclusion, 'success', `${path} failed`);
    const { jobs } = await get(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
    for (const name of names) assert.ok(jobs.some(j => j.name === name && j.conclusion === 'success'), `Missing successful ${name}`);
    checks.push({ path, runId: run.id, attempt: run.run_attempt, jobs: names });
  }
  return { schemaVersion: 1, commit: sha, tree: release.tree.sha, reviewedHead: pr.head.sha, pr: Number(prNumber), checks };
}
export async function observeRelease({ origin, sha, workerVersion, fetcher = fetch }) {
  commitSha(sha);
  if (workerVersion) versionId(workerVersion);
  const url = new URL(origin);
  assert.equal(url.origin, origin, 'Use an exact HTTPS origin, without a path');
  assert.equal(url.protocol, 'https:');
  const response = await fetcher(`${origin}/api/health/live`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, 'Live health unavailable');
  const live = await response.json();
  assert.equal(live.status, 'ok');
  assert.equal(live.release?.commit, sha, 'Running commit does not match the release');
  versionId(live.release?.workerVersion);
  if (workerVersion) assert.equal(live.release.workerVersion, workerVersion, 'Running Worker version changed');
  return { origin, commit: sha, workerVersion: live.release.workerVersion, observedAt: new Date().toISOString() };
}
