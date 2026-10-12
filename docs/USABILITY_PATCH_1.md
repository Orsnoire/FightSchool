# Usability Patch 1

Branch: `feat/usability-patch-1`. Review: [PR #64](https://github.com/Orsnoire/FightSchool/pull/64).

## Scope and behavior

- Teacher statistics expose saved session/participant totals and immutable question attempts. Search and combined guild, session, quiz, question, job, player ID and date filters support paged session, player and question views. All queries are scoped to the authenticated teacher. Older and partially recorded sessions retain totals and explicitly show missing question detail.
- Questions have Edit, Save changes and Cancel controls; editing keeps question identity/order. Fight saves require finishing the current question edit.
- A shared presentation contract describes ability effects, action groups, impact HP and event batches. SVG/CSS/Web Animations provide sword, fire, ice, curse, herbalist, arrow, claw, bard, web and bite placeholders, plus heal/block feedback. Avatars shake when attacking and flash red with a shake when damaged. Flying numbers and HP changes follow each hit; attacker starts are 150 ms apart.
- **Only player and enemy resolution phases replace normal timers.** Question and action/ability selection clocks remain. Clients automatically report completed batches; the server advances when connected participant/host renderers have finished. Stale reports cannot advance later batches. Disconnection, reduced motion, hidden tabs, empty batches and teacher overrides release or cancel playback. A bounded recovery watchdog handles crashed/obsolete renderers; it does not pace normal combat.
- Enemy palettes and equipment base-sprite palettes are optional, validated and saved independently of combat statistics. Editors preview colors and equipment can be copied as a new variant. Alpha, dark outlines, highlights and avatar skin are preserved. External enemy images require CORS permission to recolor; uploaded/same-origin sprites work directly.

## Data and rollout

Additive migrations `0015_usability_patch_1` and `0016_equipment_color_variants` add reporting projections/attempts and optional equipment visuals. Existing migrations are unchanged. Attempt writes are idempotent with a Durable Object outbox and retry alarm. Award calculations and receipts stay authoritative and independent of presentation. Live fights retain their frozen authored questions; subsequent sessions use teacher edits.

Deploy the additive migrations before the Worker/client. Old in-flight resolution phases retain their deadline until the next batch. Older records cannot acquire question-by-question history retroactively. Rollback may revert the Worker/client while retaining additive tables/columns.

## Verification and review checkpoint

Implementation is complete and ready for review. At commit `e8fdadc9274ebe14cb86d9f1b7e9a03dca9dd5c9`, CI typecheck, all **253 automated tests**, production client/Worker builds, Avatar Workshop Acceptance and Combat UI Acceptance pass. Browser coverage includes desktop/phone selection clocks, question Edit/save/cancel/reload, palette previews and saved variants, composed statistics filters, every placeholder effect, actual animation completion (including a deliberately paused animation), reduced motion, and 30/60-player playback. Screenshots are attached to [browser run 38306652737](https://github.com/Orsnoire/FightSchool/actions/runs/38306652737).

Focused tests cover signed-HTTP ownership/validation, visual persistence through combat snapshots, old/partial reporting coverage, immutable evidence, accurate filtered question summaries, retry/restart behavior, stale completion reports and compact classroom timeout checkpoints. The final follow-up aligns the three claw strokes to 45 degrees, makes the red hit flash immediate, improves screenshot framing and removes stray whitespace. Current-head check results and the exact pushed SHA are recorded in PR #64.

Next: review and approve PR #64, then separately authorize merging and deploying the additive migrations and application. Neither merge nor deployment has occurred. Automatic approval review blocked updating the main discovery pointer directly; this PR contains the proposed checkpoint update instead.
