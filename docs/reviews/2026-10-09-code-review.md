# Engineering review — October 9, 2026

**BASELINE RECORD.** Reviewed runtime: `e1581948f6623d86af859452bf083ca0f35db681`.
This is the repository companion to the October 9 code review and cleanup report.
Use [CURRENT_STATUS.md](../CURRENT_STATUS.md) for current completion status and
[CLEANUP_PLAN.md](../CLEANUP_PLAN.md) for the active queue. Findings describe the
reviewed baseline, even after later fixes. At that review checkpoint, F17's
documentation reconciliation was complete and runtime/schema/dependency packages
had not started. C01 subsequently closed F01–F03; the findings below retain the
original reproduction evidence.

P1 means address in the first cleanup phase; P2 means material cleanup work;
P3 means lower-priority removal once dependencies are verified. These are review
priorities, not security severity ratings.

## Correctness and data boundaries

| ID / priority | Evidence and effect | Recommended change / package |
| --- | --- | --- |
| **F01 / P1** | [Reward route](../../worker/routes/game.ts) accepts only UUID `itemId`, while [Tier 1 catalog](../../shared/tier-one-equipment.ts) uses IDs such as `t1_healer_potion`. Real handler plus migrated disposable SQL returned HTTP 400 for an earned built-in item; direct repository claim succeeded. Repository-only reward tests miss this boundary. | Shared equipment ID contract supporting registered built-ins and custom UUIDs, preserving ownership/earned-loot/idempotency checks. HTTP and UI regression: **C01**. |
| **F02 / P1** | [GuildLeaderboard](../../client/src/pages/GuildLeaderboard.tsx) includes `damageDealt` in a cache key that the [default query function](../../client/src/lib/queryClient.ts) joins into the URL path. The resulting `/leaderboard/damageDealt` returns 404; the query-parameter route returns 200. The UI silently falls back to an empty list. | Explicit URL/query factory and visible errors: **C01**, consolidate contracts in **C04**. |
| **F03 / P1** | [Leaderboard aggregation](../../worker/routes/game.ts) sums per-fight accuracy percentages. Two 8/10 fights report 160 instead of 80. | Question-weighted `100 * sum(correct) / sum(answered)`, with explicit zero-answer behavior. Mixed 1/1 and 1/9 must be 20%, not an unweighted average: **C01**. |
| **F04 / P1** | [Migration journal/snapshots](../../migrations/cloudflare/meta/) run through `0014` but snapshots stop at `0007`. Disposable generation emitted 23 duplicate column additions. SQL-only `quest_fight_evidence` and `personal_quest_receipts` also lack declarations in [schema.ts](../../worker/db/schema.ts). Generated SQL was never applied. | Reconcile metadata and explicit SQL ownership; preserve shipped migrations, SQL functions/checks and existing data. No-op generation and migrated-catalog verification: **C03**. |
| **F05 / P2** | [Shared schema](../../shared/schema.ts) and [fight route validation](../../worker/routes/fights.ts) duplicate validators with differences in bounds/empty enemies/IDs. Public types alias DB records whose date/omitted-field shape differs from serialized JSON. | Domain request/response contracts, JSON DTOs, typed query factories and separate internal/public combat views: **C04**. |
| **F06 / P2** | [DB schema](../../worker/db/schema.ts) has a combat-result unique index beginning with `session_id`; reads also filter by student, guild and fight. Membership reads by student do not match the existing composite leading column. History fetches complete sets and repeatedly scans names. No production query plan was captured. | Representative `EXPLAIN` measurements, justified indexes, paginated history, SQL aggregates and lookup maps; retain unique reward constraints: **C06**. |

## Room and frontend performance

| ID / priority | Evidence and effect | Recommended change / package |
| --- | --- | --- |
| **F07 / P2** | [Session publish](../../worker/combat/session-object.ts) rebuilds, projects and encodes full state per socket. A synthetic 30-player + host snapshot was 30,164 bytes and one full fan-out 935,084 bytes; at 60 + host, 59,564 and 3,633,404 bytes. | Build/encode once per role/revision and suppress unchanged broadcasts; measure bounded coalescing only if needed. Preserve immediate acknowledgement/phase transitions and full reconnect snapshots. Delta protocol deferred: **C05**. |
| **F08 / P2** | [Serialized commands](../../worker/combat/session-object.ts) await session revocation checks and can write quest evidence before acknowledgement. Established-player rejoin reloads a profile; checkpoints include frozen fight content. | Instrument queue, DB and save time; preserve revocation/serial authority/durable receipts. Avoid redundant profile reads; consider durable evidence outbox and separate frozen content only with evidence: **C05–C06**. |
| **F09 / P2** | [Quest evaluation](../../worker/progression/quests.ts) loads whole-guild results/evidence and teacher fight banks, repeatedly filters quests/levels, and can write rewards during quest/shop GET requests. Thirty seeded members imply 2,051 quests (68 each + 11 shared). | Separate read views from evaluation; evaluate affected quests on relevant events, pre-index evidence/levels, version question fingerprints and bound history. Preserve atomic rewards and departed-player academic evidence: **C06**. |
| **F10 / P2** | [App](../../client/src/App.tsx) eagerly imports all routes; [MathEditor](../../client/src/components/MathEditor.tsx) imports MathLive. Build emitted a 2,001.87 kB main JS file, 583.00 kB gzip. | Lazy route/editor loading with explicit loading/error states; proposed 40% initial login gzip reduction: **C07**. |
| **F11 / P2** | [StaticAvatar](../../client/src/components/StaticAvatar.tsx) always allocates 1,200 × 1,950 pixels even for small battlefield figures. One RGBA surface is 9.36 MB; 30 is 280.8 MB and 60 is 561.6 MB before other buffers. Composition cache holds eight results. These are theoretical backing sizes, not measured heap. Its effect already avoids repaint on every ordinary render. | Display/DPR-sized surfaces, byte-bounded cache and stable appearance keys; reuse compositions. Off-thread work only if profiling warrants it. Proposed 80% allocation reduction: **C08**. |
| **F12 / P2** | [Combat hook](../../client/src/hooks/useCombatSession.ts) updates time every 250 ms and rerenders its consuming page/battlefield. [Teacher dashboard](../../client/src/pages/TeacherDashboard.tsx) polls full definitions every five seconds as well as a separate live-session query. | Isolate countdown updates and stable battlefield sections; list summary DTOs, mutation/navigation refresh for definitions and focused live polling: **C07–C08**. |

Synthetic projection/encoding medians over 40 Node iterations: 30 players,
5.69 ms per-socket projection/encoding versus 0.15 ms encoded once; 60 players,
19.57 ms versus 0.30 ms. Fixture: one simple enemy, base warriors, no rich question,
equipment art or large event list. These isolate local CPU, not Cloudflare
latency. Reusing encoding alone does not reduce wire bytes.

## Maintainability and release discipline

| ID / priority | Evidence and effect | Recommended change / package |
| --- | --- | --- |
| **F13 / P2** | Mixed responsibilities concentrate in `game.ts` (1,076 lines), `engine.ts` (1,274), `session-object.ts` (735), `CreateFight.tsx` (1,160), `Lobby.tsx` (1,113), `shared/schema.ts` (992), `jobSystem.ts` (1,167). Size alone is not the defect; unrelated changes cross many concerns. | Domain APIs/services, engine responsibilities, authoring/lobby panels and contract/catalog separation. One coherent extraction per PR after regression boundaries: **C09–C11**. |
| **F14 / P2–P3** | [Shared schema](../../shared/schema.ts) retains legacy CombatState/PlayerState and random damage/solo-scaling helpers with no external callers found in repository search. Shared transport types depend on Worker DB types; some import cycles are type-only, not demonstrated runtime faults. | Verify callers before removal; independent domain contracts; retain saved-room adapters until retirement is safe: **C04, C09–C11**. |
| **F15 / P1–P2** | October 9 `npm audit` reported 32 package entries: 21 high, 9 moderate, 2 low, including transitive/dev dependencies. No exploit was attempted or established. Lockfile includes ProseMirror view 1.41.3, MathLive 0.107.1 and Drizzle ORM 0.39.1 under published advisories. | Triage browser/runtime/build exposure; compatible editor, ORM and tooling upgrades with focused verification. Some suggested fixes are breaking changes or downgrades: **C02**. |
| **F16 / P2** | CI and acceptance suites exist, but `main` reported `protected=false`; deployment and acceptance are separate manual workflows. Public resources retain staging names; live fixtures retain accounts/results/uploads after fights are archived. Some handlers swallow errors or lack useful context; body limits are inconsistent. | Intended required checks, exact-SHA release evidence, post-deploy acceptance, isolated fixtures/scoped cleanup, pinned tools and Node alignment; redacted request/room/revision/timing diagnostics and bounded parsing. **C04, C12**. |
| **F17 / P2** | Authority docs on the reviewed `main` described released equipment/quests/enemies as unshipped and the old R2 failure as current; fresh-Replit-database language could be misapplied to live students. | **COMPLETE in pre-Phase-1 documentation preparation:** current status, cleanup/expansion plans, historical labels, recovered release evidence and explicit live-data preservation. Maintain on future releases. |

Dependency sources captured for the review:
[ProseMirror paste-handling advisory](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w),
[MathLive escaping advisory](https://github.com/advisories/GHSA-fm7p-gw32-828p),
[Drizzle identifier-escaping advisory](https://github.com/advisories/GHSA-gpj5-g38j-94v9).
ProseMirror's cited fix is 1.42.3; the MathLive advisory covers versions through
0.109.2; Drizzle's cited fix is 0.45.2. Verify current advisories/compatible releases
when C02 starts. No `sql.identifier`, `sql.raw` or dynamic alias use was found in
the reviewed Worker/shared source, so F15 does not assert a confirmed SQL
injection path.

## Existing strengths to retain

Enemy registry/AI validation, shared equipment rules, server-side action
validation, seeded randomness, command receipts, guarded loadout updates,
atomic reward functions, content sanitization and reconnect tests are useful
foundations. Extend their coverage through actual HTTP/UI boundaries.

## Baseline and limits

- Inventory: 260 tracked source/test/script/SQL files, 35,622 lines. Detailed
  inspection emphasized runtime, domain rules, persistence, UI and delivery.
- Local: type check, 186 tests and production build passed. Node 24.19.0 locally
  versus Node 22 in CI; installed dependencies were reused, not a new clean install.
- All 15 migrations applied to disposable PGlite. Route reproductions used real
  handlers/SQL with a test session repository. No live student data was read or
  mutated for these reproductions; duplicate generated SQL was not applied.
- Build: 583.00 kB gzip main JS; CSS 138.31 kB / 27.16 kB gzip. The full asset
  directory was 27 MiB, which is not the amount downloaded at login.
- [Existing live acceptance 37844271331](https://github.com/Orsnoire/FightSchool/actions/runs/37844271331):
  30-answer p50 1,657 ms, p95 3,070 ms, max 3,220 ms; maximum gate 15 seconds.
  The fixture does not populate a full guild quest/history workload.
- No new live load test, production query-plan capture, browser heap profile or
  penetration test was performed. Hypotheses require measurement during cleanup;
  this review does not prove every path defect-free. Release evidence is linked
  from [current status](../CURRENT_STATUS.md).
