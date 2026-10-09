# Active work and interruption checkpoint

**CURRENT — October 9, 2026. Phase 1 has started with the resume safeguard.**

Read this file on `main` to find the active package, then read the same file on
its registered branch and inspect the live PR. Branch progress can be newer than
this discovery pointer. Follow [AGENTS.md](../AGENTS.md#start-or-resume-work) before
editing. The [cleanup plan](CLEANUP_PLAN.md) controls scope; the
[current status](CURRENT_STATUS.md) controls release reporting.

## Registered work

| Field | Checkpoint |
| --- | --- |
| Active package | **C01 — correctness**, reserved as the only active cleanup package |
| Current stage | Phase 1 first step COMPLETE; F01 HTTP regression reproduced, validator fix next |
| Owner / execution lane | QuestAcademy cleanup session; resume this registered work, do not create another implementation |
| Canonical branch | [`cleanup/c01-correctness`](https://github.com/Orsnoire/FightSchool/tree/cleanup/c01-correctness) |
| Draft PR | [#53 — C01 correctness (DRAFT)](https://github.com/Orsnoire/FightSchool/pull/53); continue this PR |
| Starting main | `117373252e81721342d0faa483d2cf54eeeda874` (merged documentation reconciliation) |
| Last verified draft checkpoint | `45ed2e5333b40f8300c9c764af204d69a358047b` — documentation checkpoint, CI 37945619623 passed; inspect the live PR for newer commits |
| Latest pushed checkpoint | Read the registered PR's live head SHA and its checkpoint section; update that section after every push |
| Deployed runtime | `e1581948f6623d86af859452bf083ca0f35db681`; the kickoff does not change the live application |
| Other packages | C02–C12 not started; do not begin another package while C01 is active |

A commit cannot contain its own SHA. The PR description records the exact pushed
SHA after publication; this file records the work and next action contained in
the commit. Verify the remote head rather than trusting a stale copied SHA. If
the two differ, inspect the newer commits and update the handoff before editing.

## Scope and unfinished work

Only the three C01 defects from the [review](reviews/2026-10-09-code-review.md):

1. **F01:** built-in Tier 1 loot IDs fail UUID-only claim-route validation. Cover
   registered built-in and custom IDs, ownership/earned-item checks and replay.
2. **F02:** the student leaderboard builds a path from its metric cache key instead
   of using the route's query parameter. Correct the URL and expose load errors.
3. **F03:** accuracy sums fight percentages. Use question-weighted totals with
   zero-answer and unequal-size-fight coverage.

Dependency updates, schema generation repair, broad refactors and expansion
belong to later packages. Preserve live students, inventory, reward receipts and
approved gameplay. The review reproductions are findings, not completed fixes.

## Verification checkpoint

- Starting main `1173732`: [CI 37944238703](https://github.com/Orsnoire/FightSchool/actions/runs/37944238703)
  passed type checking, the 186-test suite and production build.
- Kickoff: 254 relative documentation links and diff scope verified; the resume
  rules and C01 registration are the first Phase 1 step. Its documentation PR
  records CI before merge; subsequent C01 checks belong to PR #53.
- F01 regression: `node --import tsx --test tests/phase4/reward-claim-http.test.ts`
  has two expected failing subcases on the unchanged runtime: built-in claims
  return 400, and registered but unearned built-ins never reach earned-loot
  validation. Five subcases pass (custom UUID/retry, ownership, ineligible
  results, gold/legacy result ID, and simultaneous claims). The parent test also
  reports failure. This is an intentionally failing draft checkpoint.
- The test uses the real HTTP handler, signed sessions, all 15 migrations and
  atomic reward SQL in disposable PGlite. No live data or schema is changed.
- Remaining: fix F01 and verify the full suite, then reproduce and fix F02/F03.

## C01 branch checkpoint

This is the registered C01 draft workspace. The resume protocol is COMPLETE in
[merged kickoff PR #54](https://github.com/Orsnoire/FightSchool/pull/54), main commit
`3b490b391df4a3ec6d1d69d44346b8ccb153390a`. Its exact-head
[CI 37945475536](https://github.com/Orsnoire/FightSchool/actions/runs/37945475536) passed.
This branch includes that main commit. The new F01 regression is intentionally
failing against unchanged runtime code. F02/F03 remain pending in this same PR.

## Exact next action

Fetch `cleanup/c01-correctness` / PR #53 and current `main`, reconcile this
checkpoint with the live PR head and any newer branch commits, then fix the
claim-route item ID contract to accept registered built-in IDs and custom UUIDs.
Retain UUID-only fight/result IDs and repository ownership, earned-loot and
replay checks. Make the published regression pass, run the C01 verification
gates and checkpoint the result before beginning F02/F03 in this same PR.

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
