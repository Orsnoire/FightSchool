# Tier 1 equipment, tank VIT and fallback loot

Status: implemented for review on `feat/tier-one-gear`, not deployed. Based on
remembered-loadout PR #43. Owner direction: October 7, 2026.

## Equipment and level gate

Tier 1 requires **job level 2**, including existing/custom Tier 1 equipment.
Tier 0 stays available at level 1; higher-tier gates are unchanged. Existing
loadouts are not stripped by migration. New equip and remembered-loadout restore
requests enforce the gate. These 37 new items require acquisition, unlike the
permanent Tier 0 entitlement. No inventory seeding or automatic equipping occurs.

| Armor family | Head / Chest / Feet | Arms / Hands / Pants | Six-piece total |
| --- | --- | --- | --- |
| Healer's | Each +1 DEF | Each +1 MND | +3 DEF, +3 MND |
| Caster's | Each +1 DEF | Each +1 INT | +3 DEF, +3 INT |
| Forester's | Each +1 DEF | Each +1 AGI | +3 DEF, +3 AGI |
| Fighter's | Each +1 DEF and +1 STR | Each +1 VIT | +3 DEF, +3 STR, +3 VIT |

The existing armor exclusions apply: healer/caster cloth, forester leather,
fighter heavy. No set-completion bonus or new DEX/STA stat is introduced.
Fighter's Claws use AGI; stamina is VIT. The lute uses the existing instrument
weapon family (`harp`), retaining Bard compatibility.

| Weapon / off hand | Attribute bonus / effect | Retained starter weapon power |
| --- | --- | --- |
| Healer's Herbs | +1 MND | — |
| Healer's Potion | Healing potion recipients gain +1 ATK for 3 rounds | — |
| Healer's Ankh Wand | Priest only; +1 HP to every heal, including First Aid | +1 MAT |
| Caster's Staff | +2 INT | +1 MAT |
| Caster's Wand | +1 INT | +1 MAT |
| Spell Book | +1 INT; Wizard/Warlock, pairs only with a wand | — |
| Forester's Bow | +1 AGI | +1 RTK |
| Forester's Quiver | +1 AGI | — |
| Fighter's Sword | +2 STR | +1 ATK |
| Fighter's Shield | +2 DEF | — |
| Fighter's Claymore | +3 STR | +2 ATK |
| Fighter's Claws | +2 AGI | +1 ATK |
| Bard's Lute | +1 AGI, +1 STR, +1 VIT | +1 RTK |

Retaining starter weapon power prevents ATK-multiplied tank abilities from becoming
zero-damage attacks. Staff and wand/book caster configurations each provide +2
INT. Staves cannot pair with books; shield/quiver/potion pairing stays unchanged.
Ankh healing is added after base rounding and before missing-HP capping, once per
recipient. It adds no HP beyond maximum and does not bypass death/target rules.

The equipped Healer's Potion augments the existing healing-potion action and
Potion Diffuser recipients. No new action, charges or crafting effect is added.
Its +1 ATK refreshes rather than stacks, includes the application round and the
next two rounds, survives room serialization and is removed at expiration.
Gear effects are frozen with the player's combat profile. Lobby/combat previews
and item/reward descriptions show the corresponding effect.

## Tank VIT damage weighting

VIT contributes half its former amount to Dark Knight basic attacks, Sacred
Strike, Holy Judgment damage, Ruin Strike, Blood Price, Shadow Requiem, Crimson
Slash and Raining Blood. Shield Bash retaliation changes from VIT/2 to VIT/4.
Fractional intermediate values are retained until normal damage rounding.
Cross-class versions share these rules. Damage-based lifesteal follows the reduced
actual damage. HP, mitigation, blocking, threat transfer, direct healing formulas
and defensive VIT effects are unchanged. Bard's basic VIT contribution is unchanged.

## Fallback instance loot

When a new solo or hosted room opens with an empty equipment loot table, resolve
one random item from each of four pools: healer, caster, forester and fighter.
Pools include their six armor pieces and named weapons/off hands; Bard's Lute is
in the forester pool. The four distinct choices are shared by that instance's
eligible players, not independently rerolled per player. Each may choose **one
item or the existing gold alternative**, not all four items.

A separate deterministic stream keyed by the new session ID selects the choices
without consuming combat RNG. The resolved table is stored in the room's fight
snapshot before play; reconnects, retries, recovery and later template edits do
not reroll it. A new instance receives a new draw. Assigned nonempty loot tables
are preserved exactly. The saved fight template remains unchanged; old rooms
retain their original loot. Victory and participation eligibility, one-choice
claiming and retry safety use the existing result ledger. Defeats and host-ended
partial fights do not grant this equipment. Students can earn an item at level 1
and keep it until their job reaches level 2.

## Art direction and release boundary

- Healer: white robes with white tasseled fringe; dark grey gloves, white pants/shoes.
- Caster: light violet robes, dark reddish fringe, black gloves/shoes, purple pants.
- Forester: green leather and green bow.
- Fighter: starter plate silhouette, red replacing the blue details.

These briefs are recorded in catalog metadata. Individual item art, equipped
color/overlay rendering and animation remain pending; current static starter
illustrations do not display the new outfits. No unfinished art is marked ready.

Apply migration 0012 from PR #43 and then `0013_spellbook_offhand.sql` before
activating the Worker. Migration 0013 extends the existing off-hand constraint;
it does not modify any items, loadouts or stats. Pending: review, deployment and
live acceptance. Local verification covers item budgets, permissions/level gates,
real migrated API and reward persistence, seeded room opening/recovery, ankh
rounding, potion refresh/expiry and revised damage/healing formulas.

Validation: all 127 tests, TypeScript checking, production client/Worker build and
`git diff --check` pass. Hosted CI and browser acceptance run on the review PR.
