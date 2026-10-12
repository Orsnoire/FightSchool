# Party-scaled swarm counts

Owner decision — October 12, 2026. Implementation in PR #61; not released.

Each enemy group may enable Swarm and choose an integer enemies-per-four-players increment x. Its requested count is `base + x * max(0, floor(players / 4) - 1)`: base through 7 players, base+x at 8–11, base+2x at 12–15, and so on. Disabled or absent settings retain authored quantities. This setting is independent of goblin species/targeting and may be used with any supported species.

The waiting room recalculates both count and HP from the joined roster and the room's frozen fight template. Preview does not mutate stored state; Start Fight uses the same calculation and locks counts for all waves. Late arrivals retain the existing HP-budget rules without adding individuals mid-fight. This scopes the initial release instead of the older proposed per-wave count adjustment.

Retain the current limits of 60 individuals per group and 120 across the encounter. Authored base counts are reserved first. Remaining capacity is allocated one extra enemy per eligible group in author order repeatedly, until requested additions or the cap are reached. The editor explains these caps. More individuals share the existing role HP budget; count scaling must not multiply that budget a second time.

Persist only the optional swarm setting in existing enemy JSON. Existing templates/rooms remain compatible; no migration or live-data modification is required. C04 / PR #60 is independent and in progress; shared contract changes must be reconciled before merge.

Required verification: 0/1/4/7/8/11/12/16/30/60-player boundaries, caps and mixed fixed groups, unique stable IDs, preview/start equality, join/leave/reconnect, no active count changes, API create/update/read validation, and rendered authoring controls.

## Reference gear correction — October 12 owner direction

Classroom groups (3+) now budget against the previous tier's full gear set while retaining the encounter tier's level midpoint. Tier 1 uses actual complete tier 0 starter loadouts, including starter weapon and defense stats; tier 2 uses full tier 1 equipment. Tiers 3/4 provisionally extrapolate tier 1 bonuses by 2/3 until those collections exist. The Priest healing bonus follows the same equipment tier. This lowers both reference HP and outgoing pressure; solo/duo still use their real capped entry loadouts. Waiting preview and Start Fight continue to share the calculator.

## Host controls — requested, implementation pending

The owner also requested a Next phase button and an enemy elimination × on mouseover, matching player removal. Both must be host-only, server-authoritative and safe across retries/reconnects; normal phase, wave and victory handling must remain intact.
