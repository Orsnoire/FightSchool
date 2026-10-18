# C10 — combat modules

## Scope and baseline

Claimed October 18, 2026 from main `33e692ff055be47b0f8411d4a0d40d3e7ab3d0e7`, after verifying no active C10 branch or open PR. C09 runtime `9efcfeada5a64e0ff115dd64430df4c255f4e479` is released and accepted. Implementation branch: `cleanup/c10-combat-modules`.

C10 addresses F13–F14: phase transitions, ability execution, damage/healing, command parsing, public projection and persistence effects. Preserve existing gameplay and random call order, a single serialized Durable Object authority, checkpoint-before-publication, atomic SQL rewards, durable retries and saved-room compatibility. No migrations or production-data reset. C11 and C12 are separate packages.

## Checkpoint

Claim only. Runtime extraction, seeded replay baseline, fault/retry and saved-room tests, full verification and exact-head CI are pending. Not merged or deployed.

## Verification plan

Capture deterministic multi-round traces from the unchanged engine before extraction. Compare complete persisted state and public projections across normal execution and JSON recovery. Retain the existing ability/status/wave tests and atomic reward gates; add boundary tests for extracted command and persistence services. Run TypeScript, all tests, both builds and all three Chromium jobs on the final draft head. Record limitations without claiming live acceptance.
