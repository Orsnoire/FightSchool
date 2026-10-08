# QuestAcademy — Source of Truth

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

The [classroom polish release queue](combat/release-queue.md) distinguishes
implemented review branches from deployed behavior and records the remaining
ordered tasks. First Aid, calculated ability values, informative loot choices,
eight equipment slots, complete Tier 0 starters, loadout synchronization and
visible equipment permissions with explicit new-armor classification were
released October 7 in PRs #37–42. Migration 0011 preserves existing equipment.
See [the release record](cloudflare/full-migration.md) for deployment evidence and
[starter wardrobe](starter-wardrobe.md) for future slot extension hooks. Per-job remembered equipment and cross-class
ability loadouts are implemented for review with migration 0012, not yet deployed;
see the same wardrobe document for restoration and concurrency rules.


## Tier 1 gear and instance loot

The [October 7 Tier 1 specification](combat/tier-one-equipment.md) records the
owner's level-2 equipment collection, revised tank VIT damage weighting and
fallback instance loot rules. It supersedes older conflicting equipment level
gates and VIT damage formulas. Implementation is in review, not deployed.

The [equipment comparison specification](combat/equipment-comparisons.md) records
hover, keyboard and touch comparisons in gear, shop and loot screens, including
lost off-hand bonuses and special effects. It is implemented for review after the
Tier 1 branch, not yet deployed.

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
precise formation pattern remains open; it does not replace the current
combat overlay flow or authorize premature live avatar integration.

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
current portrait UI is transitional until the new renderer/creator is integrated.

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

GitHub should become the canonical source of the codebase after migration.

Replit should not remain a required part of QuestAcademy's architecture.

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

QuestAcademy is being migrated away from Replit.

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
- unused student records
- test data
- implementation compromises made solely because of Replit

---

# 8. Database Migration

Existing Replit database data does NOT need to be preserved.

A fresh production database is preferred.

The migration should therefore:

1. determine the data model QuestAcademy actually needs
2. create a clean schema
3. eliminate obsolete prototype fields and tables
4. generate migrations/schema definitions in source control
5. seed only data that is useful for the product itself
6. begin production with clean user/student data

Do not spend development time preserving historical test accounts, player progression, or prototype database state.

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

Current likely options include services such as Cloudflare for hosting/DNS and Neon for PostgreSQL, but implementation should avoid unnecessary provider lock-in.

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

## Equipped gear artwork — review pending

[Equipped gear visuals](avatar-equipment-visuals.md) records the October 7 owner
direction: independent static slot rendering, Tier 0-based Tier 1 recolors and
missing weapon art. The head-stat change was withdrawn; prior bonuses remain.
This implementation is not deployed and does not satisfy the animation gate.


## October 8 deployment checkpoint

PRs #43–46 are merged at `14a58f14cf29e8a0ed33e8aa601e2e680dd77efc`.
The remembered-loadout, Tier 1, comparison and equipped-art implementations above
have completed review but are **not deployed**. The release workflow stopped at
Cloudflare's R2 HTTP 403 before migrations 0012/0013 or Worker activation. See
[the release record](cloudflare/full-migration.md#gear-release-attempt--8-october-2026-blocked-before-migration).
The previous October 7 release remains live.

## Guild quests and classroom tiers — implementation pending release

[Guild quests and classroom tiers](guild-quests-and-tiers.md) records the October 8
owner direction and this branch's implementation: teacher-authored quests and
limit-break/job rewards, permanent progression with encounter-specific caps,
AA overflow banking, shop tier browsing and tier/role fight authoring. Initial
scaling presets require classroom balance review. AA upgrade purchases remain
future work. This implementation is not deployed.
