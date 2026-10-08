# Permanent starter wardrobe

October 5, 2026 owner direction: every student owns the starter collection, regardless of current job. Changing jobs selects compatible equipment without losing starter gear or acquired upgrades. Potion and quiver off hands are equipment; future variants may modify healing or other effects, but no such effect is defined in this release.

## October 5 released defaults

The Expanded Class List defines jobs, weapon usage and abilities but contains no armor exclusions. The following material rules and grouped player slots were prepared as review defaults and are included in the October 5 owner-authorized static-avatar release.

| Jobs | Plate / heavy | Leather | Linen / unarmored clothing |
| --- | --- | --- | --- |
| Warrior, Paladin, Dark Knight, Blood Knight | Allowed | Allowed | Allowed |
| Scout, Ranger, Monk, Bard | Excluded | Allowed | Allowed |
| Wizard, Herbalist, Priest, Warlock | Excluded | Excluded | Allowed |

The October 5 release introduced seven data slots: weapon, off hand, head, body, hands, legs and feet. The October 7 review update below adds Arms and exposes all eight consistently. Paired armor covers both anatomical art slots; the avatar attachment schema retains separate left/right bones and grips. This does not add independently selectable armor for each individual arm or shin. `armor` and `headgear` remain the API keys for body and head.

## Starter collection

`shared/equipment-catalog.ts` is the permanent catalog and default-loadout source. `JOB_TREE` exposes each job's `armorExclusions`; `shared/equipment-rules.ts` is used by both the client and authoritative equip API.

- Plate: Imperial helm, body armor, gauntlets, leggings and boots.
- Leather: rake's cap (the brown Robin Hood style), body armor, gloves, leggings and boots.
- Linen robe, purple wizard cap and gold/green laurel.
- Sword, staff, bow, and herb pouch with herbs.
- Shield, potion and quiver off hands.
- Existing basic fist wraps, claymore and harp are retained as advanced-job fallbacks. Until their weapon artwork is finished, those jobs render empty hands in the face-on rest pose. Their equipped stats remain in effect.

The source catalog uses existing stable IDs such as `basic_sword`, `basic_staff`, `basic_helm` and `basic_armor`. Legacy class-specific starter restrictions are replaced by weapon/material compatibility, so a Priest can reuse the starter staff and a Paladin can reuse the starter sword. Blood Knight receives its permitted two-handed claymore rather than the previous incompatible sword fallback.

Starter ownership is a permanent entitlement merged with persisted purchased/looted inventory. It does not duplicate inventory rows on login or job change, and there is no sale or consumption path for the starter entitlement. Other built-ins are **not** automatically owned. Existing equipped items are included in the owner's inventory response and retained when switching jobs, preserving gear equipped under the earlier rules.

## Equip behavior

All equip requests require the owning student session and an allowed origin. The server validates ownership, slot, job exclusion, weapon type, job-level tier gate and the resulting pair of held items. Concurrent stale loadout changes return 409 instead of overwriting a newer loadout.

A shield pairs with a sword. A potion pairs with herbs. A quiver pairs with a bow; it is worn on the back, leaving the anatomical right hand available to draw arrows. A two-handed sword cannot retain a shield. Requests may change both weapon and off hand together, or explicitly unequip the off hand first. The potion prop is separate from combat's existing limited healing-potion action and adds no charges or effects.

Switching to a different job selects that job's starter loadout. Reconfirming the same job preserves equipped upgrades. No job switch deletes inventory, colors, job levels, gold, unlocked abilities or learned passives. A player can re-equip any owned compatible upgrade after a switch. Per-job remembered loadouts are not introduced here.

Starter body/head defenses retain the prior +1 each; sword/staff/bow/herbs retain their existing +1 attack-type or MND bonus. New limb pieces and off hands have no bonus stats pending a balance decision. The seven released slots contribute declared equipment stats to the same server combat-profile calculation. Future stat-bearing potion/quiver variants require explicit design, acquisition and balance decisions.

## Art and rollout boundary

The static review covers all twelve jobs on both bodies, with separate head/headwear rendering and independent hair/eye/skin recoloring. Garments and held props within each source body sheet remain a combined starter illustration. **It is not yet an arbitrary item-by-item paperdoll renderer.** All placeholder job portraits and their imported PNGs are removed. Plate, leather and linen have empty-handed male/female bodies for missing weapons; hats are selected independently, so Priest can reuse the staff/robe with a laurel. Starter appearance is labeled in the lobby; purchased gear still affects stats even where its individual overlay art is not available. Do not mark equipment-fit or animation records ready based on these sheets.

Migration `0009_starter_wardrobe.sql` adds nullable hands/legs/feet/offhand columns and optional armor/offhand metadata. It preserves existing rows and loadouts. New compatibility rules apply to new equip requests and the next job selection; the migration does not strip or rebalance existing equipped items. The deployment must apply this migration before the new Worker is activated.

The owner approved the static collection and requested live release on October 5. The release went live at 18:31 MDT on October 5 (00:31 UTC October 6), with migration, CI, saved-avatar API, combat and classroom acceptance checks passing. See the [deployment record](cloudflare/full-migration.md#static-avatars-and-starter-wardrobe--5-october-2026). The independent [workshop](workshop-routing.md) can publish previews without deploying this database or game change.


## October 7 expansion — implemented for review, not deployed

The lobby summary and equipment picker, dedicated loadout screen, teacher item
editor and shop filters now use eight player-facing slots: **Head, Chest, Arms,
Hands, Pants, Feet, Weapon and Off hand**. Arms and Hands are independent gear
choices; each still covers the pair of limbs. Existing API/save keys `headgear`,
`armor` and `legs` remain stable and are labeled Head, Chest and Pants.

Plate vambraces, leather bracers and cloth sleeves join the permanent starter
collection and the corresponding job defaults. They have no bonus stats. All
low-stat starter items, including existing weapons, armor and advanced-job
fallbacks, are labeled **Tier 0** in metadata, loadout displays and choices.
Stats are unchanged. This is an explicit starter catalog tier, not an inference
from an item's current stats: teacher-created and other built-in upgrades retain
Tier 1+ and their existing level gates. Tier 0 starter gear is available at level
1 but still requires ownership, the correct slot and job compatibility.

Migration `0011_equipment_arms.sql` adds a nullable `arms` column only. Existing
loadouts, inventory, progression, gold and appearance are preserved. Existing
students start with Arms empty and can equip any compatible starter arms from
their permanent inventory; selecting a different job uses the new defaults.
Apply this migration before activating the new Worker during the combined
release. No production migration or deployment has been performed for this work.

### Extension hooks

`shared/equipment-slots.ts` owns the ordered slot keys, TypeScript slot union,
labels and armor classification. UI controls/filters, item and equip validation,
ownership checks, stale-write checks and combat stat collection iterate this
registry. `calculateLoadoutEquipmentStats` accepts a named loadout rather than a
fixed list of three equipment arguments. All eight slots contribute declared
stats, including teacher-created items.

To add another slot, extend the registry, add a nullable student column through
an additive migration and the Drizzle schema, then choose null or a compatible
starter in each default loadout. Add acquisition content and tests as needed.
Separate left/right gear, per-job saved loadouts, stat rebalancing and individual
item art/animation remain pending. This change does not turn the static starter
illustrations into item-by-item overlays.

Validation covers migration preservation on an existing student, every job's
starter compatibility and Tier 0 metadata, equip/unequip, wrong-slot and
unowned/job/tier rejection, same-job upgrade preservation, all eight slots'
combat bonuses, and the actual React equipment screen's labels and Tier 0 text.
