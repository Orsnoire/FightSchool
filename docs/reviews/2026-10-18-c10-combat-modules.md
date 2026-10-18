# C10 — combat modules

## Scope and publication

C10 / F13–F14 is implemented in [draft PR #73](https://github.com/Orsnoire/FightSchool/pull/73), branch `cleanup/c10-combat-modules`. Work started from main `33e692ff055be47b0f8411d4a0d40d3e7ab3d0e7` after verifying no C10 branch or open PR. The claim/draft and main discovery pointer were published before substantive code changes. Claim, frozen baseline, engine extraction and room extraction were published as separate recoverable checkpoints.

Implementation revision: `92bbbca579e6db2899bd119c269a7864c13b3d87`. The final documentation checkpoint retains this runtime. The live PR records the newest pushed SHA and its exact-head checks. **Not merged, deployed or live-accepted.** C09 remains the released runtime `9efcfeada5a64e0ff115dd64430df4c255f4e479`. No migration, SQL/reward-procedure change, saved-room version bump or production-data reset.

## Changes

The engine now has explicit owners for phase orchestration, ability execution, damage/healing, encounter setup, participation, choices, host controls, state events and persisted randomness. The existing engine entry point remains compatible. Internal modules import owners directly. An AST comparison against the pinned baseline found all **31 original engine function bodies unchanged**; the runtime import graph among combat modules has no cycles.

Command frame/JSON/schema decoding and atomic student rule application are separated from socket authority and durable receipts. Safe public room messages retain role/phase allowlists. Saving, reporting/evidence outboxes, result completion and alarm policy use explicit effect callbacks. The Durable Object retains the sole serial queue, authentication/revocation, rate/round/deadline checks, moderation, checkpoints and socket delivery. Both saved-room adapters remain in place, including completed legacy rooms' reward-ineligible treatment. No background queue or independent scheduler is introduced.

See the [module ownership map](../combat/modules.md). The change is architectural; line counts show ownership boundaries, not a claimed performance improvement.

| Check | Before C10 | After C10 |
| --- | --- | --- |
| Central engine entry point | 1,363 lines | 9-line compatible facade |
| Durable Object coordinator | 893 lines | 689 lines; extracted effects/decoding/recovery/messages |
| Frozen replay | Captured on unchanged main | All 80 scenarios / 1,813 steps identical |
| Existing engine function bodies | 31 | All 31 unchanged |
| Automated tests | 289 | 298 pass |
| Worker bundle, esbuild display | 907.5 KiB | 908.6 KiB |

## Verification

Local `npm run check`, `npm test`, `npm run build` and `git diff --check` pass. Test breakdown: phase 2 **5**, phase 3 **7**, phase 4 **279**, rich content **7**. The existing populated-guild, C06 cost limits, atomic reward/stamina and cross-room retry tests pass. In particular, `data-costs.test.ts` loses the SQL acknowledgement after a committed combat award, retries both rooms, and checks that rewards remain unchanged on further retries.

Two new frozen replay tests cover every unlocked ability and three seeds across 1/7/30 participants: repeated rounds, missing/wrong/correct answers, resource spending, phase clocks, queued entry, departure/rejoin, host elimination, events and public projections. The second test crosses JSON storage after every operation. Expected output was captured and committed **before** runtime extraction, not regenerated afterward.

Seven new room-boundary tests cover:

- UTF-8 frame limits, invalid commands and atomic action/ready selection.
- Storage failure before command persistence: no acknowledgement or reporting write, followed by serialized simultaneous retries after restoration.
- Result SQL success followed by storage failure: recreated-object retry, retained command receipts and no premature results or duplicate simulated award.
- The legacy adapter preserving answers, HP/MP, threat and clocks; completed legacy rooms cannot replay rewards.
- Version-2 recovery preserving queued/departed players, receipts, playback and reporting/evidence outboxes.
- Public question/result/moderation secrecy by phase and role.
- The bundled rule engine having no runtime room, transport, authentication, route or database implementation dependencies.

The result-checkpoint failure test uses a receipt-aware repository double to verify orchestration; SQL atomicity itself is established by the separate existing migrated PGlite tests. Existing playback, reporting failure, restored Priest actions, revocation, host moderation, duplicate delivery and classroom batching gates continue to pass.

GitHub verification **passes** on the implementation revision: [CI 39130097869](https://github.com/Orsnoire/FightSchool/actions/runs/39130097869) and all three jobs in [Chromium 39130097749](https://github.com/Orsnoire/FightSchool/actions/runs/39130097749): combat UI, initial loading and battlefield rendering. Exact-head results for the final documentation publication are tracked in the live PR.

## Reproduction

```sh
npm run check
npm test
npm run build
node --import tsx --test tests/phase4/combat-replay.test.ts tests/phase4/combat-room-boundaries.test.ts
```

The golden JSON stores SHA-256 hashes of ordered per-step persisted-state/projection hashes, phase, round and seed. Inputs and clocks are fixed in `combat-replay-fixture.ts`; the source main SHA is recorded in the fixture. To independently recapture, use a separate checkout of `33e692ff055be47b0f8411d4a0d40d3e7ab3d0e7`, copy only that helper there, and call `combatReplayTraces()` with the same dependencies. Do not regenerate expected values from the refactored engine. Targeted ability/status/wave tests remain the readable rule assertions; these hashes detect changes across complete traces.

The 31-function audit compares TypeScript AST function-body text from baseline `worker/combat/engine.ts` against each function's new module. Type-only imports are excluded when checking runtime cycles. No gameplay helper or saved-room adapter was deleted; the unused-helper retirement portion of F14 remains in C11.

## Limits and next action

These checks establish regression parity and fault handling in local/migrated fixtures and CI browsers. They do not establish production performance, actual Cloudflare eviction/rollback recovery or physical Chromebook behavior. C08 observation limitations and C12 infrastructure/fixture-isolation/recovery drills remain open.

Review PR #73. Merge and deployment await a separate owner request. C11 is the next unstarted package and must be registered before implementation; do not begin another cleanup package while C10 remains the active draft.
