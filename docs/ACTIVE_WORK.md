# Active work and interruption checkpoint

**CURRENT — October 12, 2026. C04 COMPLETE: merged, deployed and accepted.**

## C04 release checkpoint

- [PR #60](https://github.com/Orsnoire/FightSchool/pull/60) merged as `097081c11692c3526714d34628a29b0b0f28815c`; follow-up [PR #62](https://github.com/Orsnoire/FightSchool/pull/62) merged as `a2f13673de9bccbf044ef27f67a96fa4adf2431a`, with owner authorization to merge and deploy.
- Original verified head `84ce8e87983ebd49c69bac9dea33f0b212b20a93` passed CI 38283049347/browser 38283049357. Follow-up head `5fdfe6c2f2e6d0ca715335e2a2e3538e8fb7dc54` passed all 224 tests, typecheck and builds plus CI 38284897429/browser 38284897183. Merged-main CI 38285235793 passed.
- Implemented F05/F16: shared authoring/command/JSON DTO contracts, explicit public projections, typed query factories, bounded UTF-8 JSON and redacted diagnostics. Ownership, revocation, saved rooms, rewards and gameplay remain covered.
- First deployment 38284111710 passed smoke, but live acceptance 38284362252 caught host-launch 503 from immutable Durable Object response headers. Published baseline `13b8bcc` reproduced it. PR #62 copies HTTP responses before adding request IDs and preserves WebSocket upgrades.
- Corrected [deployment 38285264787](https://github.com/Orsnoire/FightSchool/actions/runs/38285264787) passed on exact checkout `a2f13673de9bccbf044ef27f67a96fa4adf2431a`: all 224 tests, typecheck, builds, R2, existing migration gate and both hostnames.
- Deployed Worker: `94a6a8f1-462d-4b1c-98c1-365de92066f1`, published October 12 at 17:37:35 UTC. No new SQL migration or live-data reset.
- [Canonical live acceptance 38285499681](https://github.com/Orsnoire/FightSchool/actions/runs/38285499681) passed on the same checkout: combat/economy, R2, 30 participants, reconnects, room isolation, moderation, revocation and exactly-once rewards.
- [Contract ownership, limits and intended CI policy](cloudflare/contracts-and-diagnostics.md). Both intended required checks run on every PR; main remains unprotected, so administrative enforcement is not claimed.
- C05 is next and not started; register it before implementation. Preserve separate PR #61 below; its code is not included in this release. Both C04 implementation branches are historical. No cleanup implementation package is active.

## PR #61 — authorized merge and deployment in progress

- Branch: `feat/swarm-party-count`; [PR #61](https://github.com/Orsnoire/FightSchool/pull/61), ready for review at `8d78de7ef593e9812e833950d282c7395488c178`.
- Implemented: optional swarm batches at 8/12/16 players, exact waiting count/HP preview, previous-tier reference gear, teacher **Next wave** override and enemy elimination ×.
- Integrated C04 merge `097081c` without restoring duplicate contracts. Public wave mode, authenticated host commands, stale-phase guards and durable retries are covered.
- Verified: all 238 tests, typecheck and both builds; [CI 38284666305](https://github.com/Orsnoire/FightSchool/actions/runs/38284666305) and [browser acceptance 38284666286](https://github.com/Orsnoire/FightSchool/actions/runs/38284666286) passed on that head.
- Owner authorized merge and deployment on October 12. Integrated current main `87d45a5`, including the released PR #62 response-forwarding fix and C04 release records; merge was clean. Combined-revision CI/browser checks are pending; exact head/results are recorded in the PR. Next: pass those gates, merge, deploy the merged revision and run canonical live acceptance. No SQL migration or live-data reset.
- The older swarm section below is superseded by this pointer and the PR's verified checkpoint.


The records below are historical.

## C03 completion checkpoint

- [PR #58](https://github.com/Orsnoire/FightSchool/pull/58) merged with owner approval at `6f01fdd087fc651a8650ac08dc39ad7a541bfbd0`.
- Verified head: `cd34f1a90a7330c5386f8fcba235a539abea0ac2`; [CI 38273784877](https://github.com/Orsnoire/FightSchool/actions/runs/38273784877) passed.
- All 214 tests, typecheck and client/Worker builds passed, including existing-data preservation.
- No-op generation writes no files; all 27 tables/246 columns match the migrated PostgreSQL catalog. Shipped SQL hashes and journal entries are unchanged.
- [Schema ownership and future migration workflow](cloudflare/schema-baseline.md) documents the repaired 0014 snapshot and SQL-owned reward functions.
- This is a tooling/declaration repair with no new SQL migration. No production database operation or deployment was performed during the C03 task. C03 is included in the later HP preview deployment below; the existing migrator passed with no new SQL.
- `cleanup/c03-schema-baseline` is now historical. C04 is active above.
- At C03 closeout C04 was next; it is now active above. Check current main and open PRs, then register its branch/PR before implementation; preserve any separately authorized work.

The C02 release record below is historical context.

## Historical C02 registered work

- At C02 closeout there was no active package. C03 completion is recorded above.
- [PR #56](https://github.com/Orsnoire/FightSchool/pull/56) merged; `cleanup/c02-dependencies` is historical, not a resume target.
- Deployed runtime: `5d89fb0bc4d160754ceb9645019f465809742ef2`; immutable Worker `81387a2a-9084-410f-b773-3726713f8544`.
- [Deployment 38270833735](https://github.com/Orsnoire/FightSchool/actions/runs/38270833735) and [canonical live acceptance 38271115093](https://github.com/Orsnoire/FightSchool/actions/runs/38271115093) passed.
- Updated typecheck, all 211 tests and both production builds pass; exact review-head CI and Chromebook/phone checks passed.
- [Advisory disposition](reviews/2026-10-12-dependency-triage.md): 32 → 12 entries; scoped build/CLI deferrals remain. Production-only audit reports 7 Tailwind peer-chain entries.
- [Release evidence](cloudflare/full-migration.md#c02-dependency-release--12-october-2026) separates reviewed, merged, deployed and accepted states.
- No gameplay, schema or shipped SQL-history changes. Preserve current students and live data.
- Documentation-only handoff: `release/c02-2026-10-12`; exact pushed SHA recorded in its PR.

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

## HP preview — deployed and accepted October 12, 2026

- [PR #59](https://github.com/Orsnoire/FightSchool/pull/59) reviewed with no blocking findings and merged as `02392ef1c6fb6978a6602e470a336290a6886193`.
- Reviewed head: `13713d5b13feea53d728e42155ab378df9faa7a1`; branch `fix/waiting-room-hp-preview` is now historical.
- Implemented: read-only enemy HP preview using the real Start Fight calculator; joins/leaves and reconnects refresh estimates; empty rooms show Waiting for players. Actual combat balance is preserved.
- Verification: original 215 tests, typecheck and both production builds passed; review against merged C03 also passed all 218 tests, typecheck and both builds. CI 38274186846 and browser acceptance 38274186815 passed on the reviewed head.
- C03 / PR #58 and its completion record are preserved. The two PRs merged cleanly; no schema, migration or dependency changes were introduced by #59.
- Owner explicitly authorized deployment after review/merge. Deployed checkout: `274dbfe1d29dcb8897b675e85a3edb0343866f0c`; immutable Worker `50f91c4d-1cdb-4b04-bf69-8f3c715eff82`, published at 16:13:11 UTC.
- [Deployment 38275647965](https://github.com/Orsnoire/FightSchool/actions/runs/38275647965) passed: all 218 tests, typecheck, both builds, R2, existing migration gate and both hostname smoke checks.
- [Canonical live acceptance 38275889570](https://github.com/Orsnoire/FightSchool/actions/runs/38275889570) passed on the same checkout, including combat/economy, R2, 30 participants, reconnects, room isolation, moderation and exactly-once rewards.
- Status: complete, merged, deployed and accepted. C04 is now registered above. C04 sequencing remains governed by the cleanup checkpoint above.

## Swarm count scaling — separate feature work

- Owner request, October 12: optional Swarm control per enemy group, adding a configurable x enemies at 8, 12, 16, etc. players. Base count through 7 players.
- Branch: `feat/swarm-party-count`; [draft PR #61](https://github.com/Orsnoire/FightSchool/pull/61). C04 / PR #60 is merged; its contracts and diagnostics are preserved.
- Counts and HP preview follow the joined waiting roster; counts lock at Start Fight. Existing late-entry HP budgeting remains in effect.
- Preserve fixed quantities when disabled, species behavior, waves, individual IDs and current data. Store the optional setting in existing enemy JSON; no SQL migration.
- Retain 60 enemies per group and 120 per encounter. Reserve authored counts first, then distribute capped additions fairly in author order.
- Implemented: editor enable/increment/save/reload, shared bounded count calculation, API validation, waiting preview/start equality and locked active counts.
- Owner added previous-tier reference gear: tier 1 uses real tier 0 starter sets; tier 2 full tier 1; later provisional gear estimates shift down one tier. Character level midpoints remain 2/6/9/13. Solo/duo entry-loadout budgeting is unchanged.
- Verification: 12 focused tests pass, including real mounted editor and Durable Object join/leave/reconnect/start. Swarm baseline failed 3/4 new checks; reference-gear baseline failed both new checks. Full pre-integration suite (231 tests), typecheck and both builds pass; final stale-phase guard also passes its 4 targeted tests.
- Owner corrected the new control to Next wave, not Next phase. Implemented teacher-only wave skip/start with confirmation when living enemies remain, and enemy elimination × with matching hover/focus/touch affordances. Existing phase advance remains available.
- Host controls: all 5 focused checks pass, including stale-round/ownership/revocation/retry checks, wave selection, status release, no fabricated player credit, victory and exactly-once result persistence. C04 / PR #60 has merged as `097081c11692c3526714d34628a29b0b0f28815c`. Integrated main `097081c` with shared fight/command contracts and structured rule errors. Added `encounterRules` to the public allowlist so wave UI and active enemy selection survive the refactor. Integrated typecheck and client/Worker builds pass; 19 focused checks pass. Full suite and browser acceptance pending final verification. Next: verify exact-head CI/browser and mark ready for review. Not merged or deployed.
