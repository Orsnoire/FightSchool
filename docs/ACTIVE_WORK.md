# Active work and interruption checkpoint

**CURRENT — October 12, 2026. C02 implemented; final CI/browser and review pending.**

## Registered work

- Package: C02 dependency triage (F15), only active cleanup package.
- Branch: `cleanup/c02-dependencies`; [draft PR #56](https://github.com/Orsnoire/FightSchool/pull/56).
- Baseline: `af8d389`, C01 handoff merged. C01 remains the deployed runtime.
- Completed: editor/math updates, compatible ORM/Vite/transitive updates, duplicate underline registration fix, security/paste/undo tests, dependency-only browser CI triggers.
- [Version and advisory disposition](reviews/2026-10-12-dependency-triage.md): 32 → 12 entries; remaining build/CLI chains explicitly deferred. Production-only audit still reports 7 Tailwind-chain entries; not a clean audit.
- Local verification: baseline 208 tests; updated typecheck, all 211 tests and both production builds pass. Disposable-database auth/SQL/migration preservation gates included.
- Local browser download returned invalid ZIPs; GitHub browser acceptance is required. Final exact-head CI/browser results pending.
- No schema/history/gameplay change; nothing from C02 merged or deployed. C03–C12 unstarted.
- Main discovery pointer write was rejected by automatic approval review; authorization covers feature branch/draft PR. This branch and PR are the current checkpoint. Main pointer remains C01 until approved publication/merge.
- Next: inspect final pushed SHA’s CI and browser acceptance; fix failures on this branch, then request review/merge authorization. Never treat passing local tests as live release evidence.

Exact pushed SHA is in the PR description (a commit cannot contain its own hash).
Verify the remote head before resuming and preserve unexpected new changes.

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
