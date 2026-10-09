# Current status

**CURRENT — verified October 9, 2026.** Documentation has been reconciled before
cleanup. **Phase 1 has started with its interruption/resume safeguard.**
C01 is registered as the single active package in [draft PR #53](https://github.com/Orsnoire/FightSchool/pull/53);\nruntime fixes are not yet written.
Read [active work](ACTIVE_WORK.md) for the branch/PR and exact next action. The
[cleanup plan](CLEANUP_PLAN.md) controls sequencing; expansion is [deferred](EXPANSION_PLAN.md).

## Verified release baseline

The latest verified application runtime is
[`e1581948f6623d86af859452bf083ca0f35db681`](https://github.com/Orsnoire/FightSchool/commit/e1581948f6623d86af859452bf083ca0f35db681),
the October 8 merge of PR #52. It was also `main` at the start of this review.
Subsequent documentation commits do not change the deployed runtime. Immutable
Worker version: `2180375a-c947-470d-a3ea-e199c9ff25f3`, published October 8
at 21:04:51 UTC in deployment job `113540375470`.

| Evidence | Result |
| --- | --- |
| [CI 37843818974](https://github.com/Orsnoire/FightSchool/actions/runs/37843818974) | Passed on `e158194` |
| [Deployment 37844054859](https://github.com/Orsnoire/FightSchool/actions/runs/37844054859) | Passed on `e158194`, October 8 |
| [Canonical live acceptance 37844271331](https://github.com/Orsnoire/FightSchool/actions/runs/37844271331) | Passed on `e158194`, October 8 |
| [Enemy AI browser acceptance 37841834095](https://github.com/Orsnoire/FightSchool/actions/runs/37841834095) | Passed on the PR #52 review head; sprite/authoring/recovery screenshots inspected |
| Local review baseline | TypeScript, 186 tests and production client/Worker build passed; existing installed dependencies reused |
| Database release evidence | Successful migrator gates with the committed journal through `0014`; details and limits in the [release record](cloudflare/full-migration.md#gear-release-recovered-and-verified--8-october-2026) |

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
| Equipment | Eight slots, full Tier 0 starters, permissions, remembered per-job gear/abilities, Tier 1 level-2 collection, comparisons, equipped static art | Built-in Tier 1 loot claim fails at the HTTP validator: F01/C01 |
| Guilds and progression | Teacher/personal/shared quests, permanent progression with encounter caps, tier browsing, AA overflow banking, atomic reward receipts | AA purchases and additional balance tuning remain future work |
| Host sessions | Explicit Join / End / Launch, exact-session reconnect, duplicate-launch protection, idempotent host-end rewards | Team race is not implemented |
| Enemies | Seven defined species, configurable priorities, answer-based recovery, individual quantities, waves, goblin targeting and minimum-five additions | Party-scaled enemy counts are not implemented; fixed authored quantities remain |
| Avatars | Saved independent appearance, Human models, starter wardrobe and front-facing equipped-item visuals | Full animation, near-profile fitting and custom-item artwork remain pending |

Release details: [October 7–8 completed batch](combat/release-queue.md),
[current enemy specification](combat/enemy-ai.md), and
[dated deployment history](cloudflare/full-migration.md).

## Known issues and cleanup status

The [review](reviews/2026-10-09-code-review.md) identifies 17 findings. No runtime
fixes from that review have been implemented by this documentation update.

- **Reproduced correctness defects:** built-in loot IDs are rejected by the claim
  route; the student leaderboard constructs an invalid path; accuracy adds fight
  percentages instead of calculating an aggregate percentage (F01–F03).
- **Schema generation drift:** journal through `0014`, latest snapshot `0007`;
  disposable generation emitted 23 duplicate column additions. SQL-only quest
  tables also need explicit schema ownership (F04).
- **Dependency maintenance:** the October 9 audit reported 32 vulnerable-package
  entries, not 32 proven application exploits. Triage and compatible updates are
  planned (F15).
- **Performance/refactoring work:** API contracts, query/index patterns, room
  projection and persistence, quest evaluation, bundle loading, avatar surfaces,
  broad timer updates, mixed modules and delivery diagnostics (F05–F16).
- **Documentation reconciliation (F17): COMPLETE for this baseline.** Status,
  history and plans are now separated; updating them remains part of each release.

## Open acceptance and operational work

The October 8 30-answer burst measured p50 **1,657 ms**, p95 **3,070 ms**, maximum
**3,220 ms**. Its current maximum threshold is 15 seconds. It does not establish
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
