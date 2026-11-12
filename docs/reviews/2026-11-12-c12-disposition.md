# C12 PR #75: reconciliation review and retirement

Review date: November 12, 2026. **Owner-approved disposition: RETIRED UNMERGED. PR #75 was closed on November 12 with its branch retained.**

The owner wants to continue from current main without carrying an indefinitely open C12 PR. Retiring this branch is appropriate. Its useful safety ideas remain recoverable in the retained branch, but merging its October release path would require substantive reconciliation. Retirement means deferred operational work, not successful performance or recovery signoff. It creates no replacement PR or implementation commitment.

## Reviewed identities and method

| Item | Pinned value |
| --- | --- |
| Current main | `8605097b13179f77d020a1cd3c1426ef1043aca8` |
| C12 head / draft PR #75 | `348b034a0efb6e0f022a0f64f360489794e0f444` |
| Common ancestor | `20188dc9c7a994d82a9e04ceb807b128002c8a25` |
| Divergence | 153 main-only commits; 16 C12-only commits |
| Latest recorded accepted production source | MATH-02 merge `7562485586160e1c321f21bda902713690159e23` |
| Latest recorded Worker | `fd7b8c4b-de13-4132-9fb6-992f9cc445ee` |
| Canonical schema | 27 migrations, ending in `0026_math_templates` |

GitHub PR/ref/compare reads and a fresh local fetch established these source identities. Production identity comes from the [November 5 release record](../releases/2026-11-05-math-02.md); this review did not contact providers or reverify live state.

A local `git merge-tree --write-tree` simulation compared the pinned heads. No branch was merged or moved. An extracted disposable candidate retained the automatic merges; the sole runtime conflict in `worker/index.ts` was provisionally resolved by retaining all three Env fields. This sandbox was used only for targeted tests. Workflow/document conflicts were not resolved, and it is not a publishable candidate.

## Actual conflicts versus overlap

There are 15 paths changed on both sides, with **five actual content conflicts**:

| Conflicted path | Necessary resolution if this work is ever revived |
| --- | --- |
| `.github/workflows/combat-ui-acceptance.yml` | Choose a consistent locked Playwright installation; retain current campaign, advancement, roster, fight-validation and mathematics browser suites and the four required jobs. Preserve C12's exact-head checkout and dialog-focus wait. |
| `.github/workflows/live-combat-staging-acceptance.yml` | Reconcile main's request-file push trigger with C12's required SHA/version/mode inputs. A push event has no workflow-dispatch inputs; simply keeping both produces empty identity inputs. Preserve explicit authorization, readiness, identity checks and partial journals. |
| `.gitignore` | Retain both private rehearsal/journal exclusions and newer release/artifact exclusions. |
| `docs/ACTIVE_WORK.md` | Keep the accepted November baseline; do not restore October's active-release instructions. |
| `worker/index.ts` | Retain `CAMPAIGN_BETA_GUILD_IDS`, `RELEASE_SHA`, and `CF_VERSION_METADATA`, plus all current maintenance, campaign, mathematics and combat routing. |

The other overlapping paths merge textually: CI, deployment workflow, four status/authority documents, browser combat test, both operational/live combat scripts, and Wrangler config. A textual merge is not proof of operational compatibility.

**Dependency clarification:** neither `package.json` nor `package-lock.json` changed on main since the common ancestor. They are not actual two-sided dependency conflicts. C12 adds pinned Node/npm/Playwright/Wrangler tooling and 89 lockfile packages; one existing locked dependency changes (`detect-libc` 2.0.3 to 2.1.2). These still require reproducible-install/browser validation if adopted. No dependency upgrade is necessary to close the PR.

## Integration findings and narrow corrections

| Finding | Evidence and impact | Narrow correction if revived |
| --- | --- | --- |
| Production serialization is split | C12 deploy/migrate/acceptance use `questacademy-production`; newer production maintenance/inspection retain `cloudflare-staging`. These jobs could overlap. | Use one non-cancelling production group for every writer/acceptance path; keep preview and C12 rehearsal separate. Test the workflow graph and target selection. |
| C12's documented deployment route is obsolete | The automatic merge retains `refuse-unguarded-deploy.mjs`, which rejects a production Worker with `RELEASE_WINDOWS`. This is a required protection, not an obstacle to remove. C12's direct migration workflow does not establish a paused-writer/room/ledger gate. | Integrate commit/check verification into the current controlled maintenance path. Disable or guard standalone production migration. Never bypass the maintenance refusal to make the old runbook work. |
| Version metadata conflicts with the newer validator | `scripts/deploy-campaign-preview.mjs:42–59` removes `CF_VERSION_METADATA` from production's permitted bindings, whereas C12 adds that binding to root Wrangler config and requires it for acceptance. A local probe reproduces rejection. The current transport preserves existing version bindings but does not provision a missing one. | If identity reporting is adopted, explicitly support and preserve the typed binding in the controlled production transport, with negative tests for wrong types, duplicates and foreign resource bindings. Bootstrap it only through a separately reviewed release. |
| Cleanup has an incomplete ownership model | C12 checks older relations only. Populated campaign and mathematics rows cause FK refusal and transactional rollback. AA purchases and student activity rows instead cascade when their journal-owned student is deleted, without appearing in cleanup counts. | Initially refuse cleanup whenever these unsupported relations touch the run. Later add explicit ownership/closure, JSON-reference checks, locks and count receipts for supported new fixtures. Keep foreign ownership and ambiguous-write refusals. Do not add broad cascades or prefix cleanup. |
| New acceptance entry point is outside C12's journal/target mechanism | `math-authoring-acceptance.mjs` is explicitly approval-gated but hardcodes production and keeps fixture IDs in memory. Passing isolated environment variables does not retarget it. The old claim that all acceptance entry points share C12 isolation no longer holds. | Preserve the current approval guard; before using it in rehearsal, add explicit target/release validation and durable intent/exact-ID journaling for templates/revisions. Never run the existing script assuming it targets rehearsal. |
| Representative coverage is narrower than the current product | C12's two-round starter-job profile runs against current combat, but does not exercise campaign saves, AA purchases/caps, activity tracking or template revisions. The clean operational merge preserves main's `damageDealt` EXP correction and transport diagnostics. | Retain that profile as a bounded classroom benchmark, plus separate populated campaign/AA/math regressions and current browser suites. Do not change production assertions or equate authoring templates with generated combat; generated combat remains deferred. |
| Rehearsal configuration deliberately omits beta access | Its explicit config strips classroom routes, production identifiers and beta guild IDs. This protects isolation but does not provide campaign acceptance by itself. | If campaign testing is separately approved, use only newly created rehearsal guild IDs. Never copy production's beta allowlist or reuse the fixed campaign-preview Worker/resources as C12. |
| Historical runbook and rollback targets are stale | October PR #84 and the 18-entry rehearsal are historical checkpoints. A pre-maintenance runtime cannot enforce current writer pauses or sleeping-room clock restoration. | Pin current source, 27-entry ledger/schema, bindings and maintenance windows. Use two reviewed schema/room-compatible versions in the same isolated environment. Retain history; do not present October builds as current rollback targets. |

## Schema and data compatibility

The original 18 journal entries are unchanged, and all 18 SQL files are byte-for-byte unchanged on current main. The nine additional canonical migrations are AA (0018), activity (0019), campaign pilot (0020), equipment (0021), consumables (0022), boss stamina (0023), AA compatibility (0024), assigned question banks (0025), and mathematics templates (0026).

A disposable populated PostgreSQL/PGlite probe applied the real Drizzle forward migrator from the 18-entry canonical history to all 27 entries, preserving the original receipt IDs/hashes/timestamps and existing result/XP/gold fields. A second migration was a no-op. Thus there is no demonstrated migration-number collision or need to rewrite old migrations. This does not authorize upgrading the retained provider rehearsal: first verify its actual ledger/schema and resource ownership, preserve its records/rooms, and obtain approval.

The legacy campaign-preview bridge is a different history and explicitly rejects C12's canonical 18-entry history. Do not use that bridge for C12. The production-specific 20-to-25 and 26-to-27 guarded upgraders also have exact historical preconditions; do not relabel a database to satisfy them.

## Verification performed

| Local check | Result |
| --- | --- |
| C12 release tests plus current deployment safeguard tests | 46/46 pass |
| Focused cleanup/history/identity, campaign migration, mathematics migration and maintenance tests | 22/22 pass |
| Additional review probes | 5/5 pass, reproducing the behaviors below |

The five review probes establish: canonical 18-to-27 upgrade/no-op; production validator rejection of C12 metadata; mathematics FK refusal with rollback; campaign FK refusal with rollback; and unreported AA/activity cascades. Passing a diagnostic test that reproduces an incompatibility does **not** mean the incompatibility is fixed.

The 22 compatibility tests include 3,000 historical results/1,500 evidence rows, lost COMMIT acknowledgement, exact cleanup ownership, 30/60-player two-round real-engine actions, production/preview-history separation, late rollback, and maintenance across HTTP/socket/DO timers and reward persistence.

Commands in the disposable combined-source directory:

```sh
node --test tests/release/*.test.mjs tests/deployment/*.test.mjs
node --import tsx --test --test-concurrency=2 tests/phase4/fixture-cleanup.test.ts tests/phase4/performance-history.test.ts tests/phase4/release-identity.test.ts tests/phase4/campaign-migrations.test.ts tests/phase4/math-production-migration.test.ts tests/phase4/release-maintenance.test.ts
node --import tsx --test tests/phase4/c12-reconciliation-review.test.ts
```

Retained [local test output](c12-2026-11-12/local-verification.txt) and [diagnostic probe source](c12-2026-11-12/diagnostic-probes.ts.txt) accompany this review. The probes belong only in a disposable combined-source checkout; they are not added to main's active tests.

Runtime: Node 24.22.1/npm 11.9.0 with an existing local dependency installation, not a fresh C12-pinned Node 22.23.3/npm 10.9.9 install. These are targeted source-level findings, not full-suite, exact-head CI, build, browser, or provider acceptance. During the review stage, no provider tests, provisioning, deployments, real-data writes, cleanup, branch publication, PR edits or merges occurred. The subsequent owner-approved retirement changes only the PR state/body and this documentation; it does not release code or touch provider resources or data.

If code is ever ported, meaningful regression gates are: all current application and deployment suites plus C12 safeguards; fresh locked install/typecheck/client+Worker builds; all four current browser jobs and Avatar Workshop; explicit push/dispatch and metadata/maintenance combinations; unsupported-schema cleanup refusal and complete row/receipt preservation; campaign snapshot/AA/stamina and immutable mathematics ownership/revision tests. Only then consider separately authorized provider acceptance.

## Protections and acceptance limits retained

Current main's fixed-target deployment, preserved opaque secrets and resource identities, database fingerprint/ledger verification, all-room pause scans, recovery-copy prerequisites, completed maintenance windows, writer quiescence, beta allowlist and sleeping-room recovery must survive any future port.

Retain C12's ideas as reference: exact reviewed-tree/check evidence; before/after commit and immutable Worker identity; UUID-bound rehearsal origin/account/DB/DO/R2 ownership; pooled-host alias and redirect rejection; fresh synthetic-only data; intent-before-write journals; unresolved-COMMIT retention; exact reference closure; rollback-only cleanup before application; confirmed Worker absence in the correct account; exact R2 keys; and partial evidence retention. Closing the PR authorizes none of its cleanup commands.

The November 5 canonical p95 of 3,180 ms is a functional acceptance sample from a different workload/environment. It establishes neither pass nor failure against C12's proposed sub-1,000 ms repeated 30-player target. C12's report uses the worst per-run p95; 60-player runs remain separately reported stress evidence.

C12-specific credential isolation and renewed target/database inventory, repeated matched 30/60-player measurements, forced room/database recovery, timed compatible rollback, historical fixture disposition, physical Chromebook observation, and monitoring ownership remain **unaccepted/deferred**. November production release evidence does verify independent database identity and preservation for that release; it does not revalidate the old C12 rehearsal or automatically close its distinct credential/inventory gates.

## Approved retirement scope

1. Close PR #75 without merging. Retain branch `cleanup/c12-release-review` at the reviewed head and retain its historical evidence.
2. Publish only this review and the accompanying status/coordination documentation changes on current main, using an expected-head check. Mark C12 **retired unmerged; operational gates deferred**, and remove instructions to resume it or complete it before choosing further work. Keep C01–C11 and the accepted campaign/mathematics release history intact.
3. Open no replacement PR and port no C12 runtime, workflow, dependency, migration or test code as part of retirement.
4. Leave production, the campaign preview, retained C12 rehearsal, all backups/fixtures and all student data untouched. Resource cleanup remains a separate explicitly approved action.

This closes a stale development branch as a queue item while preserving the accepted current code and an honest record of unperformed operational work.
