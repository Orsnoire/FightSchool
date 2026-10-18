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
} else if (['observe', 'observe-production'].includes(process.argv[2])) {
  const production = process.argv[2] === 'observe-production';
  const origins = production ? ['https://questacademy-staging.coxsonator.workers.dev', 'https://questacademy.bookwyrminteractive.studio'] : [process.env.STAGING_ORIGIN];
  let workerVersion = process.env.WORKER_VERSION;
  for (const origin of origins) {
    let observed;
    for (let attempt=0;attempt<(production ? 20 : 1);attempt++) {
      try { observed = await observeRelease({ origin, sha, workerVersion }); break; }
      catch (error) {
        if (!production || attempt === 19) throw error;
        await new Promise(resolve=>setTimeout(resolve, 1000));
      }
    }
    workerVersion = observed.workerVersion; // Both hostnames must serve the same version.
    const name = new URL(observed.origin).hostname;
    const label = process.env.OBSERVATION_LABEL || 'deployment';
    assert.match(label, /^[a-z-]+$/);
    writeFileSync(`${directory}/${label}-${name}.json`, JSON.stringify(observed, null, 2) + '\n');
    console.log(JSON.stringify(observed));
  }
} else throw new Error('Expected review, observe or observe-production');
