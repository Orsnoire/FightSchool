# Additive, role-weighted encounter HP — October 19, 2026

Owner-authorized balance change in [PR #77](https://github.com/Orsnoire/FightSchool/pull/77).
The first implementation passed local and remote checks, but the owner has
expanded/corrected the requirements below. PR #77 remains incomplete, draft,
not merged and not deployed.
This supersedes the earlier HP formulas in the classroom, enemy-wave and swarm
specifications. C12 release review remains separate in PR #75.

## October 19 follow-up — required corrections, not yet implemented

The owner clarified that the question coefficient replaces 0.5 with
`idealized four-player party output / 2`. Interpret output as average damage per
question, not whole-quiz damage, so quiz length is counted once. The first draft
below incorrectly omitted that output baseline. Do not release its raw-HP formula.

Confirmed requirements:

- Keep the named player weights below and add the player and question terms.
  The question term is `question count * (reference average output / 2)`.
  The proposed corrected pool is
  `floor(weighted players + questions * (tier reference average output / 2))`.
  Tier selects reference stats, equipment and abilities; applying another numeric
  tier multiplier would scale the reference output a second time. This corrects
  the earlier assistant explanation, which treated the scaling sum as raw HP.
- The entire encounter has one HP cap. All swarmers across ALL waves share
  ONE 25% allocation for the whole fight (final owner clarification). Neither
  wave count nor population multiplies that allocation.
  Remove any species HP bonus that would exceed the encounter cap.
- Maximum/total HP and current HP must be integers for players and enemies.
  Floor calculated maximum HP. Ceil calculated current HP, then clamp to
  `[0, maxHealth]`. Starting current HP equals the integer maximum. Damage/heal
  events and statistics must report the actual resulting HP change. Apply the
  rule to allocation, late-entry rescaling, damage, healing, temporary maximum-HP
  effects and recovery, with an explicit compatibility decision for active rooms.
- Target a swarmer surviving one or at most two regular attacks. Use this as a
  balance regression against reference basic attacks, not an independent HP
  bonus that exceeds its wave's budget.
- Audit Wizard basic damage. Change Fireball and cross-class Fireball from 1 MP
  to 2 MP. New Wizard entrants and previews start at full maximum MP, calculated
  by the existing `(INT + MND) * 3` formula; remove the half-MP initialization.
  Preserve spent MP for existing participants/reconnections. Update reference
  simulation and visible costs consistently.
- Monster Magic Defense is `2 * (tier - 1)`: tiers 1–4 use 0/2/4/6. Magical
  damage, including Wizard's MAT+INT basic attack, uses MDF separately from
  physical DEF. Per-family MDF overrides are deferred.

### Implemented Wizard checkpoint

Fireball now costs 2 MP in selection, resolution, cross-class metadata and UI.
Wizard initialization, lobby preview and the current reference party use full
`(INT + MND) * 3` MP. Existing participant resources are not refilled. Basic
attack is verified as `MAT + INT` (3 with starter gear before defense/critical
hits), consistent with the class specification; its formula is unchanged.
The current reference simulator now consumes Fireblast's all-MP cost. A separate
historical reference path preserves already-running encounters' old HP budgets.
The corrected HP allocator remains pending at this checkpoint.

MDF is implemented locally: every new monster receives `2 * (tier - 1)`
(0/2/4/6). Magical hits subtract MDF only, physical hits use DEF and its existing
buffs. Existing active rooms with no MDF retain their old defense behavior.
Basic/spell/cross-class/AoE/DOT paths, lobby/start/public projection and JSON
recovery are covered. All 315 tests, TypeScript and both builds pass locally.

Validation: 311 tests, TypeScript and both production builds pass locally.
The historical C10 file is unchanged: 79 unaffected traces still match its
hashes; the intentionally changed Wizard/Fireball trace is covered by explicit
resource/damage tests. Every new trace, including Fireball, matches across JSON
recovery. New tests cover basic damage, two-MP affordability and cross-class
spending, full-MP lobby/reference initialization and finite Fireblast simulation.

Read-only audit of the currently deployed calculation:

- At tier 1 with 30 questions, the reference Warrior/Priest/Wizard/Scout party
  estimates 651 damage across the whole quiz (60 + 0 + 140 + 451).
- At 20 players, the old pool is `651 * (20 / 4) * 1.1 = 3580.5`.
  A group of 25 leader-role enemies therefore receives 35.805 HP **each**.
  This reproduces the reported magnitude; the reported live fight's saved role
  configuration was not inspected, so its exact cause is not established.
- Goblin-trash HP also adds 1% per three goblins after role allocation. A
  100-HP fixture containing all roles and ten goblins allocates 100.3 HP,
  demonstrating a separate cap violation.
- Using raw average whole-party output per question gives `651 / 30 = 21.7`.
  The proposed question-only coefficient gives
  `floor(20 + 0.5 * 30 * 21.7) = 345` HP at tier 1 and a swarm budget of
  `floor(345 * 0.25) = 86` HP. This example treats all 20 players as full DPS;
  support-job discounts lower the pool.
- The reference simulator also repeats Fireblast without spending its all-MP
  cost. This inflates tier-4 output; correct the new HP coefficient's simulation
  before using it. Preserve or explicitly version historical active-room rules.

The owner resolved the earlier wave-allocation conflict: all swarms collectively
share 25% of the whole fight, not 25% per wave. Integer allocation must never
inflate that share. Configurations that cannot give every authored individual
positive integer HP need an explicit start-time validation error.

The proposed coefficient uses the existing bounded rotation over the quiz length
to account for resource depletion and ramping abilities, divides its damage by
the question count, then divides by two. It excludes the old extra 1.1 HP margin.
Thus the raw reference average can vary with quiz length; it is not a constant
per-tier lookup. Record any further owner correction before implementation.

The following sections describe the **superseded first draft** until these
corrections are implemented and verified.

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
