# Expansion plan after cleanup

**FUTURE — October 9, 2026. No expansion implementation is started by this plan.**

New feature development follows the [cleanup exit gates](CLEANUP_PLAN.md#exit-gates-before-expansion-resumes).
This is the current backlog of remaining product direction, not a claim that
all ideas are fully specified or an authorization to implement them together.
Choose the next feature's scope after the cleanup release review. The current
[released baseline](CURRENT_STATUS.md) already includes fixed-count goblins,
waves, static gear art, quests and explicit host-session controls.

## Follow-on candidates

| Item | Current state | Decisions / prerequisites before implementation |
| --- | --- | --- |
| Team race | Feasibility and design direction recorded; no race implementation | Persistent coordinator and assignments, one public join code with two private child rooms, shared immutable content/seed, synchronized controls and durable retries, split host view, scoring/ties, late-entry and recovery tests with 30–60 players |
| Party-scaled swarm counts | Future option; released encounters use authored fixed quantities | Define enemies-per-player/pressure setting, count caps and wave locking; avoid doubling attendance-based HP scaling; benchmark large formations |
| Classroom balance refinements | Initial tier presets and enemy AI are released; classroom observation still needed | Gather evidence for tier scaling, large-party hypnosis, vampire healing, poison and enemy composition; approve individual rule changes separately from cleanup |
| AA upgrade purchases | Overflow XP banking exists; spending system does not | Define catalog, prices, caps, effects, progression pacing, UI and atomic spending rules; preserve earned AA balances |
| Further static artwork | Front-facing Human gear/Tier 1 recolors are released | Define near-profile fitting and custom-item art coverage, fallbacks and owner visual review |
| Animated avatars | Isolated rig prototype only; no approved full collection | Complete both models, segmentation, calibrated attachments, starter/signature gear, ability/weapon coverage and owner signoff under the existing animation gate |
| Further equipment slots, variants or tiers | Current eight-slot/Tier 0/Tier 1 behavior is released | Define stats, acquisition, compatibility, visuals and progression before extending catalog/hooks; prior ideas do not authorize new bonuses |
| Additional enemy species | Exactly seven species are currently authorable | Define complete moveset, default AI and approved combat sprite; extend catalog validation and tests before enabling authoring |

Team race and scaled swarms are the nearest documented encounter expansion
candidates; their relative release order and exact scope remain to be selected.
The [host-session/race design](combat/host-sessions-and-team-race.md) controls race
direction; the [enemy/wave specification](combat/enemy-waves-and-goblins.md)
controls current quantities. Ordinary hosting continues to use explicit Join /
End / Launch, and launch must not silently end an existing session.

References: [guild progression and AA](guild-quests-and-tiers.md),
[enemy balance](combat/enemy-ai.md), [static equipment artwork](avatar-equipment-visuals.md),
[animation gates](avatar-art-direction.md), [wardrobe extension hooks](starter-wardrobe.md).

## Longer-term product direction

The [Source of Truth](Source_of_Truth.md) retains the larger vision: portable
content-agnostic campaigns, standards-aligned and differentiated content,
dungeons/bosses/raids, reusable solo/group progression, teacher authoring and
campaign import/sharing, and eventually a possible educator marketplace.
Ready-to-use ACT, Math 3, AP Precalculus, AP Calculus and other subject campaigns
are examples of that direction, not committed releases.

Each needs a scoped design, content/data contract, acceptance criteria and
priority decision before entering the implementation queue. Cleanup should make
these easier to build without inventing their mechanics or coupling the engine
to one course, provider or presentation system.
