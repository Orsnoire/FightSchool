# Host sessions and team-race feasibility — October 8, 2026

> **MIXED STATUS — reconciled October 9, 2026.** Explicit host-session controls
> are RELEASED (PR #49, included in `e158194`). Team race and party-scaled swarm
> counts are FUTURE. See [current status](../CURRENT_STATUS.md),
> the [cleanup plan](../CLEANUP_PLAN.md) and [expansion plan](../EXPANSION_PLAN.md).

## Approved session controls

The latest owner direction replaces the earlier automatic-restart proposal.
The dashboard checks the signed-in teacher's unfinished hosted rooms. A fight
with an open waiting or active room shows **Join fight in progress** and
**End existing session**. With no open room it shows **Launch Host**.
Legacy duplicate rooms can all be explicitly ended; the selected room IDs are
captured before the operation, so a newly launched room cannot be ended by a
stale dashboard request. Solo rooms and other teachers' rooms are excluded.

Joining opens a session-specific host URL. Refresh and reconnect only read that
room; a bare host URL looks for an existing room and otherwise offers an explicit
launch button. Multiple assigned guilds still require a hosting-guild selection.
Launch POSTs are serialized by a per-fight Durable Object coordinator and reuse
an existing room, preventing duplicate launches across tabs and request retries.
This uses the existing namespace without a schema migration.

End requests authenticate the teacher at the Worker boundary and recheck room
ownership in the room object. They use normal host-ended result persistence:
earned activity XP, proportional base XP, and no victory-only gold or loot.
Completed victories are preserved. An unopened waiting room can be closed without
creating combat state or rewards. Result failures remain ended in durable state,
retry by alarm, and return a retryable error to the dashboard. Connected players
receive the standard ended-fight state/results. Launch never ends a room silently.

## Team race: feasible, not implemented in this release

PR #47 supplies hosting-guild context and encounter caps. The individual-enemy,
wave and bounded loadout-performance work originally reviewed in PR #48 was
integrated and released through PR #52. Those foundations do not implement team
race; the additions below remain future work after cleanup.

| Requirement | Existing foundation | Needed addition |
| --- | --- | --- |
| One public join code | Session lookup and authenticated WebSockets | Persistent race record/coordinator mapping one code to two private combat rooms |
| Balanced teams | Frozen entry profiles; released `performance()` estimate | Server-owned membership and loadout snapshots; size-first balancing, then damage/healing/mitigation and tank/healer coverage |
| Comparable questions | Each room currently shuffles using its room ID | Shared immutable question snapshot and shared shuffle seed; answer options should also use the race seed |
| Split teacher battlefield | `HostFight` and `CombatBoard`; one hook per room | Extract host pane from page-level launch logic; two subscriptions and a shared control strip |
| Start/pause/end together | Per-room serialized commands and alarms | Persisted shared command receipts, scheduled start and durable fan-out retries; a real pause/resume state with retained remaining time |
| Independent race progression | Each room owns its snapshot, timer and rewards | Independent advancement; race summary based on server state, deterministic first-clear/tie rule and accuracy reporting |
| Rejoin/late arrivals | Per-room pending entrants and moderation | Stable assignment ledger; late entry at next round boundary; moderation must not allow changing teams |
| Swarm pressure | Released fixed quantities and attendance budgets | Optional party-scaled counts with pressure setting, locked per wave; avoid applying attendance scaling twice |

Use a hosting-session option rather than changing the reusable fight template.
Suggest it for guilds over 30; do not interrupt ordinary launching with a modal.
Teachers can move students before start. Lock assignments at the shared countdown.
The balancing estimate is a heuristic: gear and class potential do not predict
student accuracy, response speed or coordination. A final lobby rebalance is
necessary because greedy arrival-order assignment can otherwise be uneven.

A single DO cannot simply host both existing battles: the current implementation
stores one `room` key, one alarm, one roster and broadcasts to its room sockets.
Keep independent child rooms and add a coordinator. Race persistence must retain
both child IDs and assignment receipts across refresh, hibernation and retries.
Completing one side must not stop the other or award either side twice. End must
fan out durably to both rooms using existing host-ended reward rules.

Recommended implementation order: persistent race/join assignment and recovery;
shared seeded content and synchronized controls; split host UI and scoreboard;
then load/balance acceptance with 30–60 students, late joins, moderated rejoin,
one child failing a control request, and teacher refresh during start/end.

## Validation and release status

At the original implementation checkpoint, the host-session change passed all 142 local tests, TypeScript checking, the
production client/Worker build, and diff checks. Coverage includes real Worker
routes and SQL for concurrent launches, teacher/solo isolation, exact-room
reconnect, stale end requests, and idempotent reward persistence with retry.
Browser checks for dashboard Join/End/Launch and refresh are defined at desktop
and phone sizes. Canonical live acceptance now verifies host-session discovery,
explicit end, concurrent launch and stale-end isolation; see the released
[October 8 evidence](../cloudflare/full-migration.md#gear-release-recovered-and-verified--8-october-2026).

PR #47 is already merged at `e3e1737a371e1d5d26d65b77e46f7f48684200f3`;
CI run `37801060648` and deployment run `37801260340` succeeded. This supersedes
the older blocked-release note in Source_of_Truth for that release.
Host-session controls were merged in PR #49 and deployed. The later `e158194`
release includes them and passed canonical live acceptance; see
[current status](../CURRENT_STATUS.md). Team race remains unimplemented.
