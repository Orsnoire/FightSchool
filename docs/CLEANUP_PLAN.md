# Current cleanup plan

**CURRENT PLAN — October 9, 2026. Phase 1 active; C01 COMPLETE, C02 next and not started.**

Complete the engineering cleanup before new feature development. This plan
translates the [October 9 review](reviews/2026-10-09-code-review.md) into six phases
and twelve reviewable packages. `C01`–`C12` are planning IDs, **not GitHub PR
numbers**. Split a package into smaller PRs when compatibility or review scope
requires it; each should leave `main` deployable.

Preparation is **COMPLETE**: reconcile shipped status, retain historical release
evidence, mark older documents, and publish this queue and the
[expansion backlog](EXPANSION_PLAN.md). This closes F17's initial reconciliation;
C03 still owns the unstarted schema work. See [current status](CURRENT_STATUS.md)
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

## Work packages

| Phase / package | Scope and review findings | Completion gate | Status / actual PR |
| --- | --- | --- | --- |
| **1 — C01: correctness** (small) | F01–F03: shared built-in/custom equipment ID validation; correct leaderboard URL and visible errors; weighted aggregate accuracy | HTTP/UI reproductions fail on baseline and pass after fixes; unauthorized/unearned claims rejected; duplicate claims remain harmless; zero-answer and mixed-size fights covered | COMPLETE — [PR #53](https://github.com/Orsnoire/FightSchool/pull/53) merged, deployed and accepted; 208 tests; [release evidence](cloudflare/full-migration.md#c01-correctness-release--9-october-2026) |
| **1 — C02: dependencies** (medium) | F15: triage exposure; update editor chain first, then ORM and build/test tools in compatible groups | Record advisory disposition and versions; rich HTML/SVG/math, paste/undo, auth, SQL, migration and build checks pass; no forced blanket audit fix | NOT STARTED / — |
| **1 — C03: schema baseline** (medium) | F04: reconcile Drizzle snapshots, table declarations and intentional hand-written SQL; documentation portion F17 already completed in preparation | No-op generation proposes no duplicate DDL; all migrations apply to a disposable database; existing-data preservation and catalog/schema comparison pass; shipped SQL history is not rewritten | NOT STARTED / — |
| **2 — C04: contracts and diagnostics** (medium) | F05, F16: request/response/command contracts, public snapshot allowlists, typed query factories, bounded JSON parsing, structured diagnostics and intended required CI checks | Built-in and custom content covered through real boundaries; explicit ownership and revocation preserved; logs identify request/room/revision and timing without credentials or submitted answers | NOT STARTED / — |
| **3 — C05: room costs** (medium) | F07–F08: encode once per role/revision, suppress unchanged broadcasts, avoid redundant established-player profile reads, instrument queue/DB/checkpoint costs | Equivalent 30/60-player comparisons; immediate acknowledgements and phase transitions, reconnect, moderation, expiry and saved clocks preserved | NOT STARTED / — |
| **3 — C06: data costs** (larger) | F06, F08–F09: durable evidence projection, affected-quest evaluation, indexed evidence/levels, bounded history, SQL aggregates and measured indexes | Populated guild fixtures plus fault/retry and cross-room reward tests; no lost evidence or duplicate awards; query plans justify indexes; read/query/payload costs recorded | NOT STARTED / — |
| **4 — C07: initial loading** (medium) | F10, F12: lazy route/editor loading, loading/error boundaries, summary list DTOs and focused live-session polling | Proposed target: at least 40% less initial login gzip JS against the same build baseline; teacher editing and student math entry pass after deferred loading | NOT STARTED / — |
| **4 — C08: battlefield rendering** (medium) | F11–F12: display/DPR-sized avatars, byte-bounded composition cache, isolated countdown subscriptions and stable battlefield props | Proposed target: at least 80% less canvas backing allocation; 30/60 distinct avatars, visual comparison and Chromebook responsiveness verified | NOT STARTED / — |
| **5 — C09: API and services** (larger) | F13–F14: split guild/quest/equipment/reward/reporting routes and services; independent domain contracts | Same API behavior, explicit tenant/owner checks, atomic awards and failure paths; one coherent responsibility per extraction | NOT STARTED / — |
| **5 — C10: combat modules** (larger) | F13–F14: separate phase transitions, abilities, damage/healing, command parsing, public projection and persistence effects | Same seeded input produces the same outcomes; one serial authority; durable receipts/retries and persisted-room compatibility preserved | NOT STARTED / — |
| **5 — C11: authoring and lobby UI** (larger) | F13–F14: extract question/CSV/enemy/loot authoring and loadout/avatar panels; remove verified unused helpers/types | Teacher workflow, saved drafts, gear and error recovery preserved; import/reference search before deletion; saved-room adapters retained until explicitly retired | NOT STARTED / — |
| **6 — C12: release review** (medium) | F16 and consolidation: full classroom acceptance, before/after report, commit-pinned releases, environment/fixture isolation and cleanup, recovery/rollback runbook | Exit gates below pass; exact CI/runtime/deploy/acceptance evidence recorded; current status and relevant specs updated | NOT STARTED / — |

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
