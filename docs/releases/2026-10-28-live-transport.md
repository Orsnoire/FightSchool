# Live acceptance transport follow-up

Owner-authorized continuation after PR #88. Production and preview migrations are complete and both sites reopened; see [release evidence](2026-10-28-pr88.md).

Canonical acceptance 40715425162 attempt 4 timed out awaiting the abilities phase. The room's alarms continued, but the expected action invocation was absent from provider logs. No root cause is established. A local diagnostic attempt could not open the WebSocket because direct DNS lookup failed; it is not runtime evidence.

Registered branch: `fix/live-acceptance-transport`. Scope: capture sanitized socket send/receive/close/phase diagnostics with the exact existing fixture and deadlines, identify the observed failure, implement only a supported fix, and rerun the full original classroom acceptance. Preserve authentication, progress, migration history, maintenance windows and all storage. Do not weaken acceptance thresholds or enable beta during diagnosis. C12 remains untouched.

State: DIAGNOSTIC CHECKPOINT on draft PR #89; no runtime change. Bounded failure-only socket diagnostics record sends/callbacks, ready state, buffered bytes, received phase/revision, close codes and error presence. They omit identities, cookies, answers, command fields and full snapshots. All fixtures, assertions and deadlines remain unchanged. Syntax/diff checks pass. Production post-upgrade preflight 40739839531 passes. Next: run the full canonical suite from this branch.
