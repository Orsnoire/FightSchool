# Tier 2 armor — owner specification October 22, 2026

All guilds share these 24 common-quality armor pieces. Each costs **1,000g**;
student availability follows the guild's existing shop-tier unlock. Existing
armor-category permissions and equipment level requirements still apply.
STA in the owner's brief is the game's existing **VIT** stat. No Tier 2 weapons
or automatic loot grants are added by this collection.

| Set | Every piece | Head / chest / feet, each | Arms / hands / legs, each | Six-piece total |
| --- | --- | --- | --- | --- |
| Soldier's (heavy) | 2 DEF, 1 STR | +1 ATK | +1 VIT | 12 DEF, 6 STR, 3 VIT, 3 ATK |
| Ranger's (leather) | 1 DEF, 1 AGI, 1 RTK | — | — | 6 DEF, 6 AGI, 6 RTK |
| Acolyte's (light) | 1 DEF, 1 INT, 1 MAT | — | — | 6 DEF, 6 INT, 6 MAT |
| Ascetic's (light) | 1 DEF, 1 MND | — | +1 healing | 6 DEF, 6 MND, +3 healing |

Ascetic healing adds to each heal after normal formula rounding, including First
Aid, and stacks with the Tier 1 Ankh. Each piece works independently; there is
no full-set requirement. Healing remains capped at the recipient's missing HP.

Names use the set prefix and the established slot nouns (Helm/Cuirass/etc.,
Cap/Jerkin/etc., Hat/Robes/etc., Laurel/Robes/etc.). The registered IDs use
`t2_soldier_`, `t2_ranger_`, `t2_acolyte_`, and `t2_ascetic_` plus the slot.

Colors reuse existing approved silhouettes through the production recoloring
pipeline, including headgear. Soldier's armor is dark grey with silver trim;
Ranger's is green with brown trim and deterministic olive/brown mottling;
Acolyte's is royal blue with purple trim; Ascetic's is white with dark grey trim.
Identity colors, transparency, source ink, slot separation and existing custom
palette overrides are preserved. No generated source atlas is replaced.

Reproduce the visual review for both bodies:
`node --import tsx scripts/avatar/render-equipment-review.ts artifacts/tier-two-review tier2`.
