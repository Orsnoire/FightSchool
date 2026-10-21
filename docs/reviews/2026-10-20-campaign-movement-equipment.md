# Campaign playtest follow-up — movement and equipment

**Verified and deployed to the isolated owner playtest, October 20, 2026.**
Runtime source: `df6c850931f08a58499b27c34522cffc57b84f23`, [PR #81](https://github.com/Orsnoire/FightSchool/pull/81).
No classroom release or merge is included.

## Changes

The prototype waited for a complete server request before drawing each step and
built the combat profile twice per movement action. Movement now predicts legal
tiles immediately, permits up to eight unconfirmed steps and sends queued inputs
as bounded paths. Each step is still validated server-side; travel stops at the
first encounter. Polling cannot overwrite pending movement. Conflicts and network
errors discard queued inputs and reload authoritative progress. The response
reuses the prepared combat profile when the job and loadout revision still match.

An Equipment panel in the adventure exposes only owned, currently usable gear,
including permanent starters. Eligibility follows the campaign job, effective
level, slot and weapon/off-hand pairing. Server validation and atomic persistence
protect the same rules. Changes save to that job's loadout, leave the classroom
job selection unchanged, freeze during combat and never refill HP/MP. Tier 1 gear
still requires job level 2. Forward-only migration 0019 extends the existing
campaign action routine; the already-applied 0018 migration was not modified.

## Evidence

- [CI 39464751242](https://github.com/Orsnoire/FightSchool/actions/runs/39464751242)
  passes all **332 tests**, TypeScript and both builds. Local checks also pass.
- [Browser acceptance 39464751340](https://github.com/Orsnoire/FightSchool/actions/runs/39464751340)
  passes all four jobs. Campaign cases at 1366×900 and 390×844 verify that the
  marker moves while a response is deliberately delayed 700 ms, subsequent
  movement queues, and the equipment menu filters and saves choices. Equipment
  screenshots from both sizes were inspected. These are API-fixture browser tests.
- Controller tests cover immediate prediction, bounded buffering, batching,
  stale polling, revision conflicts and encounter interruption. Migrated HTTP
  tests cover per-step/path validation, duplicate commands, equipment ownership,
  job/level/hand restrictions, reload persistence, separate job loadouts, combat
  lockout and preservation of spent HP/MP.
- Authenticated live checks on a separate QA character pass: four steps commit in
  one request/revision; replay does not duplicate steps; stale revisions fail;
  current-job filtering matches server rejection; equipment changes appear in the
  combat loadout, survive reload and preserve resources. The owner's character
  was not used by these checks.
- An initial live test driver assumed the wrong town spawn-to-inn route. The
  server correctly rejected the remote job change. The driver was corrected to
  use the generated inn coordinates; the rerun passes without a gameplay change.
- Migration 0019 was applied only to the existing isolated playtest. The new
  runtime is serving that preview and its existing bindings were retained.

## Limits and next review

This improves immediate feedback and reduces requests for queued walking; it is
not client-authoritative combat or offline progression. Live requests still show
network/backend variability: the checked four-step commit took 323 ms, while
another movement request took about 3.1 seconds. These are individual functional
samples, not a latency benchmark. The eight-step buffer can fill during a slow
connection. Physical-device feel remains an owner playtest question.

The visual interface remains a placeholder. The owner's 16-bit FF/DQ references
and proposed overworld/town/menu review are recorded in
[campaign art direction](../CAMPAIGN_ART_DIRECTION.md). No supplied reference
assets were installed in the game. The earlier guardian balance and initial
combat feedback-delay observations remain open in the original playtest report.
