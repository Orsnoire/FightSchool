# Classroom balance and daily stamina

These rules implement the October 1, 2026 classroom feedback. They follow the
Source of Truth hierarchy and supersede older conflicting combat presentation
and progression rules. This release was deployed on October 1, 2026, including
the additive migration and Worker rollout. See the release record in
[Worker migration and combat recovery](../cloudflare/full-migration.md).

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

## Validation and approved Wizard/Scout balance

Coverage includes Denver midnight/DST, TypeScript/SQL curve agreement, fractional
XP, retries and concurrent room completions, job/mode sharing, 30-player query
budgets, empty/full potion inventories, threat conservation and self-targeting,
quiz-length HP scaling, and base-job solo survival. The real React overlay test
exercises empty-stock crafting and immediate selection from a 20-player grid.
The browser acceptance script covers these views at 1366×768 and 390×844.

The owner approved this balance on October 1: high early Wizard damage tapering
over the fight, with Scout damage building over time. The 1.25x damage goal is a
minimum, not an exact target. The implemented rules are:

- Halve Wizard starting MP, rounding down; starting stats give 3 MP and three
  6-damage Fireballs. Maximum MP and other jobs' starting MP are unchanged.
- Headshot deals `floor(2 * (RTK + AGI) + 0.5 * consecutiveCorrectAnswers)`.
- Count the current correct answer, so the first Headshot on question four deals
  8 damage with starting equipment.
- Spend 3 CP and return 2 CP total on a damaging Headshot; basic damage returns 1 CP.
- A wrong or unanswered question costs 1 CP (minimum zero) for Headshot users,
  including equipped cross-class Headshot; it also resets the damage streak.
  Other combo jobs retain their existing miss behavior.
- Correct answers build the streak regardless of action; damaging Headshots return
  2 CP total, not 2 plus the regular 1. Failed attacks cannot earn the refund.
- The streak persists across rounds, quiz cycles, and reconnects, and starts at
  zero in each new encounter. Older saved rooms default missing streaks to zero.
  Existing MP is preserved in running rooms; new Wizard entrants start at half MP.
- Students can see their current correct-answer streak with their combat resources.

With perfect accuracy, no critical hits, and sufficient enemy HP, Scout totals after questions
1–10 are `3, 6, 9, 17, 20, 29, 32, 42, 45, 56`; Wizard totals are
`6, 12, 18, 21, 24, 27, 30, 33, 36, 39`. Scout overtakes on question six, exceeds
1.25 times Wizard's damage on question eight, and finishes at about 1.44 times.

With one miss in the ten-question Scout sequence, a one-CP penalty and a full
streak reset produce 41–45 damage depending on miss position. An eight-correct
Wizard deals 33; eight of the ten Scout miss positions exceed the 1.25 target,
and two finish at 41/33 (about 1.24). These are accepted starting balance numbers,
not a guarantee across accuracy patterns: eight-correct Scout versus seven-correct
Wizard reaches 1.25x in only 3 of 45 miss patterns. Higher-level mana, equipment,
other abilities, and knockouts also affect the comparison. Regression tests run
the actual engine through the perfect ten-question sequence, misses, timeouts,
cross-class Headshot, and storage round-trips.

## Priest First Aid (review branch, not deployed)

Priest's basic attack is replaced by free **First Aid**, an ally-targeted question
ability healing `max(1, floor(Mend healing / 3))`. Mend still heals MND for 1 MP;
First Aid uses the same MND stat, so a starting Priest heals 1 HP. Both require a
correct answer. First Aid can target any living participant, including self,
cannot resurrect, and grants healing totals and threat only for actual restored HP.

The default action is self First Aid, including unanswered questions and host
resurrection. Wrong/missing answers do no healing and retain the wrong-answer
penalty. The server rejects Priest Attack commands. Saved active, queued, and
departed Priest loadouts replace obsolete Attack with First Aid on recovery,
including retargeting an old Attack choice to self. HP, MP, totals, question state,
phase deadlines and enemy HP are preserved; finished receipts are unchanged.

Encounter estimates contribute zero damage for a loadout without an offensive
ability; an equipped offensive cross-class ability restores a damage estimate.
The current basic-damage proxy is retained for damage-capable loadouts. Minimum
enemy HP remains one; an all-healer party still needs an offensive loadout.

Before creating a solo room, the Fight Library warns when the loaded job and
validated cross-class unlocks contain no offensive ability. Students can change
equipment, join a teacher-hosted group, or explicitly continue solo anyway.
Solo rooms remain private. Group entry reuses the existing student lobby's real
six-character session-code flow and the October 7 join/rejoin behavior: students
can join waiting or active teacher-hosted rooms, enter at a question boundary,
and receive participation-based rewards. Intentionally removed students still
need host approval. No second room type or duplicate join implementation is added.

## October 7 classroom corrections

The owner reported repeated caster/healer one-shots at damage +1, difficulty 15.
Enemy counterattacks now use `ceil(damageLevel * sqrt(difficulty / 10))` before
Dread Aura, armor, vitality, Block and shields. Difficulty 10 is the baseline;
difficulty 15 at +1 produces 2 raw damage instead of 15 (1 after starter armor).
At +10 it produces 13 raw damage, retaining a dangerous upper end. At +1 even
difficulty 100 produces only 4 raw damage, so full-health starting casters survive
one hit. This does not grant death immunity to wounded characters or cap a whole
classroom round's multiple enemy attacks. Wrong-answer penalties and the existing
solo total-counterattack cap are unchanged.

Combat now advances through question → action selection → support → answer
resolution → enemy counterattack. The question retains its configured time limit.
When all living players have submitted answers, or that timer expires, action
selection starts with a fresh 20-second server deadline. Support then gets its
own 20-second deadline. Both choice phases end early once everyone is ready.
Missing answers remain incorrect; the additional action time cannot extend the
answer deadline. Deadlines and choices persist through refresh/hibernation.
Previously opened clients can still submit early action choices during questions.

The host can click a knocked-out player's card, or focus it and press Enter/Space,
to resurrect that participant with exactly 1 HP during any active phase. The
server verifies the host's current session and ownership of this room. Students,
other teachers, unknown/living targets, stale rounds, and completed fights cannot
use it. Retried commands are idempotent. Resurrection preserves resources,
statistics, choices and phase deadlines; it does not replay resolved turns.
Students should refresh after this release to load the separate action phase UI.
