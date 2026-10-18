# C12 / Phase 6 release review — October 18, 2026 UTC

**Implementation and local verification complete; operational signoff OPEN.**
[Draft PR #75](https://github.com/Orsnoire/FightSchool/pull/75), branch
`cleanup/c12-release-review`. C12 is the last package in **six phases / twelve
packages**, not a twelfth phase. No C12 deployment, production-data reset,
provider interruption, rollback or provider cleanup has occurred.

## Verified baseline

At claim time, GitHub main was `a66f229a43b5fdff04ad0c1b4dd789ab8b1ea67b`, no PR
was open and no C12 branch was found. Main's discovery pointer was published at
`7cd6fab97c5306514a04d6e591ba3d5495dd0d8e`. Actual GitHub state takes precedence
over old release checkpoints. Main remains unprotected; this implementation
adds release checks, not repository administration controls.

The actual accepted classroom runtime remains C11:

| Evidence | Exact identity / result |
| --- | --- |
| Merged runtime | `a580b30b6e9826fbaaca9f3e2cfc914a94e4c7ad`, [PR #74](https://github.com/Orsnoire/FightSchool/pull/74) |
| Reviewed head/tree | `34c3dd4d97a9000c23c3b14869f468a032313421` / `bb9a1f04ae80fc662abcab16ad301b97187d9248`; merge tree identical |
| CI | [39150169998](https://github.com/Orsnoire/FightSchool/actions/runs/39150169998), 300 tests, typecheck and builds pass |
| Browser | [39150169935](https://github.com/Orsnoire/FightSchool/actions/runs/39150169935), all four jobs pass |
| Deployment | [39161062489](https://github.com/Orsnoire/FightSchool/actions/runs/39161062489), migration gate and both hostnames pass |
| Worker | `86111493-688d-41c2-9462-b050044b3d10`, published 19:59:21 UTC |
| Canonical acceptance | [39161276964](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964), combat, storage, 30-player completion, concurrent rooms, moderation, reward retries and logout pass |

C11's single 30-answer sample was p50 **654 ms**, p95 **1,260 ms**, max **1,310 ms**.
It is neither a repeated benchmark nor evidence of the proposed sub-second p95.
A documentation or implementation branch head is not a deployed runtime.

## C12 changes

- Deployment/migration require a full merge SHA and merged PR number. Before
  resource changes, the guard verifies the repository, exact merge SHA, identical
  reviewed tree, newest CI/browser runs and every required job. Failed/skipped
  newer checks cannot fall back to older green runs. PR workflows check out the
  actual PR head. Deploy still runs the entire test/typecheck/build gate itself.
- Deployment, standalone migration and live acceptance share one production
  concurrency group. Both hostnames must expose the expected commit and the
  same immutable Worker version. Acceptance checks identity before fixtures and
  after completion and retains both observations. Failed rollout checks leave an
  explicit failure; they do not silently claim a rollback occurred.
- Node 22.23.3, npm 10.9.9, Wrangler 4.151.1 and Playwright 1.62.1 are pinned.
  Wrangler/browser tooling is installed by the lockfile, not floating `npx`
  packages. Existing application dependency versions remain, except the shared
  `detect-libc` dependency resolves 2.0.3 → 2.1.2 for the added tooling. All jobs
  use Ubuntu 24.04. Actions major tags remain mutable; no hermetic runner claim.
- Acceptance has no default target. Both production hostnames are recognized as
  live, regardless of their staging names. Every suite records exact synthetic
  account aliases/IDs, entities, sessions and object keys; partial manifests
  survive interruption and contain no credentials. Creation intent is written before requests; unresolved writes (including HTTP 5xx) block cleanup until their exact identity is reconciled. Historical unjournaled live
  fixtures remain a separate retention task.
- Isolated configuration generation rejects the production endpoint, including
  pooled/non-pooled aliases, and uses a distinct Worker/DO namespace and R2 bucket
  with no classroom route. Inventory/provider provisioning is **not** assumed.
- Cleanup refuses live manifests, requires the isolated Worker to be absent,
  verifies exact account aliases and all relational ownership, and checks
  deletion order in a rolled-back transaction before apply. It never deletes by
  account prefix or truncates a database. Only listed R2 keys are deleted;
  partial failure is retryable and SQL remains untouched until R2 succeeds.
  Actual provider namespace/branch disposal still requires independent receipts.
- Isolated functional acceptance supports bounded 30/60-player repeats and stores
  answer percentiles. The existing live workflow stays at one 30-player run.
  The repeated harness is not yet the combined guild/history/browser workload.

The only application behavior change is additional non-secret release identity
on `/api/health/live`. No gameplay, permissions, migrations, progression,
academic evidence, reward functions or saved-room format changes. The room,
progression and UI implementations from C01–C11 remain intact.

## Consolidated before/after evidence

These are scoped engineering measurements, not a whole-application speedup:

| Package | Before | After / preserved result | Evidence / limit |
| --- | --- | --- | --- |
| C01–C02 | Reproduced loot validation and combat authorization/revocation defects | Boundary regressions, ownership and already-open socket revocation covered | Cleanup plan and retained release acceptance; no gameplay change |
| C03–C04 | Schema declaration/snapshot drift and permissive contracts | Migrated-schema agreement, shared HTTP/WS validation and allowlisted diagnostics | Complete suite; existing learner fixture survives additive migrations |
| C05 | Per-recipient repeat encoding and redundant reconnect profile reads | Per-role/revision encoding and unchanged-state suppression; established reconnect avoids profile reads/writes | [C05 measurements](2026-10-12-c05-measurements.json); changed revisions still fan out |
| C06, 30 members | 2,051 quests; 6,645 rows / 3,504,115 serialized DB bytes per full evaluation | 2,155 rows / 629,883 bytes (82.02% fewer bytes); 11 → 13 queries | Fresh 3-repeat PGlite comparison below; fewer bytes does not mean fewer queries |
| C06, 60 members | 4,091 quests; 13,275 rows / 7,002,985 bytes | 4,285 rows / 1,255,953 bytes (82.07% fewer bytes); 11 → 13 queries | Same workload, two guilds, 100 history entries/member/guild |
| C06 targeted evidence | Legacy full-guild evaluation | 2 affected quests; 6 queries; 3,734 bytes (30) / 6,644 bytes (60) | Single event samples, not repeated event-latency estimates |
| C07 login | 601,648 gzip JS bytes | 119,663 bytes, 80.11% smaller | [C07 report](2026-10-17-c07-initial-loading.md); cold transfer, not observed load time |
| C07 fight list | 742,896 DB-result bytes / 750,336 HTTP bytes | 6,340 / 9,700 bytes | 40-fight fixture; full definitions retained for editing |
| C08 avatars | 280.8 MB / 561.6 MB output backing at 30/60 avatars | 449,280 / 898,560 bytes at 48×78, 99.84% smaller | [C08 report](2026-10-17-c08-battlefield-rendering.md); backing is not total process/GPU memory; cold recoloring still expensive |
| C08 countdown | Page/board/avatar executions on each clock tick | Isolated countdown subscription avoids those executions | Retained browser comparisons; physical device/input-latency gate still open |
| C09–C11 ownership | Central routes, engine, authoring and lobby mixed responsibilities | Explicit owners, unchanged API/reward boundaries, 80 frozen engine scenarios / 1,813 steps, draft/loadout recovery | [C09](2026-10-18-c09-api-services.md), [C10](2026-10-18-c10-combat-modules.md), [C11](2026-10-18-c11-authoring-lobby.md); file size alone is not performance proof |

Fresh C12 DB reconciliation median wall times (three samples) are **432.13 →
115.10 ms** at 30 members and **1,138.72 → 233.28 ms** at 60. They use the frozen
pre-C06 evaluator and pre-index schema versus current code/schema, on migrated
PGlite in one local environment. Query plans, returned rows/bytes and DB timings
are retained in [before](c12/data-before.json) and [after](c12/data-after.json).
This does not measure Neon network cost or production latency.

[Room bursts](c12/room-bursts.json) repeat 12 times each at 30/60 players with
four jobs, distinct saved Human appearances, scaled goblins, concurrent answers,
duplicate commands and reconstructed-room reconnect. Median per-run ack p95 is
**379.5 ms / 2,572.5 ms**; worst p95 **426.1 / 2,739.5 ms**. The repository is a
stub: SQL/history and browser rendering are measured separately. The harness
also captures/parses messages; these numbers are **not** provider budgets.
The first samples emit **37,075,007 / 285,950,969 wire bytes** and **31 / 61
checkpoints** per burst. This documents substantial changed-state fan-out at 60
players; unchanged-state suppression does not eliminate it. Queue/checkpoint
samples and counts are retained. No pass of the live latency gate is inferred.

Reproduce sequentially with the pinned Node/npm versions and `npm ci`:

```sh
node --import tsx tests/support/measure-release.ts /tmp/room-bursts.json
node --import tsx tests/support/measure-data-costs.ts --baseline /tmp/data-before.json
node --import tsx tests/support/measure-data-costs.ts /tmp/data-after.json
```

[Measurement manifest](c12/measurement-manifest.json) records source/harness
hashes, commands and limitations. Existing browser workflows rerun pinned C07
and C10 baselines against the current C08/C11 implementations at Chromebook and
phone dimensions. These independent fixtures do not substitute for one
representative populated-guild provider classroom session.

## Verification and exit gates

Local **318 tests**, TypeScript and both builds pass under Node 22.23.3/npm
10.9.9. New tests cover release mismatch/failure/skipped jobs, missing runtime
identity, target/size guards, credential-free interrupted manifests, populated
SQL cleanup, external references, transactional fault rollback, idempotent retry
and partial R2 failure. Existing deterministic room/evidence/reward and cross-room
SQL tests remain part of the suite. Workflow YAML parses; Wrangler 4.151.1 successfully bundles the generated isolated config with `deploy --dry-run`, without provider changes. A short command-ID
mistake in the first measurement attempt was rejected by the existing validator;
the harness was corrected and all retained runs use valid IDs.

First published implementation `96d4fe3911d028cee24daa45cbc6aa736c463e22` passes
[CI 39165110557](https://github.com/Orsnoire/FightSchool/actions/runs/39165110557),
[all four browser jobs 39165110655](https://github.com/Orsnoire/FightSchool/actions/runs/39165110655)
and [Avatar Workshop 39165110695](https://github.com/Orsnoire/FightSchool/actions/runs/39165110695).
The fuller implementation `0b28b194da774acea8f47f8b95e7fbbc4d28007f` also passes [CI 39165744219](https://github.com/Orsnoire/FightSchool/actions/runs/39165744219) and [Avatar Workshop 39165744263](https://github.com/Orsnoire/FightSchool/actions/runs/39165744263); [all four browser jobs 39165744264](https://github.com/Orsnoire/FightSchool/actions/runs/39165744264) also pass. Final exact-head results are maintained in the PR and ACTIVE_WORK checkpoint.

| Cleanup exit gate | State / remaining evidence |
| --- | --- |
| Correctness and state regression coverage | PASS locally; exact-head CI/browser required before merge |
| Preserve existing data / atomic rewards | PASS regression coverage; no C12 schema/data mutation; no production reset |
| Initial loading and bounded avatar backing | PASS scoped C07/C08 fixtures; not a total-memory or physical-device claim |
| Representative repeated 30/60 provider performance | **OPEN**. Local pieces and bounded functional driver exist, but no combined provider guild/history/abilities/browser workload or calibrated repeatable release threshold. The last live p95 was 1,260 ms. |
| Immutable release/tool/fixture safeguards | IMPLEMENTED / tested; C12 guarded deployment and post-deploy acceptance have not run |
| Provider isolation and retention | **OPEN**. No independently verified isolated inventory available; no provider cleanup executed; historical live fixtures cannot be safely inferred from names |
| Forced room eviction / DB interruption / timed rollback | **OPEN**. Local fault/reconstruction tests pass; provider drills have not run |
| Physical Chromebook/classroom and monitoring | **OPEN**. CI emulation passes; actual device observation and a monitoring window/owner are not yet recorded |
| Handoff / expansion | **OPEN** until the remaining cleanup gates are evidenced or explicitly revised by the owner |

The [runbook](../cloudflare/release-runbook.md) provides the exact inventory,
fixture cleanup commands and required drill records. To finish C12, obtain the
independent empty Cloudflare/Neon/R2 rehearsal resources, run the outstanding
provider/performance checks and record the classroom observation and agreed
monitoring window. The current staging-named environment is production. Do not
run disruption there, silently lower the performance threshold or mark cleanup
complete merely because this PR passes CI.
