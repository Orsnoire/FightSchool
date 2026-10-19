# Additive, role-weighted encounter HP — October 19, 2026

Owner-authorized balance change in [PR #77](https://github.com/Orsnoire/FightSchool/pull/77),
with the later full-output coefficient and adaptive tier follow-up in
[PR #78](https://github.com/Orsnoire/FightSchool/pull/78).
This supersedes older HP formulas and the initial draft of this PR. See
[ACTIVE_WORK](../ACTIVE_WORK.md) for verification and release status. Separate
from C12 release review; no production-data changes are required.

## Full encounter pool

```
question coefficient = idealized four-player party average raw damage per question
full HP pool = floor(sum(player weights) + question count * question coefficient)
```

The [effective encounter tier](adaptive-encounter-tier.md) selects the existing reference Warrior/Priest/Wizard/Scout party's stats,
equipment and abilities. Do not multiply the resulting pool by tier again.
The bounded reference rotation runs over the actual quiz length, accounting for
finite MP and ramping abilities. Its average output can therefore vary with quiz
length. This is raw potential damage before enemy DEF/MDF. Sum the reference
rotation damage directly to avoid floating-point round trips.
The old 1.1 margin and player-count multiplier no longer apply to HP.

| Jobs | Player weight |
| --- | ---: |
| Warrior, Monk | 0.33 |
| Herbalist, Paladin | 0.25 |
| Priest | 0 |
| Wizard, Scout, Warlock, Ranger, Bard, Dark Knight, Blood Knight | 1 |

Player and question contributions are additive. Actual players' gear and
cross-class loadouts do not change HP weights or the reference party. Solo/duo
and all-Priest fights use the same coefficient; the existing warning for a
non-offensive solo loadout remains. The old guarantee that a solo legacy fight
fits its character's own damage/survival window is superseded by this shared
reference formula; legacy solo incoming-damage caps remain.

## One role allocation for the whole fight

| Enemy role | Share of full HP pool |
| --- | ---: |
| Swarm/trash (`trash`) | 10% |
| Normal | 15% |
| Leader | 25% |
| Boss | 50% |

All individuals of a role across **every wave** divide that role's one share:

```
role budget = floor(full HP pool * role share)
individual maximum HP = max(1, floor(role budget / total individuals of that role))
```

Five swarm waves share 10% altogether, not 10% each. The same rule applies to
normal, leader and boss waves. Missing roles leave their shares unused. Rounding
remainders are not redistributed. Remove the old goblin HP bonus entirely from
new encounters. Adding waves or enemies never multiplies the budget.

**Explicit owner-approved exception:** every individual has at least 1 maximum
HP, even when the number of enemies exceeds its role's HP budget. Such a fight
may exceed the nominal pool solely because of this minimum; it can still start.

Swarm/trash is intentionally extremely weak; its pressure comes from numbers.
The target is one or at most two regular attacks per swarmer. This target does
not add another HP bonus or override the shared-budget formula. The existing
Swarm checkbox controls attendance-based population growth independently of
role/species; it does not silently turn a boss into trash.

Legacy definitions without role/quantity rules use the same full pool, divide it
in proportion to difficulty, floor each maximum and apply the same 1 HP minimum.
No tier defaults to tier 1. Their existing no-late-rescaling behavior remains.

### Reported encounter regression

At tier 1 and 30 questions the reference party estimates 651 raw damage:
60 Warrior + 0 Priest + 140 Wizard + 451 Scout. The coefficient is 21.7.
With 20 full-DPS players, the pool is `floor(20 + 30 * 21.7) = 671`.
Swarm/trash receives `floor(671 * 0.10) = 67` HP. Twenty-five swarmers therefore
receive **2 HP each**, whether in one wave or five waves of five. Support-player
discounts reduce the pool further, subject to the same minimum.

The deployed old formula would produce `651 * (20 / 4) * 1.1 = 3580.5` HP.
Twenty-five leader-role enemies would receive 35.805 HP each. This reproduces the
reported magnitude, but the actual live fight's saved roles were not inspected.
The old goblin-trash bonus could separately exceed the nominal role budget.

## Integer HP throughout combat

For newly scaled fights, player/enemy maximum HP always rounds down. Current HP
rounds up and clamps to `[0, maximum HP]`; current HP may reach zero on defeat.
Starting current HP equals the floored maximum. Damage/heal events and statistics
report actual HP changes after rounding. This includes damage caps, healing,
self costs, temporary maximum-HP effects, late-entry percentages and recovery.
A temporary HP buff records its actual integer maximum increase so expiry removes
exactly that increase. MP retains its own rules.

Lobby preview and Start Fight use the same calculation. New participant weights
are frozen at admission and counted once. Late arrivals add only their weight,
retain prior contributions after departure, and rescale surviving enemies by
remaining percentage with current HP rounded up. Dead enemies stay dead. A Priest
adds no HP. Reconnecting does not refill HP/MP or count a participant twice.
Population scaling still counts actual attendance, including Priests, and enemy
counts lock at Start Fight.

Existing active rooms without `encounterTier` retain the preceding half-reference
coefficient for late-entry HP updates; new rooms lock their effective tier and use
full reference output. Rooms without `encounterHpPool` retain their saved fractional
HP rule, old allocation and historical reference calculations until completion.
Recovery normalizes only new-rule rooms and preserves spent resources. No room
reset, database migration or live-data rewrite is required.

## Wizard and magic defense

- Wizard basic attack is **MAT + INT**, unchanged: starter MAT 1 + INT 2 = 3 raw.
- Fireball and cross-class Fireball cost **2 MP** throughout selection, execution
  and visible descriptions.
- New Wizard entrants, previews and current reference parties start with full
  **`(INT + MND) * 3` MP**. There is no 3-MP cap or half-MP initialization.
- The reference simulator consumes Fireblast's all-MP cost rather than repeating
  full-power Fireblast every question. Historical HP reference paths remain
  compatible for active old rooms.
- New monster Magic Defense is **`2 * (tier - 1)`**, giving **0, 2, 4, 6** at tiers
  1–4. Magical basics, spells, cross-class spells, AoE and magical DOT subtract MDF
  only. Physical hits use DEF; physical defense buffs do not increase MDF.
  Per-family MDF is deferred. Old active monsters lacking MDF retain their saved
  defense behavior.

## Verification

Tests cover every job/tier, frozen reference outputs, additive attendance and
question terms, whole-fight role budgets over five waves, missing roles, the
25-swarmer example, the 1 HP exception, preview/start parity, late entry and
re-entry, integer mutations/temporary buffs/recovery, Wizard resources and damage
routing. Historical C10 baseline files remain unchanged: 79 unaffected traces
retain their hashes; Fireball's authorized resource change is directly tested.
All new replay scenarios compare execution with JSON recovery at every step.
All 320 local tests, TypeScript and both production builds pass. See the PR and
checkpoint for exact published head and CI/browser results before release.
