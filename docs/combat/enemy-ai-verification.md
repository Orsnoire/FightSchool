# Enemy AI verification — October 8, 2026

Branch: `feat/enemy-ai-priorities`, integrating the existing goblin/wave work.
Draft implementation; not deployed.

## Completed checks

- `npm run check`: passes.
- `npm run build:cloudflare`: client and Worker bundles pass. Vite reports the
  existing large-bundle advisory.
- Phase 2: 5 tests pass. Phase 3: 7 tests pass. Rich content: 5 tests pass.
- Phase 4: 164 tests pass, 3 artwork checks fail because files are still missing.
  Gameplay, authoring API, React DOM controls and recovery indicators pass.
- `git diff --check`: passes.

Coverage includes seven-type roster enforcement, default AI validity, rejecting
undefined types and cross-species moves, custom-priority persistence, cooldowns,
all six movesets, hypnosis channeling and source death, nonconsecutive recovery,
reapplication without resetting progress, swarm quotas and damage limits, waves,
hidden Flatten state, and preserving academic credit while combat actions are
blocked. Goblin additions below five are rejected by the API and raised to five
by the editor. Explicit species takes precedence over legacy portrait identity.

## Remaining release gates

1. Complete and visually inspect `vampire-v2.png`, `slime-v2.png` and
   `samhain-v2.png`. Their generation was interrupted. Catalog tests deliberately
   fail until all three are real, decodable, transparent sprites.
2. Browser visual acceptance of all seven portraits, the teacher editor, recovery
   labels and dense goblin formations at desktop and mobile sizes. Local Chromium
   installation failed with a corrupt download, so React DOM checks do not claim
   screenshot or real-browser acceptance. Existing CI browser workflows can run
   on the draft.
3. Run the full test gate again after the artwork is complete, then staging
   acceptance if deployment is authorized. Acceptance fixtures now explicitly use
   a defined Slime type with basic attacks for predictable operational checks.

No failing check is skipped or weakened to make this draft appear release-ready.
