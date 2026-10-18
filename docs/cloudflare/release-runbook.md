# Pinned releases and C12 signoff

C12 is in progress in PR #75. The two `questacademy-staging`/canonical hostnames
both serve the live classroom application. Their names do not imply isolation.
Current deployed/accepted baseline remains C11 `a580b30b6e9826fbaaca9f3e2cfc914a94e4c7ad`.

## Release boundary

1. Review the exact PR head. Require `CI / verify` and all four Combat UI
   Acceptance jobs. Both workflows now check out the actual PR head. Main is
   currently unprotected; this procedure does not claim branch protection exists.
2. Merge with an expected-head check and confirm the merge tree is identical to
   that reviewed head. Record the full merge SHA and PR number.
3. When deployment is authorized, dispatch **Deploy Cloudflare Staging** from
   `main`, providing `release_sha` and `release_pr`. It checks out that immutable
   SHA, verifies the merged PR/tree and newest required checks/jobs, then runs
   tests/typecheck/builds before the existing additive migration and deployment.
   A changed merge tree needs new review/checks; the guard does not waive it.
4. The deployment binds the commit SHA and Cloudflare's version metadata. Both
   hostnames must report the expected commit. Preserve `release-<sha>` artifacts
   (reviewed head/tree, check run IDs and each observed immutable Worker version).
   Secret files are outside the artifact path and removed in an always step.
5. Dispatch **Live Combat Staging Acceptance** from `main` with that same SHA,
   Worker version and chosen live origin. It verifies identity before writing
   fixtures and again afterwards. Download the acceptance manifest artifact;
   it contains exact generated IDs and synthetic aliases, never passwords or
   cookies. A failed run still retains its partial manifest. Review retained
   fixtures within 24 hours; artifact expiry is not data cleanup.
6. Record CI, deployment, migration gate, Worker ID, acceptance and the monitoring
   window separately in ACTIVE_WORK/CURRENT_STATUS. Documentation-only commits
   do not change runtime. C12 itself has not been deployed.

Deployment, migration and live acceptance share one non-cancelling production
concurrency group. This serializes these workflows, not dashboard/API changes;
reconcile provider state if someone publishes outside the workflows. A failed
post-deploy check may leave the new version serving traffic: inspect the actual
version before retry or rollback.

## Reproducible tools

Use Node **22.23.3**, npm **10.9.9** (`.node-version`, package engines), `npm ci`,
Wrangler **4.151.1** and Playwright **1.62.1** from `package-lock.json`. The latter
two versions match the C11 deployment/browser tooling. Browser binaries come
from the locked Playwright installer. All jobs use Ubuntu 24.04. `npm run
deploy:staging` directs operators to the guarded workflow.

Cloudflare's [version metadata binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/)
supplies the immutable version ID. `/api/health/live` exposes only commit/version
identity plus existing status/environment; no database, account or secret data.
Older releases without metadata fail the new acceptance guard rather than being
misreported as the requested release. Use their retained historical acceptance
records; do not invent a release identity.

## Remaining C12 work

Scoped cleanup/isolation tooling, repeated local measurements, the consolidated
evidence matrix and the provider drill checklist are the next checkpoint. No
provider interruption, Worker rollback, database reset or production load test
has been performed for C12. Physical Chromebook observation, provider recovery,
compatible timed rollback and an agreed monitoring window remain unsigned.
