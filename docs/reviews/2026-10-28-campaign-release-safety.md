# Campaign release-safety review — October 28, 2026

Starting PR #81 head: `634907fd7ff721fbeb7383c1ed2e258ae8cfc6a3`.
Production integration baseline: `2d524dff1ff7ac784d37b02fb48a4ec530e9b666`.
Review and corrections only. No provider/database migration, deployment, merge,
student reset, production change or C12 change is authorized by this review.

## Findings and corrections

1. **Blocking: ledger aliases could certify damaged schema.** On a disposable
   populated legacy database, dropping `campaign_players.state` did not prevent
   the original bridge from committing 28 rows. Dropping `purchase_aa` after a
   successful bridge also passed its completed-history retry. The original four
   table/column checks and unconditional retry return were insufficient.
   The bridge now verifies a reviewed catalog contract before migration, after
   all changes, and on retry: tables, columns/types/defaults/nullability,
   constraints, indexes/validity, routine definitions and trigger definitions/
   enabled state. Drift fails closed without attempting repair.
2. **Blocking for safe rollback: an old runtime could pass the deployment request.**
   Full SHA validation and an AA boolean did not establish runtime compatibility.
   The workflow now requires the exact requested source to descend from the AA
   integration `bcf2c4c251c24f2d5a4cbcc5a62aac97149bb3af`, before build/upload or
   access to deployment credentials. Old free-appearance builds cannot be used
   as rollback targets through this workflow.
3. **Coverage gaps:** original rollback coverage stopped early during AA DDL;
   it did not fail after backfills and all aliases. Retry coverage preceded any
   AA purchases. Added late-failure rollback/retry, post-upgrade paid-wallet/
   receipt/five-slot preservation, C12 history, missing/extra/duplicate rows and
   timestamp corruption, and schema drift regressions. Deployment tests now
   exercise the whole mocked upload path and a binding change during upload.
   They run in ordinary PR CI, not only when a release request changes.
4. **Operational improvements:** the bridge ends explicitly at 0023 and pins
   the reviewed source histories, rather than automatically incorporating future
   journal entries. Lock wait (15 seconds) and statement execution (120 seconds)
   are bounded. Deployment now requires dependency readiness as well as liveness.

No shipped SQL, active journal, historical ledger row, gameplay rule or release
request was changed for these corrections. Canonical 0019–0022 remain identical
to historical campaign SQL; production 0000–0018 remain unchanged.

## What the protections establish

- The exact production 19-row history and C12's 18-row history are rejected by
  the bridge without changes. The legacy 22-row ledger alone is insufficient:
  its catalog must also match. A bridged retry requires the exact 28-row ledger
  and combined schema. Unknown histories are not guessed or marked applied.
- The preview deployer targets only `questacademy-campaign-preview`, validates
  its environment/origin/cookie/R2 bindings, retains secrets and storage
  server-side, and rechecks bindings before replacing the Worker. It has no
  database connection or migration capability.
- **A ledger is not a provider identity check.** Neither the SQL nor a hidden
  `DATABASE_URL` binding proves which Neon endpoint/branch the operator selected.
  The release operator must independently match account/project/branch/endpoint,
  database and role to the preview and verify they differ from production/C12.
  Likewise verify the existing combat namespace belongs to the preview. A copied
  database can have an identical ledger. Do not treat the attestation as proof.
- Schema checksums are drift checks, not authorization. They are derived from
  exact historical SQL in disposable PGlite; regression tests independently
  derive the canonical result with Drizzle. The read-only catalog query is in
  `scripts/campaign-preview-schema.mjs`; expected values and source-history hashes
  are in `migrations/cloudflare/legacy-campaign-preview/schema-contract.json`.
  Provider/PostgreSQL catalog-format differences must be investigated on an
  authorized disposable copy, never bypassed by replacing a checksum blindly.
- The transaction rolls back new AA tables/columns, cross-class backfills,
  routines, aliases and 0023 on error. Existing IDs/rows remain unchanged.
  PostgreSQL sequence counters can advance on failed inserts; gaps in new ledger
  IDs are harmless and are not repaired. A lost response after COMMIT is handled
  by reading the ledger/catalog and using the idempotent bridge, never manual
  ledger insertion or deleting purchases.
- The ledger lock is not a complete maintenance mode. Pause all preview writers
  (HTTP, existing WebSockets and Durable Object alarms/reward retries), retain
  active room checkpoints, and stop concurrent migrators for the upgrade window.
  Do not destroy rooms or clear progress to accomplish the pause.

## Safe preview sequence — only after explicit release authorization

1. Pin the reviewed source and green CI/browser evidence. Confirm current preview
   runtime `6de42632f4953e408b566bf60978cfe482a11f10` against fresh provider evidence;
   a mismatch stops the release. Confirm provider identities as above. Set a
   **preflight** request with these full SHAs; its workflow performs GET only.
2. Verify the exact 22-row ledger and legacy catalog on the selected preview.
   Obtain a recoverable backup and rehearse the bridge on an isolated copy with
   existing records. Record ordered row digests/counts for students, job levels,
   avatars/loadouts, results, campaigns/layouts, campaign players/encounters,
   live sessions and any existing AA purchases. Existing AA schema with a legacy
   ledger is drift: stop, do not rerun AA 0018 over it.
3. Prepare a known compatible runtime/rollback build and a verified way to quiesce
   writers before starting the maintenance window. If either is unavailable,
   **NO-GO**. Pause writers, capture final state/checkpoint evidence and recheck
   the history. Generate SQL from the reviewed source:
   `node scripts/campaign-preview-migration-bridge.mjs > /tmp/campaign-preview-bridge.sql`.
4. Execute that whole SQL file on **one authorized preview connection**, with
   stop-on-error (for psql: `-X -v ON_ERROR_STOP=1 -f ...`). Do not split BEGIN,
   statements and COMMIT across stateless provider calls. Never run the ordinary
   migrator first. On error, issue ROLLBACK on that connection or disconnect it,
   verify unchanged state and diagnose before retrying. On an uncertain response,
   inspect exact history/catalog first.
5. Require 28 ledger rows, unchanged first 22 rows including IDs/hashes/timestamps,
   combined catalog equality and unchanged saved gameplay/receipts. Account only
   for AA's additive columns and conversion of the two old cross-class slots.
   The normal migrator is then a no-op at the reviewed 0023 head. Later migrations
   require their own review; the bridge does not absorb them automatically.
6. With that evidence, set the three migration attestations and `mode: deploy`
   in the explicit preview request. Run only **Deploy Campaign Preview**. Verify
   source marker, Worker version, retained namespace/storage, liveness and
   readiness. Resume writers only with a compatible runtime. If deployment fails
   after migration, keep writes paused and retry/forward-fix or use a verified
   compatible runtime; do not drop AA data or deploy the October 21 runtime.
7. Check saved exploration, HP/MP, inventory/equipment, town services, active-room
   resume and AA wallet/slots. Use a dedicated QA account for mutations. Then the
   owner plays the existing character to a guardian victory without resetting
   it. Record session/result receipt, victory, XP, daily fight count and actual
   stamina restored. The reward is **up to 20 percentage points after normal
   fight cost, capped at full stamina**, not necessarily 20 points compared with
   the pre-fight display. Reload/reconnect must not grant it twice. Obtain the
   owner's acceptance and record it separately from fixture/browser results.

## Main-site beta direction

The owner selected **main site, gated beta** during this review. Prepare a
server-enforced tester gate and visible Beta / Report a bug entry point before
requesting consolidation into main. Preserve the isolated preview database;
merging code does not import its saves into production. Production follows its
own canonical forward-only 24-row migration path, never the preview bridge.
C12 stays separate and untouched. Retire the campaign development branch only
after the authorized merge/release/acceptance, then do future campaign fixes on
short branches from main. Beta status does not waive migration or acceptance gates.

## Current decision

**NO-GO for migration/deployment now.** Local guard regressions pass; remaining
work is full verification and the newly requested main-site beta preparation.
A later release requires concrete authorization plus provider identity/backup/
maintenance evidence. No live guardian-victory acceptance is claimed.
