import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { commitSha, reviewedRelease, observeRelease } from './gates.mjs';

const sha = commitSha(process.env.RELEASE_SHA);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), sha, 'Checkout does not match release');
const directory = 'artifacts/release';
mkdirSync(directory, { recursive: true });
if (process.argv[2] === 'review') {
  const repository = process.env.GITHUB_REPOSITORY;
  assert.equal(repository, 'Orsnoire/FightSchool');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Dispatch the release workflow from main');
  const get = async path => {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30_000),
    });
    assert.ok(response.ok, `GitHub release evidence unavailable (${response.status})`);
    return response.json();
  };
  const review = await reviewedRelease({ sha, prNumber: process.env.RELEASE_PR, repository, get });
  writeFileSync(`${directory}/review.json`, JSON.stringify({ ...review, node: process.version, runId: process.env.GITHUB_RUN_ID }, null, 2) + '\n');
  console.log(`Reviewed release ${sha}; PR #${review.pr}; required checks passed`);
} else if (process.argv[2] === 'observe') {
  const observed = await observeRelease({ origin: process.env.STAGING_ORIGIN, sha, workerVersion: process.env.WORKER_VERSION });
  const name = new URL(observed.origin).hostname;
  writeFileSync(`${directory}/${name}.json`, JSON.stringify(observed, null, 2) + '\n');
  console.log(JSON.stringify(observed));
} else throw new Error('Expected review or observe');
