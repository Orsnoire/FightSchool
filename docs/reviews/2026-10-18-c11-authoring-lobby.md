# C11 — authoring and lobby UI

## Scope and publication

Phase 5 / C11 / F13–F14 is implemented in [PR #74](https://github.com/Orsnoire/FightSchool/pull/74), branch `cleanup/c11-authoring-lobby`. **Complete, merged, deployed and accepted.** Runtime `a580b30b6e9826fbaaca9f3e2cfc914a94e4c7ad` has the identical reviewed tree to final head `34c3dd4d97a9000c23c3b14869f468a032313421`. Verified code and browser fixture: `469c1c864f3d2a693f5e5018a7ceb43e4860a12f`; later checkpoint changes are documentation only. C11 is the accepted live runtime. Baseline main is `e02f46d7367f8f006a97565fec0d4d5b85ff648b`. Remote main, checkpoint, branches and open PRs were inspected before publishing the claim and main pointer. Characterization was committed before extraction at `2b1f9449bbd122ded1db77e442804eda593dce5c`; authoring extraction was published at `cf4d8a311f4f8a4033582762543257b5a8986182`.

Question/CSV/enemy/loot editing and lobby loadout/avatar UI now have explicit owners.
[Ownership map](../client/authoring-and-lobby.md). Route-level draft hooks retain
unsaved edits across tab unmounts. The existing form, query keys, save serialization,
authorization, item rules, saved appearance and remembered loadout behavior remain.
No server route, SQL, migration, reward procedure, saved-room version or gameplay
rule is changed. No production-data reset is authorized or performed.

## Measurements and audit

| Boundary | Before | After |
| --- | --- | --- |
| CreateFight route | 1,197 lines | 204 lines |
| Lobby route | 1,115 lines | 205 lines |
| Shared schema | 752 lines | 617 lines |
| Automated tests | 298 | 300 |
| Worker bundle (esbuild display) | 908.6 KiB | 908.6 KiB |

This is architectural cleanup; line counts and unchanged rounded bundle size do
not establish a performance improvement. The [raw audit](c11-module-audit.json)
records seven unchanged lobby handler bodies, 22 runtime feature modules with no
internal cycles, and unchanged room recovery/state owners. The bundled client
pages have no runtime imports of Worker implementations.

The baseline repository-wide TypeScript/JavaScript reference search found all
15 occurrences of the retired names inside `shared/schema.ts`, with no external
callers. Removed helpers: `getPlayerCombatStats`, `calculateCriticalHit`,
`calculatePhysicalDamage`, `calculateMagicalDamage`, `calculateRangedDamage`,
`calculateHybridDamage`, `calculateDamageReduction`, `calculateSoloModeEnemyScaling`.
Removed types: `ResolutionFeedbackType`, `ResolutionFeedback`, `EnemyAIAttackData`,
`PartyDamageData`. Unused lobby solo-entry state/handler and the unused
`onEquipFromMenu` prop were also removed after reference inspection.

`CombatState` is still referenced by `StudentGuildLobby`'s active-sessions query;
it and `PlayerState` remain. Active deterministic damage helpers remain. Both
legacy and version-2 saved-room adapters are unchanged. A broad legacy-name search
is not evidence that a live compatibility path is safe to delete.

## Regression coverage and observed defect

The new real Chromium fixture runs against pinned C10 and C11, at 1366×768 and
390×844, using isolated HTTP fixtures:

- Unsaved question and enemy drafts survive tab switches; an unfinished question
  edit blocks the fight save. Save/Cancel/reload retain question identity/order.
- CSV keeps quoted commas/newlines/rich text, case-insensitive headers, accepted
  question aliases, answer order and 5–120 second/default timer behavior. Invalid
  rows are skipped without losing valid neighbors. Two new unit tests cover the
  conversion independently, including input immutability.
- Supported enemy species, goblin minimum five, swarm settings, waves, keyboard
  group reordering and complete enemy/loot payloads survive save/reload.
- Failed fight saves retain the complete payload for an identical retry.
- Gear permissions, authoritative failure/retry, locked ability slots, filtering,
  ability drag/removal, appearance persistence and class-save ordering are covered.
  Failed appearance saves issue no class write; failed class saves retain the modal;
  returning jobs display the authoritative remembered loadout.

The first baseline run [39148536013](https://github.com/Orsnoire/FightSchool/actions/runs/39148536013)
reproduced a real existing defect: selecting an item, removing it, then selecting
that same item again produced an empty loot save. The uncontrolled selector
retained its old value, so the second selection emitted no change. The extracted
loot panel resets the controlled selection after each add. The before fixture
asserts that failure and uses the existing tab-remount workaround; the after
fixture requires direct re-add to work. The saved payload/API shape is unchanged.

Authoring checkpoint `cf4d8a3` passes [CI 39148906179](https://github.com/Orsnoire/FightSchool/actions/runs/39148906179).
Its authoring/lobby before-and-after, initial-loading and battlefield Chromium
jobs pass in [39148906182](https://github.com/Orsnoire/FightSchool/actions/runs/39148906182).
The existing combat UI job timed out at the previously observed phone gear-comparison
Escape close check. That failure is retained in the record; the final run below passes.

Local final implementation checks pass: **300 tests** (phase 2: 5; phase 3: 7;
phase 4: 281; rich content: 7), TypeScript and both production builds. Existing
populated-guild, cross-room atomic reward/retry, deterministic replay, room
recovery, teacher authorization, rich content and loadout concurrency tests pass.
Final [CI 39149774141](https://github.com/Orsnoire/FightSchool/actions/runs/39149774141) and all four jobs in [Chromium 39149774126](https://github.com/Orsnoire/FightSchool/actions/runs/39149774126) pass on `469c1c864f3d2a693f5e5018a7ceb43e4860a12f`. The authoring/lobby job passes all flows against both pinned C10 and C11 at both viewport sizes, including keyboard enemy ordering and ability drag/removal.

The first expanded keyboard check in run 39149487653 failed against unchanged C10:
it sent drop before the asynchronously installed sensor/collision state settled.
The harness now observes activation and the destination announcement before drop;
no product behavior or assertion was weakened. Pointer drag similarly observes its
activation and destination and scrolls the target into view before dropping.

## Reproduction and limits

```sh
npm run check
npm test
npm run build
node tests/support/audit-c11.mjs
node --import tsx --test tests/phase4/authoring-csv.test.ts tests/phase4/swarm-editor-ui.test.ts tests/phase4/loadout-sync.test.ts
```

The `authoring-lobby` job in `.github/workflows/combat-ui-acceptance.yml` fetches
pinned C10 into an isolated worktree and runs the same browser fixture against
both Vite roots. Screenshots are retained in [authoring-lobby-evidence](https://github.com/Orsnoire/FightSchool/actions/runs/39149774126/artifacts/12144902092) with
separate before/after directories. The baseline-only flag asserts the known loot
bug and applies its existing UI workaround; it does not skip the remaining flows.

Browser HTTP fixtures establish UI behavior, not database enforcement; the
existing migrated HTTP/SQL tests cover permissions, concurrency and rewards.
Deployment and canonical acceptance are recorded below. C08
physical Chromebook/repeated-performance observations and C12 environment/fixture
isolation, provider recovery, rollback drills and monitoring remain open.

## Release — October 18, 2026 UTC

The owner authorized merge and deployment after reviewing the verified draft.
Final reviewed head `34c3dd4` passes [CI 39150169998](https://github.com/Orsnoire/FightSchool/actions/runs/39150169998) and all four jobs in [Chromium 39150169935](https://github.com/Orsnoire/FightSchool/actions/runs/39150169935).
Merge `a580b30b6e9826fbaaca9f3e2cfc914a94e4c7ad` has the identical tree `bb9a1f04ae80fc662abcab16ad301b97187d9248`.
[Deployment 39161062489](https://github.com/Orsnoire/FightSchool/actions/runs/39161062489) passed validation, R2, the existing additive migration gate and both hostname smoke checks; Worker `86111493-688d-41c2-9462-b050044b3d10` was published at 19:59:21 UTC.
[Canonical acceptance 39161276964](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964) passes on the same runtime, targeting `https://questacademy.bookwyrminteractive.studio`: teacher/student combat, guild quests/shop/history, durable rewards, owner isolation, R2, 30-player answers/reconnect/completion, concurrent rooms, moderation and socket revocation.
[Live acceptance record](https://github.com/Orsnoire/FightSchool/actions/runs/39161276964).

One 30-answer burst recorded p50 654 ms, p95 1260 ms, maximum 1310 ms. This is functional acceptance, not a repeated performance benchmark. No production-data reset, reward-procedure change or rollback was performed. The standard live suite uses its existing acceptance fixtures; broader fixture isolation/cleanup and provider recovery/rollback drills remain C12 work. Later documentation-only commits do not change the runtime.

C11 is **COMPLETE / MERGED / DEPLOYED / ACCEPTED**. C12 / Phase 6 release review is next and unstarted; register its claim and draft before implementation.
