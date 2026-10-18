# C09 — API and services

Baseline: `3ab41fa3de83d0d134a49d30de81c40f391f3241`, after accepted C08.
C09 covers the API/service portion of F13–F14. The combat engine and authoring/lobby
UI remain C10/C11 responsibilities. No schema migration or live data reset is planned.

## Extraction plan

`worker/routes/game.ts` currently combines 1,018 lines of request matching,
authentication/authorization, validation, guild membership/settings, quests,
equipment administration/loadouts/purchases, reward claims and reporting.

1. Establish route/authorization/error regression boundaries and the existing test baseline.
2. Introduce narrow HTTP context/error helpers and domain input contracts; preserve dispatch precedence and unmatched-route behavior.
3. Extract guild, quest, equipment, reward and reporting handlers with service functions for domain operations; keep atomic SQL functions and event-scoped progression intact.
4. Verify tenant/member checks and faults/retries through the HTTP boundary, then publish exact local/CI evidence and a resume checkpoint.

## Preservation gates

- Existing API paths, methods, status codes and response fields remain compatible.
- Authorization stays explicit at every affected domain boundary; public DTOs exclude credentials and internal loadouts.
- Reward receipts, purchase SQL and quest completion remain atomic and replay-safe.
- C06 bounded histories, aggregates, read-only views and event-scoped evaluation remain intact.
- All migrations and live student data remain unchanged. No deployment is part of this implementation request.

## Evidence

Pending baseline and implementation. Do not interpret this claim as verification.
