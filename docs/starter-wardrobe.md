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

Switching to a different job selects that job's starter loadout. Reconfirming the same job preserves equipped upgrades. No job switch deletes inventory, colors, job levels, gold, unlocked abilities or learned passives. A player can re-equip any owned compatible upgrade after a switch. This describes the deployed October 5 behavior; the remembered-loadout implementation below supersedes it after its release.

Starter body/head defenses retain the prior +1 each; sword/staff/bow/herbs retain their existing +1 attack-type or MND bonus. New limb pieces and off hands have no bonus stats pending a balance decision. The seven released slots contribute declared equipment stats to the same server combat-profile calculation. Future stat-bearing potion/quiver variants require explicit design, acquisition and balance decisions.

## Art and rollout boundary

The static review covers all twelve jobs on both bodies, with separate head/headwear rendering and independent hair/eye/skin recoloring. Garments and held props within each source body sheet remain a combined starter illustration. **It is not yet an arbitrary item-by-item paperdoll renderer.** All placeholder job portraits and their imported PNGs are removed. Plate, leather and linen have empty-handed male/female bodies for missing weapons; hats are selected independently, so Priest can reuse the staff/robe with a laurel. Starter appearance is labeled in the lobby; purchased gear still affects stats even where its individual overlay art is not available. Do not mark equipment-fit or animation records ready based on these sheets.

Migration `0009_starter_wardrobe.sql` adds nullable hands/legs/feet/offhand columns and optional armor/offhand metadata. It preserves existing rows and loadouts. New compatibility rules apply to new equip requests and the next job selection; the migration does not strip or rebalance existing equipped items. The deployment must apply this migration before the new Worker is activated.

The owner approved the static collection and requested live release on October 5. The release went live at 18:31 MDT on October 5 (00:31 UTC October 6), with migration, CI, saved-avatar API, combat and classroom acceptance checks passing. See the [deployment record](cloudflare/full-migration.md#static-avatars-and-starter-wardrobe--5-october-2026). The independent [workshop](workshop-routing.md) can publish previews without deploying this database or game change.


## October 7 expansion — released October 7, 2026

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
release. Migration 0011 and the combined release are deployed; see the release record.

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
Separate left/right gear, stat rebalancing and individual item art/animation
remain pending. Per-job saved loadouts are implemented for review below. This change does not turn the static starter
illustrations into item-by-item overlays.

Validation covers migration preservation on an existing student, every job's
starter compatibility and Tier 0 metadata, equip/unequip, wrong-slot and
unowned/job/tier rejection, same-job upgrade preservation, all eight slots'
combat bonuses, and the actual React equipment screen's labels and Tier 0 text.


## October 7 Tier 0 completion — released October 7, 2026

The starter catalog now includes zero-stat linen gloves, linen pants and cloth
shoes, plus +1 ATK claws and a +1 RTK spoon for supported alternate weapons.
The existing +2 ATK claymore is labeled “Starter Claymore (Two-Handed Sword)”;
its ID, Tier 0 status, compatibility and Blood Knight default remain unchanged.
Every armor category now covers Head, Chest, Arms, Hands, Pants and Feet, and
all nine supported weapon families have a Tier 0 option. Cloth jobs default to
the new matching limb pieces. Existing off-hand compatibility remains unchanged;
not every job uses an off-hand item.

These are permanent catalog entitlements, automatically included in inventory
responses for existing and new students. No duplicated item rows, live seeding,
additional migration, forced replacement of existing gear or balance changes
are involved. Per-item visuals and animation are still pending. The shared
loadout synchronization and this catalog completion are released;
see [release queue](combat/release-queue.md).


## Equipment permissions — released October 7, 2026

Both loadout views now list allowed weapons, armor categories and usable off-hand
types. Owned incompatible gear stays visible with a reason, including job, tier
or held-item conflicts. The same shared rules drive these descriptions and the
authoritative equip API. Blood Knight has no usable off hand because its allowed
two-handed sword cannot pair with a shield.

New custom armor requires an explicit category for Head, Chest, Arms, Hands,
Pants and Feet. The teacher form and API enforce this. API partial updates check
the merged item whenever classification changes; clearing a category or moving
a weapon to an armor slot without one is rejected. Category metadata is rejected
on weapon/off-hand slots. Existing uncategorized items retain legacy inference
and may receive unrelated API edits; deliberate classification changes and full
form saves require explicit selection. This requires no data migration.


## Remembered job loadouts — implemented for review, not deployed

Each job remembers all eight equipment slots and both cross-class ability choices.
Switching away snapshots the current selections; returning restores them. Empty
slots stay empty. First-time jobs receive compatible starter gear and empty
cross-class slots. Reconfirming the same job or saving appearance preserves the
active loadout. Existing students retain their current gear until they switch;
the first switch captures it. Saves persist across logout and devices.

Restoration checks current ownership, slot, job/material permissions, tier gates,
held-item compatibility and cross-class unlocks. Missing or unusable items fall
back to that slot's starter; an incompatible off hand is cleared. Unavailable,
native-job or duplicate cross-class abilities are cleared. Other valid choices
are retained. Inventory, shared appearance, progression and combat snapshots are
not reset. Static starter artwork remains unchanged.

Migration `0012_remembered_job_loadouts.sql` adds an empty saved-loadout map and
revision counter without changing existing equipment. Apply it before releasing
the Worker. One conditional student update saves the outgoing map and incoming
loadout together. Equipment, ability and character writes advance the shared
revision; overlapping stale writes return 409 and the existing client refreshes.
Saved maps are server-owned and cannot be submitted through equipment PATCH.
Additional slots use the shared registry and nullable active student column;
older snapshots treat newly added fields as empty.

Pending: review, migration and deployment of this change; individual equipment
art/overlays, animation, separate limb sides and future stat/acquisition balance.


## Tier 1 progression — implemented for review, not deployed

The [Tier 1 specification](combat/tier-one-equipment.md) adds 37 acquired items,
job-level-2 gates, wand/book pairing, ankh healing and potion buffs. Tier 0 remains
permanently owned and available at level 1. The new color/trim briefs are recorded;
individual equipped-item art and animation remain pending. Migration 0013 extends
the off-hand constraint for spell books and follows remembered-loadout migration 0012.


## Equipped gear art — implemented for review, not deployed

The [new static renderer](avatar-equipment-visuals.md) selects all eight slots
from actual equipment, with Tier 1 recolors and static advanced weapons on both
bodies. It supersedes the combined-starter-only visual boundary upon release.
Healer’s Laurel keeps the previous head bonus; all other head bonuses and set
budgets remain unchanged. Unknown custom gear uses neutral fallback artwork.
Owner visual review, deployment, animation and custom art remain pending.
