# Permanent starter wardrobe

October 5, 2026 owner direction: every student owns the starter collection, regardless of current job. Changing jobs selects compatible equipment without losing starter gear or acquired upgrades. Potion and quiver off hands are equipment; future variants may modify healing or other effects, but no such effect is defined in this release.

## Release defaults

The Expanded Class List defines jobs, weapon usage and abilities but contains no armor exclusions. The following material rules and grouped player slots were prepared as review defaults and are included in the October 5 owner-authorized static-avatar release.

| Jobs | Plate / heavy | Leather | Linen / unarmored clothing |
| --- | --- | --- | --- |
| Warrior, Paladin, Dark Knight, Blood Knight | Allowed | Allowed | Allowed |
| Scout, Ranger, Monk, Bard | Excluded | Allowed | Allowed |
| Wizard, Herbalist, Priest, Warlock | Excluded | Excluded | Allowed |

Player-facing slots are weapon, off hand, head, body, hands, legs and feet. Paired armor covers both anatomical art slots; the avatar attachment schema retains separate left/right bones and grips. This does not add independently selectable armor for each individual arm or shin. `armor` and `headgear` remain the API keys for body and head.

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

Starter body/head defenses retain the prior +1 each; sword/staff/bow/herbs retain their existing +1 attack-type or MND bonus. New limb pieces and off hands have no bonus stats pending a balance decision. All seven slots contribute declared equipment stats to the same server combat-profile calculation. Future stat-bearing potion/quiver variants require explicit design, acquisition and balance decisions.

## Art and rollout boundary

The static review covers all twelve jobs on both bodies, with separate head/headwear rendering and independent hair/eye/skin recoloring. Garments and held props within each source body sheet remain a combined starter illustration. **It is not yet an arbitrary item-by-item paperdoll renderer.** All placeholder job portraits and their imported PNGs are removed. Plate, leather and linen have empty-handed male/female bodies for missing weapons; hats are selected independently, so Priest can reuse the staff/robe with a laurel. Starter appearance is labeled in the lobby; purchased gear still affects stats even where its individual overlay art is not available. Do not mark equipment-fit or animation records ready based on these sheets.

Migration `0009_starter_wardrobe.sql` adds nullable hands/legs/feet/offhand columns and optional armor/offhand metadata. It preserves existing rows and loadouts. New compatibility rules apply to new equip requests and the next job selection; the migration does not strip or rebalance existing equipped items. The deployment must apply this migration before the new Worker is activated.

The owner approved the static collection and requested live release on October 5. Migration verification, the regular CI and authenticated classroom acceptance checks remain deployment gates. The independent [workshop](workshop-routing.md) can publish previews without deploying this database or game change.
