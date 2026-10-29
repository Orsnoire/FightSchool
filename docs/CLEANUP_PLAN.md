# Current cleanup plan

**CURRENT PLAN — October 20, 2026 (UTC). Phases 1–2 complete; C01–C11 COMPLETE, merged, deployed and accepted; C11 is COMPLETE, merged, deployed and accepted in PR #74; C12 is active separately in draft PR #75.**

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

The separately authorized [Usability Patch 1](USABILITY_PATCH_1.md), PRs #64/#65, is complete, merged, deployed and accepted. C06 is complete in [PR #69](https://github.com/Orsnoire/FightSchool/pull/69), merged, deployed and accepted October 17. C07 is complete in [PR #70](https://github.com/Orsnoire/FightSchool/pull/70), merged, deployed and accepted October 17. C08 is COMPLETE, merged, deployed and accepted in PR #71; C09 is COMPLETE, merged, deployed and accepted in PR #72; C10 is COMPLETE, merged, deployed and accepted in PR #73. C11 is COMPLETE, merged, deployed and accepted in PR #74; C12 is active separately in draft PR #75.

## Work packages

| Phase / package | Scope and review findings | Completion gate | Status / actual PR |
| --- | --- | --- | --- |
| **Owner-requested student join context isolation** | Campaign context only for campaign fights; ordinary guild reads limited to admission, frozen power caps and reward identity | Database query boundaries, guild/AA caps, campaign ownership/resources, reconnect and unchanged live acceptance | IMPLEMENTED / CI VERIFIED / UNMERGED — [PR #95](https://github.com/Orsnoire/FightSchool/pull/95). No migration or deployment. Prior join timeout remains unconfirmed. [Scope and checks](reviews/2026-10-29-student-join-context.md). |
| **Owner-requested fight-authoring validation repair** | Show actionable save errors and reject invalid CSV batches without losing the draft | Existing bounds/answer identity, actual CSV hook rejection/retry, desktop/phone creation recovery, protected release and live acceptance | MERGED / DEPLOYED — [PR #94](https://github.com/Orsnoire/FightSchool/pull/94). 412 tests and all browser jobs pass. Release verification passes; no migration. Live acceptance is BLOCKED after two unchanged student-join timeouts; no operational pass is claimed. [Record](releases/2026-10-29-fight-validation.md). |
| **Owner-requested campaign consolidation and protected upgrade** | Merge campaign/AA/roster work, preserve both database histories and all saves, maintenance across HTTP/socket/alarm/rewards and sleeping-room clock restoration | Exact reviewed tree, CI/browser gates, isolated rehearsal, paused recovery copies, table/ledger/room preservation, original live acceptance and gated owner playtest | MERGED / MIGRATED / DEPLOYED / OPERATIONALLY ACCEPTED — PRs [#81](https://github.com/Orsnoire/FightSchool/pull/81), [#88](https://github.com/Orsnoire/FightSchool/pull/88), diagnostic-only [#89](https://github.com/Orsnoire/FightSchool/pull/89); production `b33bebe`. 405 tests, eleven deployment tests, four browser jobs and canonical acceptance 40740564094 pass. Both environment upgrades preserve records and rooms. Dedicated beta-guild/owner playtest pending; C12 untouched. [Evidence](releases/2026-10-28-pr88.md). |
| **Owner-requested teacher roster statistics** | Every job level, lifetime AA, seven-day active hours and 24-hour guild accuracy | Authenticated sampling, deduplication, rolling-window and migrated-data tests; TypeScript/builds and desktop/phone roster checks | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #87](https://github.com/Orsnoire/FightSchool/pull/87), included in `b33bebe`. Original failures remain documented; current full canonical acceptance 40740564094 passes after PR #88 and failure-only diagnostic PR #89, with unchanged fixtures/deadlines. [Current evidence](releases/2026-10-28-pr88.md); [historical evidence](releases/2026-10-28-pr87.md). |
| **Owner-requested Alternate Advancement** | Preserved overflow XP wallet, tier-limited rank catalog, atomic purchases, paid recustomization, five cross-class slots, combat effects and full wrong-answer combo reset | Existing XP/loadouts retained; atomic receipt/retry and isolated migration checks; all-class/tier combat parity; desktop/phone selection and real combat command acceptance | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #86](https://github.com/Orsnoire/FightSchool/pull/86), runtime `207b7bb`. 364 tests, TypeScript/builds, four Chromium jobs and merged-main CI pass. Deployment 40370834834 applied additive migration 0018; canonical acceptance 40371373272 passes on its first attempt. [Evidence and limits](releases/2026-10-26-pr86.md). Campaign #81 and C12 #75 remain separate. |
| **Owner-requested solo exit EXP and periodic effects** | Shared teacher/solo-host EXP and completion; actual damage, blocking, healing and correct answers; MAT/MDF Hex initial/ticks and Hemorrhage timing | Deterministic duration/refresh/recovery, migrated SQL/DO retry/receipt checks, UI confirmation, TypeScript/builds and browser CI | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #85](https://github.com/Orsnoire/FightSchool/pull/85), runtime `5530459`. 347 tests, TypeScript/builds, all four Chromium jobs and merged-main CI pass. Deployment 40344349000 and canonical acceptance 40345280239 (first attempt, corrected test source `453925f`) pass. No new migration or reset. [Evidence and limits](releases/2026-10-26-pr85.md). Separate from Campaign/C12. |
| **Owner-requested vampire, guild shop and battle joining fixes** | Bite heals actual HP drained; T1–T4 common prices 100/1,000/5,000/10,000g; 24 owner-specified Tier 2 armor pieces; visible guild battle lists and authenticated guildmate entry | Deterministic/stat/healing and SQL/socket authorization regressions, TypeScript, tests/builds and Chromebook/phone UI | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #84](https://github.com/Orsnoire/FightSchool/pull/84), runtime `a665948`. 339 tests, TypeScript/builds, all Chromium/Avatar Workshop jobs and merged-main CI pass. Deployment 39819733897 and canonical acceptance 39820153872 pass. [Evidence and limits](releases/2026-10-22-pr84.md). Separate from Campaign/C12. |
| **Owner-requested math display repair** | Typed/imported powers, subscripts, fractions and delimited LaTeX; stored source, answer values, prose, SVG and sanitization preserved | Rich-content/CSV tests; desktop/phone import/edit/save/reload; exact-head CI/builds and canonical live acceptance | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #83](https://github.com/Orsnoire/FightSchool/pull/83), runtime `2ca741f`. 334 tests, TypeScript/builds and four Chromium jobs pass. Deployment 39695583585 and canonical acceptance 39695893872 attempt 2 pass. All 48 quiz questions/264 equations, live save/reload and correct/distractor grading verified. Initial combat-phase timeout retained with unconfirmed cause. [Evidence and limits](releases/2026-10-21-pr83.md). Separate from campaign/C12. |
| **Owner-requested campaign beta / release safety** | Reconcile AA/combat, protect divergent histories, and prepare server-gated main-site beta with bug reporting | Populated preservation/late rollback, API beta isolation, exact-head CI/browser checks and authorized live guardian acceptance | MERGED / ISOLATED MIGRATION REHEARSED / LIVE RELEASE PENDING — [PR #81](https://github.com/Orsnoire/FightSchool/pull/81), merge `811ff45`, exact reviewed tree. Reviewed CI/four Chromium jobs and merged-main CI pass. Preview backup and provider rehearsal preserve all old data/history. Live migration awaits target/writer-pause verification; main-site beta also awaits original production classroom acceptance. Authorization exists; beta stays closed. [Release evidence](releases/2026-10-28-pr81.md). Future campaign work follows main; C12 is unchanged. |
| **Owner-requested battlefield labels and swarm tier scaling** | Enemy list and wave heading at the top; full reference-output HP coefficient; automatic tier at average job levels 2/6/10; starting Swarm count × tier with unchanged attendance increments, caps and role budgets | Teacher/student desktop and phone layout; count/HP preview and Start Fight parity, locked active counts, host controls, TypeScript/build and browser verification | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #79](https://github.com/Orsnoire/FightSchool/pull/79), runtime `989c9ec`; 325 tests, TypeScript/builds, exact-head CI and four Chromium jobs pass. Deployment 39438053539 passes; canonical 39438588938 attempt 3 passes the original fixture; attempts 1/2 remain recorded with unconfirmed connection-timeout cause. PR #80 adds diagnostics without weakening gates and also passes canonical 39442555095. [Release evidence](releases/2026-10-20-pr79.md). Separate from C12. |
| **Owner-requested fight balance** | Reference-output question coefficient + weighted players; whole-fight role shares 10/15/25/50; integer HP with 1 HP minimum; Wizard MP/Fireball and monster MDF | Exact budgets, attack types, preview/start, recovery, compatibility, TypeScript, tests and builds | COMPLETE / MERGED / DEPLOYED / ACCEPTED — [PR #77](https://github.com/Orsnoire/FightSchool/pull/77), `c9f8280`; [deployment 39313909643](https://github.com/Orsnoire/FightSchool/actions/runs/39313909643) at `5bb24b0` and [canonical acceptance 39315198519](https://github.com/Orsnoire/FightSchool/actions/runs/39315198519) pass. Acceptance uses corrected tests at `cd5bc74`; no runtime redeployment needed. 320 tests, TypeScript/builds, PR/main CI and four Chromium jobs pass. Future AoE coverage is in the expansion backlog. Separate from C12. [Specification](combat/role-weighted-hp.md) |
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
| **6 — C12: release review** (medium) | F16 and consolidation: full classroom acceptance, before/after report, commit-pinned releases, environment/fixture isolation and cleanup, recovery/rollback runbook | Exit gates below pass; exact CI/runtime/deploy/acceptance evidence recorded; current status and relevant specs updated | IN PROGRESS — [draft PR #75](https://github.com/Orsnoire/FightSchool/pull/75), `cleanup/c12-release-review`; resume its own checkpoint. Isolated rehearsal and safeguards remain separate and unchanged by PR #79. |

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

## Campaign beta visual/entry workshop — October 28, 2026

[PR #90](https://github.com/Orsnoire/FightSchool/pull/90) is merged, migrated and deployed. Original map/battle art, 47 connected border cases, shared equipped avatar and mandatory per-player guild-assigned question-bank selection are live. 408 application tests, 11 original deployment tests, TypeScript/builds and all browser jobs passed. Provider rehearsal, recovery copy and paused row/room preservation checks pass. [PR #91](https://github.com/Orsnoire/FightSchool/pull/91) closes release evidence and explicit current-ledger preflight (12 deployment tests pass). Canonical live combat and all eight operational checks pass (40769862238); release-only PR #91 is merged and read-only preflight passes (40771213932). Beta remains closed pending dedicated-guild/guardian handoff; preview and C12 stay unchanged. See [release evidence](releases/2026-10-28-pr90.md) and [screenshots](reviews/2026-10-28-campaign-visual-pass.md).

## AP guild beta enrollment — October 29, 2026

Owner selected AP Precalc 2027 and AP Calculus; access is enabled for exactly those production guilds. PR #92 retains enrollment across releases and updates the settings-version preflight pin, with thirteen deployment tests passing. No runtime-code or database changes. The next owner step is campaign creation per guild and authenticated guardian/stamina acceptance; preview and C12 remain separate. [Evidence](releases/2026-10-29-ap-beta.md).

## October 29 campaign tile correction

PR #92 is merged at `24df089`; AP Precalc 2027 and AP Calculus beta access is live, with CI and all four browser jobs passing. Both guilds still need teacher-created campaigns.

[PR #93](https://github.com/Orsnoire/FightSchool/pull/93) is COMPLETE / MERGED / DEPLOYED / OPERATIONALLY ACCEPTED at `236ea0f`. Terrain repeats one complete material per 48px tile, retaining borders and saved layouts. CI, all four Chromium jobs, desktop/phone screenshot review, protected release 40885240111 and canonical acceptance 40886432975 pass. Current 26-row ledger, all paused rooms, storage/bindings and AP beta access are preserved; no migration or reset. Both domains are ready and live campaign JS/CSS match the tested build. Preview/C12 remain separate. [Evidence](releases/2026-10-29-campaign-tiles.md).
