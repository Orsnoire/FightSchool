# Active work and interruption checkpoint

**CURRENT — October 9, 2026. C01 in progress; F01 verified; F02/F03 regressions reproduced.**

Read this file on `main` to find the active package, then read the same file on
its registered branch and inspect the live PR. Branch progress can be newer than
this discovery pointer. Follow [AGENTS.md](../AGENTS.md#start-or-resume-work) before
editing. The [cleanup plan](CLEANUP_PLAN.md) controls scope; the
[current status](CURRENT_STATUS.md) controls release reporting.

## Registered work

| Field | Checkpoint |
| --- | --- |
| Active package | **C01 — correctness**, reserved as the only active cleanup package |
| Current stage | Phase 1 first step COMPLETE; F01 verified in CI; F02/F03 failing regressions published, fixes next |
| Owner / execution lane | QuestAcademy cleanup session; resume this registered work, do not create another implementation |
| Canonical branch | [`cleanup/c01-correctness`](https://github.com/Orsnoire/FightSchool/tree/cleanup/c01-correctness) |
| Draft PR | [#53 — C01 correctness (DRAFT)](https://github.com/Orsnoire/FightSchool/pull/53); continue this PR |
| Starting main | `117373252e81721342d0faa483d2cf54eeeda874` (merged documentation reconciliation) |
| Last verified draft checkpoint | F01 `d24e934de770d41e3ca5619e720a5034ea9360e9`; 194 tests/type check/build and CI 37949069416 passed; this later checkpoint intentionally adds failing F02/F03 regressions |
| Latest pushed checkpoint | Read the registered PR's live head SHA and its checkpoint section; update that section after every push |
| Deployed runtime | `e1581948f6623d86af859452bf083ca0f35db681`; F01 is not merged or deployed |
| Other packages | C02–C12 not started; do not begin another package while C01 is active |

A commit cannot contain its own SHA. The PR description records the exact pushed
SHA after publication; this file records the work and next action contained in
the commit. Verify the remote head rather than trusting a stale copied SHA. If
the two differ, inspect the newer commits and update the handoff before editing.

## Scope and unfinished work

Only the three C01 defects from the [review](reviews/2026-10-09-code-review.md):

1. **F01 — implemented and locally verified:** claim-route validation accepts
   registered built-in equipment IDs and custom UUIDs through a shared schema.
   Fight/result IDs remain UUID-only; ownership, earned-item checks and atomic
   reward SQL are unchanged. Not merged or deployed.
2. **F02:** the student leaderboard builds a path from its metric cache key instead
   of using the route's query parameter. Correct the URL and expose load errors.
3. **F03:** accuracy sums fight percentages. Use question-weighted totals with
   zero-answer and unequal-size-fight coverage.

Dependency updates, schema generation repair, broad refactors and expansion
belong to later packages. Preserve live students, inventory, reward receipts and
approved gameplay. The review reproductions are findings, not completed fixes.

## Verification checkpoint

- Baseline proof: commit `1f2eaf418b4547578c758a437eefbe6bb423bfa9`
  intentionally fails two HTTP subcases against unchanged runtime: earned
  built-ins are rejected, and valid unearned built-ins never reach earned-loot
  validation. Five other subcases pass; the parent also reports failure.
- F01 fix: `node --import tsx --test tests/phase4/reward-claim-http.test.ts
  tests/phase4/tier-one-rewards.test.ts tests/phase4/combat-overlay.test.ts
  tests/phase4/loot-reward-choices.test.ts` passes all 11 tests. The new HTTP
  regression passes all seven subcases (eight tests counting its parent).
- Full local gates: `npm run check`, `npm test` (194 tests: 5 Phase 2, 7 Phase 3,
  177 Phase 4, 5 rich-content), and `npm run build` all pass. Existing Vite large
  chunk warning remains assigned to C07. Local Node 24 uses the existing locked
  dependencies; GitHub CI verifies a fresh install on its configured Node 22.
- The HTTP regression uses signed sessions, all 15 migrations and real atomic
  reward SQL in disposable PGlite. It covers custom UUIDs, all four built-in
  fallback choices, invalid/unearned/prototype-property IDs, student and
  fight/result scope, ineligible results, gold, retries and simultaneous claims.
- No production data, migration, reward calculation, or gameplay changes. CI
  for this pushed commit is recorded in the live PR; local checks are not a
  claim that CI has completed.

## C01 branch checkpoint

Resume safeguards from merged PR #54 are included. F01 is verified at
`d24e934de770d41e3ca5619e720a5034ea9360e9` by
[CI 37949069416](https://github.com/Orsnoire/FightSchool/actions/runs/37949069416).

This checkpoint adds `leaderboard-http.test.ts` and `leaderboard-ui.test.ts`.
Running both with `node --import tsx --test tests/phase4/leaderboard-*.test.ts`
against unchanged leaderboard code yields seven expected failing subcases and
five passing subcases (the two parents also fail):

- UI failures: path instead of metric query parameter, invisible 403/503 errors,
  guild metadata failure misreported as missing, and failed cached refresh.
- HTTP failures: 8/10 + 8/10 yields 160 rather than 80; 1/1 + 1/9 yields 111.11
  rather than 20. Zero/no-history and fractional results already pass.
- Guild/member scope, additive metrics and response aliases, ordering,
  authentication, teacher ownership and hidden metric permissions already pass.

The UI test bundles the actual page/default query function and supplies HTTP
responses. The HTTP test runs the real handler against all 15 migrations in a
disposable PGlite database with signed sessions. No live data is used.
This is an intentionally failing draft checkpoint, not a completed C01 package.

## Exact next action

Fetch the registered branch and main, inspect the live PR head/CI and any newer
commits, then fix F02's explicit query-parameter URL and visible retriable errors
without changing the metric-specific cache key. Fix F03 with
`100 * sum(correct) / sum(answered)` and zero when unanswered; preserve all
other metric aliases, guild/member visibility and response fields. Make the new
boundary regressions pass, then run full type/test/build and CI gates. Keep this
work in PR #53 and update current docs before marking C01 implementation verified.

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
