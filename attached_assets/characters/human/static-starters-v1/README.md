# Static starter review 03

October 5, 2026. **Static review 03 approved by the owner on October 5, 2026.** Both bodies for all twelve jobs, reusing plate, leather and linen starter gear. The earlier animation-completion gate is superseded
for this static-first track; see `docs/avatar-art-direction.md`.

The original front-facing neutral heads and hair/iris/skin masks are reused
without changing their geometry or palette IDs. Four transparent source sheets
contain male/female garments and props plus independent headwear. Prompts and
source hashes are versioned alongside them. Magenta exposed hands on Wizard and
Herbalist sheets are reserved skin-tone markers and are recolored at runtime.
The renderer keeps Wizard rear brim behind the hair and hides the Warrior's
shield-side hand. Anatomical right appears on the viewer's left.

`shared/avatar/static-catalog.ts` records source polygons and fits;
`shared/avatar/static-renderer.ts` composes the shared head identity, rear collar, continuous neck/upper chest, front collar lip, head and headwear. Original source images remain unchanged. Garments
and props in these kits are combined art, not individually swappable armor
parts. Do not use these sheets to claim completed skeleton/slot readiness.

```sh
npm run build:static-avatars
npm run render:static-avatars
```

The build produces `workshop/site/previews/static-starters-03.html` and a manifest
with deterministic input/output hashes. The native-canvas render writes a
male/female twenty-four-look contact sheet under ignored `artifacts/static-avatar-review/`.
The self-contained HTML shares the production appearance/renderer modules and
can be opened offline, used by the workshop's local preview picker, or published
with the documented connected-session helper.

See `docs/workshop-routing.md` for hosting and `docs/starter-wardrobe.md` for the
separate gameplay ownership, grouped slots, exclusions, stats and migration.

The owner requested removal of every placeholder job portrait. `empty-bodies.png`
adds six armor/body combinations in the original open-hand rest pose; its fit
coordinates use its actual 1254×1254 output size. Blood Knight's claymore, Monk's
wraps and Bard's harp currently use these empty-handed bodies. All other jobs
reuse a fitted sword/staff/bow/herbs starter look. Headwear is independently
selected from the loadout. Weapon-art absence does not remove equipment stats.

## Review 02 — neck and hat fit

The owner accepted the outfit designs and requested collar/neck and headwear
fitting corrections. Source bitmaps are unchanged. Source-space curved collar
edges now separate rear collars from front lips for each body and armor type,
including the empty-handed variants. The neck extends into an unlined upper
chest; original shirt/neckline pixels are clipped out of the reused head layer.
The helmet sits just above the eyebrows and the scout cap slightly higher.
Helmet neck-guard flares are separate rear layers; cheek plates and brow band
remain in front. Closed hats contain crown hair while preserving exposed fringe
and side hair. Wizard brim layering is unchanged.

The render command also exports enlarged starter/fallback fit sheets and
light/dark skin checks. Review 01 remains available as a historical workshop
entry. Review 02 was superseded by the approved review 03 below.

## Review 03 — female body alignment

The female Warrior collar center was at reference x=527.24 and the Wizard at
x=496.52, on opposite sides of the shared neck center x=513. Their body layers
move 14 pixels left and 16 pixels right respectively, placing the centers at
x=513.24 and x=512.52. The Scout and Herbalist fits served as visual references.
Only these two female body offsets change; their collar masks move with the
body. Shared heads, neck geometry, headwear, scales, and vertical fits retain
review 02's settings. Jobs using these bodies inherit the correction.
