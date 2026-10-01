# Classroom balance and daily stamina

These rules implement the October 1, 2026 classroom feedback. They follow the
Source of Truth hierarchy and supersede older conflicting combat presentation
and progression rules. This document describes the proposed release; deployment
requires the additive migration and Worker rollout.

## Daily XP stamina

Stamina changes combat XP only. It does not prevent play or reduce combat stats,
gold, loot, or teacher quest rewards. The first completed fight receives full XP.
After `n` completed combats on the current Mountain date, the next fight uses:

```
a = -ln(0.89 / 0.99)
b = ln(ln(990) / a) / ln(10)
multiplier(n) = 0.01 + 0.99 * exp(-a * n^b)
```

This is a calibrated stretched exponential, not a statistical regression. Its
first reduction is 10%, its decay rate increases, and its floor is 1%.

| Fight today | XP multiplier |
| --- | --- |
| 1 | 100% |
| 2 | 90% |
| 3 | 69.1% |
| 5 | 27.7% |
| 7 | 7.4% |
| 10 | 1.3% |
| 11 | 1.1% |
| Later | Approaches 1% |

The counter belongs to the student, across all jobs, guilds, classroom rooms, and
solo rooms. A completed win or loss counts after at least one resolved question,
even if it earns no XP. An untouched room ended by the teacher does not count.
Only persisted results count; quitting without a result grants no XP. The date
is the database award date in `America/Denver`. The next date starts fresh at
midnight, including 23-hour and 25-hour daylight-saving days. Replaying an old
result never changes today's stamina.

Migration `0008_daily_combat_stamina.sql` adds counters and result audit fields.
A single batched database function locks students in sorted order, checks the
unique session/student receipt, calculates the multiplier, inserts the result,
and awards XP/gold atomically. Concurrent rooms cannot both claim the same
stamina position. This retains the bounded classroom query budget. The browser
cannot choose an XP award or modify the counter. Existing results and XP are
preserved; historical fights are not retroactively charged against stamina.

Whole XP is credited while a fractional remainder carries forward across fights,
jobs, and dates. This prevents low awards at the 1% floor from disappearing or
being rounded up to one XP every fight. Results retain base XP, the applied
multiplier, and the daily fight number. The UI shows the current rate in the lobby,
fight library, guild lobby, and combat overlay, refreshing at midnight and after
results. Another concurrent completion can change the rate before a fight ends.

This is a soft limit, not an absolute daily XP ceiling. A sufficiently valuable
fight or enough fights can still earn substantial XP. The current level-15
threshold remains 630 total job XP; base reward tuning and per-fight farming
limits are separate product decisions.

## Block and threat

Support selection has a 20-second server deadline, still ending early when all
living players are ready. The Warrior's Block target grid opens on entering this
phase. Selecting an ally tile saves the support action immediately. Tiles show
nickname, numeric threat, numeric HP percentage, and HP color; high-threat allies
sort first. Every living ally remains selectable. Other ally-targeted abilities
use the same grid, sorted by missing health percentage when appropriate.

Block and Shield Bash transfer `floor(target.threat / 2)` to the blocker once per
blocker/target/round, after answer and damage-over-time resolution and before the
enemy counterattack. The original target loses exactly that amount. Self-blocks
transfer nothing, and choosing both abilities for the same target cannot transfer
twice. Block protection is established before wrong-answer damage. Existing
threat from actual blocked damage is preserved, and transfers appear in feedback.

Inspection found Wizard damage adds `max(0, actualDamage - AGI)` threat per hit;
there is no additional Wizard-specific multiplier or duplicate Fireball threat
award in this path. Fireball's damage and its cumulative threat can nevertheless
outpace Warrior basic attacks. Tests cover actual spell threat and the transfer
including current-round spell damage. No arbitrary Wizard-only threat reduction
is introduced.

## Potions

Healing potions have five visible bottle placeholders and a numeric inventory.
Empty stock replaces Healing Potion with **Create potion**, restoring exactly
one potion and doing no healing or damage. It is available from level one and
with the cross-class healing-potion ability. It remains a question action that
requires a correct answer, like other crafting. Crafting while stock remains
preserves level-based bonuses and the five-potion cap. Full inventories reject
crafting. Shield potion behavior and its three-potion cap are preserved.

## Encounter HP and solo play

The old classroom formula was `10 * difficulty * attendance`, unrelated to quiz
length or player damage. At the start of a new encounter, the total HP budget is:

```
ceil(0.9 * numberOfQuestions * sum(playerBasicDamage))
```

The budget is shared among enemies proportionally to their difficulty, rounding
each enemy up to at least one HP. It is not multiplied again by attendance,
difficulty, or number of enemies. Difficulty still scales enemy counterattack
damage and gold rewards. The teacher authoring help explains this change.

At perfect accuracy with basic attacks, this targets about 90% of the question
count. At 72% accuracy and unchanged damage/attendance, the same budget takes
about 125%. These are calibration points, not promises for every composition:
healing/crafting turns, spells, critical hits, deaths, and integer rounding affect
actual duration. Answer speed itself currently has no damage multiplier.

Solo rooms use the same quiz-based starting budget, cap the entire enemy
counterattack phase by `max(1, floor(playerHP / questionCount))`, and lower total
HP where necessary for survivability. Enemy shares use whole basic-attack units
so separate rounding does not create extra fatal rounds. Wrong-answer penalties
remain unchanged. These protections are tested for all four starting jobs in
single- and two-enemy encounters; configurations with more enemies than a solo
player can survive in one-hit rounds still need encounter design review.

Scaling runs only while waiting, before the first question. Reconnects and
restarts cannot rescale a running encounter. Already-running rooms retain their
HP. This release does not reset student data, job XP, or ongoing encounters.

## Validation and remaining balance discussion

Coverage includes Denver midnight/DST, TypeScript/SQL curve agreement, fractional
XP, retries and concurrent room completions, job/mode sharing, 30-player query
budgets, empty/full potion inventories, threat conservation and self-targeting,
quiz-length HP scaling, and base-job solo survival. The real React overlay test
exercises empty-stock crafting and immediate selection from a 20-player grid.
The browser acceptance script covers these views at 1366×768 and 390×844.

Fireball and Headshot formulas are unchanged in this release. The owner's desired
shape is high early Wizard damage tapering over the fight, with Scout damage
building over time. A proposed test candidate is Headshot damage
`3 * (RTK + AGI)`, spending 3 CP and returning 2 CP total on a damaging success.
This is not an approved/shipped rule; the current multiplicative formula and
one-CP gain remain active pending a product decision. Two-CP recovery improves
sustained cadence, but a smooth continuing ramp would need a separate persistent
mechanic. INT currently increases both Wizard damage and starting MP, so a
short-fight taper at higher levels also requires mana-economy tuning.

The subsequent proposal is to halve Wizard starting MP specifically. With starting
stats this permits three 6-damage Fireballs, then 3-damage basic attacks. Combined
with the proposed 9-damage Headshot and two-CP total return, an all-correct Scout
would pass the Wizard's cumulative damage around round six (ignoring criticals).
Halving starting MP is also still a proposal; it is not implemented in this patch.
