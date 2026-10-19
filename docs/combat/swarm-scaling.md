# Party-scaled swarm counts

Owner decision — October 12, 2026. PR #61 is merged, deployed and accepted. See [release evidence](../cloudflare/full-migration.md#swarm-gear-baseline-and-host-controls--12-october-2026).

Each enemy group may enable Swarm and choose an integer enemies-per-four-players increment x. Its requested count is `base + x * max(0, floor(players / 4) - 1)`: base through 7 players, base+x at 8–11, base+2x at 12–15, and so on. Disabled or absent settings retain authored quantities. This setting is independent of goblin species/targeting and may be used with any supported species.

The waiting room recalculates both count and HP from the joined roster and the room's frozen fight template. Preview does not mutate stored state; Start Fight uses the same calculation and locks counts for all waves. Late arrivals retain the existing HP-budget rules without adding individuals mid-fight. This scopes the initial release instead of the older proposed per-wave count adjustment.

Retain the current limits of 60 individuals per group and 120 across the encounter. Authored base counts are reserved first. Remaining capacity is allocated one extra enemy per eligible group in author order repeatedly, until requested additions or the cap are reached. The editor explains these caps. More individuals share the existing role HP budget; count scaling must not multiply that budget a second time.

Persist only the optional swarm setting in existing enemy JSON. Existing templates/rooms remain compatible; no migration or live-data modification is required. C04 / PR #60 merged on October 12 and is integrated here. Swarm settings and host commands extend its shared contracts; public wave mode remains allowlisted.

Required verification: 0/1/4/7/8/11/12/16/30/60-player boundaries, caps and mixed fixed groups, unique stable IDs, preview/start equality, join/leave/reconnect, no active count changes, API create/update/read validation, and rendered authoring controls.

## Reference gear correction — October 12 owner direction

The [October 19 HP decision](role-weighted-hp.md), tracked in PR #77, replaces
attendance-multiplied and solo/duo loadout HP scaling with weighted players plus
half the reference rotation output. Reference gear still determines that question
coefficient and outgoing pressure. Swarm/trash shares one 10% HP allocation across
all waves, floored per individual with a 1 HP minimum; no goblin HP bonus remains.

Classroom groups (3+) now budget against the previous tier's full gear set while retaining the encounter tier's level midpoint. Tier 1 uses actual complete tier 0 starter loadouts, including starter weapon and defense stats; tier 2 uses full tier 1 equipment. Tiers 3/4 provisionally extrapolate tier 1 bonuses by 2/3 until those collections exist. The Priest healing bonus follows the same equipment tier. This lowers both reference HP and outgoing pressure; solo/duo still use their real capped entry loadouts. Waiting preview and Start Fight continue to share the calculator.

## Host controls — October 12 owner direction

The owner corrected Next phase to **Next wave**. The new host control appears in consecutive individual-enemy fights when another wave is available (or during the between-wave pause). It confirms before defeating any living enemies left in the current wave, uses normal round cleanup and late admission, and opens the next wave. Between waves it starts the waiting wave without skipping it. The existing phase advance remains separate.

Each active enemy also exposes an elimination × on hover, keyboard focus and touch, matching player removal. Confirmation defeats only that enemy, releases source-bound statuses and preserves the normal next-wave pause. Defeating the final enemy completes victory through existing result persistence. These interventions do not manufacture player damage, answer credit or participation. Waiting/finished rooms and future-wave targets are rejected; host ownership, session revocation, round checks and durable command receipts protect both controls.
