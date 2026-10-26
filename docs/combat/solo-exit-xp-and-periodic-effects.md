# Solo exit EXP and periodic effects — October 26, 2026

Owner-requested behavior, published on `fix/solo-exit-xp` in
[draft PR #85](https://github.com/Orsnoire/FightSchool/pull/85). Not merged or
deployed. This decision supersedes the earlier no-reward rule for the
student who hosts a solo fight and the older INT-only Hex description.

## One completion and EXP calculation

When the authenticated creator leaves an active solo room, end the fight through
`endFight`, the same transition used by both teacher end controls. Keep participants
in the completed roster so `persistCombatResults` calculates their results with
`combatReward` and the single `calculateXP` function. If guildmates joined, this
ends the room for them too, as the confirmation explains. A non-host leaving a
group room retains existing departure/rejoin behavior. Closing a browser or a
network disconnect remains recoverable and does not deliberately end a room.

Before stamina:

```
EXP = max(0, prorated base EXP
             + correct answers - incorrect answers
             + actual damage dealt + actual damage blocked + actual HP healed)
```

All contribution coefficients remain one EXP per unit. The changed damage term
uses total actual damage rather than only bonus damage. Ability/DoT damage is
already in that total and is not added twice. Damage caps at remaining enemy HP;
healing caps at missing HP. Contributions remain available to every class,
including hybrid and cross-class actions. There is no new rigid role gate.

Base EXP retains encounter fraction × attended/resolved rounds × encounter HP
progress for early endings. Activity is not prorated. Victory uses full encounter
progress; ordinary defeat still grants only earned activity. Answers and actions
count when the round resolves, as for teacher ending. An untouched exit yields
zero EXP and no stamina charge. Early ending grants no victory gold or loot.

The existing database receipt, stamina multiplier, level caps and fractional
remainder apply afterward. Completion is durably saved before leaving; successful
SQL completes before dashboard navigation. SQL failure schedules recovery. Lost
SQL acknowledgements, duplicate exits, reconnected exits and room restoration
cannot grant a second result or spend stamina twice. Already-completed victories
retain their results. No migration or historical result rewrite is needed.

## Periodic-effect investigation and fixes

| Effect | Previous behavior | Corrected behavior |
| --- | --- | --- |
| Hex | INT − 1 ticks; MAT ignored; no base initial hit below Warlock 15; cast-round tick consumed a duration round | Initial MAT + INT; subsequent ticks MAT + INT − 1; MDF applied independently to each hit/tick |
| Hex duration | 2 + Warlock upgrades, including cast round | 2 + Warlock upgrades **subsequent** rounds (3/4/5 at Warlock levels 3/9/14) |
| Hex refresh | Replaced the caster's effect | Still refreshes without stacking; an already-due tick is preserved when recast |
| Soul Echo | Additional initial damage at Warlock 15 | Preserved as an extra (raw tick × duration) / 2 on the initial hit, before mitigation |
| Hemorrhage | Inherited Hex duration upgrades; ticked immediately | ATK initial hit, ATK/2 on each of two subsequent rounds, physical DEF; no Hex duration upgrades |
| Enemy poison, bleed and suffocation | Start after application round; fractional carry and enemy damage limits | Existing rules retained; poison/bleed regression checks pass |
| Player healing | Immediate healing; timed buffs expire but do not repeat healing | No HoT ability exists in the current player catalog/execution; no unrequested HoT added |

`abilityDot` owns periodic magnitude/duration for both execution and previews;
`abilityDamage` owns the initial hit. Damage floors before defense and clamps at
zero, using the existing hit resolver. New applications save their application
round so casting cannot consume a later tick. Existing saved effects without the
new optional field retain their saved magnitude and remaining-round semantics.
New casts use corrected rules, including in restored rooms. Historical monsters
without MDF retain the existing legacy-defense fallback.

Different casters retain separate effects. New ticks are labelled in the combat
log/playback and credited to the originating student's actual-damage total.
DoTs continue while their caster is KO but still participating, as previously;
a departed caster cannot generate new activity credit. Direct heal credit covers
only HP actually restored and is not repeated on later turns.

## Verification and release boundary

Deterministic checks cover MAT, MDF versus DEF, full duration, recast timing,
independent owners, rank upgrades, Soul Echo, wrong answers, overkill, zero damage,
JSON restoration, actual healing and shared EXP. Durable Object plus migrated
PGlite checks cover teacher/solo parity, authenticated ownership, forged targets,
waiting/completed rooms, SQL failure, lost commit acknowledgement, exactly-one
result, stamina and job EXP, and no early-exit loot/gold.

All 347 tests pass across the repository suites after the focused corrections;
TypeScript and both builds pass. The historical C10 baseline is unchanged;
only the two explicitly changed DoT scenarios join the existing Fireball
exception, with independent numeric and complete JSON replay coverage.

The unrestricted default test fan-out stopped without completing in this local
runtime; Phase 4 was verified in bounded-concurrency batches (319/319 named test results, no failures). Browser confirmation
coverage is added to the existing Chromebook/phone suite, but local Chromium
installation failed with a truncated download. This is not a local real-browser
pass. The owner subsequently authorized publication; the authenticated GitHub app
published implementation `f9f10203e07d55f404456709ee00dd88ffe9fa06` with Git tree
`357a84877c3158df9f7f2cf46a836b0db8ed7b57`, identical to the locally verified work.
The live PR description and checks carry the latest published SHA and exact-head
GitHub CI/browser results. Review, merge, deployment and canonical acceptance
remain pending; no live acceptance is claimed.

The implementation passed all 347 tests and all four Chromium jobs in GitHub.
A repeat run after the documentation checkpoint exposed a one-millisecond
wall-clock difference in the new recovery test. The test now supplies an explicit
clock for phase advancement and deliberately varies `Date.now` during the full
restored-snapshot comparison. The assertion and runtime behavior are unchanged.
