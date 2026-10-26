# Expansion plan after cleanup

**FUTURE — updated October 20, 2026. No further expansion implementation is started by this plan.**

New feature development follows the [cleanup exit gates](CLEANUP_PLAN.md#exit-gates-before-expansion-resumes).
This is the current backlog of remaining product direction, not a claim that
all ideas are fully specified or an authorization to implement them together.
Choose the next feature's scope after the cleanup release review. The current
[released baseline](CURRENT_STATUS.md) already includes fixed-count goblins,
waves, static gear art, quests and explicit host-session controls. The separately
authorized October 12 [swarm/gear/host-control release](combat/swarm-scaling.md)
is deployed; it does not start another cleanup or expansion package.

## Follow-on candidates

| Item | Current state | Decisions / prerequisites before implementation |
| --- | --- | --- |
| Campaigns and cooperative exploration | October 20 owner design recorded in the [campaign development roadmap](CAMPAIGN_DEVELOPMENT_ROADMAP.md); CAM packages not started | Quiz selection with guild/name filters; fixed generated maps; access gates and named keys; 13 themes; one chest per assigned loot entry; leader-controlled parties; 3–8-player boss queues with tank/healer/DPS; level caps 4/8/12/15 and encounter-tier gear with duplicate-to-gold. Resolve recorded policy questions and scope one complete pilot before implementation. |
| Team race | Feasibility and design direction recorded; no race implementation | Persistent coordinator and assignments, one public join code with two private child rooms, shared immutable content/seed, synchronized controls and durable retries, split host view, scoring/ties, late-entry and recovery tests with 30–60 players |
| Classroom balance refinements | Initial tier presets and enemy AI are released; classroom observation still needed | Gather evidence for tier scaling, large-party hypnosis, vampire healing, poison and enemy composition; approve individual rule changes separately from cleanup |
| Early AoE access for DPS and tanks | Owner-requested future work, October 19; not implemented in the HP balance release | Every DPS must have an AoE available by job level 4; every tank by job level 8. Change the behavior of an existing ability. Audit job roles and unlock levels, select the ability for each uncovered job, and define target coverage, damage and resource behavior before implementation; verify every applicable job meets its threshold. |
| Teacher create/edit fight HP estimate | Owner-requested future work, October 19; not implemented | Show a preview of estimated enemy HP per player in both the teacher create-fight and edit-fight panels, with a clear disclaimer that the values are estimates. Use the current fight-scaling rules and make any assumed player count/composition clear; final HP depends on the actual fight roster. |
| AA upgrade purchases | Implemented and verified in isolation on `feature/alternate-advancement`, [PR #86](https://github.com/Orsnoire/FightSchool/pull/86); not deployed | Approved catalog, 60 XP/AA wallet, atomic purchases, tier caps, five-slot interface and combat effects are implemented. Primary-stat prices unchanged; lower dodge/potion curves; wrong answers clear CP except AA preservation. 364 tests and desktop/phone acceptance pass; evidence and release limits are tracked in [active work](ACTIVE_WORK.md). Campaign adapter remains separate. |
| Further static artwork | Front-facing Human gear/Tier 1 recolors are released | Define near-profile fitting and custom-item art coverage, fallbacks and owner visual review |
| Animated avatars | Isolated rig prototype only; no approved full collection | Complete both models, segmentation, calibrated attachments, starter/signature gear, ability/weapon coverage and owner signoff under the existing animation gate |
| Further equipment slots, variants or tiers | Current eight-slot/Tier 0/Tier 1 behavior is released | Define stats, acquisition, compatibility, visuals and progression before extending catalog/hooks; prior ideas do not authorize new bonuses |
| Additional enemy species | Exactly seven species are currently authorable | Define complete moveset, default AI and approved combat sprite; extend catalog validation and tests before enabling authoring |

Team race remains a documented encounter expansion candidate; its priority and
exact scope remain to be selected.
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
