# Campaign development roadmap

**OWNER DESIGN RECORD / FUTURE IMPLEMENTATION — October 20, 2026 (America/Denver).**

This document records James's campaign decisions from the October 20 design
conversation, including the final three-player boss minimum and leader-controlled
party movement. It is the shared starting point for agents working on campaigns.
The roadmap and acceptance criteria are planning guidance; publishing this file
does not implement, deploy, or authorize the entire expansion.

Read [Source of Truth](Source_of_Truth.md), [active work](ACTIVE_WORK.md), and the
[expansion plan](EXPANSION_PLAN.md) before implementation. Preserve the existing
cleanup/release claims. Campaign package IDs below are separate from C01-C12.

**Later October 20 authorization:** the owner requested a one-dungeon test
campaign with unlocks, exploration and town services. The separately scoped
[campaign pilot](CAMPAIGN_PILOT.md) implements parts of CAM-00–03 and the town
requirements below in [PR #81](https://github.com/Orsnoire/FightSchool/pull/81).
It does not complete any full roadmap package or the multiplayer boss system.

### Persistent resources and town services — decided October 20

- Current HP carries across campaign encounters; the next fight does not heal
  the student automatically.
- An exploration menu offers the current job's healing and consumable use.
- An inn permits job changes; town has separate weapon and armor shops.
- Generate a quest giver for each required unlock in the campaign.
- Rest pricing, consumable replenishment, defeat recovery and automatic academic
  unlock objectives remain open for the full campaign. The pilot documents its
  free-rest, teacher-opened-key defaults separately.

## 1. How to use this roadmap

- **DECIDED** means explicitly requested by the owner in this conversation.
- **PROPOSED** means an engineering recommendation or an assistant suggestion
  that still needs a product decision where it affects gameplay.
- **OPEN** means the behavior is unresolved; do not silently invent a rule.
- All CAM packages start **NOT STARTED**. Their ordering is a proposed development
  sequence, not evidence of completed work or a commitment to deliver everything
  in one release.
- A later explicit owner decision supersedes an older one. Update the relevant
  requirement, open-decision row, and dated decision log together.
- Before substantive implementation, inspect current code and live branch/PR
  state, register the chosen package/branch/draft PR through the existing
  [agent workflow](../AGENTS.md), and define its release scope.
- Record implementation evidence separately: code complete, tested, merged,
  deployed, and accepted are distinct states. Retain exact commits and test links.
- Keep academic content, campaign configuration, generation, combat rules,
  presentation, transport, and persistence as separate responsibilities.
  Campaigns must remain reusable across subjects and portable across providers.

## 2. Campaign vision and scope

**DECIDED:** campaigns offer a substantial overworld containing towns and themed
locations such as caves, ruins, and dungeons. Students can adventure independently
or together. Topic-focused dungeons lead to matchmade bosses; overworld encounters
provide mixed practice from accessible topics.

The first authored campaign direction is ACT Math preparation: each dungeon
represents a division of the ACT standards. The precise standards mapping and
content inventory remain to be authored and verified. Teacher-created campaigns
can cover an instructional unit or a larger sequence of units/courses; the engine
must not hard-code ACT or mathematics.

Teacher-generated campaigns and authored campaigns share the campaign foundation.
The degree of hand-editing, storytelling, and custom geography in authored
campaigns is still open. Import/sharing/marketplace remain longer-term product
direction, not requirements for the first playable release.

## 3. Decided product requirements

### C-R01 — Teacher campaign creation

Teachers can create a campaign by choosing their authored quizzes, with **guild
filtering and name search/filtering** while adding quizzes. They designate which
quiz locations require access gates and select a biome/type for each location.

A quiz supplies a topic dungeon's academic content. The default mapping is one
selected quiz to one dungeon; combining multiple quizzes or splitting one quiz
into multiple dungeons remains an extension to decide.

**PROPOSED authoring flow:** choose quizzes; arrange progression; name locations;
assign themes, access requirements, and treasure; generate; preview; finalize.
Store a theme on the campaign's quiz/dungeon entry so a quiz can be reused with
different scenery in another campaign.

### C-R02 — Class-level pacing and access

Teachers control campaign access at the class level. They can block particular
dungeons through transportation or keys, unlock material when beginning or
finishing a unit, or allow the campaign to proceed without those restrictions.

Unlocking and clearing are different states. A student does not need to clear a
dungeon before its questions become eligible for overworld encounters.

Teacher-controlled access must be respected by exploration and matchmaking.
Party leadership or random matchmaking must not create a route around a
student's applicable access restrictions.

### C-R03 — Overworld question pool and encounter completion

The overworld question pool contains **only questions associated with currently
unlocked dungeons**, including unlocked dungeons that have not been cleared.
Questions from locked dungeons are excluded. As more dungeons become accessible,
their questions join the pool alongside previously accessible content.

Overworld random encounters keep providing questions until the encounter is
cleared; reaching the end of a quiz is not the encounter's victory condition.
Question-pool cycling, repeated-question treatment, defeat/escape, and rewards
for repeated evidence need explicit rules before implementation.

For parties, how to combine members' different accessible pools remains OPEN.
No player's teacher restrictions may be bypassed by another member's unlocks.

### C-R04 — Transportation and named keys

The campaign supports geographic access barriers:

| Access mechanism | Intended geographic/use relationship |
| --- | --- |
| Canoe | Waterways and river access |
| Ship | Oceans and island access |
| Airship | Mountain barriers and otherwise inaccessible destinations |
| Submarine and/or diving suit | Underwater access |
| Teacher-named key | A locked dungeon entrance; additional gates beyond transportation |

Teachers can add and name keys when the standard transportation options do not
provide enough gates. The exact submarine/diving-suit relationship, AND/OR
combinations, shared keys, and whether unlocks are earned through play, granted
by a teacher, or both remain OPEN.

Transportation unlocks from the town are part of the proposed world presentation;
the acquisition interface and automatic progression conditions are not finalized.

### C-R05 — Fixed generation and premium boundary

Procedurally generated **overworld and dungeon layouts are set when the campaign
is generated**. Ordinary continued play does not regenerate them.

The owner's intended premium service is fresh procedural maps/dungeons **after
campaign generation**. Whether that means manual rerolls, per-run layouts, new
regions, or a combination is OPEN. Pricing, entitlement ownership, and billing
are not specified or authorized by this roadmap.

**PROPOSED:** offer preview/reroll during initial authoring before finalization;
persist finalized layouts along with their seed, generator version, and asset
manifest version. Keep published worlds stable and recoverable even if the
generation algorithm later changes.

### C-R06 — Initial theme catalogue

Each theme requires an exploration tileset suitable for procedural generation
and a matching fight background. The complete initial catalogue is:

| Theme | Proposed generation family / notes |
| --- | --- |
| Frozen cave | Irregular cave chambers |
| Volcano | Cave chambers / volcanic terrain |
| Town | Streets, plazas, and buildings |
| Castle | Rooms and corridors |
| Sewer | Constructed passages and channels |
| Forest | Trails and clearings |
| Jungle | Trails and clearings with dense vegetation |
| Marshland | Clearings, channels, and wet terrain |
| Ruins | Broken rooms and corridors |
| Normal cave | Irregular cave chambers |
| Waterway cave | Natural water passages; the natural counterpart to a sewer |
| Seaside cave | Cave chambers with coastal elements |
| Underwater | Adapted chambers or open areas, with aquatic access requirements |

The theme list and two asset types are DECIDED. Generation families are PROPOSED
implementation reuse, not thirteen independently required algorithms. Theme alone
does not establish an academic difficulty or encounter tier.

#### Environment bestiaries — decided October 20; polish phase

Every biome/environment requires its own bestiary of **3–5 unique enemies**.
This includes dungeon themes **and overworld terrain/tile types**. Each environment
must have a distinct roster rather than all locations drawing from one shared
generic enemy pool.

Random encounters select enemies from the player's current environment: walking
on an overworld forest tile draws from the forest bestiary; moving into another
terrain type uses that terrain's bestiary. Dungeon encounters use the dungeon's
assigned environment. Defining a bestiary does not enable random encounters in
locations otherwise designated safe.

Enemy selection and academic question selection are independent. Overworld
questions still come only from currently unlocked dungeons under C-R03; terrain
changes the enemies, not which academic topics are eligible.

Deliver this in **CAM-08 content and polish**, with the acceptance checks below.
It is future work, not a requirement already satisfied by the one-cave pilot.
New enemy types require complete movesets, default AI, combat sprites, and
catalogue verification before they can be used in authored encounters.

### C-R07 — Assigned dungeon treasure

Teachers can assign loot to a dungeon. **Each assigned loot entry appears in its
own chest**, rather than all assigned loot being combined into one chest.

**PROPOSED defaults, not yet owner-confirmed:** personal claims; once per student
per campaign; claimed chests remain visibly open on return; regenerating a layout
moves chests without resetting claims. These policies need a decision before
treasure claims are implemented. Placement controls, quantities, duplicate owned
items in assigned chests, and boss-locked chests are also OPEN.

Do not automatically apply the decided boss duplicate-to-gold rule to assigned
chests; those are different reward sources.

### C-R08 — Cooperative exploration

Students can form a party and adventure together. **The leader controls group
movement in the overworld.** Other members follow the authoritative party
position; independent member movement must not move the group.

The boss size/role restrictions below apply to matchmaking encounters. They are
not an established minimum role composition for casual overworld exploration.
Exploration party capacity, dungeon movement control, invitations, leadership
transfer, disconnect behavior, and party persistence require further definition.

### C-R09 — Boss matchmaking and party composition

Dungeon bosses are matchmaking encounters open to players who have unlocked the
encounter and meet its access and entry requirements. Support both selecting a
specific unlocked boss and random eligible matchmaking to help populate groups.

**Minimum viable boss party: three distinct players covering one tank, one healer,
and one DPS. Maximum boss party: eight players.** Larger groups must retain at
least one of each required role. One hybrid player cannot satisfy the
three-player minimum by counting as multiple people.

The owner has established valid party composition, not the launch timer:
whether a complete three-role party starts immediately or waits briefly for
additional players is OPEN. Role eligibility by job, role locking, premade-party
queueing, backfill, disconnects, and cross-class/cross-campaign matching also need
decisions. Three players without the required roles cannot substitute for the
minimum viable party; nine players cannot enter one matched boss group.

### C-R10 — Entry levels and encounter level synchronization

Encounters have minimum entry levels. **Tier 2 minimum entry level 4** was the
owner's example; the remaining entry thresholds are not specified. Do not infer
the full minimum-level table from the maximum-level table below.

Players are temporarily level-capped to the difficulty/tier of the matchmade
encounter:

| Encounter tier | Maximum effective player level | Random authored gear reward tier |
| --- | ---: | ---: |
| Tier 1 | 4 | 1 |
| Tier 2 | 8 | 2 |
| Tier 3 | 12 | 3 |
| Tier 4 | 15 | 4 |

Permanent earned levels/progression must be preserved. The level/job source,
gear/ability/AA treatment, lower-level behavior, and interaction with guild caps
need explicit synchronization rules before implementation.

**PROPOSED:** bosses declare a fixed encounter tier; synchronize participant power
to that tier and use it consistently for combat and rewards. This must be
reconciled with existing adaptive classroom tiers; it is not permission to change
all classroom fights.

### C-R11 — Matchmaking rewards

Random matchmaking provides EXP/quest reward incentives, including gold and
random authored gear. **Gear is drawn from the encounter's tier**, not the
student's permanent level tier.

A Tier 1 encounter awards a randomly selected authored Tier 1 gear piece.
If the student already owns the selected piece, **convert that piece to gold**.
Apply the corresponding encounter tier for higher tiers. Do not silently reroll
an owned item or upgrade the gear to the player's uncapped tier.

The eligible authored-item catalogue, probability weights, gold conversion
amount, EXP amounts, quest integration, participation rules, and any differences
between direct queues and random-queue bonuses are OPEN.

**PROPOSED:** each participant receives an independent roll recorded in an atomic,
idempotent reward receipt, including either the item or its gold conversion.
This prevents retries/reconnects from awarding both or awarding twice.

## 4. Reconciliation with existing systems

These are implementation decision points, not reasons to replace the owner's
campaign rules with prototype behavior.

| Existing reference | Campaign requirement / action |
| --- | --- |
| [Guild limits](guild-quests-and-tiers.md): effective ceilings 4/8/10/15 | Campaign boss ceilings are explicitly **4/8/12/15**. Preserve the new Tier 3 value. Decide how a lower class/guild limit interacts with campaign synchronization; do not change global guild caps as a side effect. |
| [Adaptive classroom tiers](combat/adaptive-encounter-tier.md): average effective job levels 2/6/10 can raise a fight tier | Define a separate campaign-boss policy or an explicit coexistence rule. A helper joining must not silently change the promised encounter/reward tier. Fixed tiers are the proposed approach. |
| [Role-weighted HP](combat/role-weighted-hp.md): quiz question count participates in HP budgeting | Continuing question delivery requires a finite, explicit encounter budget independent of question-pool exhaustion. Decide the campaign budget before adapting the current formula. |
| [Guild quest/evidence rules](guild-quests-and-tiers.md) | Maintain academic evidence scope and durable awards. Define hosting/content scope for matching players from different classes or campaign instances. |
| [Existing Tier 1 and fallback loot](combat/tier-one-equipment.md) | Campaign boss random same-tier gear and duplicate-to-gold are explicit new rules. Reuse reliable claim machinery without silently inheriting incompatible loot-choice behavior. |
| [Enemy roster](combat/enemy-ai.md) and [agent instructions](../AGENTS.md) | C-R06 requires distinct environment bestiaries during CAM-08 polish. Until those are implemented, use registered enemies. Each new type must have complete movesets, default AI, combat sprites, and catalogue verification before authoring it into encounters. |
| [Cleanup plan](CLEANUP_PLAN.md) and [active work](ACTIVE_WORK.md) | Design documentation can be published now. Implementation is separately scoped and coordinated with ongoing release work; this document does not mark cleanup complete or claim its branches. |

## 5. Proposed architecture and generation approach

These are implementation recommendations to review in CAM-00.

### Campaign state boundaries

| Record / responsibility | Purpose |
| --- | --- |
| Campaign definition/version | Portable quiz references or snapshots, locations, themes, gates, encounters, and assigned loot |
| Campaign instance | A particular class's generated layouts and campaign settings |
| Access state | Class grants/restrictions and any approved individual unlocks |
| Student campaign progress | Exploration, dungeon/boss unlocks, completion, and chest claims |
| Adventure party | Membership, leader, shared location, movement revision, and active encounter |
| Matchmaking ticket/match | Content/version compatibility, eligibility, role assignment, tier, and admission |
| Encounter snapshot | Frozen roster context, question source, combat rules, cap, and reward catalogue |
| Reward receipt / academic evidence | Replay-safe awards and appropriately scoped learning evidence |

These are conceptual boundaries, not a finalized database schema. Reuse current
identity, quiz, equipment, quest, combat, and receipt services after inspecting
their contracts. Use additive migrations that preserve current live records.

### Generate progression before geography

1. Build the destination/access graph from quiz locations and gate assignments.
2. Reject circular or impossible required progression.
3. Place connected land, waterways, islands, mountains, and destination entrances
   so the geography expresses those access rules.
4. Generate each dungeon's connected entrance-to-objective route, branches, and
   one chest placement per assigned loot entry using a theme-appropriate family.
5. Decorate from tileset metadata without changing required traversability.
6. Validate access, reachability, chest count, and exits before publishing.
7. Persist the accepted layouts, stable destination/reward identities, seed, and
   version metadata. Reconnect/re-entry loads the saved layout.

Access validation must consider actual movement capabilities, including later
transportation. Airship travel must not accidentally bypass a separately required
dungeon key. Do not allow the leader to take an ineligible member through a gate.

### Art contract

Define tile size, perspective, ground/wall/edge/corner pieces, entrances/exits,
walkability, transitions, props, and chest states. Fight backgrounds must match
the theme and the existing combat framing. Establish one complete theme first,
then add the remaining twelve and overworld transportation/terrain assets.
Use approved assets and the existing art-review expectations.

### Runtime and multiplayer

Keep deterministic generation and access evaluation testable without the UI.
Movement, encounter transitions, access checks, question eligibility, and reward
claims need server authority. Every party member sees the same campaign layout
and party revision. Plan reconnect recovery, leader transfer, duplicate commands,
and frozen combat/reward contexts explicitly.

Do not expose correct answers in map/queue/public snapshots. Reuse existing
authorization and teacher-content permissions when searching quizzes and
creating campaigns. Group play must not broaden quiz visibility or reward rights.

## 6. Proposed development sequence

Each package requires a scoped PR and evidence. All are **NOT STARTED**.
Dependencies describe a working order; implementation may split a package into
smaller coherent changes.

| Package | Depends on | Scope | Completion evidence |
| --- | --- | --- | --- |
| CAM-00 — Contracts and decisions | Current release/cleanup handoff or separate scoped authorization | Inspect existing services; resolve policy questions needed for the first slice; define campaign/instance/party/encounter contracts, additive migration plan, and test fixtures | Recorded decisions, ownership boundaries, migration/data-preservation review, and explicit first-release scope |
| CAM-01 — Campaign authoring and gates | CAM-00 | Select quizzes with guild/name filters; create quiz locations; assign themes, access gates, named keys, encounter tier/minimum, and treasure entries; class-level access controls | Saved definitions round-trip; owner permissions enforced; access and eligible-pool previews match settings |
| CAM-02 — Persistent map generation | CAM-01 | Overworld progression/terrain generation; one dungeon family and complete theme; stable layouts and validated chest placements | Multiple seeds pass route/gate/chest checks; save/load/reconnect retains the map; no premium regeneration is required for ordinary play |
| CAM-03 — Solo exploration and encounters | CAM-02 | Town/overworld navigation, dungeon entry, random encounters, eligible-question pool, continuous question delivery, and recovery | Locked content never appears; unlocked uncleared content does; combat continues beyond one pool pass; navigation/combat transitions survive reconnect |
| CAM-04 — Assigned treasure | CAM-03; chest-policy decisions | One chest per assigned loot entry; placement, claims, and saved state under the approved policy | Exact chest count; durable/retry-safe awards; independent-player and repeat-visit cases match the chosen policy |
| CAM-05 — Cooperative adventures | CAM-03; party-policy decisions | Form/join/leave parties; leader-controlled overworld movement; shared encounter transitions; gate enforcement; disconnect/leadership recovery | Nonleader movement rejected; eligible members remain synchronized; reconnect/leave cannot duplicate movement, rewards, or transport access |
| CAM-06 — Boss queues and level synchronization | CAM-05; matchmaking/sync decisions | Direct/random eligible queues; boss unlocks; 3-8 players with tank/healer/DPS; entry minima; caps 4/8/12/15; admission and recovery | Boundary tests for sizes/roles, queue access, level/gear/ability policy, same-content matching, departures, and reconnection |
| CAM-07 — Boss rewards and first complete pilot | CAM-04 and CAM-06 | Encounter-tier authored gear, owned-item gold conversion, EXP/quest integration; one complete campaign segment with town, dungeon, boss, treasure, and onward access | End-to-end teacher/student acceptance, atomic reward tests, replay/reconnect tests, and a documented release with known limits |
| CAM-08 — Campaign breadth, authored content and polish | Accepted pilot | Remaining theme catalogue; dedicated bestiaries of 3–5 unique enemies per biome/environment, including overworld tile types; environment-based encounter selection; transportation/region breadth, generated campaign usability, authored ACT standards divisions and question content | All 13 themes have tilesets/backgrounds; every environment has its required bestiary; terrain/dungeon pool checks below pass; generated campaigns honor varied gate arrangements; content review and classroom usability acceptance |
| CAM-09 — Premium map variation | Stable core and explicit premium decisions | Post-generation rerolls and/or per-run variation, versioned layouts, entitlements, progress/reward preservation | Premium boundary enforced; active parties share a layout; generation changes do not lose progression or reset rewards unless explicitly designed to |

### UI workshop — owner playtest feedback, October 20

The solo pilot's map tiles, layout and sidebar are placeholders. Workshop the
exploration UI before final visual acceptance: map prominence and scale, compact
resource status, movement feedback, equipment/healing/quest menus, nearby town
services, and keyboard/touch use at desktop and phone sizes. A map-first layout
with menus opened on demand is PROPOSED, not yet owner-approved. The pilot
follow-up adds responsive movement and an equipment menu filtered to currently
usable owned gear; broader art/layout work remains separate.

### CAM-08 polish acceptance — environment bestiaries

- [ ] Every dungeon biome and overworld environment/tile type has a dedicated
  bestiary containing 3–5 unique enemies, with complete registered combat content.
- [ ] Encounter selection uses the current terrain or dungeon environment;
  forest-tile checks draw only from the forest bestiary. Crossing terrain
  boundaries and entering/exiting dungeons selects the appropriate roster.
- [ ] Missing environment mappings fail content validation rather than silently
  falling back to a global pool or another environment's enemies.
- [ ] Environment selection preserves unlocked-dungeon question eligibility and
  existing safe-area rules.

The first complete pilot covers one coherent region and a limited content set.
It proves the full exploration-to-boss loop before expanding all artwork and
campaign content. Prototypes may use temporary tiles, but production art and
usability still require their own acceptance.

**Exact next planning action:** scope CAM-00, inspect the current implementation,
and resolve the open decisions needed for the first slice. Do not start all
packages or deploy production changes merely because this roadmap exists.

## 7. Open decisions and proposed defaults

Resolve a decision when its dependent package is scoped. This documentation task
does not need to settle every gameplay choice.

| ID | Decision | Proposed starting point / constraint |
| --- | --- | --- |
| O-01 | What constitutes a campaign instance and compatible cross-class matchmaking? | Share a saved map within an instance; only match compatible boss/content versions. Exact class/guild boundaries and question delivery are OPEN. |
| O-02 | Are source quizzes snapshotted or live-linked? What happens on quiz edit, removal, or archival? | Versioned content snapshots with an explicit teacher refresh are PROPOSED; preserve academic evidence and running encounters. |
| O-03 | Gate grants, automatic unlocks, combined requirements, and re-locking | Teacher class-level controls are DECIDED. Earned gates, AND/OR logic, teacher revocation during play, and submarine/diving-suit semantics are OPEN. |
| O-04 | Question sampling and continuous encounters | Define weighting, repeat avoidance, empty pools, exhaustion/cycling, repeated evidence/XP, finite HP budgeting, defeat/escape, and mid-encounter unlock changes. |
| O-05 | Party eligibility when members have different unlocks | An intersection of accessible content is PROPOSED; teacher restrictions remain binding. Decide handling when the shared pool or destination eligibility is empty. |
| O-06 | Chest claims and treasure placement | Personal once-per-student-per-campaign claims surviving map regeneration are PROPOSED. Confirm placement, quantities, duplicates, and any boss-locked treasure. |
| O-07 | Exploration party lifecycle | Decide capacity, invite scope, dungeon movement, leader succession, offline members, joining/leaving during fights, and ability to adventure while queued. Do not import boss role minima into exploration. |
| O-08 | Boss unlock condition and launch behavior | Exact unlock objectives are OPEN. Minimum 3 with tank/healer/DPS and maximum 8 are DECIDED; wait time, ready checks, premades, backfill, and underfilled-party difficulty are OPEN. |
| O-09 | Role assignment | Define each job's eligible queue role, hybrid/support classification, validation at the synced level, and job/loadout changes while queued or admitted. |
| O-10 | Entry minima versus effective caps | Keep separate tables. Tier 2 minimum 4 is the stated example; other minima and the level source require decisions. Caps 4/8/12/15 are DECIDED. |
| O-11 | Level/power synchronization and classroom compatibility | Decide job level, equipment stats, abilities, cross-class powers, AA, guild caps, and fixed versus adaptive encounter-tier handling. Preserve permanent progression. |
| O-12 | Reward eligibility and amounts | Define authored catalogue scope/permissions, empty tier pools, weights, gold conversion, EXP/stamina/AA, quest credit, participation, and direct versus random-queue incentives. |
| O-13 | Layout size, exploration behavior, and assets | Choose map/dungeon sizes, movement interface, encounter frequency, theme asset contract, chest density limits, and initial art review. |
| O-14 | Premium variation | Post-generation procedural variation is the intended premium boundary. Define payer/entitlement scope, reroll versus per-run behavior, active-session policy, and preservation of unlocks/claims before implementation. |

## 8. Acceptance checklist for the first complete campaign

This is a future release checklist, not a claim that checks have already run.

- [ ] Teacher can select quizzes using guild filtering and name search, assign
  themes/gates/loot, and save a campaign.
- [ ] Map generation produces a valid persistent overworld and dungeon; load,
  refresh, and reconnect preserve layouts and progress.
- [ ] Class-level unlocks change both available destinations and future eligible
  overworld questions according to the approved snapshot policy.
- [ ] Locked dungeon questions are excluded; unlocked uncleared questions are
  included. Party members' restrictions cannot be bypassed.
- [ ] An encounter can continue through question-pool exhaustion and ends under
  the chosen combat rules; reward/evidence repetitions follow the chosen policy.
- [ ] Each assigned loot entry has its own reachable chest and durable claim state.
- [ ] Students adventure together; only the leader moves the overworld party;
  members recover consistently after disconnect or leadership change.
- [ ] Boss admission accepts valid 3-8-player parties and rejects missing-role,
  over-capacity, locked-content, and below-minimum-level cases.
- [ ] Tier 1/2/3/4 caps are 4/8/12/15 respectively; permanent progression/loadouts
  remain intact under the chosen synchronization policy.
- [ ] Boss gear comes from the encounter tier. An owned roll converts to the
  defined gold amount; retries cannot reroll, double-award, or award both forms.
- [ ] Existing classroom tier/scaling, guild controls, identity isolation,
  academic evidence, and live student records remain correct.
- [ ] Teacher/student browser acceptance covers Chromebook-sized desktop and
  phone layouts, with explicit evidence for any physical-device observation.
- [ ] Release records distinguish local tests, CI, merge, deployment, and live
  acceptance; all remaining limits are recorded.

## 9. Decision log and agent handoff

| Date | Decision / correction |
| --- | --- |
| 2026-10-20 | Large campaign overworld; topic/ACT-division dungeons; matchmade bosses; teacher-controlled geographic gates; teacher-generated campaigns from quizzes. |
| 2026-10-20 | Overworld pool narrowed from all campaign questions to currently unlocked dungeon questions; clearing is not required. |
| 2026-10-20 | Guild/name quiz filtering, teacher-named keys, thirteen themes, exploration tilesets, and matching fight backgrounds requested. |
| 2026-10-20 | Maps fixed at campaign generation; later procedural variation intended as premium. |
| 2026-10-20 | Teacher-assigned dungeon loot: one chest per assigned loot entry. Personal/once-only claims remain proposed. |
| 2026-10-20 | Boss groups capped at eight; encounter caps 4/8/12/15; random authored gear uses encounter tier, superseding the earlier player-tier reward idea; owned gear converts to gold. |
| 2026-10-20 | Minimum viable boss party clarified as three players: tank, healer, DPS. Students can adventure together with the leader controlling overworld group movement. |
| 2026-10-20 | Owner requested this shared Markdown development map in GitHub /docs. Planning document published; no campaign implementation claimed. |
| 2026-10-20 (later) | Owner authorized a one-dungeon test campaign with unlocks and exploration; persistent HP, field healing/consumables, an inn for job changes, separate weapon/armor shops, and generated quest givers per unlock. Scoped pilot in PR #81; full CAM packages remain incomplete. |
| 2026-10-20 (playtest feedback) | Movement should respond faster, including appropriate client-side work; expose equipment changes within the adventure and show only currently usable gear. Current UI is a placeholder requiring a workshop. |
| 2026-10-20 (polish addition) | Every biome/environment, including overworld tile types, needs its own bestiary of 3–5 unique enemies. Random encounters use the current environment's roster; academic question eligibility remains tied to unlocked dungeons. Scheduled for CAM-08 content and polish, not implemented in the current pilot. |

For subsequent handoffs, record the CAM package, branch/PR, exact head, decisions
resolved, acceptance evidence, unfinished work, and next action through
[ACTIVE_WORK.md](ACTIVE_WORK.md). Update this roadmap when requirements or
package scope change. Read live repository state rather than treating this dated
planning record as a release-status report.
