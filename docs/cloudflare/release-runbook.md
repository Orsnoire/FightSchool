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

## Isolated rehearsal inventory

Provider provisioning and drills have **not** been run. Before a disruptive test,
record an independent inventory outside git with these fields:

| Field | Required value / proof |
| --- | --- |
| `id` | Fresh UUID identifying this disposable environment |
| `workerName` | `questacademy-rehearsal-` plus the UUID's first eight characters; independently confirm this is a new Worker |
| `bucketName` | Same unique name, a fresh R2 bucket containing only this rehearsal's objects |
| `origin` | This Worker's exact HTTPS `workers.dev` origin, no custom classroom domain |
| `databaseHost`, `neonBranchId` | Fresh empty Neon database/branch, not a production data clone; confirm endpoint-to-branch mapping in Neon |
| Separate retained record | Cloudflare account, namespace IDs, empty-resource evidence, creation time, operator, expiry/cleanup owner and actual production DB hostname |

Use a separate GitHub environment/credential scope for this inventory. The
existing `cloudflare-staging` environment has production secrets. Never copy its
DATABASE_URL, R2 bucket, session secret, password pepper or room binding into a
rehearsal. Create the empty database using the committed migrations; do not copy
real learners into it. Do not use the production `ensure-r2.mjs` helper here.

With `ISOLATED_DATABASE_URL`, `PRODUCTION_DATABASE_HOST` and `RELEASE_SHA` set
through the trusted environment, run:

```sh
node scripts/release/prepare-rehearsal.mjs /absolute/path/isolated-target.json
```

This only writes `artifacts/rehearsal/wrangler.json`. It removes classroom routes,
uses a unique Worker/DO namespace and R2 name, and rejects the production database
endpoint (including pooled/non-pooled aliases). It does not create resources or
prove the inventory is true. Inspect the generated bindings and provision
independent secrets before deploying the selected immutable commit using that
explicit config. Keep its generated config/secret material out of git/artifacts
published as release evidence; the target inventory itself contains no passwords.

For acceptance, set `ACCEPTANCE_MODE=isolated`, `ISOLATED_ORIGIN` and
`STAGING_ORIGIN` to the inventory origin, `ISOLATION_ID` to its UUID, and
`RELEASE_SHA`/`WORKER_VERSION` to the independently observed deployment. Run the
two staging test scripts. The bounded repeated driver is:

```sh
ACCEPTANCE_REPETITIONS=5 node scripts/release/repeat-acceptance.mjs
```

It runs five fresh 30-player and five 60-player functional fixtures, serially,
records every answer percentile/fixture manifest, and refuses live targets.
It is **not the complete performance exit fixture**: it does not seed 100-result
history/guild quests or exercise four-job abilities and browser rendering in the
same provider session. Add that representative workload before calibrating the
release threshold. The local populated-guild/room/browser comparisons remain
separate evidence, as specified in the [C12 review](../reviews/2026-10-18-c12-release-review.md).

## Fixture retention and cleanup

Every new acceptance suite persists creation intent before sending a write, then a random run ID and exact created teacher,
student, guild, fight, item, session and R2 key identities after each successful
creation response. Synthetic aliases identify account ownership; credentials and
cookies never enter the journal. Preserve partial manifests after failures and
review them within **24 hours**. Workflow evidence expires after 30 days; that is
not a database/object deletion policy. Interrupted requests or HTTP 5xx responses retain unresolved intent: cleanup stops until the exact request/identity is reconciled, even if no root account ID was returned. Unrecorded children also block deletion; no prefix deletion is inferred. Resolve such a case against the isolated inventory.

Existing historical live fixtures lack this ownership journal. Do **not** delete
accounts by `qa-` prefix, age, or a guessed ownership relationship. Live classroom
fixtures are explicitly rejected by the cleanup script. They require a separate,
reviewed exact-ownership plan; historical retention remains an open C12 gate.

For a completed isolated rehearsal, close clients and remove its isolated Worker
using the independently verified inventory. The cleanup tool requires a confirmed
404 from that exact Worker, so rooms cannot recreate deleted SQL evidence. A 403
or missing credentials is not evidence of absence. Then run:

```sh
node scripts/release/cleanup-fixtures.mjs /absolute/path/isolated-target.json /absolute/path/fixture-manifest.json
# Inspect the rollback-only counts, then apply only that manifest:
node scripts/release/cleanup-fixtures.mjs /absolute/path/isolated-target.json /absolute/path/fixture-manifest.json --apply
```

Use the isolated DB and Cloudflare credentials plus the independently recorded
production DB hostname. The first command runs deletion inside a rolled-back
transaction to verify FK ordering. It verifies aliases, exact IDs and reference
closure: unrecorded children, outside guild members, cross-room results, external
quest completions and custom-equipment references all block deletion. Locks are
held only on the stopped isolated database. The apply command deletes only exact
R2 keys, then commits the scoped SQL transaction. A failed R2 operation leaves SQL
untouched; partial object deletion is retry-safe (404 is already absent). SQL
failure rolls back; the manifest remains usable. Preserve the `.cleanup.json`
receipt. No broad bucket listing/deletion or database reset is implemented.

Finally verify the isolated DO namespaces, Worker, R2 bucket and empty Neon
branch are disposed of in their providers and retain their receipts. Worker
absence alone is not proof that all historical namespace storage was destroyed.
The script does not claim that provider-level disposal. No cleanup has been
executed against production or any provider during this implementation.

## Recovery and rollback rehearsal

Record UTC start/end times, commit and Worker IDs, fixture run/room IDs, injection,
observed failures, recovery time, before/after reward/evidence counts and provider
logs for each drill. Do not record tokens, cookies, connection strings or answers.

| Drill | Required action and pass evidence |
| --- | --- |
| Room restart/eviction | On the isolated Worker, establish a live room with durable receipts, phase and deadline. Force a documented provider restart/eviction, reconnect and replay a command. Same room/phase/deadline and exactly one receipt/reward must survive. A browser refresh or local object reconstruction alone does not pass this gate. |
| Database interruption | Interrupt only the isolated DB connection while results/evidence are pending. Observe failure/pending state, restore connectivity, retry/reconnect and confirm one durable result/reward with complete academic evidence. Compare committed ledger counts before/after recovery. Local injected errors are regression coverage, not a provider outage drill. |
| Compatible timed rollback | Deploy two reviewed compatible revisions to the same isolated environment, retaining its data. Start a room, record the current version, then roll back to the older **isolated** version ID. Time detection-to-recovery and prove refreshed clients, assets, room deadlines, results/reward retry and DB/R2 access still work. Never use a classroom Worker ID with the rehearsal config. |
| Desktop/mobile classroom flow | Observe teacher authoring/launch/moderation and student answer/ability/loot/reconnect at desktop and phone sizes, then on the actual classroom Chromebook. Record device, browser, network, participant count and unresolved symptoms. CI emulation does not replace the physical-device observation. |
| Monitoring window | Agree start/end and owner before signoff (proposal: one full class plus 30 minutes; **not yet agreed**). Retain error/retry counts, ack p50/p95, queue/DB time, query volume, bytes and classroom reports. Zero data loss/duplicate rewards is required; evaluate latency against the calibrated repeated-fixture threshold. |

[Cloudflare rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
uses a specific previously deployed version, for example `npx --no-install
wrangler rollback <isolated-version-id> --config artifacts/rehearsal/wrangler.json`.
Check current provider limitations first: DO class lifecycle changes and changed
bindings can make an older version incompatible. Worker versions do not rewind
Neon rows, R2 objects or Durable Object storage. Never run down-migrations or
restore a production database merely to undo a Worker release. Treat data repair
as its own reviewed operation with backups and idempotent reconciliation.

C11 Worker `86111493-688d-41c2-9462-b050044b3d10` / runtime
`a580b30b6e9826fbaaca9f3e2cfc914a94e4c7ad` is the current accepted production
baseline, **not a rehearsed C12 rollback target**. C12 adds only release identity
to the application; no schema/reward/saved-room change. An older version without
identity metadata needs provider-version verification and its original acceptance
harness during the isolated drill; do not weaken the new guard to claim it passed.

C12 cannot be signed off, nor expansion resumed, until the remaining gates in the
review are evidenced or explicitly revised by the owner. No gate is waived here.
