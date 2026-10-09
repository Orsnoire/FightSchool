# Active work and interruption checkpoint

**CURRENT — October 9, 2026. C01 COMPLETE: merged, deployed and accepted. C02 next, not started.**

Read this file on `main` to find the active package, then read the same file on
its registered branch and inspect the live PR. Branch progress can be newer than
this discovery pointer. Follow [AGENTS.md](../AGENTS.md#start-or-resume-work) before
editing. The [cleanup plan](CLEANUP_PLAN.md) controls scope; the
[current status](CURRENT_STATUS.md) controls release reporting.

## Registered work

| Field | Checkpoint |
| --- | --- |
| Active package | **None. C01 is COMPLETE; C02 is next and NOT STARTED.** |
| C01 disposition | F01–F03 implemented, reviewed, merged, deployed and accepted on the canonical domain |
| Completed PR / branch | [#53 — C01 correctness](https://github.com/Orsnoire/FightSchool/pull/53), merged; `cleanup/c01-correctness` is historical, not a resume target |
| Deployed runtime | `8bf9df71629c9ba8933b63a24ca5f35da655e3cc`, PR #53 merge |
| Immutable Worker | `68cf4f65-c163-4018-ad6f-a718489dbb46`, published October 9 at 16:07:27 UTC |
| Release handoff | `release/c01-2026-10-09` records this documentation-only checkpoint; inspect its PR state if interrupted during publication |
| Release evidence | [C01 release record](cloudflare/full-migration.md#c01-correctness-release--9-october-2026) |
| Other packages | C02–C12 not started; register C02 before dependency implementation |

A commit cannot contain its own SHA. The handoff PR description records its exact
pushed SHA; this file records the work and next action contained in that commit.
Verify the remote head and PR state rather than trusting a stale copied SHA.
If they differ, inspect newer commits and reconcile before editing.

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

## Exact next action

Fetch current `main`, check for newer commits and open PRs, and verify this release
handoff is merged. If publication was interrupted, resume the existing
`release/c01-2026-10-09` documentation PR before starting another branch.

For the next implementation session, register **C02 — dependency triage** with
one branch and draft PR, and publish that claim in this checkpoint before
substantive dependency changes. Follow the C02 scope and exit gates in the
cleanup plan. C02 is not started by this release; do not reopen C01 or combine
schema repair, broad refactors or expansion with dependency maintenance.

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
