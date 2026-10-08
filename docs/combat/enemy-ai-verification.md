# Enemy AI verification — October 8, 2026

Branch: `feat/enemy-ai-priorities`, integrating the existing goblin/wave work.
Draft implementation; not deployed.

## Completed checks

- `npm run check`: passes.
- `npm run build:cloudflare`: client and Worker bundles pass. Vite reports the
  existing large-bundle advisory.
- Phase 2: 5 tests pass. Phase 3: 7 tests pass. Rich content: 5 tests pass.
- Phase 4: all 169 tests pass, including all seven artwork checks and the review
  regressions for overlapping control effects and possession candidate selection.
  The complete `npm test` gate now passes: 186 tests, zero failures. Gameplay, authoring API,
  React DOM controls and recovery indicators pass.
- Vampire, Slime and Samhain replacement sprites are complete, visually inspected
  and integrated into the existing catalog paths. All are 1254×1254 transparent
  PNGs with unclipped, left-facing silhouettes; transparent pixels account for
  67%, 51% and 55% of their canvases respectively.
- `git diff --check`: passes.

Review identified and fixed source death incorrectly clearing another active
control effect's action restriction. Remaining stun, suffocation, fear and the
round's saved paralysis roll now remain effective. Sprite thumbnails also use
contain sizing so tall and wide creatures are visible without cropping.
Possess now tries the remaining living players if its preferred source has no
eligible damaging ability, and falls back only when none can supply an attack.

PR #52's expanded Combat UI Acceptance run
[37841834095](https://github.com/Orsnoire/FightSchool/actions/runs/37841834095)
passed. Its screenshots were downloaded and inspected. Coverage includes all
seven sprite loads, phone-width authoring, custom
priority save/reload, goblin minimum quantity, default reset, visible recovery
counters and the source's hypnosis channel label, plus 60-goblin formations.

Coverage includes seven-type roster enforcement, default AI validity, rejecting
undefined types and cross-species moves, custom-priority persistence, cooldowns,
all six movesets, hypnosis channeling and source death, nonconsecutive recovery,
reapplication without resetting progress, swarm quotas and damage limits, waves,
hidden Flatten state, and preserving academic credit while combat actions are
blocked. Goblin additions below five are rejected by the API and raised to five
by the editor. Explicit species takes precedence over legacy portrait identity.

## Remaining release gates

1. Final CI on the possession fix, merge, deployment and live staging acceptance.
   The review branch is published as PR #52 and deployment is authorized.
   Acceptance fixtures now explicitly use
   a defined Slime type with basic attacks for predictable operational checks.

No failing check is skipped or weakened to make this draft appear release-ready.
