# Individual enemies, waves and goblins — October 8, 2026

Integrated into `feat/enemy-ai-priorities` from `feat/goblin-swarms`. Not deployed.

## Authoring and compatibility

Enemy groups have a creature sprite, role, quantity (1–60; goblins 5–60) and wave (1–20).
A fight supports at most 120 individuals across all waves. Consecutive mode shows
all groups in the current wave; simultaneous mode shows all individuals.
The approved single goblin replaces the former horde/swarm illustrations.
The enemy formation occupies a fixed right-hand battlefield area, with smaller,
overlapping sprites for large populations and focus/hover inspection.

Newly authored groups use individual-enemy rules. Existing templates and active
sessions retain their previous calculations until the teacher explicitly converts
the template through tier/wave editing. No database migration is required: these
fields live in the existing enemy JSON. Conversion affects subsequent sessions.

## Encounter budget

The four-person reference party is Warrior, Priest, Wizard and Scout at the tier
midpoint (levels 2, 6, 9, 13). Tier 1 uses its shipped full equipment sets. Later
tiers provisionally extrapolate those equipment bonuses by tier until their
complete collections are authored; they need classroom tuning.

A bounded rotation estimates damage and healing over the quiz length, including
finite MP, combo points and cooldowns. Full HP is 1.10 times that damage. Three or
more players use the reference scaled by attendance / 4. Solo and duo use their
entry loadouts; this is a baseline, not adaptive rescue or a victory guarantee.
An offensive healer alternates healing and available attacks in this estimate.

Across the entire encounter, including all waves, bosses receive 50% of the full
HP budget, leaders 25%, normals 15%, and trash 10%. Each present role divides its
share equally among its members; absent roles leave their shares unused.
Goblin trash receives another 1% of its allocated HP per three goblins. Fractional
HP avoids rounding a large weak swarm into an unintended HP wall. No excess
attack damage spills into another enemy, so individual hit count still imposes
a minimum duration. AoE hits only the active wave.

Initial outgoing pressure includes reference healing, health and mitigation;
role shares also allocate that pressure. Armor applies per attack. Every third
goblin attacking the same victim contributes one collective damage beyond armor;
Block, shields and immunity apply afterward. A provisional per-phase concentration
ceiling of 35% of a victim's maximum HP prevents classroom attendance from turning
a leader-targeted volley into an unavoidable one-shot. Wrong-answer damage is
separate. These coefficients require playtesting for failure pressure.

## Targeting and progression

Goblins repeat a 50% threat leader / 25% healer / 25% damage leader allocation.
Healer selections choose randomly among the least-targeted living healers.
Without healers, their share returns to the threat leader. Overlapping leaders
receive both shares. Player actions resolve in join order, rotating the starting
player each round. If a selected enemy has died, the action bounces to the next
living enemy in the active wave, wrapping at the end.

Hosted fights pause between waves; the teacher starts the next wave. Solo waves
continue automatically. Resources persist. Question banks repeat, reshuffling
when enabled and avoiding an immediate boundary repeat when there is more than
one question. Mastery tracks original question identities.

Late entrants increase the budget at the round boundary. Surviving enemies retain
their HP percentage, defeated enemies stay defeated, and departed/rejoining
students do not repeatedly grow the budget. Attendance never shrinks the budget.
Base fight XP follows the sum of present role shares; earned answer activity XP
is unchanged.

## Follow-up ideas, not implemented

- Team race: independent room codes and state for one encounter, shared teacher
  start and a progress/accuracy scoreboard. Existing hosting reuses an open room.
- Optional party-scaled swarm count with an enemies-per-player control. Proposed
  counts lock at wave start; subsequent arrivals affect the next wave. Fixed
  quantities remain the behavior in this branch. Do not apply party scaling twice.
