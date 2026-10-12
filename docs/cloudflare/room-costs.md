# C05 room publishing and reconnect costs

C05 implements F07 and the reconnect/instrumentation portion of F08. No gameplay,
SQL migration, live load test or release is included. PR #63 carries exact-head
verification. C06 retains evidence projection, query plans and frozen-fight storage work.

## Delivery behavior

Each publish projects state once and builds/encodes one full message per eligible
role, rather than per socket. Per-socket volatile delivery hints suppress identical
public payloads; only `serverTime` is excluded from change detection. Revision,
question, phase clocks, teacher rejoin requests and results are included. Thus
same-revision results and moderation updates still deliver. A failed send does not
mark that payload delivered. New sockets and new object instances have no hints
and receive full state. No delta protocol, delayed batching or acknowledgement
coalescing is introduced. Acknowledgements still follow durable receipts; phase
transitions publish immediately. Role checks exclude unadmitted and smoke sockets.

The full public content comparison deliberately protects fields that can change
without a revision increment (entry roster and completed reward projection).
It costs one full serialization per role per publish attempt, including attempts
whose wire sends are suppressed; it is not a persistent revision cache. The delivery
hints retain public strings only and are held in a WeakMap, never persisted.

Established/pending students receive a direct full reconnect snapshot using their
saved entry profile. Authentication/revocation checks and removal/block checks still
precede that path. Waiting solo rooms retain automatic start; waiting classroom
reconnects still check room metadata. New admissions and approved moderated reentry
retain their existing paths. Saved room format, alarms, phase deadlines, evidence
retries, receipt bounds, result idempotency, swarm previews and host controls remain.

## Diagnostics

`combat_command` adds logical repository call count/time, storage-read count/time,
and checkpoint count/time alongside queue and total duration. Repository time
includes its internal work; it is **not** SQL query count or server database time.
All checkpoint writes, including the post-evidence write, emit checkpoint timing.
`combat_publish` records encoding count, successfully sent messages/UTF-8 bytes,
skipped state sends, failed sends and duration. Logging uses the existing numerical
allowlist; no bodies, answers, credentials, exception text, SQL or actor names.
Proxy wrappers preserve repository method receiver and propagate failures.
Timing is rounded to milliseconds in logs. Logging/encoding still has overhead;
there is no claim of production latency improvement before a measured release.

## Reproducible isolated comparison

Run `node --import tsx tests/support/measure-room-costs.ts` against baseline runtime `de0ddfd7`
and the candidate with the same dependencies/runtime. Use the final PR #63 versions
of both `tests/support/room-costs.ts` and `measure-room-costs.ts` in each checkout:
the final fixture corrects appearance metadata to registered model/palette IDs.
Run baseline and candidate sequentially, without competing benchmark processes. Twelve independent runs
per size; median per column. Each run has 30/60 players plus host, varied jobs and
appearance metadata, rich question text, and a configured goblin swarm. It performs
10 changed publications, 10 identical publications and one reconnect per player.
The baseline is the same fixture and operation sequence, not the older F07 microbenchmark.
Raw measurements and Node version are in
[the measurement record](../reviews/2026-10-12-c05-measurements.json).

| Measured work per run | 30 players: before → after | 60 players: before → after |
| --- | --- | --- |
| Publish loop, ms | 76.95 → 13.70 | 254.48 → 31.17 |
| Reconnect loop, ms | 147.96 → 23.12 | 868.92 → 82.03 |
| Full state encodings | 1,550 → 70 | 4,880 → 100 |
| Sent messages | 1,550 → 340 | 4,880 → 670 |
| Sent UTF-8 bytes | 60,632,350 → 13,299,980 | 374,292,720 → 51,388,530 |
| Reconnect student/profile reads (each) | 30 → 0 | 60 → 0 |
| Reconnect checkpoints | 30 → 0 | 60 → 0 |
| Revocation checks | 30 → 30 | 60 → 60 |

These are Node CPU/operation measurements with disposable in-memory storage and a
stubbed repository, not Cloudflare/network/database timings. No realistic guild
quest/history query cost or browser rendering is represented. Reusing encoding
alone does not reduce wire bytes; skipped duplicate publishes and targeted
reconnect delivery account for wire savings here. This workload intentionally
exercises redundant work and is not representative of every classroom command.
No production p95 or under-one-second target is claimed. Repeated deployed
30/60-player latency, rich guild data and memory profiling remain release/C06–C08/C12
work. Checkpoint byte counts in the harness describe serialized fixture values,
not billed Cloudflare storage bytes. Actual persisted data format is unchanged.

## Regression evidence

Published baseline fails three boundary tests: 31 encodes for a 30-player fan-out,
unchanged state delivery, and redundant reconnect reads. New-admission control
already passes. Candidate additionally covers same-revision moderation/results,
failed-send recovery, fresh socket/object replay, pending/waiting reconnects,
revocation/expiry, blocked membership and 30/60 simultaneous answer bursts.
Burst tests verify all acknowledgements, durable receipts, immediate action-phase
transition and harmless retry. Existing persistence-failure, host-control, swarm,
reward, saved-clock and ownership tests remain full-suite gates.
