# Enemy AI verification — October 8, 2026

Branch: `feat/enemy-ai-priorities`, integrating the existing goblin/wave work.
Draft implementation; not deployed.

## Completed checks

- `npm run check`: passes.
- `npm run build:cloudflare`: client and Worker bundles pass. Vite reports the
  existing large-bundle advisory.
- Phase 2: 5 tests pass. Phase 3: 7 tests pass. Rich content: 5 tests pass.
- Phase 4: all 167 tests pass, including all seven artwork checks. The complete
  `npm test` gate now passes: 184 tests, zero failures. Gameplay, authoring API,
  React DOM controls and recovery indicators pass.
- Vampire, Slime and Samhain replacement sprites are complete, visually inspected
  and integrated into the existing catalog paths. All are 1254×1254 transparent
  PNGs with unclipped, left-facing silhouettes; transparent pixels account for
  67%, 51% and 55% of their canvases respectively.
- `git diff --check`: passes.

Coverage includes seven-type roster enforcement, default AI validity, rejecting
undefined types and cross-species moves, custom-priority persistence, cooldowns,
all six movesets, hypnosis channeling and source death, nonconsecutive recovery,
reapplication without resetting progress, swarm quotas and damage limits, waves,
hidden Flatten state, and preserving academic credit while combat actions are
blocked. Goblin additions below five are rejected by the API and raised to five
by the editor. Explicit species takes precedence over legacy portrait identity.

## Remaining release gates

1. Browser visual acceptance of all seven portraits, the teacher editor, recovery
   labels and dense goblin formations at desktop and mobile sizes. Local Chromium
   installation failed with a corrupt download, so React DOM checks do not claim
   screenshot or real-browser acceptance. Existing CI browser workflows can run
   on the draft.
2. Publish the review branch after authorization, followed by staging acceptance
   if deployment is authorized. Acceptance fixtures now explicitly use
   a defined Slime type with basic attacks for predictable operational checks.

No failing check is skipped or weakened to make this draft appear release-ready.
