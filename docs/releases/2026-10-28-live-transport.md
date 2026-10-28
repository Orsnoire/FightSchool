# Live acceptance socket diagnostics — October 28, 2026

[PR #89](https://github.com/Orsnoire/FightSchool/pull/89) is merged at
`7623af943a589018503b21d6faddd8f5deaac3a6`. Its reviewed head is
`00101edd1a25cab95f242864e4617c2255e5b9c2`; the merge adds only main's documentation
pointer to that tree. It changes no runtime, migration, gameplay or security rule.

Canonical acceptance 40715425162 attempt 4 timed out awaiting abilities on the
upgraded runtime. Provider alarms continued, but the next expected action
invocation was absent. A local diagnostic attempt could not open WebSocket because
direct DNS failed, so it is not runtime evidence. No root cause was established.

The existing test now records bounded failure-only socket send/callback, ready
state, buffered bytes, received phase/revision, close code and error presence.
The allowlist omits identities, cookies, answers, command fields and full snapshots.
Every fixture, assertion and deadline is unchanged. Operational acceptance's source
is unchanged entirely from the previous canonical test.

[CI 40740411821](https://github.com/Orsnoire/FightSchool/actions/runs/40740411821)
and all four [browser jobs 40740412143](https://github.com/Orsnoire/FightSchool/actions/runs/40740412143)
pass. [Canonical live acceptance 40740564094](https://github.com/Orsnoire/FightSchool/actions/runs/40740564094)
passes both combat/progression and all eight operational checks on live runtime
`b33bebee309c6828c1e3f44fc70ded7de6a43e85`, using the canonical origin in both steps.
The 30-player burst, reconnect, room isolation, exactly-once results, moderation
and revocation pass. Answer p50/p95/max: 1922/3683/3785 ms, one functional sample.

The timeout did not reproduce, so its cause remains unconfirmed; this PR makes
no speculative production transport fix. The release's operational gate is passed,
not a claim of repeated performance qualification or C12 completion.

State: COMPLETE / MERGED / LIVE ACCEPTANCE PASSED. Production and preview migrations
are complete with records and combat rooms preserved; see [release evidence](2026-10-28-pr88.md).
No further implementation remains on this branch. Continue development from main.
Dedicated beta-guild selection and authenticated owner playtest remain pending;
beta is closed and C12 is untouched.
