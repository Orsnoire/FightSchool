# C07: initial loading and dashboard data

Implementation: [draft PR #70](https://github.com/Orsnoire/FightSchool/pull/70),
branch `cleanup/c07-initial-loading`. Scope: F10 and the list/polling part of F12.
This is review evidence, not a deployment or live acceptance record.

## Behavior

- Login stays immediately available. Other routes load on navigation, with an
  accessible loading status and local error boundary. Retry creates a new React
  lazy instance. Browsers can cache a failed native module import, so route errors
  also offer an explicit page reload. There is no automatic reload of a draft.
- MathLive loads when a student chooses **Use math answer**. Controlled answers
  survive waiting and failure; **Use text answer** remains available if the math
  download fails. The keyboard stays inside the combat dialog and retains its
  existing cleanup behavior. Teacher authoring already uses textareas; C07 keeps
  that editing experience. The unused Tiptap component is unchanged.
- Authenticated owners may request `GET /api/teacher/:id/fights?view=summary`.
  PostgreSQL returns card metadata and question/enemy-definition counts, without
  transmitting banks, enemies or loot. Archive/owner filtering occurs in SQL;
  equal creation times have an ID tie-breaker. Full list/detail editing responses
  remain compatible. Summary and full views have distinct query-cache keys under
  the same mutation-invalidation prefix.
- Dashboard definitions refresh on mount/navigation, tab focus and create/edit/
  delete invalidation. Only hosted-session status polls every five seconds,
  while the dashboard is mounted and the tab is visible. Session errors disable
  launch controls until a successful check. Summary errors offer retry and do
  not render a false empty list. The guild assignment picker also uses summaries.

No gameplay, reward, academic evidence, permission, schema or migration changes.
No production data was reset. Battlefield countdown/avatar work remains C08.

## Production JavaScript

Baseline source: `5208ff3d0ae5b2c9c2f22b0a329b98ab26865e71`.
Measured implementation: `9267047c70b248dea6f14e3ff3a6fabc70354e57`.
Both use Node 24.19.0, the same lockfile and production Vite defaults. The harness
walks the complete static import/modulepreload closure and counts each file once,
gzip-compressing each asset at the default level. It includes the selected route;
the student-math workload additionally includes the dynamically requested editor.
These are cold download byte counts, not load-time or production latency claims.

| Cold workload | Before gzip JS bytes | After gzip JS bytes | Reduction |
| --- | ---: | ---: | ---: |
| Teacher login | 601,648 | 119,663 | 80.11% |
| Student login | 601,648 | 119,663 | 80.11% |
| Teacher dashboard | 601,648 | 130,782 | 78.26% |
| Teacher authoring | 601,648 | 284,061 | 52.79% |
| Student combat with math input | 601,648 | 505,192 | 16.03% |

The C07 gate is at least 40% less initial login gzip JS (at most 360,988 bytes):
**passed**. Login CSS separately falls from 28,015 to 16,164 gzip bytes. Total JS
is split into 74 chunks; this is deferral, not elimination of MathLive's cost.
The full editor chunk remains large. Existing cache reuse makes later navigation
different from the cold totals above.

Raw assets, hashes and closure details: [before](c07/before.json),
[after](c07/after.json). Browser acceptance compares real production JS requests
to the manifest closure, so an accidentally eager preload cannot hide behind a
small entry-file measurement.

## Summary query and response measurements

The migrated local PostgreSQL fixture contains two teachers: 40 active owned
fights (39 with 50 questions and one empty bank), one archived fight and one
other-owner fight. Both API views use the identical rows. Full definitions remain
available for editing; the summary request never reads them into the Worker.

| Per list request | Full view / before | Summary / after |
| --- | ---: | ---: |
| SQL queries | 1 | 1 |
| Rows returned | 40 | 40 |
| Serialized database result bytes | 742,896 | 6,340 |
| HTTP response bytes | 750,336 | 9,700 |
| HTTP gzip bytes | 9,480 | 421 |
| Estimated plan row width | 1,183 | 78 |

This removes 99.15% of database result bytes and 98.71% of uncompressed HTTP bytes
in the fixture. Both plans use a sequential scan and sort on this small table;
no index is added. PostgreSQL still evaluates JSON array lengths, so reduced
transfer is not evidence of an equivalent database CPU improvement. SQL row bytes
serialize driver results; they are not database wire-protocol metering. Repeated
question text compresses particularly well; actual content mix changes the gzip
ratio. [Exact queries, plans and fixture dimensions](c07/fight-lists.json).

Before C07, a continuously mounted visible dashboard requests both full
definitions and live sessions every five seconds. In an ideal 60-second window
including mount, that policy implies 13 of each request. C07 removes the timed
definition requests. That comparison is derived from the old policy, not a live
traffic sample. Production-browser observed counts are recorded separately by
`tests/browser/initial-loading.mjs` in the CI `initial-loading-evidence` artifact.

## Verification checkpoint

- Local: **277 tests pass**, TypeScript and production client/Worker builds pass.
  Migrated HTTP tests cover unsigned/student/other-owner rejection before SQL,
  archive exclusion, empty arrays, swarm-definition counts, stable order and full
  editing content. Deferred component tests cover pending prop changes, failure,
  retry, retained parent state and unmount before completion. The C06 progression,
  fault/retry and cross-room reward regressions remain in the complete suite.
- Initial runtime CI [39077715536](https://github.com/Orsnoire/FightSchool/actions/runs/39077715536)
  and existing Chromium acceptance [39077715534](https://github.com/Orsnoire/FightSchool/actions/runs/39077715534)
  passed. Full CI [39078090447](https://github.com/Orsnoire/FightSchool/actions/runs/39078090447)
  passes on `9267047`. Production run 39078090459 stopped at an incorrect test
  assumption about the default login tab. The fixture now selects Teacher
  explicitly; its corrected browser pass remains pending.
- The production job covers exact login requests, delayed route loading, summary
  counts and request frequency, hidden/off-route polling, navigation/mutation
  refresh, failed summary/session retries, saved/reopened teacher questions,
  failed route reload, delayed MathLive with retained answer, the real phone
  keyboard, and text fallback after a failed editor download.
- Browser screenshots and measurements are CI artifacts. Local Chromium was
  unavailable; no local browser or live performance pass is claimed.

## Reproduction

From this branch, using Node 24.19.0 for matching byte measurements:

```sh
npm ci
npm run check
npm test
npm run build:cloudflare
node --import tsx tests/support/measure-initial-loading.ts /tmp/c07-after.json
node --import tsx tests/support/measure-fight-lists.ts /tmp/c07-lists.json
```

For the before build, create a detached worktree at the baseline SHA, install
with the same Node/lockfile, copy this branch's `measure-initial-loading.ts` into
its `tests/support/` directory and run:

```sh
npm run build:client -- --manifest
node --import tsx tests/support/measure-initial-loading.ts /tmp/c07-before.json
```

The `Combat UI Acceptance` workflow runs both the existing development-browser
suite and a separate production build/`vite preview` job. To reproduce the latter,
install the workflow's isolated Playwright version/browser, serve the build on
127.0.0.1:4174 and run `node --import tsx tests/browser/initial-loading.mjs`.
All database measurements use disposable local PGlite fixtures; they require no
production credentials or data.
