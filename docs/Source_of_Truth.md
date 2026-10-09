# QuestAcademy — Source of Truth

> **CURRENT AUTHORITY — October 9, 2026.** Start with the [documentation index](README.md),
> [current status](CURRENT_STATUS.md), [cleanup plan](CLEANUP_PLAN.md) and
> [expansion plan](EXPANSION_PLAN.md). Cleanup precedes new feature development;
> Phase 1 is active with the [resume safeguard](ACTIVE_WORK.md). C01 (F01–F03)
> is COMPLETE: PR #53 merged, deployed and accepted. C02 is next, not started.
> Historical migration phases are not the active queue.

This document defines the authority hierarchy for all QuestAcademy design, development, migration, and agent-based work.

Its purpose is to prevent outdated prototype behavior, abandoned architecture, old bug reports, or implementation accidents from being mistaken for current product requirements.

When documents, code, comments, or historical notes conflict, use the hierarchy below.

---

# 1. Authority Hierarchy

## Tier 1 — Product Vision and Development Guardrails

The highest-authority document is:

**QuestAcademy: Product Vision and Development Guardrails**

This document defines what QuestAcademy is intended to become.

It controls:

- product philosophy
- educational philosophy
- classroom use
- campaign architecture
- differentiation
- solo and group play
- progression philosophy
- teacher workflow
- marketplace vision
- long-term architecture
- migration principles
- metrics of product success

If any lower-level document conflicts with the Product Vision and Development Guardrails, the Product Vision wins.

The goal is not to preserve the current prototype exactly.

The goal is to build the intended QuestAcademy product.

---

# 2. Current System Design Specifications

These documents define current intended game systems unless superseded by a newer explicit design decision.

## Expanded Class List

Authoritative for:

- character statistics
- base classes
- advanced classes
- class unlock requirements
- level progression
- abilities
- passives
- cross-class abilities
- ultimates
- combat formulas
- resources such as MP and Combo Points

Historical transition language such as "old statistics," "new statistics," or descriptions of previous implementations should not be treated as requirements.

The intended final mechanic is authoritative; the historical path used to reach it is not.

---

## Core Guild Design

Authoritative for:

- guild membership
- guild progression
- guild XP
- guild quests
- personal progression quests
- equipment tier unlocks
- guild shop progression
- gold economy
- guild feature unlocks
- teacher/admin guild controls

Guild progression is intended to support long-term classroom engagement across approximately a school year rather than rapid MMO-style progression.

---

## Classroom balance and daily stamina

The [October 1 classroom balance rules](combat/classroom-balance-and-stamina.md)
record the latest explicit changes to XP stamina, Block targeting and threat,
potion replenishment, encounter HP, and the approved Wizard/Scout balance. They
supersede older conflicting rules for these systems. Priest First Aid replaces its basic attack; see the same document for solo and group safety.

The October 7 corrections in the same document supersede raw enemy-difficulty
multiplication and the shared question/action clock, and restore host resurrection.

The [October 7 host panel and departure rules](combat/student-overlays.md#october-7-host-controls-and-student-departure)
record the consolidated host controls, attendance, temporary log placement,
and explicit student Leave fight behavior.

## Current implementation and release queue

The [cleanup plan](CLEANUP_PLAN.md) is the current ordered implementation queue.
The [classroom polish release record](combat/release-queue.md) preserves the
completed October 7–8 batch and its validation evidence. First Aid, calculated
ability values, informative loot choices,
eight equipment slots, complete Tier 0 starters, loadout synchronization and
visible equipment permissions with explicit new-armor classification were
released October 7 in PRs #37–42. Migration 0011 preserves existing equipment.
See [the release record](cloudflare/full-migration.md) for deployment evidence and
[starter wardrobe](starter-wardrobe.md) for future slot extension hooks. Per-job
remembered equipment and cross-class ability loadouts (PR #43) were released
October 8 with successful migration-gate evidence for 0012; see the same wardrobe
document for restoration and concurrency rules and the October 8 checkpoint below.


## Tier 1 gear and instance loot

The [October 7 Tier 1 specification](combat/tier-one-equipment.md) records the
owner's level-2 equipment collection, revised tank VIT damage weighting and
fallback instance loot rules. It supersedes older conflicting equipment level
gates and VIT damage formulas. PR #44 was released October 8; migration 0013 is
covered by the successful migration gate recorded below. The October 9 review
found a built-in loot claim HTTP-validation defect; [F01/C01](CLEANUP_PLAN.md)
corrected it in the October 9 PR #53 release without changing intended loot
eligibility or rewards.

The [equipment comparison specification](combat/equipment-comparisons.md) records
hover, keyboard and touch comparisons in gear, shop and loot screens, including
lost off-hand bonuses and special effects. PR #45 was released October 8 after
the Tier 1 implementation, with no additional migration.

## Enemy roster, behavior and recovery

The [October 8 enemy AI and recovery specification](combat/enemy-ai.md) records
species defaults, teacher-editable conditional priorities, the six enemy move
sets plus basic-attacking goblin swarms, and answer-based status recovery.
Only these seven defined types are authorable; every goblin addition contains at
least five individuals. New types require a moveset, default AI and verified art.
Two nonconsecutive correct answers clear
stun/paralysis; three release each player from single-target Hypnotic Stare or
party-wide Hypnosis. Hypnotizing sources cannot act until their victims are free.
This supersedes the initial damage-threshold and fixed-turn hypnosis proposals.
PR #52 was released in runtime `e158194` and remains included in the current
C01 runtime `8bf9df7`; CI, deployment and canonical live acceptance passed.
See [current status](CURRENT_STATUS.md) for exact runs.

## Combat Flow Refactor

This document is authoritative primarily for **player experience and presentation**, including:

- combat phase order
- question presentation
- ability targeting
- blocking
- healing
- combat feedback
- combat toasts/modals
- enemy presentation
- victory/defeat flow

However, it is **not authoritative for underlying software architecture**.

The current architectural direction is that:

- combat calculation should be deterministic
- game state should be server-authoritative
- combat resolution should be separated from presentation
- UI animations should present calculated results rather than determine them
- clients should be able to reconnect or refresh without corrupting combat state
- multiplayer state should not depend upon fragile browser-local state
- classroom combat may eventually batch or choreograph actions for presentation without coupling animation timing to combat logic

When the Combat Flow Refactor conflicts with these architectural principles, preserve the intended user experience while replacing the old implementation.

---

# 3. Content and Data Specifications

Documents such as the QuestAcademy Question Bank Template define content structures and authoring expectations.

They should guide:

- question bank formats
- campaign content
- teacher-created content
- standards tagging
- assessment content
- reusable campaign data

Content specifications should remain portable and should not be unnecessarily coupled to a particular hosting provider or database implementation.

## Character Art and Appearance

The [October 7 battlefield and participation approval](combat-facelift.md#october-7-battlefield-and-participation-approval)
supersedes older scene integration gates, centered waiting dialogs, no-entry-after-start
rules and all-or-nothing host-ended base XP. It authorizes the static battlefield,
moderated re-entry, proportional completion rewards and full earned activity XP.


The [combat facelift brief](combat-facelift.md) records the October 1 direction
for biome scenery and population-dependent player formations. Players occupy
the left half facing right; enemies occupy the right half facing left. The
early formation studies are historical. The October 7 approval and subsequent
release govern the current static battlefield and overlay flow.

October 5 owner direction supersedes the earlier all-animation release gate for
an initial static release. Front-facing Human male/female paperdolls with the
four approved starter-kit briefs may be integrated after visual approval,
persistence/security checks and classroom acceptance. Independent saved colors
remain shared across jobs; a job switch selects its hat, outfit and props.
Animation completion is no longer a prerequisite for that static release.
The subsequent October 5 direction removes all placeholder job portraits:
every job uses its armor type's starter gear and the shared Human base. Missing
weapon artwork renders empty hands in the original front-facing pose, without
changing the equipped weapon's gameplay effects.

The [avatar art and animation direction guide](avatar-art-direction.md) retains
the full segmented-model, rig, starter/signature-gear and ability-coverage gate
for the later animated release. Static approval does not approve an unfinished
rig or change combat mechanics. See the [permanent starter wardrobe](starter-wardrobe.md)
for the October 5 shared-ownership direction and armor exclusions. The owner
approved static review 03, including the slot/material defaults, and authorized
live release on October 5. The static release is deployed and live acceptance
passed; see the [release record](cloudflare/full-migration.md#static-avatars-and-starter-wardrobe--5-october-2026).

The separate [workshop routing guide](workshop-routing.md) records the Worker,
R2 binding, connection/upload flow and recovered review checkpoints. Publishing
a workshop preview does not deploy the game or migrate student data.

The approved Human male/female base art and appearance contract are documented in
[`attached_assets/characters/human/v1/README.md`](../attached_assets/characters/human/v1/README.md).
Its adjacent `manifest.json` associates each model and view with independent
hair, iris, and skin channels and eight-option natural-tone palettes. Initial
colors are independently randomized and then saved per character; the sample
art colors are not fixed defaults. All four views have separate hair, iris, and
skin masks plus neutral shading bases. An isolated
[male combat rig workshop](../attached_assets/characters/human/rig-prototype-v1/README.md)
now provides equipment swaps and idle/attack/shield review loops. It is an
unapproved prototype; the full production parts, rigs, and animation collection
remain pending.

The [avatar database specification](avatar-database.md) defines the new dedicated
avatar tables, saved appearance, and equipment attachment slots. This system
supersedes fixed class portraits as the intended product design. Migration
`0006_avatar_foundation.sql` seeds the Human model metadata and palettes, and
`0007_human_recolor_masks.sql` associates the recoloring assets with their views; the
static renderer/creator and equipped-item visuals are now released. Full animated
integration remains subject to the separate art and animation gates.

---

# 4. Git Repository

The GitHub repository is the authoritative record of:

> **What QuestAcademy currently does.**

It is NOT automatically the authority for:

> **What QuestAcademy should do.**

Existing code may contain:

- prototype architecture
- Replit-specific assumptions
- temporary workarounds
- obsolete database structures
- abandoned UI decisions
- partially implemented features
- old combat logic
- technical debt

Agents should inspect existing code before changing systems, but should not preserve an implementation merely because it currently exists.

When code conflicts with current design documents, current design wins unless changing the behavior would destroy required functionality that has not yet been replaced.

GitHub is the canonical source of the codebase. The live runtime is Cloudflare
with Neon and R2; Replit is no longer an application dependency or rollback target.

---

# 5. Historical Documents

The following documents are historical development records and should NOT be treated as current product specifications:

- Class Fight Test Notes
- Quest Academy Bug Reports & Status
- old version-specific testing notes
- resolved prototype bug lists
- obsolete Replit-specific implementation instructions

These may be retained in an archive for historical reference.

They may be useful for discovering:

- previously encountered failure modes
- intended behavior that was never completed
- regression risks
- UX ideas worth preserving

However, an agent must never assume that a historical proposed fix is still the correct fix.

Example:

If an old bug report says that websocket failures should be handled using a refresh button, the requirement is not necessarily "build that refresh button."

The underlying requirement is:

> Players and teachers must remain synchronized and be able to recover gracefully from connection loss.

The modern implementation should solve the underlying requirement using the current architecture.

---

# 6. Conflict Resolution

When two sources conflict, use this priority:

1. Explicit instructions from the current conversation/task
2. This Source of Truth document
3. Product Vision and Development Guardrails
4. Current system design documents
5. Current content/data specifications
6. GitHub implementation
7. Archived bug reports and prototype notes

A newer explicit design decision overrides an older one.

When uncertainty remains, do not silently choose one interpretation.

Identify the conflict and ask for a product decision.

---

# 7. Migration Principles

The application migration away from Replit is implemented and deployed. These
principles remain architectural guidance. The historical migration plan does not
replace the current cleanup queue; infrastructure recovery/rollback signoff
remains open in cleanup C12.

The objective is NOT to recreate the Replit environment exactly.

The objective is to create a maintainable architecture that an AI coding agent can understand, deploy, modify, and troubleshoot without requiring the product owner to become a DevOps engineer.

## Preserve

Preserve:

- the Git codebase
- game design
- useful assets
- campaign/content structures
- class systems
- progression systems
- teacher workflows worth retaining
- functional UI concepts
- reusable business logic

## Do Not Preserve Merely for Compatibility

Do not preserve:

- Replit-specific architecture
- Replit-specific database assumptions
- historical deployment hacks
- prototype websocket behavior
- obsolete schemas
- historical Replit prototype student records
- historical Replit test data
- implementation compromises made solely because of Replit

---

# 8. Database Migration

The following was the **historical initial-migration decision**, not a current
database reset instruction: existing Replit prototype data did not need to be
preserved, and the migration began with a clean production schema. Its goals were:

1. determine the data model QuestAcademy actually needs
2. create a clean schema
3. eliminate obsolete prototype fields and tables
4. generate migrations/schema definitions in source control
5. seed only data that is useful for the product itself
6. begin production with clean user/student data

That decision applied only to discarded Replit prototype state. **Preserve the
current live Neon data**, including students, progression, equipment, guilds,
content, results and reward receipts, throughout cleanup and expansion. Use
reviewed data-preserving migrations; do not reset live data or rewrite applied
migrations. Acceptance-fixture cleanup must identify its own scoped records.

---

# 9. Infrastructure Philosophy

The infrastructure should be:

- inexpensive
- portable
- maintainable
- source-controlled where practical
- friendly to AI-agent development
- simple enough that the product owner does not need to manually administer servers
- replaceable if a provider becomes expensive or inconvenient

The preferred conceptual architecture is:

**GitHub**
→ canonical source repository

**Web application host / runtime**
→ deploys from GitHub

**Managed PostgreSQL**
→ persistent application database

**DNS / domain provider**
→ domain and DNS management

Exact providers may change.

The deployed providers are Cloudflare Worker Static Assets, Durable Objects and
R2, with Neon PostgreSQL. Keep product rules and content portable across providers.

Secrets and credentials must not be committed to Git.

Deployment configuration should be documented sufficiently that another agent could recreate the environment.

---

# 10. Agent Development Model

The product owner is primarily acting as:

- product designer
- systems designer
- curriculum designer
- gameplay designer
- teacher/user representative

The coding agent is expected to handle much of the translation from product specification into implementation.

A typical product instruction may describe desired behavior rather than programming details.

Example:

> Guild progression should take approximately a school year, with early levels arriving relatively quickly and later progression slowing substantially.

The agent should translate this into appropriate:

- schema
- backend logic
- frontend behavior
- calculations
- configuration
- tests
- migration scripts
- deployment changes

The product owner should not be required to specify React components, SQL syntax, server configuration, or infrastructure commands unless they explicitly want to.

---

# 11. Implementation Expectations

When implementing or refactoring a system:

1. Read the relevant authoritative design documents.
2. Inspect the current Git implementation.
3. Identify discrepancies between implementation and current design.
4. Preserve behavior that still matches the intended product.
5. Replace obsolete architecture rather than layering additional hacks on top of it.
6. Prefer modular systems over tightly coupled systems.
7. Keep game rules separate from presentation when practical.
8. Keep campaign/content data separate from engine logic when practical.
9. Add tests around deterministic systems such as combat calculations.
10. Update documentation when a major design decision changes.

Do not treat existing technical debt as a design constraint unless removing it would create unreasonable migration risk.

---

# 12. QuestAcademy Product Direction

QuestAcademy is not merely a classroom quiz interface.

It is intended to become a reusable educational RPG platform in which teachers can create or import campaigns covering many academic domains.

Core concepts include:

- teacher-led classroom encounters
- solo encounters
- group encounters
- dungeons
- bosses and raids
- persistent character progression
- jobs/classes
- equipment
- guilds
- quests
- campaign progression
- standards-aligned content
- differentiated challenge
- long-term student progression

QuestAcademy should eventually support complete ready-to-use campaigns such as:

- ACT preparation
- Math 3
- AP Precalculus
- AP Calculus
- other teacher-created subjects and courses

The engine should therefore remain general enough that QuestAcademy is not fundamentally tied to mathematics.

---

# 13. Differentiation Philosophy

QuestAcademy should support meaningful differentiation.

In particular:

- normal classroom encounters can target core course standards
- solo encounters can offer deeper and substantially more challenging material
- advanced students should be able to extend their learning without requiring the whole class to move at their pace
- progression systems should reward participation and achievement without making academic difficulty inaccessible to struggling students

For a Math 3 implementation, the broader game world may effectively function as ACT-aligned practice while classroom instruction continues to address required course standards.

---

# 14. Campaigns and Marketplace

Campaigns should ultimately be portable packages of educational/game content.

Teachers should be able to:

- create campaigns
- import campaigns
- modify campaigns
- share campaigns

The long-term product vision includes the possibility of a marketplace where educators can distribute or sell complete campaigns.

This supports the goal that a teacher should be able to begin using QuestAcademy quickly without needing to build an entire RPG campaign from scratch.

A mature campaign may include:

- question banks
- encounters
- quests
- bosses
- raids
- progression
- equipment
- narrative structure
- standards mappings

Campaign architecture should therefore be designed with portability and reuse in mind from the beginning.

---

# 15. Product Success Metric

The most important long-term engagement metric is:

**Daily Active Users (DAU)**

DAU is especially useful because it reflects more than mandatory classroom participation.

Healthy DAU should eventually capture students voluntarily engaging through:

- solo encounters
- group encounters
- progression
- after-school play
- weekend play
- guild activity
- optional campaign content

Supporting metrics may be useful, but development should remain focused on whether QuestAcademy becomes something students repeatedly choose to engage with.

---

# 16. Guiding Principle

When making a development decision, ask:

> Does this move QuestAcademy toward a robust, reusable educational RPG platform, or merely preserve an accident of the prototype?

Prefer the former.

<a id="equipped-gear-artwork--review-pending"></a>

## Equipped gear artwork — released October 8, 2026

[Equipped gear visuals](avatar-equipment-visuals.md) records the October 7 owner
direction: independent static slot rendering, Tier 0-based Tier 1 recolors and
missing weapon art. The head-stat change was withdrawn; prior bonuses remain.
PR #46 is deployed as front-facing static equipment artwork. This does not
satisfy the separate animation gate.


## October 8 deployment checkpoint

PRs #43–46 are merged at `14a58f14cf29e8a0ed33e8aa601e2e680dd77efc`.
The remembered-loadout, Tier 1, comparison and equipped-art implementations above
are **deployed**. The R2 HTTP 403 occurred only in attempt 1 of run `37773374205`;
[attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/37773374205/attempts/2)
passed at 12:21 UTC, including the migration gate with 0012/0013 in its journal.

The 17:12 UTC checkpoint was
[run 37814586746](https://github.com/Orsnoire/FightSchool/actions/runs/37814586746),
runtime commit `764cd2fe2d544733c8e10fdace84084cbbfe94aa`, Worker
`926af6a1-eb8b-4fd0-8c3b-9941ece77aad`. It includes PRs #43–46, #47 and #49;
R2, the migration gate through 0014 and both hostname smoke checks passed.
[Live acceptance 37816148964, attempt 2](https://github.com/Orsnoire/FightSchool/actions/runs/37816148964/attempts/2)
passed against the canonical domain at 17:28 UTC using PR #50's corrected fixtures.
PR #50 changes acceptance tests only and does not require another runtime deployment.

See [the reconciled release and migration record](cloudflare/full-migration.md#gear-release-recovered-and-verified--8-october-2026)
for run/job evidence and migration verification limits. The successful migrator
and committed journals establish the release gate; individual database ledger
rows and live column/constraint definitions were not independently queried.
The earlier R2 failure is historical context, not an active release blocker.

The later PR #52 release supersedes that runtime checkpoint: `e158194` passed
[CI 37843818974](https://github.com/Orsnoire/FightSchool/actions/runs/37843818974),
[deployment 37844054859](https://github.com/Orsnoire/FightSchool/actions/runs/37844054859)
and [canonical acceptance 37844271331](https://github.com/Orsnoire/FightSchool/actions/runs/37844271331).
See [current status](CURRENT_STATUS.md) for the consolidated baseline and known
cleanup defects; a successful release does not imply every code path is correct.

<a id="guild-quests-and-classroom-tiers--implementation-pending-release"></a>

## Guild quests and classroom tiers — released October 8, 2026

[Guild quests and classroom tiers](guild-quests-and-tiers.md) records the October 8
owner direction and PR #47's released implementation: teacher-authored quests and
limit-break/job rewards, permanent progression with encounter-specific caps,
AA overflow banking, shop tier browsing and tier/role fight authoring. Initial
scaling presets require classroom balance review. AA upgrade purchases remain
future work. The release and migration-0014 evidence are recorded in the same
October 8 release record.

## Explicit host-session controls and team-race feasibility

The [October 8 host-session rules](combat/host-sessions-and-team-race.md) supersede
implicit session creation on page load and the proposed automatic end-on-launch.
Use explicit Join / End / Launch controls and session-specific reconnect URLs.
These controls were released in PR #49 and exercised by the live acceptance above.
The same document records the code-level team-race feasibility review; team race
and party-scaled swarm counts remain future implementation, not released features.

## Individual enemies and wave budgets

The [October 8 enemy and goblin rules](combat/enemy-waves-and-goblins.md) record
individual quantities, role HP shares, reference-party scaling, goblin targeting,
wave pauses and the approved sprite. This implementation was integrated into
PR #52 and is deployed. Party-scaled counts and team race remain future work in
the [expansion plan](EXPANSION_PLAN.md).
