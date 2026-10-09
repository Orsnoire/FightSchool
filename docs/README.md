# QuestAcademy documentation

**CURRENT — updated October 9, 2026.** Cleanup is the next development priority.
Cleanup Phase 1 has **started with the resume safeguard**. All three C01 fixes
are implemented and locally verified on the registered branch; PR checks/review
and release remain separate. New features wait for the cleanup exit gates.
Read [active work](ACTIVE_WORK.md) before editing.

## Start here

| Document | Purpose | Status |
| --- | --- | --- |
| [Active work / resume here](ACTIVE_WORK.md) | One package, branch/PR, checkpoint and next action | CURRENT COORDINATION |
| [Current status](CURRENT_STATUS.md) | Shipped features, verified runtime, known defects and open acceptance | CURRENT |
| [Cleanup plan](CLEANUP_PLAN.md) | Six phases, twelve work packages, dependencies and completion gates | CURRENT PLAN — C01 implementation verified locally; review/release next |
| [Expansion plan](EXPANSION_PLAN.md) | Deferred features, design dependencies and long-term direction | FUTURE — after cleanup |
| [October 9 engineering review](reviews/2026-10-09-code-review.md) | Findings F01–F17 and measured baseline behind the cleanup plan | BASELINE RECORD |
| [Source of Truth](Source_of_Truth.md) | Product authority, design rules and conflict resolution | CURRENT AUTHORITY |

## Status conventions

- **CURRENT** identifies the present status or next work. Update these documents
  when a work package or release changes that status.
- **CURRENT SPECIFICATION — RELEASED** describes intended behavior already
  shipped. It remains authoritative during refactoring; released does not mean
  defect-free or that every future extension in the document is complete.
- **COMPLETE / HISTORICAL** identifies a finished implementation phase or release
  record. Its old “next,” “pending,” and rollback instructions describe that
  checkpoint, not today's queue.
- **SUPERSEDED / HISTORICAL** identifies an earlier plan or incomplete slice
  replaced by later implementation. It is not a reason to recreate legacy code.
- **FUTURE / OPEN** identifies unimplemented features or acceptance still lacking
  evidence. These are never marked complete merely because related code shipped.

Existing paths are retained so repository links and prior review references keep
working. Status is shown in the document itself instead of renaming active
specifications to `COMPLETE`. The current cleanup phases C01–C12 are unrelated
to the historical Cloudflare migration phase numbers.

## Current specifications and operating references

| Area | Documents | Boundary |
| --- | --- | --- |
| Combat rules and presentation | [Balance and stamina](combat/classroom-balance-and-stamina.md), [student overlays](combat/student-overlays.md), [battlefield direction](combat-facelift.md) | Released static battlefield and current rules; later dated approvals supersede early proposals |
| Enemies | [Enemy AI and recovery](combat/enemy-ai.md), [individual enemies and waves](combat/enemy-waves-and-goblins.md) | Seven defined species, goblin minimum five, fixed authored quantities |
| Equipment | [Starter wardrobe](starter-wardrobe.md), [Tier 1](combat/tier-one-equipment.md), [comparisons](combat/equipment-comparisons.md), [equipped artwork](avatar-equipment-visuals.md) | Released; F01 claim fix in draft PR #53, not yet deployed |
| Progression | [Guild quests and tiers](guild-quests-and-tiers.md) | Released; classroom tuning open, AA purchases future |
| Hosting and team race | [Host sessions and team-race feasibility](combat/host-sessions-and-team-race.md) | Explicit Join / End / Launch released; team race future |
| Avatars | [Database foundation](avatar-database.md), [art and animation direction](avatar-art-direction.md) | Static avatars released; full animation gate remains open |
| Operations | [Custom domain](cloudflare/custom-domain.md), [workshop routing](workshop-routing.md), [release and recovery record](cloudflare/full-migration.md) | Workshop and live application are separate; infrastructure drills remain open |

## Completed and historical work

| Record | Classification |
| --- | --- |
| [Cloudflare migration plan](Migration_Plan) | HISTORICAL implementation sequence; deployed topology retained; open operational gates carried into C12 |
| [Phase 0 characterization](cloudflare/phase-0-characterization.md) | COMPLETE / HISTORICAL |
| [Phase 1 legacy boundary](cloudflare/phase-1-legacy-boundary.md) | COMPLETE / HISTORICAL; legacy runtime subsequently removed |
| [Phase 2 Worker foundation](cloudflare/phase-2-worker-foundation.md) | COMPLETE / HISTORICAL |
| [Phase 3A teacher identity](cloudflare/phase-3-teacher-identity.md), [Phase 3B fight persistence](cloudflare/phase-3-teacher-fights.md) | COMPLETE / HISTORICAL |
| [Initial Phase 4 combat slice](cloudflare/phase-4-live-combat.md) | SUPERSEDED by full combat recovery; original slice was incomplete |
| [October 7–8 classroom release queue](combat/release-queue.md) | COMPLETE release batch / HISTORICAL; cleanup now owns the active queue |
| [Enemy AI verification](combat/enemy-ai-verification.md) | COMPLETE release verification record; balance observation remains open |
| [Worker migration and release history](cloudflare/full-migration.md), [release screenshots](releases/) | HISTORICAL evidence, plus explicitly open operations gates |

## Maintaining current status

For each cleanup package, record its actual PR, validation, remaining limitations
and status in [CLEANUP_PLAN.md](CLEANUP_PLAN.md). A merged change is not called
deployed until deployment evidence exists. On release, update
[CURRENT_STATUS.md](CURRENT_STATUS.md) with the runtime SHA and exact CI,
deployment and acceptance runs, and append the release record. Keep old evidence
dated; move remaining scope into the active plans instead of leaving competing
“current” queues. Product rule changes also update the relevant specification and
[Source of Truth](Source_of_Truth.md).
