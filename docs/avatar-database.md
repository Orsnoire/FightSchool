# Avatar database foundation

Approved September 30, 2026: replace fixed class portraits with persistent,
customizable avatars. This is a dedicated set of PostgreSQL tables inside the
existing QuestAcademy database, independent of class/job selection. It does not
require a second database server or duplicate student identities.

## Model and appearance data

| Table | Purpose |
| --- | --- |
| `avatar_palettes` | Versioned hair, eye, or skin palette |
| `avatar_colors` | Named stable color ID, hex value, and display order within a palette |
| `avatar_models` | Species, body type, rig family, channel-to-palette bindings, semantic recoloring regions, and art status |
| `avatar_model_views` | Front/combat source paths, hashes, dimensions, orientation, mask/neutral-base paths, future rig/parts paths, and readiness flags |
| `student_avatars` | One saved avatar per student, model ID, palette IDs, and three selected color IDs |

Migration `0006_avatar_foundation.sql` seeds two Human models, four RGBA source
images, three palettes, and 24 color options from the versioned
[asset manifest](../attached_assets/characters/human/v1/manifest.json). The
Human models share the intended `human-chibi-v1` rig family. This is a future rig
contract, not a claim that the illustrations already contain a skeleton.

Database foreign keys bind each model to the correct hair/eye/skin palette and
each saved color to that model's palette. Palette identity includes version;
references are stable IDs, not a fragile match against colored source pixels.
Ink, pupils, eye whites and highlights are excluded from recoloring.

Source art remains colored. The four views now have twelve separate region
masks and four neutral shading bases, preserving source geometry and alpha.
Migration `0007_human_recolor_masks.sql` records those paths and marks matching
views recolor-ready, guarded by each original source hash. The manifest also
records derivative hashes. Rig files, parts, and calibrated transforms remain
null. Constraints prevent a view from
being marked recolor-ready or rig-ready without the required asset references.
Paths are repository asset references, not automatically deployed URLs.

## Equipment slots and visuals

| Table | Purpose |
| --- | --- |
| `avatar_equipment_slots` | Anatomical equipment slot definitions |
| `avatar_model_slots` | Supported slots and attachment bones for each model, with space for per-view calibration |
| `avatar_equipment` | Equipment appearance identity and optional link to an existing gameplay item |
| `avatar_equipment_fits` | Which model/slot combinations support an equipment appearance |
| `avatar_equipment_visuals` | Image and attachment transform for a compatible equipment/model/slot/view combination |
| `avatar_equipped_items` | The item occupying an avatar's slot; one item per slot |

Both initial Human models reserve these **18 slots**:

| Region | Slots |
| --- | --- |
| Center | Head, neck, torso, pelvis/waist |
| Arms | Left/right upper arm and forearm |
| Hands | Left/right hand/glove |
| Legs | Left/right thigh and shin |
| Feet | Left/right foot/boot |
| Held items | Left/right grip, separate from gloves |

Left/right always means the character's anatomical side. Near/far render order
belongs to each view's calibration; mirroring must not silently swap equipped
hands. Grips support weapons, shields, casting props, and other held items.
Further slot definitions can be added without adding columns to student rows.

An equipment definition can fit several slots and provide a distinct image per
view, so one armor item can cover torso and limbs. Empty slots are represented
by absent equipped-item rows. No fake equipment, transforms, or rendered parts
are seeded. The starter clothes are still baked into the concept art and will
need to be separated or covered when production equipment layers are built.

Foreign keys reject equipment in an incompatible slot/model and visuals for a
nonexistent view. Gloves and grips can coexist. A model change with equipped
parts must explicitly validate/rebind or unequip them in one transaction;
the database prevents silently retaining equipment fitted to another model.

These are visual equipment records. The existing weapon/headgear/armor gameplay
stats and inventory rules are preserved. `gameplay_item_id` may reference a
teacher-created item; `builtin_item_id` may identify an existing built-in item.
An appearance may use at most one of those links. Future equip endpoints must
validate authenticated ownership, inventory, class restrictions, two-handed
occupancy, and all covered slots together. Direct visual attachment must not
grant stats or bypass inventory checks. No equip endpoint is introduced here.

## Appearance lifecycle

`worker/db/avatar-repository.ts` provides:

1. `createStudentAvatar`: first confirmed creation chooses each omitted color
   independently and uniformly from the model's palette. Player overrides are
   validated. A unique student key and conflict handling make retries/concurrent
   submissions return the first saved avatar rather than reroll it.
2. `getStudentAvatar`: read-only; missing setup returns null.
3. `saveStudentAvatarColors`: persists explicit color choices for an existing
   avatar without changing its model, equipment, or palette versions.

The seeded palettes provide 8 × 8 × 8 = 512 initial color combinations per
model. Source image colors are never default selections. Creating or viewing
an avatar does not depend on its class. Existing characters are not randomly
backfilled by migration; their initial appearance should be saved when they
explicitly enter the new avatar setup flow. New users should enter that flow
after their account is created. Palette/model upgrades require an explicit
version migration; never rewrite saved choices on render, login, or job change.

The repository helpers are internal building blocks, not HTTP endpoints. Their
callers must derive student identity from the authenticated session and enforce
same-origin mutations. A future renderer must read the saved avatar and its
selected color IDs rather than the old `Gender`/class image lookup.

## Rollout and validation

This foundation supplies the original assets, recoloring derivatives and
preview, catalog, additive migrations, seed records, persistence helpers, and
database tests. It neither runs a live
migration nor replaces the current portrait UI. The legacy portraits remain a
temporary display implementation, not the direction for new avatar work.

Deploy the migrations through the normal migration workflow before integrating
avatar API routes. The recoloring assets are ready; complete body-part cuts,
rig calibration, and equipment art before marking rigs ready. Then integrate the avatar creator,
saved appearance transport, equipment authorization, and new renderer; remove
the old portrait imports after all callers have moved over.

`tests/phase4/avatar-database.test.ts` runs the real migrations in PostgreSQL via
PGlite. It verifies existing student preservation, seed/image consistency,
independent initial colors, persistence and concurrent retries, palette/channel
constraints, readiness flags, equipment compatibility, gloves plus held items,
and cascading avatar cleanup.

`tests/phase4/avatar-recolor.test.ts` verifies source/derivative hashes, exclusive
grayscale masks, preserved alpha and untargeted pixels, anatomical region probes,
and the shared recoloring function. See the
[recoloring contract](../attached_assets/characters/human/v1/recolor/README.md)
for regeneration and local preview commands.
