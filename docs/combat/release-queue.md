# Classroom polish release queue

Status: October 7, 2026. Implemented does **not** mean deployed. The owner wants
these items completed and reviewed one at a time, followed by a combined merge
and deployment. No deployment is authorized for this intermediate checkpoint.

| Item | Implementation status | Release status / next action |
| --- | --- | --- |
| October 7 battlefield, host controls, join/rejoin, participation rewards | Completed in main; live release recorded in `docs/cloudflare/full-migration.md` | Already released; reuse the existing session-code group entry |
| Priest First Aid, no-offense solo warning, healer encounter estimates | Implemented and tested in [PR #37](https://github.com/Orsnoire/FightSchool/pull/37) | Awaiting combined merge/deployment; uses MND / 3, floor, minimum 1 |
| 1. Calculated ability values | Implemented and locally tested in `feat/calculated-ability-previews`, based on PR #37 | Awaiting review and combined merge/deployment |
| 2. Informative loot choices | Pending | Next item: show item name, icon and stats before claiming; current result buttons say “Claim equipment” |
| 3. Loadout display synchronization | Pending | Refresh/invalidate student, equipment and job-level data consistently after class/equipment changes; the First Aid solo-entry freshness check is only a scoped safeguard |
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
combat view. General cache synchronization remains item 3.

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

## Larger work outside this batch

Individual equipment artwork/overlays and full avatar animations remain pending.
The existing starter appearance and approved static battlefield remain the
released baseline. See `docs/starter-wardrobe.md` and `docs/avatar-art-direction.md`.
