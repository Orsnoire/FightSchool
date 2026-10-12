# Current status

**CURRENT — verified October 12, 2026.** Cleanup Phase 1 is in progress.
**C01 and C02 are COMPLETE:** PRs [#53](https://github.com/Orsnoire/FightSchool/pull/53) and [#56](https://github.com/Orsnoire/FightSchool/pull/56) are merged, deployed and accepted. **C03 — schema baseline is COMPLETE, merged in PR #58.**
Read [active work](ACTIVE_WORK.md) for the interruption checkpoint and next action.
The [cleanup plan](CLEANUP_PLAN.md) controls sequencing; expansion is [deferred](EXPANSION_PLAN.md).

## Verified release baseline

The latest verified application runtime is `5d89fb0bc4d160754ceb9645019f465809742ef2`, containing the October 12
PR #56 merge plus a documentation checkpoint. Immutable Worker `81387a2a-9084-410f-b773-3726713f8544` was
published October 12 at 15:32:49 UTC. Subsequent documentation-only commits do not
change this runtime.

| Evidence | Result |
| --- | --- |
| [Deployment 38270833735](https://github.com/Orsnoire/FightSchool/actions/runs/38270833735) | Passed on `5d89fb0`; 211 tests, typecheck, builds, R2, migration and both hostnames |
| [Canonical live acceptance 38271115093](https://github.com/Orsnoire/FightSchool/actions/runs/38271115093) | Passed on `5d89fb0` |
| [Review CI 38265412023](https://github.com/Orsnoire/FightSchool/actions/runs/38265412023) / [browser 38265412210](https://github.com/Orsnoire/FightSchool/actions/runs/38265412210) | Passed on implementation head `5bb7949` |
| Database evidence | Upgraded migrator succeeded through existing journal `0014`; no C02 DDL. C03 repaired generation drift in PR #58; no new migration or live database operation was needed. |

See [C02 release record](cloudflare/full-migration.md#c02-dependency-release--12-october-2026).

The October 8 queue is reconciled: every October 8 merged PR (#37–50 and #52)
is already included in the verified October 8 runtime `e158194` and this release.
There was no separate older open PR or undeployed merged application change.
The gear, guild-quest, host-control and enemy releases are live. Deferred
expansion items are not pending deployments.

The canonical classroom URL is <https://questacademy.bookwyrminteractive.studio>.
The Worker and deployment workflows still use the name **staging**, but they
serve this live application. A second hostname is not evidence of isolated data.
Current architecture: React/Vite assets, Fetch-native Worker APIs, one Durable
Object per combat room, Neon PostgreSQL, and R2 uploads. Express/Replit is removed
from the active runtime and is not a rollback target.

## Implemented and released

| Area | Released behavior | Outstanding boundary |
| --- | --- | --- |
| Combat and classroom UI | Deterministic combat, current class rules, daily stamina, First Aid, calculated ability values, static battlefield, late entry, moderation, host resurrection and proportional host-end rewards | Refactors preserve these rules; classroom balance observation continues |
| Equipment | Eight slots, full Tier 0 starters, permissions, remembered per-job gear/abilities, Tier 1 level-2 collection, comparisons, equipped static art | F01 built-in/custom claim validation released in C01; ownership, earned-loot checks and atomic rewards preserved |
| Guilds and progression | Teacher/personal/shared quests, permanent progression with encounter caps, tier browsing, AA overflow banking, atomic reward receipts | AA purchases and additional balance tuning remain future work |
| Host sessions | Explicit Join / End / Launch, exact-session reconnect, duplicate-launch protection, idempotent host-end rewards | Team race is not implemented |
| Enemies | Seven defined species, configurable priorities, answer-based recovery, individual quantities, waves, goblin targeting and minimum-five additions | Party-scaled enemy counts are not implemented; fixed authored quantities remain |
| Leaderboards | Student metric query and visible retryable errors; accuracy weighted by total answers | Guild scope, hidden metrics and additive metrics preserved |
| Avatars | Saved independent appearance, Human models, starter wardrobe and front-facing equipped-item visuals | Full animation, near-profile fitting and custom-item artwork remain pending |

Release details: [October 7–8 completed batch](combat/release-queue.md),
[current enemy specification](combat/enemy-ai.md), and
[dated deployment history](cloudflare/full-migration.md).

## Known issues and cleanup status

The [review](reviews/2026-10-09-code-review.md) records 17 baseline findings.
**F01–F03 are now closed by released C01;** remaining work stays in the cleanup
plan and [active-work checkpoint](ACTIVE_WORK.md).

- **F01 released:** registered built-in equipment IDs and custom UUIDs pass the
  claim contract. HTTP regressions cover fallback choices, invalid/unearned
  IDs, ownership, result scope, eligibility, gold and repeated/concurrent claims.
- **F02/F03 released:** the student leaderboard sends the metric query parameter,
  displays retriable errors, and calculates total correct over total answered.
  Unequal fight sizes, zero answers, guild scope and permissions have boundary
  regression coverage. The standard live acceptance run complements these
  disposable HTTP/UI regressions; it does not reproduce every new fixture live.
- **Schema generation drift:** journal through `0014`, latest snapshot `0007`;
  disposable generation emitted 23 duplicate column additions. SQL-only quest
  tables also need explicit schema ownership (F04).
- **Dependency maintenance (C02 released):** audit entries reduced from 32 to 12.
  Remaining build/CLI chains have scoped deferrals in the [triage record](reviews/2026-10-12-dependency-triage.md).
  Production-only audit still reports 7 Tailwind peer-chain entries; not a clean audit.
- **Performance/refactoring work:** API contracts, query/index patterns, room
  projection and persistence, quest evaluation, bundle loading, avatar surfaces,
  broad timer updates, mixed modules and delivery diagnostics (F05–F16).
- **Documentation reconciliation (F17): COMPLETE for this baseline.** Status,
  history and plans are now separated; updating them remains part of each release.

## Open acceptance and operational work

The October 12 30-answer burst measured p50 **1,659 ms**, p95 **3,217 ms**, maximum
**3,367 ms**. Its current maximum threshold is 15 seconds. One burst is not a
performance trend or evidence of meeting the proposed cleanup target; it does not establish
performance for a guild with fully seeded quests, realistic history and many
distinct avatars. Cleanup C05–C08 and C12 own repeated 30/60-player measurements.

Full infrastructure signoff is still open: forced deployed room restart/eviction,
Neon interruption and connection-limit recovery, a timed compatible Worker
rollback, complete student desktop/mobile acceptance and a monitoring/observation
window. These are tracked in C12; disruptive drills need isolated resources or an
agreed release window. Functional acceptance does not mark those drills complete.

**Preserve current live data.** Students, appearances, equipment, progression,
guilds, content, results and reward receipts must survive cleanup. The original
fresh-database decision concerned discarded Replit prototype data only. It is
not permission to reset the current Neon database, R2 objects or room state.
