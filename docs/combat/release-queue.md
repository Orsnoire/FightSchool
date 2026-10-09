<a id="classroom-polish-release-queue"></a>

# COMPLETE / HISTORICAL — October 7–8 classroom polish release batch

> **COMPLETE RELEASE BATCH — reconciled October 9, 2026.** The active development
> queue is now the [cleanup plan](../CLEANUP_PLAN.md); expansion is [deferred](../EXPANSION_PLAN.md).
> The dated implementation/test counts below describe their original checkpoints.
> [Current status](../CURRENT_STATUS.md) records the latest runtime and known defects,
> including built-in loot claiming (F01). Released does not mean defect-free.

**October 8 release status:** PRs #43–46 are merged and deployed. The original
R2 HTTP 403 was limited to attempt 1 of run `37773374205`;
[attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/37773374205/attempts/2)
passed at 12:21 UTC, including migrations, Worker publication and both hostnames.
The 17:12 UTC checkpoint [deployment 37814586746](https://github.com/Orsnoire/FightSchool/actions/runs/37814586746)
published runtime `764cd2fe2d544733c8e10fdace84084cbbfe94aa`, Worker
`926af6a1-eb8b-4fd0-8c3b-9941ece77aad`, at 17:12 UTC. It also includes PRs #47
and #49. [Canonical live acceptance 37816148964, attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/37816148964/attempts/2)
passed at 17:28 UTC with PR #50's corrected fixtures. See the
[release and migration record](../cloudflare/full-migration.md#gear-release-recovered-and-verified--8-october-2026)
for evidence that migrations 0012/0013 were covered by the successful 12:21 gate,
0014 by the 15:31 gate, and all three by the 17:12 gate. This is migrator/journal
evidence, not an independent query of live schema or migration-ledger rows.

Later on October 8, PR #52 released enemy AI/recovery and individual enemies/waves
at `e158194`. [Deployment 37844054859](https://github.com/Orsnoire/FightSchool/actions/runs/37844054859)
and [live acceptance 37844271331](https://github.com/Orsnoire/FightSchool/actions/runs/37844271331)
passed. This is the latest verified runtime for the October 9 cleanup baseline.


Previous release: October 7, 2026. PRs #37–42 were reviewed, merged and deployed as
`41a372c039d00421882e37044830abaa9218b427`. Deployment run
[37717016937](https://github.com/Orsnoire/FightSchool/actions/runs/37717016937)
passed the migration gate and both hostname smoke checks. Live acceptance evidence
is recorded in [the release record](../cloudflare/full-migration.md).

| Item | Implementation status | Release status / next action |
| --- | --- | --- |
| October 7 battlefield, host controls, join/rejoin, participation rewards | Completed in main; live release recorded in `docs/cloudflare/full-migration.md` | Already released; reuse the existing session-code group entry |
| Priest First Aid, no-offense solo warning, healer encounter estimates | Implemented and tested in [PR #37](https://github.com/Orsnoire/FightSchool/pull/37) | Released October 7; see release evidence above |
| 1. Calculated ability values | Implemented and tested in [PR #38](https://github.com/Orsnoire/FightSchool/pull/38), based on PR #37 | Released October 7; see release evidence above |
| 2. Informative loot choices | Implemented and tested in [PR #39](https://github.com/Orsnoire/FightSchool/pull/39), based on PR #38 | Released October 7; see release evidence above |
| Gear expansion and Tier 0 starters | Implemented and tested in [PR #40](https://github.com/Orsnoire/FightSchool/pull/40), based on PR #39 | Released October 7; see release evidence above |
| 3. Loadout display synchronization and Tier 0 completion | Implemented and tested in [PR #41](https://github.com/Orsnoire/FightSchool/pull/41), based on PR #40 | Released October 7; see release evidence above |
| Equipment permissions and explicit armor classification | Implemented and tested in [PR #42](https://github.com/Orsnoire/FightSchool/pull/42), based on PR #41 | Released October 7; see release evidence above |
| Remembered loadouts per job | Merged in [PR #43](https://github.com/Orsnoire/FightSchool/pull/43) | Released October 8; migration 0012 covered by successful gate |
| Tier 1 gear, reduced VIT damage scaling and fallback loot | Merged in [PR #44](https://github.com/Orsnoire/FightSchool/pull/44) | Released October 8; migrations 0012/0013 covered by successful gate |
| Gear comparisons, including loot and shop | Merged in [PR #45](https://github.com/Orsnoire/FightSchool/pull/45) | Released October 8; no additional migration |
| Equipped gear and Tier 1 art | Merged in [PR #46](https://github.com/Orsnoire/FightSchool/pull/46) | Released October 8; front-facing static artwork; no additional migration |
| Guild quests and classroom tiers | Merged in [PR #47](https://github.com/Orsnoire/FightSchool/pull/47) | Released October 8; migration 0014 covered by successful gate; classroom tuning remains open |
| Explicit hosted-session Join / End / Launch | Merged in [PR #49](https://github.com/Orsnoire/FightSchool/pull/49) | Released October 8; host-session live acceptance passed |
| Enemy AI, answer-based recovery, individual enemies/waves and goblins | Merged in [PR #52](https://github.com/Orsnoire/FightSchool/pull/52) | Released October 8; fixed quantities; team race and party-scaled counts remain future |
| October 7 combined release (#37–42) | Deployed | Migration 0011 applied; existing data preserved; see release record for live validation |

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
React combat view through a stat update. Hosted browser CI passed for the implementation PR; see the combined release
record above for deployment and live validation.

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
`npm run build:cloudflare`, and `git diff --check` pass. Hosted browser CI passed; the combined release is now deployed.

Coverage includes the real React result view sending the exact result/item IDs,
rapid repeated clicks, failed claim/retry/success, names with markup characters,
signed stats, unearned/duplicate IDs, metadata retries and broken-icon fallback.

## Gear expansion and Tier 0 starters

All gear screens expose Head, Chest, Arms, Hands, Pants, Feet, Weapon and Off hand.
A shared slot registry drives UI, validation and stat collection, with nullable
storage and starter-default hooks for later slots. Existing equipment is retained;
new starter arms have no stats. Low-stat starter gear is explicitly Tier 0, with
unchanged stats and compatibility. Upgrade tiers and gates remain unchanged.
See [starter wardrobe](../starter-wardrobe.md#october-7-expansion--released-october-7-2026)
for migration, extension and pending-art boundaries.

Validation: `npm run check`, all 113 tests in `npm test`,
`npm run build:cloudflare` and `git diff --check` pass. Hosted browser CI passed; the combined release is now deployed.

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
starter compatibility and real API claymore equip/metadata. All individual batch items are implemented and deployed; see the release
record above for combined review and live acceptance evidence.

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
Individual gear art and per-job saved loadouts were released October 8 as recorded
below. Full animation remains deferred.

<a id="remembered-loadouts-per-job--review-pending"></a>

## Remembered loadouts per job — released October 8, 2026

Switching jobs now saves and restores eight gear slots and two cross-class
ability slots, including deliberately empty selections. New jobs start with
starter gear and empty cross-class choices. Restoration revalidates current
ownership and equipment/ability restrictions, with starter fallbacks for invalid
gear. Shared revisions prevent concurrent character/equipment/ability writes
from silently overwriting each other. Existing characters are preserved by
additive migration 0012. See [starter wardrobe](../starter-wardrobe.md#remembered-job-loadouts--released-october-8-2026).

Validation covers real Worker/database round trips, all eight custom upgrades,
ability restoration, empty slots, relogin, same-job preservation, changed item
tiers, duplicate ability rejection and concurrent saves returning 409 atomically.
Type checking, all 120 tests, the production build and diff checks pass.
PR #43 is merged and deployed; migration-gate and live acceptance evidence are
recorded in the October 8 release record above.

<a id="larger-work-outside-this-batch"></a>

## Larger work outside this completed batch

Front-facing static equipment artwork/overlays are released. Full avatar
animations, near-profile fitting and custom-item artwork remain pending.
The static battlefield remains the released baseline. See `docs/starter-wardrobe.md`
and `docs/avatar-art-direction.md`. Team race and party-scaled swarm counts
remain future implementation in the [expansion plan](../EXPANSION_PLAN.md).
Cleanup must finish before new feature development resumes.


<a id="tier-1-gear-and-fallback-loot--review-pending"></a>

## Tier 1 gear and fallback loot — released October 8, 2026

See [the Tier 1 specification](tier-one-equipment.md) for all 37 items, exact
budgets, level-2 gate, wand/book rules, ankh/potion effects, halved tank VIT damage
weighting, and four stable random reward choices for new unassigned instances.
PR #44 is merged and deployed, with static equipment art released in PR #46.
Existing assigned loot tables and defensive VIT benefits remain.


<a id="gear-comparisons--review-pending"></a>

## Gear comparisons — released October 8, 2026

[Gear comparison behavior](equipment-comparisons.md) covers hover/focus/tap
previews, signed stat differences, special effects and forced off-hand losses
in gear pickers, the guild shop and loot rewards. PR #45 is merged and deployed.
Static art and overlays were released in PR #46; animation remains pending.


<a id="equipped-gear-and-tier-1-art--review-pending"></a>

## Equipped gear and Tier 1 art — released October 8, 2026

[Static equipped visuals](../avatar-equipment-visuals.md) are implemented after
gear comparisons, with independent slot choices, saved/combat loadout snapshots,
both-body Tier 1 recolors and missing weapon props. Healer’s Laurel is renamed;
previous head bonuses and set budgets are unchanged. No new migration.
PR #46 is merged and deployed; subsequent canonical live acceptance passed.
Animation rigs/clips, near-profile fitting and custom-item art remain pending.
