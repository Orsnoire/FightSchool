# Phase 3B: Teacher fight persistence

This slice restores the authenticated teacher workflow for creating, listing, opening, updating, and deleting fight definitions. It keeps Neon PostgreSQL as the system of record and does not enable hosting a live fight yet.

## Included

- Additive `fights` table linked to the Phase 3A `teachers` table.
- Worker routes used by the existing Create Fight and teacher dashboard screens.
- Session authentication and teacher ownership checks on every fight route.
- Bounded request validation with legacy-compatible stripping of unknown fields.

## Deployment order

After this pull request is merged:

1. Run **Migrate Neon Staging** from GitHub Actions and confirm it succeeds.
2. Run **Deploy Cloudflare Staging** and confirm it succeeds.
3. Sign in as the test teacher, create a small fight, and confirm it appears on the teacher dashboard.
4. Log out and back in, then confirm the fight remains visible.
5. Open the fight for editing, change its title, save it, and confirm the change persists.
6. Delete the dummy fight and confirm it disappears.

No new Cloudflare or GitHub secrets are required for this slice.

## Deliberate boundaries

- Starting or hosting a fight remains outside this slice. The live combat/session routes will be migrated separately.
- Teacher equipment-item routes and custom image uploads are not enabled yet. A fight can still be created with built-in enemy images and an empty loot table.
- Existing legacy infrastructure remains the rollback path. Do not move production DNS as part of this change.
