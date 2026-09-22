# Phase 4: Authenticated live-combat milestone

This increment ports the Phase 0 synchronized-answer milestone to the staging Worker.

## Included

- Student login with auto-registration, password hashing, signed revocable sessions, and self-scoped character selection.
- Authenticated WebSocket upgrades. Teacher and student identity are derived from the session cookie, never from a message body.
- One SQLite-backed Durable Object per six-character combat session.
- Durable waiting/question state, hibernation-safe socket attachments, host reconnect, student reconnect, start, join, answer, end, and ping commands.
- Atomic first-answer semantics and optional command-ID deduplication.
- Same-session-only state broadcasts and a minimal authenticated session lookup endpoint.
- Existing Neon fight definitions remain the source for questions and enemies.

## Deliberately deferred

The legacy abilities, resolution, enemy AI, rewards, equipment, guild progression, solo mode, and combat-stat persistence remain on the legacy host. The staging milestone stops at the first synchronized answer and enters the abilities phase. It must not be used for a production class until those phases are ported and accepted.

Object storage is still deferred. Acceptance uses text-only questions and repository-owned images.

## Staging sequence

1. Run **Migrate Neon Staging** to add the isolated students table.
2. Run **Deploy Cloudflare Staging**.
3. Create or sign in to a teacher account and create a text-only one-question fight.
4. Open the host view and record the generated session code.
5. In a separate browser profile, sign in as a student, choose a character, enter the session code, and join.
6. Start the fight and submit one answer.
7. Confirm both browsers show the same player with `hasAnswered: true`.
8. Refresh both browsers and confirm each reconnects only as its authenticated actor.
9. Confirm a second student cannot impersonate the first by changing local storage or a WebSocket message.

No new secret or binding is required. The existing `DATABASE_URL`, `PASSWORD_PEPPER`, `SESSION_SECRET`, session variables, and `COMBAT_SESSIONS` binding are reused.

## Rollback

Keep production and its DNS unchanged. If staging fails, redeploy the Worker version before this increment. The students migration is additive and can remain while the Worker is rolled back. Durable Object state is staging-only and may be abandoned by reverting the Worker; do not delete the namespace during the rollback window.
