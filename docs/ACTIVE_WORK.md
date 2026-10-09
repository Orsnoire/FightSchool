# Active work and interruption checkpoint

**CURRENT — October 9, 2026. C01 implementation verified locally; awaiting PR checks/review.**

Read this file on `main` to find the active package, then read the same file on
its registered branch and inspect the live PR. Branch progress can be newer than
this discovery pointer. Follow [AGENTS.md](../AGENTS.md#start-or-resume-work) before
editing. The [cleanup plan](CLEANUP_PLAN.md) controls scope; the
[current status](CURRENT_STATUS.md) controls release reporting.

## Registered work

| Field | Checkpoint |
| --- | --- |
| Active package | **C01 — correctness**, the only active cleanup package |
| Current stage | F01–F03 implemented and locally verified; exact-head CI/review recorded in PR #53; not merged or deployed |
| Owner / execution lane | QuestAcademy cleanup session; resume this registered work, do not create another implementation |
| Canonical branch | [`cleanup/c01-correctness`](https://github.com/Orsnoire/FightSchool/tree/cleanup/c01-correctness) |
| Draft PR | [#53 — C01 correctness](https://github.com/Orsnoire/FightSchool/pull/53); continue this PR |
| Starting main | `117373252e81721342d0faa483d2cf54eeeda874`; includes merged kickoff PR #54 at `3b490b391df4a3ec6d1d69d44346b8ccb153390a` |
| Last verified implementation | This commit: local type check, 208 tests and production build pass; exact pushed SHA and CI are in the live PR |
| Latest pushed checkpoint | Read the registered PR's live head SHA and checkpoint section; update that section after every push |
| Deployed runtime | `e1581948f6623d86af859452bf083ca0f35db681`; none of C01 is merged or deployed |
| Other packages | C02–C12 not started; register C02 only after C01 closes and its handoff is updated |

A commit cannot contain its own SHA. The PR description records the exact pushed
SHA after publication; this file records the work and next action contained in
the commit. Verify the remote head rather than trusting a stale copied SHA. If
the two differ, inspect the newer commits and update the handoff before editing.

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
combat/gameplay rules were changed. Local correctness is not release evidence.

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
- The live PR records CI and triggered browser acceptance for the exact pushed
  SHA. Local checks do not claim those remote workflows have completed.

## Exact next action

Fetch the registered branch and current main, reconcile this checkpoint with
newer commits and the live PR, and inspect all checks for the exact current head.
Resolve any remaining failure on this branch. Review the complete C01 diff and
record its merge/release disposition; no F01–F03 implementation remains queued.

Keep C01 active until that review/release handoff is resolved. Merge, deployment
and live acceptance are separate states and have not occurred for C01. On
completion, update the main discovery pointer/current status and cleanup table,
then register C02 (dependency triage) before substantive work. Do not start a
competing correctness branch or mark live defects fixed based on this draft.

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
