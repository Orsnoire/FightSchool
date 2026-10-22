# C12 performance and operational signoff: resumed October 22

C12 is still in progress in draft PR #75. Production remains the separately
accepted PR #84 release. This checkpoint prepares representative measurements;
it does not certify latency, perform provider disruption or deploy new runtime.

## Completed preparation

- Merged current main `20188dc9` into the existing C12 branch at `71744d9031c326e99eb02a0d723c38e9aed53620`, preserving the released gameplay and shop fixes.
- The reconciliation passed 373 local tests, TypeScript and both builds on Node
  24.19.0. Pinned Node 22.23.3 CI [39840298710](https://github.com/Orsnoire/FightSchool/actions/runs/39840298710)
  and Avatar Workshop passed. Three Combat UI jobs passed; the phone comparison
  dialog test timed out after reopening. The new candidate waits for modal focus
  before sending Escape; it still requires the dialog to dismiss. Its exact-head
  checks must pass before release.
- Added `repeat-performance.mjs` and the isolated representative profile described
  in the [runbook](../cloudflare/release-runbook.md). SQL setup uses the existing
  Neon driver and one transaction; no runtime backdoor or schema change.
- Added migrated disposable-Postgres coverage for 3,000 results, 1,500 evidence
  rows, ownership/production-target refusal, retained exact IDs, rollback-only
  cleanup compatibility and lost COMMIT acknowledgement. Engine coverage checks
  the two-round class workload at both 30 and 60 participants. Scouts earn combo
  points in round one before using Aim; goblin disruption remains enabled.
- Reports preserve individual runs and their worst p95. Missing, failed,
  duplicated or mixed-release samples cannot become a successful report.

Candidate local verification: **380/380 tests passed**, TypeScript passed, and
client/Worker builds passed on Node 24.19.0. Exact-head pinned CI and browser
results are pending.

These local tests are not an end-to-end provider run. The representative driver
does not measure browser rendering, provider CPU, SQL query counts or server
queue time. Those need the retained provider diagnostics/browser evidence.

## Rechecked provider state

Read-only checks matched the retained rehearsal inventory: its Worker/DO namespace
and R2 bucket remain distinct from production, and its Neon endpoint maps to the
isolated branch. SQL counts remain 3 teachers, 32 students, 5 fights, 7 combat
sessions, 1 guild and 1 custom equipment item. All 35 retained rehearsal login
sessions are expired. Exact provider identifiers and ownership journals stay in
the private inventory; no new synthetic provider records or cleanup were made.

The old local secret file no longer exists. Cloudflare still reports the four
secret bindings, whose values are opaque. No secret was replaced or exposed.
The account-token listing request returned unauthorized/reauthentication required;
the current connection cannot establish the narrower management credential.

## Outstanding signoff gates

| Gate | Remaining evidence or prerequisite |
| --- | --- |
| Credential and database isolation | Rehearsal-scoped deployment access/separate environment, plus independent mapping of production's actual uploaded DB secret to its endpoint/branch. Existing broad provider access is not this proof. |
| Representative performance | Deploy the reviewed candidate to rehearsal, run bounded repeated 30/60 cohorts, retain diagnostics and correlate browser evidence. The proposed 30-answer p95 remains below 1,000 ms; no threshold revision or pass is claimed. |
| Recovery | Force isolated room restart and DB interruption, then prove restored phase/deadline, complete evidence and no duplicate result/reward. Local fault tests do not pass this gate. |
| Rollback | Two compatible reviewed versions in the same isolated environment, timed rollback and renewed room/DB/R2/browser checks. |
| Classroom observation | Actual Chromebook/browser/network evidence, then an agreed owner and monitoring window. CI emulation is supplementary. |
| Retention | Reconcile historical live fixtures by exact ownership; do not delete by prefix. Review retained rehearsal fixtures and dispose only through scoped, verified procedures. |

The earlier canonical 3,733 ms answer p95 and isolated 1,308 ms p95 are single
functional samples from different releases/environments. Neither satisfies a
repeatable sub-second performance claim. The audit's cold-avatar and expired
session findings are not silently cleared by this preparation.
