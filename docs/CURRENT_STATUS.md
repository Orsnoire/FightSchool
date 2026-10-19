# Current status

**October 19 balance release update:** [PR #77](https://github.com/Orsnoire/FightSchool/pull/77) is merged at `c9f8280ec1ae34cc82171ca94982657ea23bbfe8` and **deployed** as `5bb24b00377e511d118bc3ee4c61eb0cdcab235f` (same runtime plus docs). [Deployment 39313909643](https://github.com/Orsnoire/FightSchool/actions/runs/39313909643) passed, including 320 tests, TypeScript/builds, R2, additive migrations and both hostname smoke checks. Immutable Worker: `aa86b4da-3c2f-497a-8f80-69c1f9412030`, published at 19:50:08 UTC. PR/main CI and four Chromium suites also pass. **Full live combat acceptance remains pending** and must use the corrected test in `72e6775` ([passing CI 39314403925](https://github.com/Orsnoire/FightSchool/actions/runs/39314403925)); this test-only correction needs no redeployment. See [resume instructions](ACTIVE_WORK.md).

**CURRENT — GitHub rechecked October 18, 2026 (UTC).** Cleanup Phases 1–2 are complete; C05 is complete; Usability Patch 1 is complete, deployed and accepted; C06 is complete, merged, deployed and accepted in PR #69; C07 is complete, merged, deployed and accepted in PR #70; C08 is complete, merged, deployed and accepted in PR #71; C09 is COMPLETE, merged, deployed and accepted in PR #72; C10 is COMPLETE, merged, deployed and accepted in PR #73; C11 is complete, merged, deployed and accepted in PR #74; C12 is next and unstarted.
**C01, C02 and C03 are COMPLETE:** PRs [#53](https://github.com/Orsnoire/FightSchool/pull/53), [#56](https://github.com/Orsnoire/FightSchool/pull/56) and [#58](https://github.com/Orsnoire/FightSchool/pull/58) are merged and included in the live runtime. **HP preview, PR #59, is deployed and accepted. C04 / PRs #60 and #62 are merged, deployed and accepted. PR #61 is merged, deployed and accepted.**
Read [active work](ACTIVE_WORK.md) for the interruption checkpoint and next action.
The [cleanup plan](CLEANUP_PLAN.md) controls sequencing; expansion is [deferred](EXPANSION_PLAN.md).

## Next implementation

**C12 (Phase 6 release review)** is next and unstarted. No cleanup implementation is active; register its claim, branch and draft PR before implementation.
**C11 (authoring and lobby UI), Phase 5**, is complete, merged, deployed and accepted in [PR #74](https://github.com/Orsnoire/FightSchool/pull/74). All 300 tests, TypeScript, both builds and all four Chromium jobs pass. [Implementation and release evidence](reviews/2026-10-18-c11-authoring-lobby.md).
C10 is complete, merged, deployed and accepted in [PR #73](https://github.com/Orsnoire/FightSchool/pull/73): explicit combat module ownership with deterministic rules, one serialized room authority and compatible persistence. All 298 tests and all three Chromium jobs pass. [Implementation and release evidence](reviews/2026-10-18-c10-combat-modules.md).
C09 API/services work is complete and released in [PR #72](https://github.com/Orsnoire/FightSchool/pull/72). [Report](reviews/2026-10-18-c09-api-services.md).
C08 battlefield rendering is complete, merged, deployed and accepted. [Report and measurements](reviews/2026-10-17-c08-battlefield-rendering.md).
[C07 / PR #70](https://github.com/Orsnoire/FightSchool/pull/70) has shipped deferred
routes/MathLive, owner-only SQL fight summaries and focused live-session polling.
[Measured login JS falls 80.11%](reviews/2026-10-17-c07-initial-loading.md).

## Previous fully accepted release — C11

The preceding fully accepted runtime is `a580b30b6e9826fbaaca9f3e2cfc914a94e4c7ad`, merged [PR #74](https://github.com/Orsnoire/FightSchool/pull/74), released October 18 (UTC).
Immutable Worker `86111493-688d-41c2-9462-b050044b3d10` was published at 19:59:21 UTC.
Later documentation-only commits do not change the deployed runtime. All earlier releases remain included.

| Evidence | Result |
| --- | --- |
| [CI 39150169998](https://github.com/Orsnoire/FightSchool/actions/runs/39150169998) | Final reviewed head `34c3dd4`: 300 tests, TypeScript and both builds pass; merged tree is identical |
| [Chromium 39150169935](https://github.com/Orsnoire/FightSchool/actions/runs/39150169935) | All four jobs pass on `34c3dd4`, including before/after authoring/lobby checks |
| [Deployment 39161062489](https://github.com/Orsnoire/FightSchool/actions/runs/39161062489) | Passed on `a580b30`: tests/builds, R2, existing additive migration gate and both hostname smoke checks |
| [Canonical live acceptance 39161276964](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964) | Passed on the same runtime: combat, guilds/quests/shop/history, durable rewards, isolation, storage, 30-player concurrency/reconnect/completion, moderation and revocation |
| Database evidence | C11 adds no migration or SQL/reward-procedure change. Existing additive migration gate passed; no reset. Individual live ledger/catalog rows were not independently queried. |

C11 separates authoring/lobby responsibilities while preserving drafts, authoritative saves, permissions and recovery. Its same-item loot re-add fix was reproduced against pinned C10 before correction.
One live 30-answer burst measured p50 654 ms, p95 1260 ms and maximum 1310 ms;
this is functional acceptance, not a repeated performance benchmark. C08 physical-device limits and C12 infrastructure/fixture-isolation/recovery/rollback work remain open.
[Live acceptance record](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964).

### Previous C10 release evidence (historical)

The preceding C10 runtime is `bb753955c1b042ee52f0f5bb5b9a260e015ce5cd`, merged [PR #73](https://github.com/Orsnoire/FightSchool/pull/73), released October 18 (UTC).
Immutable Worker `d925c8ca-ff82-48bc-9843-36a49b2582d6` was published at 14:45:04 UTC.
Later documentation-only commits do not require redeployment. All earlier releases remain included.

| Evidence | Result |
| --- | --- |
| [CI 39130563643](https://github.com/Orsnoire/FightSchool/actions/runs/39130563643) | Final reviewed head `e9d13ac`: 298 tests, TypeScript and both builds pass; merged tree is identical |
| [Chromium 39130563649](https://github.com/Orsnoire/FightSchool/actions/runs/39130563649) | All three jobs pass on `e9d13ac` |
| [Deployment 39137219072](https://github.com/Orsnoire/FightSchool/actions/runs/39137219072) | Passed on `bb75395`: tests/builds, R2, existing migration gate and both hostname smoke checks |
| [Canonical live acceptance 39137585694](https://github.com/Orsnoire/FightSchool/actions/runs/39137585694) | Passed on the same runtime and canonical domain: combat, guild quests/shop/history, durable rewards, owner isolation, storage, 30-player concurrency/reconnect/completion, room isolation, moderation and revocation |
| Database evidence | C10 adds no migration or SQL/reward-procedure change. Existing additive migration gate passed at 14:44:48 UTC; no data reset. Individual live ledger/catalog rows were not independently queried. |

C10 gives combat rules, protocol, public messages, recovery and persistence effects
explicit owners while retaining one serial room authority. All 80 frozen replay
scenarios / 1,813 steps match the baseline, including JSON recovery.
One live 30-answer burst measured p50 703 ms, p95 1,354 ms and maximum 1,404 ms;
this is functional acceptance, not a repeated performance benchmark.
C08 physical-device/performance limits and C12 infrastructure/fixture-isolation/
recovery/rollback drills remain open. [Release screenshot](releases/2026-10-18-c10-live-accepted.jpg).

### Previous C09 release evidence (historical)

The preceding C09 runtime is `9efcfeada5a64e0ff115dd64430df4c255f4e479`, merged [PR #72](https://github.com/Orsnoire/FightSchool/pull/72), released October 18 (UTC).
Immutable Worker `bf61bb30-1d67-45f6-a18d-4022189e3cda` was published at 11:47:24 UTC.
Later documentation-only commits do not require redeployment. All earlier releases remain included.

| Evidence | Result |
| --- | --- |
| [CI 39099605515](https://github.com/Orsnoire/FightSchool/actions/runs/39099605515) | Final reviewed head `1628902`: 289 tests, TypeScript and both builds pass; merged tree is identical |
| [Chromium 39099605522](https://github.com/Orsnoire/FightSchool/actions/runs/39099605522) | All three jobs pass on `1628902` |
| [deployment 39124495260](https://github.com/Orsnoire/FightSchool/actions/runs/39124495260) | Passed on `9efcfea`: tests/builds, R2, existing migration gate and both hostname smoke checks |
| [canonical live acceptance 39124680158](https://github.com/Orsnoire/FightSchool/actions/runs/39124680158) | Passed on the same runtime and canonical domain: combat, guild quests/shop/history, durable rewards, owner isolation, storage, 30-player concurrency/reconnect/completion, room isolation, moderation and revocation |
| Database evidence | C09 adds no migration or database schema/reward-procedure change. Existing additive migration gate passed at 11:47:07 UTC; no data reset. Individual live ledger/catalog rows were not independently queried. |

C09 reduces the central API handler from 1,018 to 29 lines and assigns domain
operations explicit owners. Its extracted SQL remains unchanged. One live
30-answer burst measured p50 759 ms, p95 1,467 ms and maximum 1,517 ms; this is
functional acceptance, not a repeated performance benchmark.

### Previous C08 release evidence (historical)


The preceding C08 runtime is `d055b29761eec16fb96f7241c77bf4a4c0ea8d61`, merged [PR #71](https://github.com/Orsnoire/FightSchool/pull/71), released October 18 (UTC).
Immutable Worker `9908d9ec-19fd-4372-985c-36dda01b7300` was published at 01:31:04 UTC.
Subsequent release-record commits change documentation only and do not require redeployment.
All earlier released fixes, including C06 and C07, remain included.

| Evidence | Result |
| --- | --- |
| [Final review CI 39083463935](https://github.com/Orsnoire/FightSchool/actions/runs/39083463935) | Passed on `eb0968a`: 283 tests, TypeScript and client/Worker builds; expected-head merge has the identical tree |
| [Chromium 39083463944](https://github.com/Orsnoire/FightSchool/actions/runs/39083463944) / [Avatar Workshop 39083463964](https://github.com/Orsnoire/FightSchool/actions/runs/39083463964) | All three Chromium jobs and Avatar Workshop pass on `eb0968a`, including warning-free 60-avatar resize |
| [Deployment 39086670764](https://github.com/Orsnoire/FightSchool/actions/runs/39086670764) | Passed on `d055b29`: tests/builds, R2, existing migration gate and both hostname smoke checks |
| [Canonical live acceptance 39086818601](https://github.com/Orsnoire/FightSchool/actions/runs/39086818601) | Passed on the same runtime and canonical domain: teacher/student combat, guild quests/shop/history, durable rewards, owner isolation, R2, 30-player concurrency/reconnect/completion, concurrent rooms, moderation and socket revocation |
| Database evidence | C08 introduces no migration or schema change. Existing additive migration gate succeeded at 01:30:48 UTC; no reset or reward-procedure change. Individual live ledger/catalog rows were not independently queried. |

C08 reduces mounted avatar canvas backing by **99.36–99.89%** and eliminates
countdown-driven page/battlefield/avatar render executions in the populated
30/60-player fixtures. [Report, raw measurements and limits](reviews/2026-10-17-c08-battlefield-rendering.md).
Backing bytes are not total process/GPU memory. Cold recoloring remains expensive;
physical Chromebook observation and repeated input/long-task profiling remain open.

### Previous C07 release evidence (historical)

The preceding C07 runtime is `8f280b7b75479aa05bfb7dfd069f37e3f5d72334`, merged [PR #70](https://github.com/Orsnoire/FightSchool/pull/70), released October 17.
Immutable Worker `e2f6dc5a-4157-47f4-bba6-080214499dce` was published at 23:47:43 UTC.
Subsequent release-record commits change documentation only and do not require redeployment.
All earlier released fixes, including C06, remain included.

| Evidence | Result |
| --- | --- |
| [Final review CI 39078713939](https://github.com/Orsnoire/FightSchool/actions/runs/39078713939) | Passed on `7ded576`: 277 tests, TypeScript and client/Worker builds; merged runtime has the identical tree |
| [Chromium 39078713913](https://github.com/Orsnoire/FightSchool/actions/runs/39078713913) | Both existing combat UI and production initial-loading suites pass on `7ded576` |
| [Deployment 39080264978](https://github.com/Orsnoire/FightSchool/actions/runs/39080264978) | Passed on `8f280b7`: tests/builds, R2, existing migration gate and both hostname smoke checks |
| [Canonical live acceptance 39080459577](https://github.com/Orsnoire/FightSchool/actions/runs/39080459577) | Passed on the same runtime: combat/economy, guild quests/shop/history, owner isolation, R2, 30-player concurrency/reconnect/completion, moderation, revocation and exactly-once rewards |
| Database evidence | C07 introduces no migration or schema change. Existing additive migration gate succeeded at 23:47:29 UTC; no reset or reward-procedure change. Individual live ledger/catalog rows were not independently queried. |

C07 reduces initial login gzip JavaScript from 601,648 to 119,663 bytes, including
all static dependencies. SQL fight summaries and focused polling avoid repeated
full question-bank transfers. [Report and limits](reviews/2026-10-17-c07-initial-loading.md).
Teacher editing, student math/text answers, saved progression and atomic rewards
retain regression coverage.

### Previous C06 release evidence (historical)

The preceding C06 runtime was `470dd724a621b235624da4730255240580911fd3`, merged [PR #69](https://github.com/Orsnoire/FightSchool/pull/69), released October 17.
Immutable Worker `0de082fd-746e-48bb-bf4a-e33a8827ba68` was published at 22:31:11 UTC.
Later release-record commits change documentation only and do not require redeployment.
PRs #66 (mesmerize/feedback) and #68 (default shop catalog) remain included.

| Evidence | Result |
| --- | --- |
| [Review CI 39074557950](https://github.com/Orsnoire/FightSchool/actions/runs/39074557950) | Passed on reviewed head `24b0116e`: 275 tests, typecheck and client/Worker builds; merge has the identical tree |
| [Chromium 39074557979, attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/39074557979/attempts/2) | Passed on `24b0116e`; attempt 1 had an intermittent phone gear-comparison Escape timeout, retained in the PR record |
| [Deployment 39075244755](https://github.com/Orsnoire/FightSchool/actions/runs/39075244755) | Passed on `470dd724`: all 275 tests, typecheck/builds, R2, migration gate and both hostname smoke checks |
| [Canonical live acceptance 39075452591](https://github.com/Orsnoire/FightSchool/actions/runs/39075452591) | Passed on the same runtime: combat/economy, guild quests/shop/history, owner isolation, R2, 30-player concurrency/reconnect/completion, moderation, revocation and exactly-once rewards |
| Database evidence | Additive migration runner through 0017 succeeded at 22:30:55 UTC. 0017 adds five indexes only; no reset, reward-procedure changes or prior-migration edits. Individual live ledger/catalog rows were not independently queried. |

C06 adds scoped quest evaluation, SQL evidence/history aggregation, retry recovery,
bounded history and five plan-justified indexes. [Measurements and reproduction](reviews/2026-10-17-c06-data-costs.md)
record 82% fewer SQL response bytes for equivalent 30/60-member reconciliation.
Those isolated measurements do not establish a live latency trend.

The preceding runtime `d18d1b5` was deployed October 13 in
[38452066918](https://github.com/Orsnoire/FightSchool/actions/runs/38452066918), including #66/#68.
Its exact live acceptance was not reverified; current acceptance above covers the
C06 runtime containing those changes; C07 includes them as well.

### Earlier Usability Patch release evidence (historical)

An earlier accepted runtime was `bef100b4a86574819fe12bceed901de0fbd1caac`, the PR #65 correction to Usability Patch 1 / PR #64.
Immutable Worker `0951289e-d7c5-4243-b281-8ae0f61e4e9f` was published October 12 at
21:38:56 UTC. Subsequent documentation commits do not change this runtime.

| Evidence | Result |
| --- | --- |
| [Deployment 38311747151](https://github.com/Orsnoire/FightSchool/actions/runs/38311747151) | Passed on `bef100b`; 254 tests, typecheck, builds, R2, migration gate and both hostnames |
| [Canonical live acceptance 38311980245](https://github.com/Orsnoire/FightSchool/actions/runs/38311980245) | Passed on `bef100b`; combat/economy, completion, palettes/reporting, R2, 30-player concurrency/reconnects, moderation, revocation and exactly-once rewards |
| [Review CI 38311299763](https://github.com/Orsnoire/FightSchool/actions/runs/38311299763) / [browser 38311299742](https://github.com/Orsnoire/FightSchool/actions/runs/38311299742) | Passed on `78af971`; all effects/editors/filters, 30/60-player playback and the reporting batch correction |
| Database evidence | Migrations 0015/0016 applied before the initial deployment; the corrected deployment's migration gate also passed. No live-data reset. |

See [Usability Patch 1 release record](USABILITY_PATCH_1.md), including earlier acceptance failures and corrections. C05 room-cost improvements, PR #61 and the C04 refactor/forwarding fix remain included. Every answer remains durably checkpointed; reporting attempts are projected together when the question closes.

The October 8 queue is reconciled: every October 8 merged PR (#37–50 and #52)
is already included in the verified October 8 runtime `e158194` and this release.
There was no separate older open PR or undeployed merged application change.
The gear, guild-quest, host-control and enemy releases are live. Deferred
expansion items are not pending deployments.

The canonical classroom URL is <https://questacademy.bookwyrminteractive.studio>.
The Worker and deployment workflows still use the name **staging**, but they
serve this live application. A second hostname is not evidence of isolated data.
Current architecture: React/Vite assets, Fetch-native Worker APIs, one Durable
Object per combat room, Neon PostgreSQL, and R2 uploads. Express/Replit is removed
from the active runtime and is not a rollback target.

## Implemented and released

| Area | Released behavior | Outstanding boundary |
| --- | --- | --- |
| Combat and classroom UI | Deterministic combat, current class rules, daily stamina, First Aid, calculated ability values, static battlefield, late entry, moderation, host resurrection, Next wave, enemy elimination × and proportional host-end rewards | Refactors preserve these rules; classroom balance observation continues |
| Equipment | Enemy/equipment color palettes, reusable equipment base sprites and variants; eight slots, full Tier 0 starters, permissions, remembered per-job gear/abilities, Tier 1 level-2 collection, comparisons, equipped static art | F01 built-in/custom claim validation released in C01; ownership, earned-loot checks and atomic rewards preserved |
| Guilds and progression | Teacher/personal/shared quests, permanent progression with encounter caps, tier browsing, AA overflow banking, atomic reward receipts | AA purchases and additional balance tuning remain future work |
| Host sessions | Explicit Join / End / Launch, exact-session reconnect, duplicate-launch protection, idempotent host-end rewards | Team race is not implemented |
| Enemies | Seven defined species, configurable priorities, answer-based recovery, individual quantities, waves, goblin targeting, minimum-five additions and genuine roster-based count/HP estimates, optional swarm batches at 8/12/16 players and previous-tier reference gear | Counts lock at Start Fight; tier 3/4 gear bonuses remain provisional |
| Teacher statistics and editing | Session/player/question reports with search and guild, session, quiz, question, job, player ID and date filters; question Edit/save/cancel restored | Historical totals remain; pre-patch question attempts cannot be reconstructed |
| Leaderboards | Student metric query and visible retryable errors; accuracy weighted by total answers | Guild scope, hidden metrics and additive metrics preserved |
| Avatars and combat presentation | Saved appearance, equipped-item visuals, attack/damage effect placeholders, flying numbers and completion-driven resolution | Question and action/ability selection clocks remain. Full sprite animation, near-profile fitting and custom-item artwork remain pending |

Release details: [October 7–8 completed batch](combat/release-queue.md),
[current enemy specification](combat/enemy-ai.md), and
[dated deployment history](cloudflare/full-migration.md).

## Known issues and cleanup status

The [review](reviews/2026-10-09-code-review.md) records 17 baseline findings.
**F01–F03 are now closed by released C01;** remaining work stays in the cleanup
plan and [active-work checkpoint](ACTIVE_WORK.md).

- **F01 released:** registered built-in equipment IDs and custom UUIDs pass the
  claim contract. HTTP regressions cover fallback choices, invalid/unearned
  IDs, ownership, result scope, eligibility, gold and repeated/concurrent claims.
- **F02/F03 released:** the student leaderboard sends the metric query parameter,
  displays retriable errors, and calculates total correct over total answered.
  Unequal fight sizes, zero answers, guild scope and permissions have boundary
  regression coverage. The standard live acceptance run complements these
  disposable HTTP/UI regressions; it does not reproduce every new fixture live.
- **Schema generation drift/F04 (C03 complete):** schema declarations and the
  `0014` snapshot now match all 27 migrated tables/246 columns. No-op generation
  writes no files; SQL-owned functions and future migration responsibilities are
  documented in the [schema baseline](cloudflare/schema-baseline.md).
- **Dependency maintenance (C02 released):** audit entries reduced from 32 to 12.
  Remaining build/CLI chains have scoped deferrals in the [triage record](reviews/2026-10-12-dependency-triage.md).
  Production-only audit still reports 7 Tailwind peer-chain entries; not a clean audit.
- **Contracts/diagnostics F05/F16 (C04 released):** shared boundary contracts, explicit public projections, bounded JSON parsing, typed queries and redacted logs. Intended CI checks run on every PR; branch protection enforcement remains off.
- **Data costs F06/F08–F09 (C06 released):** event-scoped quest evaluation, SQL evidence/history aggregates, read-only views, bounded history, measured indexes and lost-acknowledgement recovery. Academic evidence and atomic receipts remain authoritative.
- **Initial loading F10 / list-polling F12 (C07 released):** deferred routes/MathLive, accessible recovery and text fallback, SQL fight summaries and foreground live-session polling. The measured 80.11% login gzip JS reduction exceeds the 40% gate.
- **Battlefield rendering F11 / countdown F12 (C08 released):** display/DPR-sized backing, byte-bounded caching and isolated countdown updates exceed the 80% backing-allocation gate in 30/60-player browser fixtures; physical hardware and cold-input limits remain explicit.
- **Remaining performance/refactoring work:** C08 physical Chromebook observation and repeated live query/load/recovery measurements remain C12 work. C11 UI module extraction is released and accepted in PR #74.
- **Documentation reconciliation (F17): COMPLETE for this baseline.** Status,
  history and plans are now separated; updating them remains part of each release.

## Open acceptance and operational work

The C08 October 18 canonical 30-answer burst measured p50 **906 ms**, p95 **1,760 ms**, maximum
**1,810 ms**. Its current maximum threshold is 15 seconds. One burst is not a
performance trend or evidence of meeting the proposed cleanup target; it does not establish
performance for a guild with fully seeded quests, realistic history and many
distinct avatars. C05–C08 isolated measurements are recorded; physical Chromebook observation and repeated representative live measurements remain open in the release review.

Full infrastructure signoff is still open: forced deployed room restart/eviction,
Neon interruption and connection-limit recovery, a timed compatible Worker
rollback, complete student desktop/mobile acceptance and a monitoring/observation
window. These are tracked in C12; disruptive drills need isolated resources or an
agreed release window. Functional acceptance does not mark those drills complete.

**Preserve current live data.** Students, appearances, equipment, progression,
guilds, content, results and reward receipts must survive cleanup. The original
fresh-database decision concerned discarded Replit prototype data only. It is
not permission to reset the current Neon database, R2 objects or room state.
