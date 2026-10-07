# Student combat overlays and resources

Implemented from the September 30 classroom feedback, following `docs/Source_of_Truth.md` and the Combat Flow Refactor presentation intent.

The student battlefield stays mounted behind a lightly dimmed, centered dialog. Question introduction, answering, combat choices, waiting, answer resolution, enemy counterattack, and results use that same dialog. Its header keeps the server timer and current HP, MP, combo points, and applicable potion counts visible. The body scrolls on small screens. Escape and outside clicks cannot dismiss a timed phase or advance combat. Focus returns to the heading when the view changes. MathLive's virtual keyboard is contained in the dialog and restored on unmount.

Question choices now have an atomic **Confirm action & Ready** command. This avoids highlighting a spell and then accidentally confirming the default attack. Support actions can still be added individually before Ready. Buttons show costs and explain unavailable actions. Enemy counterattack feedback is separated from question resolution using an optional phase field on events, with a fallback for existing snapshots.

## Resource findings

The existing engine correctly deducts Fireball/Frost Bolt MP, consumes all remaining MP for Fireblast, consumes healing/shield potions, and caps crafting. Deductions happen at resolution, not selection. Under the current rules, incorrect answers do not execute or charge question actions, including crafting. This behavior is preserved.

The previous UI omitted potion inventory and action costs. Selection also checked each action in isolation: Fireblast and Frost Bolt could compete for the same MP, or a question heal and Potion Diffuser could compete for the last potion. Support resolves first, so the later question action could fail. The shared selection validator now reserves the combined resource budget, excluding question actions known to have failed. Replacing a question choice does not spend or reserve resources twice. Potion Diffuser also rejects an empty inventory.

These findings reproduce code paths; they do not establish which exact condition occurred in the classroom trial. No student records or live room data were changed.

## Validation

Automated coverage includes resource deductions, crafting bonuses/caps, wrong answers, competing choices, JSON recovery, atomic confirmation/retry, and the rendered React question-to-resolution flow with one dialog, focus changes, Escape handling, rich content, resource display updates, and math input/keyboard containment. The DOM test stubs MathLive registration; it does not validate the real virtual keyboard's rendering.

`tests/browser/combat-ui.mjs` runs the real client in Chromium at 1366×768 and 390×844. It checks centered, contained dialogs through questions, action confirmation, waiting, support, answer resolution, and enemy counterattacks; rich questions, internal scrolling, and real MathLive keyboard input and cleanup are included. The Combat UI Acceptance workflow preserves screenshots for visual review. WebSocket snapshots are isolated fixtures. This is viewport coverage, not a physical Chromebook or phone certification. Local browser preview was blocked in the editing environment, so browser acceptance runs in GitHub Actions.

After deployment, Live Combat Staging Acceptance exercises the public origin with isolated accounts and rooms. It verifies atomic action/ready, exactly 1 MP spent per successful Fireball, no MP spent for an incorrect answer, reconnect deadlines, phase transitions, rewards/history, storage, and 30-player concurrency. Fixture fights are archived; real classroom records are not modified. Successful check links and deployment evidence are recorded in PR #25.

## October 7 host controls and student departure

The host title, connection status, joined-player count, join code, phase, timer,
and Start/Advance/End controls share a compact panel. Its control strip stays
visible while scrolling; the full-width current question sits directly beneath
it and remains visible through the round. Answered/ready counts include living
participants, while attendance includes knocked-out players. The host's socket
connection is distinct from the joined-player count. A disconnected browser does
not remove a participant.

A bounded combat log temporarily occupies the space next to the enemy cards;
the player grid remains full width. It retains the most recent 200 feedback
entries received during this page visit, including across round changes. It
follows new entries until the host scrolls back, then offers Jump to latest.
Small screens stack the log below the enemies.

Every student phase dialog exposes Leave fight with confirmation. The client
waits for a server acknowledgement before clearing the room code and returning
to the lobby. A reconnect during departure resends the departure, not a join.
The server removes only the authenticated student, clears actions/guards aimed
at them, recomputes threat, and advances when the remaining living players are
done. Leaving closes that student's other sockets for the room too. An empty
waiting lobby remains open; an empty active fight ends. Interrupted connections
retain participation and normal recovery.

An unfinished departure grants no result, consistent with the existing stamina
policy. The existing entry restriction still applies: a student who leaves can
rejoin while waiting, but cannot re-enter a running fight as a fresh participant.
Exiting a completed fight preserves its roster and pending/persisted rewards.
No database migration, enemy rescaling, or student data reset is involved.

Local validation for this change passes all 92 automated tests, TypeScript, and
both production builds. Coverage includes the rendered host panel/counts,
student confirmation/cancellation and acknowledged navigation, role checks,
replayed departures, remaining-player phase advancement, and completed rewards.
Real-browser desktop/mobile checks are prepared in the Combat UI Acceptance
workflow; visual acceptance and deployment are still pending.
