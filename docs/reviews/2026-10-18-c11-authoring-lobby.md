# C11 — authoring and lobby UI

## Scope and publication

Phase 5 / C11 / F13–F14 is implemented in [draft PR #74](https://github.com/Orsnoire/FightSchool/pull/74), branch `cleanup/c11-authoring-lobby`. **Final verification is pending; not merged or deployed.** C10 remains the accepted live runtime. Baseline main is `e02f46d7367f8f006a97565fec0d4d5b85ff648b`. Remote main, checkpoint, branches and open PRs were inspected before publishing the claim and main pointer. Characterization was committed before extraction at `2b1f9449bbd122ded1db77e442804eda593dce5c`; authoring extraction was published at `cf4d8a311f4f8a4033582762543257b5a8986182`.

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
Escape close check. That failure is retained in the record; final full-browser
verification is still required.

Local final implementation checks pass: **300 tests** (phase 2: 5; phase 3: 7;
phase 4: 281; rich content: 7), TypeScript and both production builds. Existing
populated-guild, cross-room atomic reward/retry, deterministic replay, room
recovery, teacher authorization, rich content and loadout concurrency tests pass.
Final GitHub checks and the extended keyboard/drag browser fixture are pending.

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
both Vite roots. Screenshots are retained in `authoring-lobby-evidence` with
separate before/after directories. The baseline-only flag asserts the known loot
bug and applies its existing UI workaround; it does not skip the remaining flows.

Browser HTTP fixtures establish UI behavior, not database enforcement; the
existing migrated HTTP/SQL tests cover permissions, concurrency and rewards.
No live deployment or production acceptance is performed for this draft. C08
physical Chromebook/repeated-performance observations and C12 environment/fixture
isolation, provider recovery, rollback drills and monitoring remain open.
