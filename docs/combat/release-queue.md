# Classroom polish release queue

Status: October 7, 2026. Implemented does **not** mean deployed. The owner wants
these items completed and reviewed one at a time, followed by a combined merge
and deployment. No deployment is authorized for this intermediate checkpoint.

| Item | Implementation status | Release status / next action |
| --- | --- | --- |
| October 7 battlefield, host controls, join/rejoin, participation rewards | Completed in main; live release recorded in `docs/cloudflare/full-migration.md` | Already released; reuse the existing session-code group entry |
| Priest First Aid, no-offense solo warning, healer encounter estimates | Implemented and tested in [PR #37](https://github.com/Orsnoire/FightSchool/pull/37) | Awaiting combined merge/deployment; uses MND / 3, floor, minimum 1 |
| 1. Calculated ability values | Implemented and tested in [PR #38](https://github.com/Orsnoire/FightSchool/pull/38), based on PR #37 | Awaiting review and combined merge/deployment |
| 2. Informative loot choices | Implemented and tested in [PR #39](https://github.com/Orsnoire/FightSchool/pull/39), based on PR #38 | Awaiting review and combined merge/deployment; names, icons, slot, rarity, tier and signed stats shown before claiming |
| Gear expansion and Tier 0 starters | Implemented and tested in [PR #40](https://github.com/Orsnoire/FightSchool/pull/40), based on PR #39 | Awaiting review and combined release; migration 0011 required before Worker activation |
| 3. Loadout display synchronization and Tier 0 completion | Implemented and tested in [PR #41](https://github.com/Orsnoire/FightSchool/pull/41), based on PR #40 | Awaiting review and combined release; shared cache refresh and complete starter catalog |
| Equipment permissions and explicit armor classification | Implemented and tested in `feat/equipment-permissions`, based on PR #41 | Awaiting review and combined release; no extra migration |
| Combined release | Pending | Finish the individual items, check the combined changes, merge, deploy and verify live behavior; update this table with release evidence |

## Item 1: calculated values

Combat action cards show calculated base damage, healing capacity, and relevant
shield/block/crafting/buff values. They derive values from the authoritative
player snapshot and update when stats or resources change. Resource costs and
unavailable reasons stay visible alongside the values. Question-action damage
assumes a correct answer; Headshot includes the upcoming correct answer in its
streak without consulting or exposing answer correctness.

Lobby ability cards show starting-encounter values for the currently loaded
class, equipment and progression, including the First Aid card for Priests.
Wizard previews use half maximum MP, consistent with new encounters. Temporary
combat buffs, spent resources, current streaks and target effects belong to the
combat view. General cache synchronization is implemented in item 3 below.

Fixed damage and healing magnitudes are shared with the engine. Damage previews
are base values before target bonuses, critical hits and enemy HP caps; healing
is capped by missing HP. Multi-hit and party abilities label per-hit/per-target
values. Execute and damage-dependent healing effects remain conditional. Earlier
actions can change resources and stats before resolution. No combat balance,
resource costs, targeting, timing or reward formulas are changed by this item.

Validation for item 1: `npm run check`, all 110 tests in `npm test`,
`npm run build:cloudflare`, and `git diff --check` pass. Regression coverage
compares displayed magnitudes with real engine resolution, checks Headshot's
upcoming streak, verifies resource-dependent values, and renders the actual
React combat view through a stat update. Hosted browser CI remains a separate
review check; no live deployment validation has been run for this branch.

## Item 2: informative loot choices

The result screen offers gold or one named equipment item. Each earned item card
shows its icon (with a slot fallback for missing/broken images), name, rarity,
tier, slot and all nonzero stat modifiers, including penalties. Zero-stat items
explicitly say “No stat bonuses.” Claiming puts equipment into inventory and does
not imply automatic equipping.

Details load through the existing authenticated equipment metadata endpoint,
which already allows students to inspect items in their saved earned loot tables.
Only earned IDs become choices; duplicate IDs are displayed once. Loading/error
and missing-item states offer retry and preserve the gold alternative. Items
without available metadata cannot be blindly claimed from the new UI.

All choices disable while a claim is in flight, with an immediate guard against
rapid repeated clicks. A failed claim shows an error and permits retry; success
shows the existing saved-reward confirmation. The server's existing authorization,
result ownership and exactly-once reward claim remain authoritative. Reward
amounts, loot eligibility and claim endpoints are unchanged.

Local validation: `npm run check`, all 111 tests in `npm test`,
`npm run build:cloudflare`, and `git diff --check` pass. Hosted browser CI is a
separate review check; this branch has not been deployed.

Coverage includes the real React result view sending the exact result/item IDs,
rapid repeated clicks, failed claim/retry/success, names with markup characters,
signed stats, unearned/duplicate IDs, metadata retries and broken-icon fallback.

## Gear expansion and Tier 0 starters

All gear screens expose Head, Chest, Arms, Hands, Pants, Feet, Weapon and Off hand.
A shared slot registry drives UI, validation and stat collection, with nullable
storage and starter-default hooks for later slots. Existing equipment is retained;
new starter arms have no stats. Low-stat starter gear is explicitly Tier 0, with
unchanged stats and compatibility. Upgrade tiers and gates remain unchanged.
See [starter wardrobe](../starter-wardrobe.md#october-7-expansion--implemented-for-review-not-deployed)
for migration, extension and pending-art boundaries.

Validation: `npm run check`, all 113 tests in `npm test`,
`npm run build:cloudflare` and `git diff --check` pass. Hosted browser CI and
live deployment checks remain separate; this branch is not deployed.

## Item 3: loadout display synchronization and complete Tier 0 catalog

The main lobby, guild lobby and equipment screen now subscribe to the same
student/job-level queries. They no longer keep separate copies that ignore
same-student or same-length progression updates. Opening or returning focus to
these screens refreshes the current loadout and progression. Lobby calculated
ability values wait for loadout and equipment refreshes to finish.

Character creation, class changes, equipment changes and cross-class ability
changes share a save path: serialize edits per student, use the authoritative
response, cancel older student reads and invalidate student, job-level, equipment,
currency and guild-member displays. Failed saves preserve the last confirmed
loadout and refresh server state. Purchases use the same refresh path; combat
completion and reward claims already invalidate cached queries. Inactive screens
refresh on their next visit. No active combat snapshot or resource reset is added.

Tier 0 additions are linen gloves, linen pants, cloth shoes, claws (+1 ATK) and
a spoon (+1 RTK). The existing +2 ATK `basic_claymore` is clearly labeled
“Starter Claymore (Two-Handed Sword).” All three armor categories cover six body
slots, all nine supported weapon types have a starter, and shield/potion/quiver
remain available. Cloth job defaults now include the three new zero-stat pieces.
Permanent catalog entitlements provide these items to existing and new students
without duplicated database inventory rows or replacing existing equipped gear.
No additional migration or live database seeding is needed for these additions.

Validation: `npm run check`, all 117 tests in `npm test`,
`npm run build:cloudflare` and `git diff --check` pass. Coverage includes same-ID
and same-count cache updates, inactive cache invalidation, older in-flight reads,
serialized edits, failure/retry, actual mounted equipment UI updates, complete
starter compatibility and real API claymore equip/metadata. All individual batch
items are implemented; combined review, merge, migration, deployment and live
acceptance remain pending.

## Equipment permissions and explicit armor classification

The lobby equipment panel and equipment sheet display allowed weapons, armor
categories and usable off-hand types from the shared enforcement rules. Owned
incompatible items remain visible with job, level/tier or hand-pair explanations;
they cannot be selected from these controls. The server remains authoritative.

New items in any of the six armor slots require an explicit heavy, leather or
cloth category in both the teacher form and API. Weapons/off hands cannot carry
an armor category. Partial updates validate the merged item when changing slot,
item type or category, so a PATCH cannot clear a required category or move a
weapon into an unclassified armor slot. Legacy uncategorized items retain their
existing inferred compatibility; unrelated API edits remain allowed. Editing
legacy classification, or saving it through the full teacher form, requires a
category choice. No existing items or stats are migrated or rebalanced.

Validation: type checking, all 118 tests, production build and diff checks pass.
Tests cover all six armor slots, omitted/null categories, merged PATCH checks,
legacy preservation, permission display and job/tier/hand-pair explanations.
Individual gear art, animation and per-job saved loadouts remain deferred.

## Larger work outside this batch

Individual equipment artwork/overlays and full avatar animations remain pending.
The existing starter appearance and approved static battlefield remain the
released baseline. See `docs/starter-wardrobe.md` and `docs/avatar-art-direction.md`.
