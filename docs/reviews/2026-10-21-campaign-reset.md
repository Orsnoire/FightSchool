# Campaign lobby reset — October 21, 2026

The owner reports the consumables preview is working and requests an explicit
**Reset campaign** button in the campaign lobby. Runtime source:
`248167a712be1d7fd0d38cd24962b2e2a7fe154a`, PR #81. This has the same application
code as the initial reset source `905c56260141fb03b0a84cf7cec9b66fed5e83d4`;
the follow-up corrects screenshot timing only.

## Behavior

The student lobby places Reset campaign beside Enter adventure. An accessible
confirmation names the campaign and explains the irreversible personal restart.
Cancel sends no mutation and returns focus to the trigger. The dialog remains
open on a failed reset, blocks duplicate submission, and retains the same command
identity for retries. A fresh saved-state read supplies the expected revision.
Success refreshes the cached adventure and displays a confirmation in the lobby.

Reset returns the student to the saved town spawn and clears explored locations,
collected campaign keys, dungeon completion, step count and active item protections.
HP/MP refill to the current campaign job/equipment maximum; healing charges return
to five and shield charges to their initial zero. The current campaign job and
purchased consumable quantities are retained. Permanent levels, XP, gold,
equipment/loadouts, results, academic evidence and reward history are retained.
The map, teacher gates, other campaigns and other students are unchanged.

This is a student-owned action. Teachers cannot use it to reset a class. Active
encounters must be finished or left first. The existing atomic action routine
checks membership, campaign/loadout/progress revisions and active encounter
status under its existing locks. No migration or change to reward rules is needed.
No client-supplied HP, target student or replacement state is accepted.

## Verification

Local TypeScript and production client/Worker builds pass. The expanded migrated
campaign integration test passes, covering:

- Concurrent duplicate resets commit once; stale retries cannot erase newer steps.
- Reset and movement competing at one revision produce one success and one conflict.
- Active encounters, teachers, nonmembers and forged target/resource fields are rejected.
- Other student/campaign progress and campaign definition/gates remain identical.
- Permanent character/job records, combat results, evidence and encounter receipts remain identical.
- Replaying a previously settled combat cannot restore old progress after reset.
- Reset restores the intended personal start state while preserving bought items.

Desktop/phone browser coverage passes against the built campaign fixture: student-only
visibility, confirmation copy, cancellation/focus, active encounter blocking,
error/retry behavior, command identity, success and entry into the reset adventure.
The preview deployment workflow runs this browser gate on its exact production
build before uploading. [GitHub run 39666392515](https://github.com/Orsnoire/FightSchool/actions/runs/39666392515)
passes 339 tests, TypeScript, both builds and the browser gate at 1366×900 and
390×844. Fully opened confirmation screenshots were inspected at both sizes.
The four deployment boundary tests also pass. Local Chromium download was
unavailable; GitHub supplied the browser verification.

## Release boundary

[Run 39666392515](https://github.com/Orsnoire/FightSchool/actions/runs/39666392515)
deployed the tested source at 20:02 UTC on October 21. The release script verified
the source marker, retained combat namespace identity and public liveness.
Public liveness/readiness returned 200 and the live Reset campaign UI bundle was
verified after the initial reset deployment; the final release has identical
application code. No migration was needed and no saved campaign was automatically
reset by deployment.

Reset behavior was exercised through real HTTP handlers against disposable,
migrated Postgres and browser fixtures. An authenticated reset of a live preview
account was not performed this turn. CampaignTester has not been reset by the
agent; owner acceptance is pending. Refresh the student Campaigns lobby to use
the new control. Classroom deployment and merge remain outside scope.
