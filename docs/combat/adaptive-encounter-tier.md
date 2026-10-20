# Adaptive encounter tier and battlefield labels — October 19, 2026

Owner-directed follow-up in [PR #79](https://github.com/Orsnoire/FightSchool/pull/79).
See [ACTIVE_WORK](../ACTIVE_WORK.md) and the [October 20 release record](../releases/2026-10-20-pr79.md) for verification and release status. This is
separate from C12, the future AoE rollout and the teacher editor HP-estimate backlog.

## Effective encounter tier

Average the joined players' **current-job levels as used in combat**, after the
existing guild level caps. Each joined player counts equally for this average;
HP role discounts do not weight levels. Other jobs' levels are not averaged in.
Use the exact average, without rounding it up or down before comparison.

| Average current-job level | Automatic tier |
| --- | ---: |
| Below 2 | 1 |
| At least 2, below 6 | 2 |
| At least 6, below 10 | 3 |
| At least 10 | 4 |

The effective tier is the higher of this result and the teacher's authored tier
(tier 1 for a legacy/unset tier), capped at 4. An empty lobby uses the authored
tier. Lobby previews recalculate when players join or leave. **Start Fight locks
the effective tier for every wave**; late admissions, departures, reconnects and
room recovery never recalculate an active fight's tier.

The effective tier selects reference HP/output pressure, monster magic defense,
Samhain attack/defense and starting swarm population. Automatic increases also
raise the base enemy damage to at least the effective tier's damage preset;
existing higher authored damage remains. It does not alter guild progression
caps, player abilities/equipment, saved authoring choices or reward rules.

## Swarm population and HP

For each group with **Swarm enabled**, requested individuals are:

```
authored base quantity * effective tier
  + enemiesPerFourPlayers * max(0, floor(players / 4) - 1)
```

Only the starting quantity is multiplied by tier; attendance batch increments
stay unchanged. Non-Swarm groups keep their authored counts, regardless of
species or HP role. Five starting swarmers become 5/10/15/20 at tiers 1/2/3/4.

Keep the existing 60/group and 120/fight caps. Reserve all authored base counts
first, then share available capacity among requested tier/attendance additions
one individual per eligible group in author order. Preview and Start Fight use
the same calculator; counts lock at start across every wave. Editor examples
use the selected minimum tier and explain that the waiting room gives final counts.

The owner removed `/2` from the [HP coefficient](role-weighted-hp.md). New fights
use weighted players plus the **full** idealized reference party's raw rotation
output. Role shares remain 10/15/25/50% across the whole fight; extra individuals
divide that one allocation. Maximum HP floors, current HP ceils/clamps, and each
enemy retains the approved 1 HP minimum even if it exceeds the nominal budget.

The optional saved `encounterTier` marks this release's locked tier/full-output
rule. Existing active rooms without it keep their original authored tier and
half-reference coefficient on late-entry rescaling; older pre-role-weight rooms
retain their prior rule. No database migration or live-state rewrite is needed.

## Battlefield presentation

Both teacher and student fields put the wave heading at the top, followed by a
bounded, scrollable list of **individual** enemy names, HP and status text.
The displayed tier is the lobby estimate or the locked tier after start. Names
wrap; large swarms scroll within the list. No name/status/HP text is positioned
over a sprite's health bar. Sprite health meters, accessible names/tooltips,
playback, hover/focus inspection and host elimination controls remain available.
The student status strip stays in the party lane, clear of the enemy list.
