# Active work and interruption checkpoint

**CURRENT — October 12, 2026. C03 schema baseline registered; investigation starting.**

## C03 active checkpoint

- Branch: `cleanup/c03-schema-baseline`; draft [PR #58](https://github.com/Orsnoire/FightSchool/pull/58). Read its branch checkpoint for newer progress.
- Baseline: `bdad601`; C02 release handoff merged, no open PRs at start.
- Scope: F04 snapshots, schema declarations and handwritten SQL ownership. Preserve all applied SQL and current data.
- Gates: no-op generation, all migrations on a disposable database, existing-data preservation and catalog/schema comparison.
- Verification: not yet run for C03. No implementation or production database changes.
- Next: reproduce generation drift in a disposable copy, inventory schema ownership, reconcile declarations/snapshot and add regression gates.

The C02 release record below is historical context.

## Registered work

- No active implementation package. C01 and C02 are COMPLETE.
- [PR #56](https://github.com/Orsnoire/FightSchool/pull/56) merged; `cleanup/c02-dependencies` is historical, not a resume target.
- Deployed runtime: `5d89fb0bc4d160754ceb9645019f465809742ef2`; immutable Worker `81387a2a-9084-410f-b773-3726713f8544`.
- [Deployment 38270833735](https://github.com/Orsnoire/FightSchool/actions/runs/38270833735) and [canonical live acceptance 38271115093](https://github.com/Orsnoire/FightSchool/actions/runs/38271115093) passed.
- Updated typecheck, all 211 tests and both production builds pass; exact review-head CI and Chromebook/phone checks passed.
- [Advisory disposition](reviews/2026-10-12-dependency-triage.md): 32 → 12 entries; scoped build/CLI deferrals remain. Production-only audit reports 7 Tailwind peer-chain entries.
- [Release evidence](cloudflare/full-migration.md#c02-dependency-release--12-october-2026) separates reviewed, merged, deployed and accepted states.
- No gameplay, schema or shipped SQL-history changes. Preserve current students and live data.
- Documentation-only handoff: `release/c02-2026-10-12`; exact pushed SHA recorded in its PR.

## Exact next action

Fetch current main and inspect open PRs. If the release handoff PR remains open,
finish that existing documentation PR before starting another package. Then register
**C03 — schema baseline** with one branch and draft PR before substantive work.
Read AGENTS.md, Source_of_Truth.md and CLEANUP_PLAN.md. C03 must reconcile snapshots,
table declarations and intentional handwritten SQL without rewriting shipped history.
C03–C12 are NOT STARTED. Do not reopen C02 merely because an advisory is explicitly deferred.

## Historical C01 release record

## Completed implementation

Only the three C01 defects from the [review](reviews/2026-10-09-code-review.md):

1. **F01:** shared claim-item validation accepts registered built-in equipment IDs
   and custom UUIDs. Fight/result IDs remain UUID-only; earned-item checks,
   ownership and atomic reward SQL are unchanged.
2. **F02:** the student leaderboard sends the metric as a query parameter while
   retaining its guild/metric cache key. Leaderboard and guild metadata failures,
   including failed cached refreshes, show an accessible error and Retry action.
   Only successful empty responses show “No stats yet.”
3. **F03:** leaderboard accuracy is `100 * sum(correct) / sum(answered)`, with zero
   for no answers/history and fractional precision retained. Other metric sums,
   response aliases, rankings, guild/member scope and hidden-metric rules remain.

Dependency updates, schema generation repair, broad refactors and expansion
belong to later packages. No live data, schema, reward calculations or approved
combat/gameplay rules were changed. Deployment and acceptance evidence follows.

## Verification checkpoint

- **F01 baseline proof:** `1f2eaf418b4547578c758a437eefbe6bb423bfa9`
  intentionally fails two HTTP subcases on UUID-only claim validation. The fix
  `d24e934de770d41e3ca5619e720a5034ea9360e9` passed 194 tests/type/build and
  [CI 37949069416](https://github.com/Orsnoire/FightSchool/actions/runs/37949069416).
- **F02/F03 baseline proof:** `d6a699baec353a91217f212e9c21968fcd80f883`
  intentionally fails seven new subcases: the URL, four error/retry states,
  8/10 + 8/10 returning 160 rather than 80, and 1/1 + 1/9 returning 111.11 rather
  than 20. Five new subcases already pass; both parent tests also report failure.
- **Fixed boundary tests:** `node --import tsx --test tests/phase4/leaderboard-*.test.ts`
  passes all 14 tests (12 subcases plus two parents). The UI test bundles the real
  page/default query function. HTTP tests use signed sessions, real handlers and
  all 15 migrations in disposable PGlite; no production data is involved.
- **Full local gates:** `npm run check`, `npm test` (208 tests: 5 Phase 2, 7 Phase 3,
  191 Phase 4, 5 rich-content) and `npm run build` pass, with no failed/skipped
  tests. The full suite includes the F01 claim, reward and combat UI regressions.
- Existing Vite large-chunk warning remains C07 work. Local Node 24 reused the
  existing locked dependencies; GitHub CI verifies its fresh Node 22 install.
- **Reviewed head:** `b952894a1fd9e584f41018038765434d49981a41` passed
  [CI 37951053838](https://github.com/Orsnoire/FightSchool/actions/runs/37951053838)
  and [browser acceptance 37951054128](https://github.com/Orsnoire/FightSchool/actions/runs/37951054128).
- **Merged runtime:** `8bf9df71629c9ba8933b63a24ca5f35da655e3cc` passed
  [main CI 37956409540](https://github.com/Orsnoire/FightSchool/actions/runs/37956409540),
  [deployment 37956580253](https://github.com/Orsnoire/FightSchool/actions/runs/37956580253)
  and [canonical live acceptance 37956888302](https://github.com/Orsnoire/FightSchool/actions/runs/37956888302).
  Both hostname smoke checks passed; the live run covered combat/economy, R2,
  30 participants, reconnects, isolation, moderation and idempotent rewards.
- **Yesterday's queue:** all October 8 merged PRs (#37–50 and #52) were already
  ancestors of the verified October 8 runtime `e158194`; this release includes
  them. No separate older open PR or undeployed merged runtime change remained.

## Resume and handoff checklist

1. Read current `main`'s `AGENTS.md`, this discovery pointer and the active branch
   copy. Verify PR state, branch head, CI and any newer commits.
2. Inspect the local working tree. Preserve unrelated or unpublished work; do not
   reset it. Resume the registered branch. If it is missing or closed, inspect
   merge/supersession history and update the record before creating a replacement.
3. Check scope and the next action. A passing baseline suite does not prove a new
   fix; unfinished or failing checks stay explicit.
4. After a coherent change, update this file, commit and push. Verify the remote
   SHA and update the PR checkpoint with that SHA, test results and next action.
   Incomplete draft checkpoints may be pushed with failures clearly recorded.
5. At package completion, update the cleanup table and main discovery pointer.
   Record merge and deployment separately; do not reuse an old feature branch or
   infer that another package started merely because it is next in the plan.

## Parallel HP preview — owner-authorized October 12, 2026

- Separate branch: `fix/waiting-room-hp-preview`; draft PR registration in progress.
- Baseline: `72b945d265a2b95db396a057957a2401ab95f1d4` from main.
- Scope: genuine waiting-room HP using the same calculation as Start Fight, recalculated from the joined roster; estimated labels and no numeric HP for empty rooms.
- C03 remains on `cleanup/c03-schema-baseline` / PR #58. Do not alter its schema, migrations, package files or checkpoint section.
- Verification: registration only; no implementation yet.
- Next: add preview projection and display tests, implement, verify and publish this separate PR. Merge/deployment are not part of this task.
- This explicitly requested parallel fix is an exception to the cleanup-first queue, not another cleanup package.
