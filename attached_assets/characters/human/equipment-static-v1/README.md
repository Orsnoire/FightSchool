# Equipped static gear — review candidate, October 8, 2026 UTC

Owner direction: October 7 MDT. Tier 1 should reuse Tier 0 silhouettes, with new
art only where necessary. The later head-stat proposal was withdrawn: head
bonuses stay +1 DEF for healer/caster/forester and +1 DEF/+1 STR for fighter.
The healer head item is named **Healer's Laurel**, with its existing stable ID.

## Sources and production

Approved originals in `../static-starters-v1` and `../v1` are unchanged. The
imagegen tool produced these transparent raster candidates using those originals
as references. Each source remains an independent versioned asset:

- `source/tier-one-outfits.png`: exact empty-handed Tier 0 atlas layout, plate
  blue details changed to crimson, leather to forest green, healer cloth to
  white with tasseled white trim, charcoal gloves and white pants/shoes.
- `source/tier-one-caster.png`: same atlas layout; right column only becomes
  light violet cloth with burgundy fringe, black gloves/shoes and purple pants.
  Unused plate/leather columns are retained as generated source context.
- `source/props.png`: isolated 4×4 weapon/off-hand atlas referenced to the four
  starter sheets. Sword, staff, bow, shield, herbs and potion reuse their design;
  adds claymore, wand, ankh, book, lute, claws, spoon and fist wraps. The final
  blue shield supplies the Tier 0 variant. Generation did not keep exact equal
  cells; measured sprite bounds are recorded in `equipment-parts.ts`.
- `source/starter-harp.png`: separate triangular wooden, seven-string starter
  harp; it is distinct from the Tier 1 pear-shaped lute.

Prompt invariants: transparent backgrounds, black ink/cel shading, no text or
labels, preserved modest male/female contours and approved poses, no heads on
body sheets, source atlas registration, no new gameplay effects. Recolor prompts
specified the palettes above and preservation of the original silhouettes and
folds. Props were requested upright, separated, with no hands, bodies or auras.
The harp prompt specified one front-facing triangular wooden harp with seven
strings, curved neck, straight pillar and gold fittings.

## Runtime contract

`shared/avatar/equipment-visuals.ts` maps known IDs to registered looks.
`equipment-parts.ts` owns paired-limb masks, crop bounds, grips and draw order.
The existing fitted head, neck joins and helmet/brim occlusion are retained.
Each armor slot selects its own source and palette. Robes cover pants naturally;
the opening shows the independently selected trousers. Shared trouser geometry
and cloth shoe palettes fill the hidden areas of the combined source sheets.
Heads reuse the original shapes with runtime red/green/violet palette channels;
the laurel keeps its gold/green design. Quivers render behind the right shoulder.

Empty armor slots use modest neutral cloth underclothes. Empty head/held slots
render no item. Unknown custom IDs use neutral cloth/no hat/no prop with an
explanatory title; their gameplay stats are unaffected. Existing rooms lacking a
gear snapshot use job starters. New rooms freeze all eight IDs on admission.

This package is **static, front-facing, review only**. It is not a segmented
animation rig, does not add motion clips, and does not mark database fit or
animation records ready. Animation views and articulated grips remain pending.

## Reproduce review

Run `node --import tsx scripts/avatar/render-equipment-review.ts`. It uses the
production renderer and exports male/female lineups of Tier 0, Tier 1, mixed
slots, empty gear, lute and claymore. Unit coverage renders both models to check
independent glove/head changes and stable identity. See
[implementation notes](../../../../docs/avatar-equipment-visuals.md).

For the remaining held items, run
`node --import tsx scripts/avatar/render-equipment-review.ts artifacts/equipment-review props`.
This covers fist wraps, claws, the starter harp, spoon, herbs/potion and Tier 1 staff
on both bodies. The generated exports remain local until separately published.
