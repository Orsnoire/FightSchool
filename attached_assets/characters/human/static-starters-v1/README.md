# Static starter review 01

October 5, 2026. **Awaiting owner visual approval.** Two body fits for Warrior,
Wizard, Scout and Herbalist. The earlier animation-completion gate is superseded
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
male/female eight-look contact sheet under ignored `artifacts/static-avatar-review/`.
The self-contained HTML shares the production appearance/renderer modules and
can be opened offline, used by the workshop's local preview picker, or published
with the documented connected-session helper.

See `docs/workshop-routing.md` for hosting and `docs/starter-wardrobe.md` for the
separate gameplay ownership, grouped slots, exclusions, stats and migration.
