<a id="enemy-ai-verification--october-8-2026"></a>

# COMPLETE — Enemy AI release verification, October 8, 2026

**COMPLETE RELEASE VERIFICATION — updated October 9, 2026.**
PR #52 merged and deployed at `e158194`, integrating the existing goblin/wave work.
See [current status](../CURRENT_STATUS.md) for the exact release baseline and known
cleanup issues. Classroom balance observation remains open in the
[expansion plan](../EXPANSION_PLAN.md); this record does not close every
infrastructure acceptance gate.

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

<a id="remaining-release-gates"></a>

## Completed release gates

1. [CI 37843818974](https://github.com/Orsnoire/FightSchool/actions/runs/37843818974)
   passed on merged runtime `e158194`, including the possession fix.
2. [Deployment 37844054859](https://github.com/Orsnoire/FightSchool/actions/runs/37844054859)
   passed on that exact revision.
3. [Canonical live acceptance 37844271331](https://github.com/Orsnoire/FightSchool/actions/runs/37844271331)
   passed on the same revision. Operational fixtures use a defined Slime with
   basic attacks; species-specific behavior is covered by the deterministic,
   authoring and browser checks above, not inferred from that simple live fixture.

These original release gates are complete. The [cleanup plan](../CLEANUP_PLAN.md)
owns new correctness, performance and operational follow-up.
