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

## Checkpoint

Implementation complete; browser acceptance in progress. Local verification: typecheck, 252 automated tests (including the new batch-handoff regression) and production client/Worker builds pass. Focused HTTP checks also cover report permissions, invalid filters, palette ownership/validation, saved equipment visuals through combat snapshots, and preserving pre-patch live totals.

CI test/build and avatar acceptance pass at 7aad9ea. Browser smoke tests pass; the new editor fixture incorrectly used an unsupported species enum and is corrected for the next run. A completion-state handoff regression and partial-ID filter feedback are also fixed.

Next: run the updated GitHub browser acceptance workflow, inspect screenshots, resolve any failures, then update this checkpoint and PR with the verified head. Local Chromium launch is blocked by this workspace's socket restrictions, so browser verification uses the existing isolated CI job. No merge or deployment has been performed.
