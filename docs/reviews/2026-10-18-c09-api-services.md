# C09 — API and services

Baseline: `3ab41fa3de83d0d134a49d30de81c40f391f3241`, after accepted C08.
Implementation: [draft PR #72](https://github.com/Orsnoire/FightSchool/pull/72),
`cleanup/c09-api-services`. Local verification passes; exact-head CI is pending.
**Not merged or deployed.** The live C08 runtime remains `d055b29`.

## Changes and boundaries

The former 1,018-line `worker/routes/game.ts` combined request matching,
authorization, input validation, data access, progression and response projection.
It is now a 29-line authenticated dispatcher. Domain routes return `null` when
unmatched; the dispatcher preserves their precedence, namespace matching and
original 401/404/error behavior. This is a responsibility split, not a claim of
faster execution or lower query cost.

| Responsibility | Owner after extraction |
| --- | --- |
| Session authentication and dispatch | `worker/routes/game.ts` |
| Request-scoped student, teacher and guild authorization | `worker/services/access.ts` |
| Guild membership/settings/assignments | `worker/routes/guilds.ts`; multi-step operations in `worker/services/guilds.ts` |
| Quest CRUD/reconciliation | `worker/routes/quests.ts`, `worker/services/quests.ts`; existing progression engine unchanged |
| Equipment CRUD/catalog/loadout/purchases | `worker/routes/equipment.ts`, `worker/services/equipment.ts` |
| Earned reward claims | `worker/routes/rewards.ts`, `worker/services/rewards.ts` |
| Student progression reads | `worker/routes/student-progression.ts` |
| History, summaries, session reports and rankings | `worker/routes/reporting.ts`, `worker/reporting/leaderboard.ts`, existing reporting repositories |
| Bounded JSON and response/error mapping | Existing `worker/http/json.ts`; `worker/http/game-response.ts` |
| Public student/fight DTOs | `worker/projections/student.ts`, `worker/projections/fight.ts` |
| Domain inputs | `shared/contracts/guilds.ts`, `equipment.ts`, `rewards.ts`; existing `shared/quests.ts` |
| Database construction | `worker/db/database.ts`, independent of combat persistence |

Routes authorize before calling internal services. Services receive the
authenticated student or authorized guild; they are not separate public entry
points. Single-query CRUD stays with its domain route. Equipment ownership,
class/level/slot checks and optimistic loadout revisions stay in the equipment
service. Guild/quest services retain the original event-scoped evaluation calls.
The SQL leaderboard retains weighted accuracy, existing metric rules and limits.

The built-in equipment catalog moved verbatim from `shared/schema.ts` to
`shared/equipment-items.ts`, with the same object re-exported for compatibility.
This removes the `equipment-id -> schema -> fights -> equipment-id` runtime
cycle exposed by independent domain imports. A fresh-process regression imports
each contract first, validates every built-in ID and a custom UUID, rejects an
unknown ID, and checks compatibility-export identity. No item definitions changed.

## Preserved behavior

- Existing URLs, request methods (including legacy method-agnostic reads), status
  codes and response fields; guard order and unsupported-route behavior.
- Explicit tenant/owner/member checks and student self-only access. Public DTOs
  exclude credentials, remembered loadouts and revision fields; fight banks stay
  private. No-store responses and bounded/sanitized errors are unchanged.
- Gold/inventory purchase is still one guarded SQL update. Reward claim lookup,
  one-choice receipts and atomic SQL award procedures are unchanged, including
  idempotent retries after a lost acknowledgement. Combat persistence retains
  compatibility exports for `claimReward`, `RewardError` and `gameDatabase`.
- C06 bounded history, SQL aggregates, read-only views and affected-quest
  evaluation; cross-room rewards and academic evidence are retained.
- All database migrations, student records, gameplay, saved-room formats,
  progression/reward procedures and UI behavior are unchanged. No production
  data operation or deployment was performed.

## Verification

| Gate | Result |
| --- | --- |
| Unchanged baseline `npm test` | 283 passing tests |
| New HTTP boundary fixture on baseline | Five passing tests against disposable, fully migrated PGlite |
| Focused domain/ownership/data-cost/reward suite after extraction | 39 passing tests |
| Final local `npm test` | 289 pass: phase 2 = 5, phase 3 = 7, phase 4 = 270, rich content = 7 |
| `npm run check` | Pass |
| `npm run build:cloudflare` | Client and Worker pass; existing large lazy-editor chunk warning remains |
| `git diff --check` | Pass |
| SQL preservation inspection | All 17 `sql` tagged templates from the original game route/repository match the extracted modules, ignoring whitespace |
| GitHub CI and Chromium | Pending on the published service checkpoint |

The HTTP fixture exercises signed sessions for two teachers, a member and an
outsider; namespace/auth dispatch; every nested guild read; owner/member/role
denials; public DTOs; malformed/oversized bodies; and sanitized database failures.
Injected reward failure before commit leaves gold at 1,000. Lost acknowledgement
after commit returns 503 with gold at 1,077; retry returns 200 and retains 1,077.
An alternate loot choice remains rejected without adding inventory.

Existing populated-guild regressions cover 2,051 seeded quests, scoped evaluation,
read-only views, bounded keyset history, cross-guild evidence, simultaneous rooms
and exactly-once awards. Existing shop tests cover concurrent/duplicate purchases,
insufficient gold, tier availability and teacher isolation. These run in the full
suite; C09 makes no new live latency or query-cost claim.

The first full run after import sorting exposed four module-initialization failures
from the cycle above. They were fixed by the catalog extraction, then the complete
suite and both builds were rerun successfully. No failed run is counted as a pass.

Reproduce local gates from a clean checkout:

```sh
npm ci
npm run check
npm test
npm run build:cloudflare
```

## Resume and remaining scope

Inspect the live PR head and `docs/ACTIVE_WORK.md` before continuing. The next
action is to inspect exact-head CI, Combat UI Acceptance (all three jobs) and
Avatar Workshop, then record their run links and final verification state.
Keep the PR draft. C10 combat extraction and C11 client extraction are unstarted;
existing C08 physical-device/performance limitations and C12 release/recovery
drills remain open. Merge and deployment require the owner's next instruction.
