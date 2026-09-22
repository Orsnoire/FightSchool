# Phase 4: first live-combat slice

This slice moves one complete text-only classroom path to the Cloudflare runtime:

1. A signed-in teacher opens a saved fight and creates a six-character room through POST /api/fights/:fightId/sessions.
2. A student signs in (or is created on first login), selects a base class, checks the room code, and opens /ws?sessionId=....
3. The Worker verifies the signed opaque cookie before selecting the Durable Object. Actor IDs and roles in WebSocket messages are ignored.
4. One SQLite-backed Durable Object owns the room snapshot, hibernated sockets, command IDs, and question alarm.
5. Host, join, start, answer, reconnect, broadcast, deadline advance, and teacher end are supported.

## Compatibility and scope

| Subsystem | Current Cloudflare implementation | Risk | Validation |
|---|---|---|---|
| Student identity | PBKDF2-peppered password plus revocable Neon session | Medium | auth and actor-scope contract tests; staging login |
| Room discovery | additive Neon live_combat_sessions table | Low | migration and two-room staging checks |
| Live coordination | one Durable Object per room code | Medium | host/student browser test and isolation test |
| State recovery | Durable Object SQLite checkpoint after every mutation | Medium | reconnect and forced Worker restart |
| Timers | Durable Object alarm per question | Medium | deadline test after hibernation |
| Commands | per-actor commandId idempotency keys | Low | duplicate-answer test |
| Advanced combat | intentionally deferred | High | later Phase 5 vertical slices |
| Object storage | not used by the text-only acceptance fight | Low | use built-in/text-only assets |

The deterministic engine is separate from transport and presentation. This PR does not port abilities, blocking, healing, enemy AI, rewards, equipment, guilds, or custom uploads.

## Staging acceptance

1. Run Migrate Neon Staging, then Deploy Cloudflare Staging.
2. Create/sign in as a teacher and save a fight with two short text questions.
3. In a second browser profile, create a student with an eight-character-or-longer password and select a class.
4. Host the fight, join with the displayed code, and start.
5. Submit an answer twice with the same command ID (protocol test) and confirm it is applied once.
6. Refresh both browsers and confirm the same room state returns.
7. Open a second fight room and confirm broadcasts never cross rooms.
8. Let a question expire and confirm its alarm advances the room.
9. End the fight and confirm further joins return 404.

## Rollback

Keep production and DNS unchanged. Redeploy the prior Worker version if staging fails. Migration 0002 is additive and may remain during rollback; the preceding Worker does not read either table. Do not delete the Durable Object namespace.
