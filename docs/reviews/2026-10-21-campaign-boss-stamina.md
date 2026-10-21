# Campaign boss stamina — October 21, 2026

The owner requests 20% stamina on every campaign boss victory, including first
clears and matchmaking. The implementation adds **20 percentage points** to the
post-fight XP stamina rate, capped at 100%. The existing fight XP/stamina cost is
applied before recovery; the bonus benefits subsequent fights in all modes/jobs.
Actual fight counts remain unchanged by recovery. The decay curve resumes from
the equivalent recovered position, and midnight Mountain time clears recovery.

## Implementation

- The server-frozen campaign objective marks boss encounters. The browser cannot
  choose boss eligibility, restoration or XP.
- The existing sorted student locks and unique session/student result receipt
  save recovery atomically with rewards. Reconnect/retry cannot grant it twice.
- First/repeat wins use the same path, including participating knocked-out winners.
  Losses, ordinary fights, nonparticipation, intentional departures and progression-
  ineligible participants do not grant recovery.
- The victory screen displays the actual restoration, including less than 20%
  when capped. The stamina API incorporates recovery; daily counts remain accurate.
- Migration 0021 adds zero-default daily recovery and result audit fields and
  replaces the atomic award routine. Existing progression/results are preserved.
  Older runtime callers omit the new boss flag and keep their ordinary behavior.
- Matchmaking itself remains future work. Eight-participant result processing is
  tested; this does not establish live queue/party acceptance. The pilot remains
  solo and repeats its complete run through the existing reset control.

## Verification

Focused migrated Postgres tests pass for the populated upgrade, eight participants,
repeat/capped awards, knocked-out winners, losses, nonparticipants, ineligibility,
concurrent independent results, duplicate receipts, midnight reset and old-result
replays. The real campaign HTTP path verifies guardian eligibility and the stamina
API. Existing stamina tests pass, as do TypeScript, both builds and four deployment
boundary tests. Desktop/phone reward presentation is added to the combat browser
fixture and the preview workflow's pre-upload gate.

A full local regression pass found two historical migration fixtures that assumed
the old student schema. Their corrections explicitly assert the zero default and
seed historical columns without depending on the current ORM; both targeted reruns
pass. Full GitHub regression/browser evidence is pending.

## Database and release

The generated migration was tested on a temporary branch of the isolated campaign
preview. Existing student/result/campaign-progress digests stayed identical. A
synthetic SQL award probe verified restoration, duplicate safety and next-day/full
cap behavior. Migration 0021 is then applied only to the preview: 22 ledger entries,
with those same existing-data digests preserved. No classroom schema/data changed.

Preview runtime deployment and screenshot inspection are pending. The owner
playtester has not been modified. Public health and authenticated live boss
acceptance must be distinguished from these integration/browser fixtures.
