# Phase 0: Milestone 1 Characterization

Status: complete for repository-level characterization

Baseline: `main` at `2d3d07053f6be854f99cb81ac8bfce3fce56969f`

## Scope and exit gate

This phase characterizes the smallest classroom gameplay slice that must survive the Cloudflare transport rewrite. It does not add Worker, Durable Object, authentication, routing, or storage implementation. The exit gate is met when the flow and state transitions are explicit, sanitized fixtures describe the contract, and focused tests detect accidental drift in the legacy implementation.

The selected synchronized action is a student answer submission. It is the smallest existing action that mutates authoritative combat state and is broadcast to both teacher and student clients. A lobby-only join or ping does not satisfy the milestone.

## Selected vertical slice

1. A teacher authenticates with `POST /api/teacher/login`. Express stores `teacherId` and `teacherEmail` in the server-side session.
2. The teacher selects a fight and opens the host view. `HostFight.tsx` connects to `/ws` and sends `{"type":"host","fightId":"..."}`.
3. The server creates a six-character combat session and sends `session_created` with the `sessionId` and initial `combat_state`.
4. A student authenticates with `POST /api/student/login`. The current client stores the returned student ID in local storage; the server does not create a student session.
5. The student enters the session code. `GET /api/sessions/:sessionId` validates that the combat session and fight exist.
6. `Combat.tsx` connects to `/ws` and sends `{"type":"join","studentId":"...","sessionId":"..."}`.
7. The teacher sends `start_fight`. The server enters the question phase and broadcasts `phase_change`, `question`, and `combat_state`.
8. The student sends `{"type":"answer","answer":"4"}`. The server derives the acting student and session from WebSocket connection fields, writes `currentAnswer` and `hasAnswered`, and broadcasts the updated `combat_state` to every connection in that session.
9. When every living player has answered, the server advances to the abilities/resolution path. Later phase handlers persist combat state and results through the existing Neon-backed storage layer.
10. On reconnect, both clients resend their prior identifiers. The server closes duplicate connections and restores the persisted combat session when it still exists.

## Observed HTTP contract

| Step | Legacy request | Success contract | Migration implication |
|---|---|---|---|
| Teacher login | `POST /api/teacher/login` with email and password | Teacher without password plus `sessionActive: true`; Express session cookie | Move to `/QuestAcademy/api/teacher/login`; retain server-verifiable identity and revocation. |
| Student login | `POST /api/student/login` with nickname and password | Student without password; missing nickname is auto-created | Move to `/QuestAcademy/api/student/login`; issue a server-verifiable student session rather than trusting local storage. |
| Session lookup | `GET /api/sessions/:sessionId` | `sessionId`, `fightId`, title, and `isActive` | Keep the response minimal; authorization and enumeration controls must be decided in the authentication increment. |
| Fight read | `GET /api/fights/:id` | Fight configuration | The Worker slice needs only the reads required by the host flow. |

All target routes remain beneath `/QuestAcademy/api`. The legacy root-level paths above are evidence, not the target routing contract.

## Observed WebSocket contract

| Direction | Message | Required effect for Milestone 1 |
|---|---|---|
| Teacher to server | `host { fightId, sessionId? }` | Create or rejoin a session and bind the connection as host. |
| Server to teacher | `session_created { sessionId, state }` | Display the join code and initial state. |
| Student to server | `join { studentId, sessionId }` | Add the authenticated student and bind the connection to the session. |
| Teacher to server | `start_fight` | Enter question phase once. |
| Server to session | `phase_change`, `question`, `combat_state` | Both clients receive the current authoritative phase and state. |
| Student to server | `answer { answer }` | Apply the answer once to the authenticated student's player state. |
| Server to session | `combat_state { state }` | Teacher and student display the same state, including `hasAnswered`. |
| Server to client | `error { message }` | Fail invalid join/start requests without falling back to static HTML. |

The target endpoint is `/QuestAcademy/ws`. The entry Worker must authenticate the upgrade, derive role and identity from the authenticated session, authorize access to the requested combat session, and pass trusted identity metadata to the Durable Object. The Durable Object must not accept `studentId`, teacher identity, or authorization solely from message payloads.

## State transition contract

For the selected action, the precondition is an existing player in a session whose `currentPhase` is `question` and whose player is alive. The command changes only the connected player's answer fields:

- `currentAnswer` becomes the submitted answer.
- `hasAnswered` becomes `true`.
- Optional healing selection fields may be updated when present.
- The resulting combat state is broadcast only to connections for the same `sessionId`.
- A command outside the question phase or from a missing/dead player is ignored.
- When all living players have answered, the server advances the phase early.

The Cloudflare implementation must add command IDs or an equivalent idempotency rule so reconnect/retry cannot apply the selected action twice. The legacy implementation has a client-side double-submit guard but no server-enforced command idempotency.

## Migration-blocking security findings

| Finding | Evidence | Required disposition before Milestone 1 |
|---|---|---|
| Student identity is client supplied | Login stores `studentId` in local storage; `join` trusts `message.studentId`. | Issue a server-verifiable student session and derive identity during the WebSocket upgrade. Add impersonation-negative tests. |
| Teacher host authority is unauthenticated on WebSocket | Any connection can send `host` with a readable `fightId`; no Express session is checked during upgrade or message handling. | Authenticate the upgrade and authorize fight ownership before creating, rejoining, starting, or ending a session. |
| Cross-session access relies on supplied session code | `join` accepts `message.sessionId` and checks only that the session exists. | Authorize membership/resource access and keep Durable Object keys opaque to unauthorized callers. |
| Answer idempotency is client-only | `Combat.tsx` uses `hasSubmitted`; the server accepts another answer while the phase remains `question`. | Add a command ID or atomic first-answer rule in the Durable Object. |
| Sensitive answer content is logged | The server logs the student ID and submitted answer. | Remove answer-body logging from the target runtime and use minimal structured events. |
| Production startup mutates data | `server/index.ts` seeds default and test data at every startup. | Do not port startup seeding; use explicit administrative fixtures for staging. |
| Production secret has a fallback | Express uses `dev-secret-change-in-production` when `SESSION_SECRET` is absent. | Fail closed when production session key material is missing. |
| Cookie scope is implicit | The Express cookie omits `Path`; logout clears the default cookie without migration-path attributes. | Set cookie `Path=/QuestAcademy` and explicit production attributes in the Worker session service. |

These findings are recorded rather than patched into the legacy Express transport. Fixing them in Express would not create the Worker authentication boundary and would increase throwaway work. They are hard entry requirements for the authentication and Durable Object increments.

## Object storage decision

R2 is not required for the selected Milestone 1 action. The repository's `Question` schema contains text, type, options, correct answer, and time limit; it has no question-image field. The controlled test fight can use a text-only question and a repository-owned static enemy image. Therefore Phase 0 defers object migration and data movement.

The R2 adapter boundary remains required before any later slice introduces teacher-uploaded or database-referenced objects. No conclusion is made here about whether existing GCS objects are production data.

## Sanitized fixture

`tests/phase0/fixtures/milestone-one-answer-flow.json` records the selected action, legacy HTTP and WebSocket messages, expected state mutation, target route scope, target identity rules, and the storage decision. IDs and credentials are synthetic. The fixture intentionally contains no real account, session, database, bucket, or Cloudflare identifiers.

## Automated characterization

Run:

```sh
npm run test:phase0
```

The test suite uses only Node's built-in test runner. It verifies:

- The fixture describes a real answer-driven state transition rather than a lobby-only demo.
- The legacy server and clients still contain the observed endpoint and message contracts.
- The selected action updates player state and broadcasts `combat_state`.
- The target contract requires server-verifiable teacher and student identity, session isolation, and idempotency.
- Object storage is explicitly deferred for a text-only milestone fixture.

These are characterization tests, not end-to-end proof. Database-backed behavior, two-browser synchronization, reconnect, and negative authorization tests remain acceptance evidence for later increments after the Worker boundary exists.

## Phase 0 conclusion

The repository provides enough evidence to proceed without undocumented manual knowledge. The next increment can build the unified Worker shell while preserving this contract. Authentication and Durable Object work must not claim Milestone 1 completion until the identity, isolation, and idempotency blockers above are implemented and tested.
