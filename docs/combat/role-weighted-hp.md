# Additive, role-weighted encounter HP — October 19, 2026

Owner-authorized balance change in [PR #77](https://github.com/Orsnoire/FightSchool/pull/77).
Implementation and local verification are complete; not merged or deployed.
This supersedes the earlier HP formulas in the classroom, enemy-wave and swarm
specifications. C12 release review remains separate in PR #75.

## Full encounter pool

```
full HP pool = tier * (sum(player weights) + 0.5 * question count)
```

| Jobs | Player weight |
| --- | ---: |
| Warrior, Monk | 0.33 |
| Herbalist, Paladin | 0.25 |
| Priest | 0 |
| Wizard, Scout, Warlock, Ranger, Bard, Dark Knight, Blood Knight | 1 |

The question contribution is added once for the entire encounter, not once per
player, enemy or wave. Tier multiplies that sum exactly once. There is no additional
damage-estimate, gear, level, 0.9 or 1.1 HP multiplier. Solo and duo HP use this same
formula. Cross-class offensive abilities do not change Priest's zero weight.
Questions still contribute HP to an all-Priest fight; the existing solo warning
for loadouts without offensive abilities remains applicable.

Example: four DPS, one Warrior, one Paladin and one Priest contribute 4.58 players.
Ten questions add 5, making the full pool 9.58 at tier 1 or 19.16 at tier 2.

## Allocation and unrelated balance rules

For individual-enemy encounters, bosses share 50%, leaders 25%, normals 15% and
trash 10% of the pool across all waves. Each role divides its share equally among
its individuals. An absent role leaves its share unused. The existing goblin-trash
allocation bonus of 1% per three goblins remains; the full pool above is before
that species-specific bonus. Fractional HP rounds to three decimal places with a
0.001 minimum per individual, so rounding can slightly affect the allocated total.

Legacy fight definitions without individual-enemy rules use the same full pool,
with tier 1 when no tier is set, and retain their difficulty-proportional division.
Their former whole-basic-attack rounding and survivability HP adjustment no longer
override the pool. Their solo outgoing-damage cap remains.

Enemy outgoing pressure, attack stats, question mechanics, rewards, role XP shares,
swarm headcount thresholds and locked enemy counts are unchanged. The reference
party and entry performance still determine outgoing pressure, not new-fight HP.

## Session behavior and compatibility

Lobby preview and Start Fight use the same calculator and current selected jobs.
For new individual-enemy sessions, persist each participant's entry weight and the
full pool. At a late-entry boundary, add a new participant only once, retain
departed participants' contributions, preserve surviving enemies' HP percentages,
and keep defeated enemies defeated. A Priest adds no HP, even across the old
two-to-three-player threshold. Reconnection does not add another contribution or
change the original job weight. Swarm counts continue to use actual attendance,
including Priests, and lock at Start Fight.

Already-running sessions retain their saved HP and historical late-entry formula.
Missing entry weights identify that historical behavior. New fields are optional
server-only snapshot data, so no database migration or saved-room reset is needed.
Legacy-definition active fights retain their existing no-late-rescaling behavior.

## Verification

Regression coverage checks all twelve job weights, all four tiers, additive player
and question increments, solo/all-Priest groups, exact examples, role allocation,
unchanged outgoing pressure and swarm attendance, preview/start equality, late
entry, departure/re-entry and JSON recovery. Pre-change starting allocations were
captured from main `7cd6fab97c5306514a04d6e591ba3d5495dd0d8e` before implementation;
they exercise historical active-room behavior against the unchanged C10 hashes.
New-balance traces also compare normal execution with JSON recovery at every step.
Local validation: all 308 tests, TypeScript and client/Worker production builds
pass. The final entry-estimate sharing change also passes the 19 focused
HP/preview/replay/swarm tests, TypeScript and Worker build. Local Node is 24.19.0;
the PR's existing CI runs Node 22. See the PR/checkpoint for exact published SHA
and CI/browser results.
