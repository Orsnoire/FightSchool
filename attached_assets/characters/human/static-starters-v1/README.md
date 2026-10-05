# Static starter review 01

October 5, 2026. **Awaiting owner visual approval.** Both bodies for all twelve jobs, reusing plate, leather and linen starter gear. The earlier animation-completion gate is superseded
for this static-first track; see `docs/avatar-art-direction.md`.

The original front-facing neutral heads and hair/iris/skin masks are reused
without changing their geometry or palette IDs. Four transparent source sheets
contain male/female garments and props plus independent headwear. Prompts and
source hashes are versioned alongside them. Magenta exposed hands on Wizard and
Herbalist sheets are reserved skin-tone markers and are recolored at runtime.
The renderer keeps Wizard rear brim behind the hair and hides the Warrior's
shield-side hand. Anatomical right appears on the viewer's left.

`shared/avatar/static-catalog.ts` records source polygons and fits;
`shared/avatar/static-renderer.ts` composes the shared head identity, collar
extension, kit and headwear. Original source images remain unchanged. Garments
and props in these kits are combined art, not individually swappable armor
parts. Do not use these sheets to claim completed skeleton/slot readiness.

```sh
npm run build:static-avatars
npm run render:static-avatars
```

The build produces `workshop/site/previews/static-starters-01.html` and a manifest
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
