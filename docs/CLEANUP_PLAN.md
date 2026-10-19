# Current cleanup plan

**CURRENT PLAN — October 18, 2026 (UTC). Phases 1–2 complete; C01–C11 COMPLETE, merged, deployed and accepted; C11 is COMPLETE, merged, deployed and accepted in PR #74; C12 is active in draft PR #75; operational signoff remains open.**

Complete the engineering cleanup before new feature development. This plan
translates the [October 9 review](reviews/2026-10-09-code-review.md) into six phases
and twelve reviewable packages. `C01`–`C12` are planning IDs, **not GitHub PR
numbers**. Split a package into smaller PRs when compatibility or review scope
requires it; each should leave `main` deployable.

Preparation is **COMPLETE**: reconcile shipped status, retain historical release
evidence, mark older documents, and publish this queue and the
[expansion backlog](EXPANSION_PLAN.md). This closes F17's initial reconciliation;
C03 schema work is COMPLETE in merged PR #58. See [current status](CURRENT_STATUS.md)
for the deployed baseline. Do not confuse these phases with the old Cloudflare
migration phases.

## Phase 1 first step — interruption and resume safeguard

**First step COMPLETE:** publish [AGENTS.md resume rules](../AGENTS.md#start-or-resume-work)
and the single [active-work checkpoint](ACTIVE_WORK.md), with C01 registered on
`cleanup/c01-correctness` / [initial draft PR #53 (now merged)](https://github.com/Orsnoire/FightSchool/pull/53)
before substantive code changes. Keep one cleanup package active
at a time initially; resume its actual remote head and push small checkpoints.
The coordination step started Phase 1; the subsequent C01 fixes are now released.

`main`'s checkpoint points to the active branch/PR. Read the branch copy and live
PR for the latest pushed SHA, validation and exact next action. On interruption,
reconcile any newer commits instead of starting a competing fix or returning to
a historical feature branch. Register handoffs when a package finishes.

The separately authorized [Usability Patch 1](USABILITY_PATCH_1.md), PRs #64/#65, is complete, merged, deployed and accepted. C06 is complete in [PR #69](https://github.com/Orsnoire/FightSchool/pull/69), merged, deployed and accepted October 17. C07 is complete in [PR #70](https://github.com/Orsnoire/FightSchool/pull/70), merged, deployed and accepted October 17. C08 is COMPLETE, merged, deployed and accepted in PR #71; C09 is COMPLETE, merged, deployed and accepted in PR #72; C10 is COMPLETE, merged, deployed and accepted in PR #73. C11 is COMPLETE, merged, deployed and accepted in PR #74; C12 is active in draft PR #75; operational signoff remains open.

## Work packages

| Phase / package | Scope and review findings | Completion gate | Status / actual PR |
| --- | --- | --- | --- |
| **1 — C01: correctness** (small) | F01–F03: shared built-in/custom equipment ID validation; correct leaderboard URL and visible errors; weighted aggregate accuracy | HTTP/UI reproductions fail on baseline and pass after fixes; unauthorized/unearned claims rejected; duplicate claims remain harmless; zero-answer and mixed-size fights covered | COMPLETE — [PR #53](https://github.com/Orsnoire/FightSchool/pull/53) merged, deployed and accepted; 208 tests; [release evidence](cloudflare/full-migration.md#c01-correctness-release--9-october-2026) |
| **1 — C02: dependencies** (medium) | F15: triage exposure; update editor chain first, then ORM and build/test tools in compatible groups | Record advisory disposition and versions; rich HTML/SVG/math, paste/undo, auth, SQL, migration and build checks pass; no forced blanket audit fix | COMPLETE — [PR #56](https://github.com/Orsnoire/FightSchool/pull/56) merged, deployed and accepted; 211 tests/build, CI/browser and live acceptance pass; scoped advisory deferrals in [triage](reviews/2026-10-12-dependency-triage.md) |
| **1 — C03: schema baseline** (medium) | F04: reconcile Drizzle snapshots, table declarations and intentional hand-written SQL; documentation portion F17 already completed in preparation | No-op generation proposes no duplicate DDL; all migrations apply to a disposable database; existing-data preservation and catalog/schema comparison pass; shipped SQL history is not rewritten | COMPLETE / [#58](https://github.com/Orsnoire/FightSchool/pull/58) |
| **2 — C04: contracts and diagnostics** (medium) | F05, F16: request/response/command contracts, public snapshot allowlists, typed query factories, bounded JSON parsing, structured diagnostics and intended required CI checks | Built-in and custom content covered through real boundaries; explicit ownership and revocation preserved; logs identify request/room/revision and timing without credentials or submitted answers | COMPLETE — [#60](https://github.com/Orsnoire/FightSchool/pull/60) and [#62](https://github.com/Orsnoire/FightSchool/pull/62) merged, deployed and accepted; 224 tests, CI/browser and canonical live acceptance pass; intended checks documented, branch protection enforcement off |
| **3 — C05: room costs** (medium) | F07–F08: encode once per role/revision, suppress unchanged broadcasts, avoid redundant established-player profile reads, instrument queue/DB/checkpoint costs | Equivalent 30/60-player comparisons; immediate acknowledgements and phase transitions, reconnect, moderation, expiry and saved clocks preserved | COMPLETE — [#63](https://github.com/Orsnoire/FightSchool/pull/63) merged, deployed and accepted; 244 tests, CI/browser and canonical live acceptance pass |
| **Owner-approved Usability Patch 1** | Teacher reporting, question Edit, combat feedback/completion, enemy/equipment recoloring | 254 tests, typecheck/builds, browser effects/editors/filters, 30/60-player playback, durable answer batching, additive migrations and live release checks | COMPLETE — [#64](https://github.com/Orsnoire/FightSchool/pull/64) / [#65](https://github.com/Orsnoire/FightSchool/pull/65) merged, deployed and accepted; [release evidence](USABILITY_PATCH_1.md) |
| **Owner-requested mesmerize and feedback fix** | Disabled-choice lockout, hypnosis magic/direct-hit release, student/host answer feedback | Deterministic rules, persisted deadlines, answer secrecy, UI and browser checks | VERIFIED AND MERGED — [PR #66](https://github.com/Orsnoire/FightSchool/pull/66), `f749695`; 261 tests, typecheck/builds and Chromium acceptance pass. Included in deployed `d18d1b5` ([October 13 deployment](https://github.com/Orsnoire/FightSchool/actions/runs/38452066918)); that historical runtime was not reaccepted, but the current `bb75395` release includes this fix and passes canonical acceptance. [Resume checkpoint](ACTIVE_WORK.md) |
| **Owner-requested guild shop default catalog fix** | All defined tier equipment automatically stocked in teacher/student shops; built-in purchases with unlock and ownership safeguards | Catalog, migrated HTTP and UI regression checks; CI/browser acceptance before release | MERGED AND DEPLOYED — [PR #68](https://github.com/Orsnoire/FightSchool/pull/68), runtime `d18d1b5`; [CI](https://github.com/Orsnoire/FightSchool/actions/runs/38452023937) and [deployment](https://github.com/Orsnoire/FightSchool/actions/runs/38452066918) passed. Current runtime `bb75395` includes this fix and passes canonical acceptance. [Checkpoint](ACTIVE_WORK.md) |
| **3 — C06: data costs** (larger) | F06, F08–F09: durable evidence projection, affected-quest evaluation, indexed evidence/levels, bounded history, SQL aggregates and measured indexes | Populated guild fixtures plus fault/retry and cross-room reward tests; no lost evidence or duplicate awards; query plans justify indexes; read/query/payload costs recorded | COMPLETE — [PR #69](https://github.com/Orsnoire/FightSchool/pull/69), runtime `470dd724`; 275 tests, CI/browser, [deployment](https://github.com/Orsnoire/FightSchool/actions/runs/39075244755) and [canonical acceptance](https://github.com/Orsnoire/FightSchool/actions/runs/39075452591) pass. Migration 0017 applied without reset; [measurements and limits](reviews/2026-10-17-c06-data-costs.md). |
| **4 — C07: initial loading** (medium) | F10, F12: lazy route/editor loading, loading/error boundaries, summary list DTOs and focused live-session polling | At least 40% less initial login gzip JS; teacher editing and student math entry after deferred loading. [Measurements](reviews/2026-10-17-c07-initial-loading.md): 80.11% less login JS; 277 tests and both Chromium suites pass | COMPLETE — [PR #70](https://github.com/Orsnoire/FightSchool/pull/70), runtime `8f280b7`; 277 tests, both Chromium suites, [deployment](https://github.com/Orsnoire/FightSchool/actions/runs/39080264978) and [canonical acceptance](https://github.com/Orsnoire/FightSchool/actions/runs/39080459577) pass. No migration or data reset. |
| **4 — C08: battlefield rendering** (medium) | F11–F12: display/DPR-sized avatars, byte-bounded composition cache, isolated countdown subscriptions and stable battlefield props | Proposed target: at least 80% less canvas backing allocation; 30/60 distinct avatars, visual comparison and Chromebook responsiveness verified | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #71](https://github.com/Orsnoire/FightSchool/pull/71), runtime `d055b29`; [deployment](https://github.com/Orsnoire/FightSchool/actions/runs/39086670764) passes; [canonical acceptance](https://github.com/Orsnoire/FightSchool/actions/runs/39086818601) passes. 283 tests and all Chromium/Avatar Workshop suites pass; no migration or data reset. [Report](reviews/2026-10-17-c08-battlefield-rendering.md). Physical Chromebook observation remains unverified. |
| **5 — C09: API and services** (larger) | F13–F14: split guild/quest/equipment/reward/reporting routes and services; independent domain contracts | Same API behavior, explicit tenant/owner checks, atomic awards and failure paths; one coherent responsibility per extraction | COMPLETE — [PR #72](https://github.com/Orsnoire/FightSchool/pull/72), merged, deployed and accepted; 289 tests, CI/browser and canonical live acceptance pass |
| **5 — C10: combat modules** (larger) | F13–F14: separate phase transitions, abilities, damage/healing, command parsing, public projection and persistence effects | Same seeded input produces the same outcomes; one serial authority; durable receipts/retries and persisted-room compatibility preserved | COMPLETE — [PR #73](https://github.com/Orsnoire/FightSchool/pull/73), runtime `bb75395`; 298 tests, 80 seeded replay scenarios, fault/recovery gates, all three Chromium jobs, [deployment](https://github.com/Orsnoire/FightSchool/actions/runs/39137219072) and [canonical acceptance](https://github.com/Orsnoire/FightSchool/actions/runs/39137585694) pass; no migration or data reset. [Report](reviews/2026-10-18-c10-combat-modules.md). |
| **5 — C11: authoring and lobby UI** (larger) | F13–F14: extract question/CSV/enemy/loot authoring and loadout/avatar panels; remove verified unused helpers/types | Teacher workflow, saved drafts, gear and error recovery preserved; import/reference search before deletion; saved-room adapters retained until explicitly retired | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #74](https://github.com/Orsnoire/FightSchool/pull/74), runtime `a580b30`; 300 tests, all four Chromium jobs, [deployment](https://github.com/Orsnoire/FightSchool/actions/runs/39161062489) and [canonical acceptance](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964) pass. No migration or data reset. [Report](reviews/2026-10-18-c11-authoring-lobby.md) |
| **6 — C12: release review** (medium) | F16 and consolidation: full classroom acceptance, before/after report, commit-pinned releases, environment/fixture isolation and cleanup, recovery/rollback runbook | Exit gates below pass; exact CI/runtime/deploy/acceptance evidence recorded; current status and relevant specs updated | ACTIVE — [draft #75](https://github.com/Orsnoire/FightSchool/pull/75); safeguards implemented; safety follow-up [#76](https://github.com/Orsnoire/FightSchool/pull/76) integrated into C12 (334 tests/all four Chromium jobs pass); production inventory read; unversioned rehearsal Worker, empty private R2 bucket and separate empty Neon project/database verified; fresh secrets prepared locally; generated DO/config dry-run passes; uploaded secrets, actual DO namespace/bindings and deploy scope pending; [operational exit gates remain open](reviews/2026-10-18-c12-release-review.md) |

## Dependencies and execution rules

1. C01 comes first. Establish correctness before optimizing the affected paths.
2. Coordinate C02 ORM/tooling changes with C03. Reconcile schema metadata before
   C06 adds indexes or any package changes persisted structures.
3. C04's contracts and diagnostics precede broad extraction in C09–C11 and give
   C05–C06 measurable boundaries. C05 instrumentation precedes decisions about
   outboxes, frozen-fight storage and broadcast coalescing.
4. C07–C08 can be reviewed independently of server internals once their shared
   API and baseline requirements are clear. Do not combine them with a sweeping
   server rewrite.
5. Preserve approved gameplay during cleanup. Balance changes or new features
   discovered along the way belong in the expansion plan and need their own
   design/review scope. Preserve current live student data throughout.
6. Run relevant regression checks per package. Record local verification, CI,
   merged and deployed states separately. Do not dispatch a live migration/load
   test merely to update documentation.

## Exit gates before expansion resumes

- **Correctness:** all three reproduced defects have boundary-level regression
  coverage. Preserve the seven-species roster, minimum-five goblins, answer-based
  recovery, First Aid, balance, per-job equipment, loot, late entry, moderation
  and proportional host-ended rewards.
- **State integrity:** duplicate commands/rewards remain harmless; refresh and
  hibernation retain phases/deadlines; failed persistence retries without lost
  progress; logout revocation works; existing students survive migrations;
  generated metadata and the migrated database agree.
- **Performance:** repeat equivalent 30-player sessions and a 60-player stress
  fixture with guild membership, seeded quests, realistic history, distinct
  avatars, abilities, swarms and reconnects. Record p50/p95 acknowledgement,
  queue/DB time, query counts, bytes, render work and memory. The proposed
  30-answer p95 target is **under one second**; calibrate and record a repeatable
  release threshold using repeated baselines, not one noisy run. Bundle and
  avatar targets are defined in C07/C08; document results and any revised gate
  explicitly rather than silently declaring success.
- **Delivery:** CI checks the exact release revision; migration verification and
  post-deploy acceptance pass; dependency/CLI/browser versions are reproducible;
  acceptance fixtures have scoped retention/cleanup and genuinely isolated
  resources for disruptive drills. Prove forced room restart/eviction, database
  interruption/connection recovery, compatible timed rollback, student
  desktop/mobile flows and the agreed monitoring window. Rollback documentation
  distinguishes code from Neon/R2/room data.
- **Handoff:** C01–C12 are complete with evidence, remaining limitations are
  explicit, and [CURRENT_STATUS.md](CURRENT_STATUS.md) names the actual runtime.
  Select and scope the next expansion item only after this checkpoint.

## Baseline and evidence discipline

Use the [review baseline](reviews/2026-10-09-code-review.md#baseline-and-limits).
It distinguishes reproduced bugs, synthetic measurements, existing live timings
and hypotheses requiring profiling. A smaller file or added cache is not itself
evidence of improvement. Preserve existing safeguards and measure the work the
change is intended to reduce.
