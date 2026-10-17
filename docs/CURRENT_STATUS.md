# Current status

**CURRENT — GitHub rechecked October 17, 2026.** Cleanup Phases 1–2 are complete; C05 is complete; Usability Patch 1 is complete, deployed and accepted; C06 is active in draft PR #69, not merged or deployed.
**C01, C02 and C03 are COMPLETE:** PRs [#53](https://github.com/Orsnoire/FightSchool/pull/53), [#56](https://github.com/Orsnoire/FightSchool/pull/56) and [#58](https://github.com/Orsnoire/FightSchool/pull/58) are merged and included in the live runtime. **HP preview, PR #59, is deployed and accepted. C04 / PRs #60 and #62 are merged, deployed and accepted. PR #61 is merged, deployed and accepted.**
Read [active work](ACTIVE_WORK.md) for the interruption checkpoint and next action.
The [cleanup plan](CLEANUP_PLAN.md) controls sequencing; expansion is [deferred](EXPANSION_PLAN.md).

## Verified release baseline

GitHub now confirms the deployed runtime is `d18d1b5c29e2b758a6bf523ad3c15b6b8285c842`,
including PR #66 (mesmerize/feedback) and merged PR #68 (default shop catalog).
[CI 38452023937](https://github.com/Orsnoire/FightSchool/actions/runs/38452023937) and
[deployment 38452066918](https://github.com/Orsnoire/FightSchool/actions/runs/38452066918)
succeeded on October 13. Live acceptance for this exact runtime and its immutable
Worker version have not been reverified by the C06 session. The October 17 main
checkpoint update is documentation only; C06 remains on its draft branch.
No deployment or production database operation was performed for C06.

### Previous accepted release evidence (historical)

The previous accepted runtime was `bef100b4a86574819fe12bceed901de0fbd1caac`, the PR #65 correction to Usability Patch 1 / PR #64.
Immutable Worker `0951289e-d7c5-4243-b281-8ae0f61e4e9f` was published October 12 at
21:38:56 UTC. Subsequent documentation commits do not change this runtime.

| Evidence | Result |
| --- | --- |
| [Deployment 38311747151](https://github.com/Orsnoire/FightSchool/actions/runs/38311747151) | Passed on `bef100b`; 254 tests, typecheck, builds, R2, migration gate and both hostnames |
| [Canonical live acceptance 38311980245](https://github.com/Orsnoire/FightSchool/actions/runs/38311980245) | Passed on `bef100b`; combat/economy, completion, palettes/reporting, R2, 30-player concurrency/reconnects, moderation, revocation and exactly-once rewards |
| [Review CI 38311299763](https://github.com/Orsnoire/FightSchool/actions/runs/38311299763) / [browser 38311299742](https://github.com/Orsnoire/FightSchool/actions/runs/38311299742) | Passed on `78af971`; all effects/editors/filters, 30/60-player playback and the reporting batch correction |
| Database evidence | Migrations 0015/0016 applied before the initial deployment; the corrected deployment's migration gate also passed. No live-data reset. |

See [Usability Patch 1 release record](USABILITY_PATCH_1.md), including earlier acceptance failures and corrections. C05 room-cost improvements, PR #61 and the C04 refactor/forwarding fix remain included. Every answer remains durably checkpointed; reporting attempts are projected together when the question closes.

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
| Combat and classroom UI | Deterministic combat, current class rules, daily stamina, First Aid, calculated ability values, static battlefield, late entry, moderation, host resurrection, Next wave, enemy elimination × and proportional host-end rewards | Refactors preserve these rules; classroom balance observation continues |
| Equipment | Enemy/equipment color palettes, reusable equipment base sprites and variants; eight slots, full Tier 0 starters, permissions, remembered per-job gear/abilities, Tier 1 level-2 collection, comparisons, equipped static art | F01 built-in/custom claim validation released in C01; ownership, earned-loot checks and atomic rewards preserved |
| Guilds and progression | Teacher/personal/shared quests, permanent progression with encounter caps, tier browsing, AA overflow banking, atomic reward receipts | AA purchases and additional balance tuning remain future work |
| Host sessions | Explicit Join / End / Launch, exact-session reconnect, duplicate-launch protection, idempotent host-end rewards | Team race is not implemented |
| Enemies | Seven defined species, configurable priorities, answer-based recovery, individual quantities, waves, goblin targeting, minimum-five additions and genuine roster-based count/HP estimates, optional swarm batches at 8/12/16 players and previous-tier reference gear | Counts lock at Start Fight; tier 3/4 gear bonuses remain provisional |
| Teacher statistics and editing | Session/player/question reports with search and guild, session, quiz, question, job, player ID and date filters; question Edit/save/cancel restored | Historical totals remain; pre-patch question attempts cannot be reconstructed |
| Leaderboards | Student metric query and visible retryable errors; accuracy weighted by total answers | Guild scope, hidden metrics and additive metrics preserved |
| Avatars and combat presentation | Saved appearance, equipped-item visuals, attack/damage effect placeholders, flying numbers and completion-driven resolution | Question and action/ability selection clocks remain. Full sprite animation, near-profile fitting and custom-item artwork remain pending |

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
- **Schema generation drift/F04 (C03 complete):** schema declarations and the
  `0014` snapshot now match all 27 migrated tables/246 columns. No-op generation
  writes no files; SQL-owned functions and future migration responsibilities are
  documented in the [schema baseline](cloudflare/schema-baseline.md).
- **Dependency maintenance (C02 released):** audit entries reduced from 32 to 12.
  Remaining build/CLI chains have scoped deferrals in the [triage record](reviews/2026-10-12-dependency-triage.md).
  Production-only audit still reports 7 Tailwind peer-chain entries; not a clean audit.
- **Contracts/diagnostics F05/F16 (C04 released):** shared boundary contracts, explicit public projections, bounded JSON parsing, typed queries and redacted logs. Intended CI checks run on every PR; branch protection enforcement remains off.
- **Remaining performance/refactoring work:** query/index patterns, room encoding and persistence, quest evaluation, bundle loading, avatar surfaces, broad timer updates and mixed modules (C06–C11).
- **Documentation reconciliation (F17): COMPLETE for this baseline.** Status,
  history and plans are now separated; updating them remains part of each release.

## Open acceptance and operational work

The corrected Usability Patch 1 October 12 30-answer burst measured p50 **818 ms**, p95 **1,477 ms**, maximum
**1,527 ms**. Its current maximum threshold is 15 seconds. One burst is not a
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
