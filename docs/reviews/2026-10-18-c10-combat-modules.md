# C10 — combat modules

## Scope and baseline

Claimed October 18, 2026 from main `33e692ff055be47b0f8411d4a0d40d3e7ab3d0e7`, after verifying no active C10 branch or open PR. C09 runtime `9efcfeada5a64e0ff115dd64430df4c255f4e479` is released and accepted. Implementation branch: `cleanup/c10-combat-modules`.

C10 addresses F13–F14: phase transitions, ability execution, damage/healing, command parsing, public projection and persistence effects. Preserve existing gameplay and random call order, a single serialized Durable Object authority, checkpoint-before-publication, atomic SQL rewards, durable retries and saved-room compatibility. No migrations or production-data reset. C11 and C12 are separate packages.

## Checkpoint

Published draft PR #73 and main discovery pointer. Baseline: 289 existing tests pass. Before runtime edits, captured 80 scenarios / 1,813 state and public-projection steps: every unlocked ability, three seeds across 1/7/30 participants, repeated rounds, missing/wrong/correct answers, queued entry, departure/rejoin and host elimination. Both frozen replay tests pass, including JSON recovery after every operation. Runtime extraction, fault/retry additions and final CI remain pending. Not merged or deployed.

## Verification plan

Capture deterministic multi-round traces from the unchanged engine before extraction. Compare complete persisted state and public projections across normal execution and JSON recovery. Retain the existing ability/status/wave tests and atomic reward gates; add boundary tests for extracted command and persistence services. Run TypeScript, all tests, both builds and all three Chromium jobs on the final draft head. Record limitations without claiming live acceptance.

## Reproducing the frozen replay

Run `node --import tsx --test tests/phase4/combat-replay.test.ts`. The fixture stores SHA-256 hashes of ordered per-step state/projection hashes, phase, round and seed (80 cases, not a hand-edited expected implementation). Inputs/clocks are fixed in `combat-replay-fixture.ts`; source main is recorded in the JSON. To independently recapture, use a separate checkout of `33e692ff055be47b0f8411d4a0d40d3e7ab3d0e7`, copy only the replay helper/test there and call `combatReplayTraces()` with the same dependencies. Do not regenerate expected values from the refactored engine. The targeted ability/status/wave tests remain necessary to explain individual rules; these hashes detect whole-trace changes.

## Engine checkpoint

The 1,363-line engine becomes a compatible export facade. Phase orchestration, ability execution, damage/healing, encounter setup, participants, choices, host controls, state events and deterministic randomness now have explicit owners. Function bodies and random call order are preserved. Internal modules import owners directly; public projection imports encounter setup directly. Health/ability primitives mutate only a phase-owned working copy. No storage, sockets or scheduling enter these rule modules. Baseline TypeScript and both builds pass; extracted TypeScript and the frozen replay pass. Room effect extraction and final verification remain pending.

## Room checkpoint

Command frame/JSON/schema decoding and atomic student rule application are separated from authorization and durable receipts. Public room messages use explicit allowlists. Room saving/completion use narrow effect callbacks; the Durable Object retains its sole serial queue, socket authentication/revocation/rate checks, checkpoint instrumentation and broadcasts. `room-state.ts` retains the persisted shape, while `room-recovery.ts` retains both existing adapters. No schema/version bump or SQL changes.

Seven new boundary tests pass. They inject storage failure before a command checkpoint and between SQL result success and its checkpoint, then recreate the object and retry. A receipt-aware repository double verifies orchestration; actual SQL atomicity/cross-room behavior remains covered by the existing migrated database tests. Legacy and version-2 room checks cover resources, answers, clocks, queued/departed players, receipts, playback and outboxes; finished legacy rooms remain reward-ineligible. Public messages retain role/phase secrecy. An esbuild dependency check proves that the rules bundle does not import room, transport, authentication, routes or database implementation at runtime. Existing playback/reporting failure and classroom cost gates pass (21 targeted tests including the new seven).

TypeScript and targeted state/contract/replay checks pass after extraction. Full tests/builds and final-head CI/Chromium remain pending.
