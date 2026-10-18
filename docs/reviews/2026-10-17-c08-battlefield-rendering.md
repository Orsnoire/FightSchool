# C08 — battlefield rendering

C08 implements F11–F12 in [draft PR #71](https://github.com/Orsnoire/FightSchool/pull/71).
Baseline: `56a1f758bde901ff9739e5ea0ee8d44d55f7ba91`, after C07 was merged,
deployed and accepted. Core compositor/countdown runtime: `35eb3a8643ae0097e8e05cf29f6d6cbe3f001bf1`.
The follow-up `99ea24cd0ad0049719072be3e6af5e8dd96fe69f` guards a redundant
avatar error-clear dispatch during resize; the measured compositor is unchanged. This report was
started October 17 Denver time (October 18 UTC). C08 is not merged or deployed.

## Changes and preserved behavior

- Avatar canvases fit their measured CSS box and device-pixel ratio, bucketed by
  eight backing pixels and capped at the original 1,200×1,950 source resolution.
  ResizeObserver, viewport changes and DPR changes invalidate dimensions.
- The ready composition cache has a 32 MiB RGBA budget and a 256-entry ceiling.
  Concurrent identical work shares one promise. A serial queue yields between
  compositions and skips jobs whose consumers have all aborted. Private tint
  canvases are released even after a failure; returned surfaces remain valid
  when the cache evicts them. Decoded source images are outside this budget.
- Semantic appearance/equipment keys and memoized battlefield/avatar components
  avoid work from equivalent DTOs or unrelated local UI changes.
- Countdown components own ticking state. Server offset/revision processing stays
  in the transport hook; the question intro wakes its page at its absolute end.
  Focus/visibility refresh clocks. No new polling or server timing rule is added.

Approved static artwork, body proportions, equipment layering and custom palettes
remain. Selection controls, reconnects and completion-driven playback retain their
existing tests. No Worker, SQL, migration, persistence, permission or reward code
changes; no production data operation or reset was performed.

## Reproducible native allocation comparison

[Before](c08/before.json) and [after](c08/after.json) include source SHA, renderer
hash, Node version and measurement limitations. Both runs used the same fixtures,
sequentially on the same environment, with 30/60 distinct appearances across
12 classes and both bodies, including equipment variation.

| Distinct avatars | Visible RGBA bytes before | After at 48×78 | Reduction | First avatar reused after roster, before → after |
| --- | ---: | ---: | ---: | --- |
| 30 | 280,800,000 | 449,280 | 99.84% | no → yes |
| 60 | 561,600,000 | 898,560 | 99.84% | no → yes |

These values sum output backing sizes. They are **not process heap, GPU residency
or peak total memory**. The native harness does not retain a whole mounted DOM;
the Chromium comparison measures mounted DOM canvases separately. The LRU byte
budget covers ready composed surfaces only. DOM copies, decoded art, pixel arrays,
and temporary full-detail tint buffers also consume memory.

Cumulative requested allocations, including temporary canvases, fell from
1,218,939,240 to 938,450,280 bytes (30) and 2,337,157,200 to 1,776,179,280 bytes (60).
These are cumulative requests, not simultaneously live bytes. Cold compositions
still process the full-detail tint inputs: 7,654 → 7,466 ms and 12,683 → 12,402 ms
in single local runs. **No cold CPU speedup or statistical latency claim is made.**
A warm first-avatar lookup creates zero canvases after the change, versus five
before. One-at-a-time composition bounds simultaneous scratch ownership and
allows input events between jobs; each individual recoloring job remains work.

To reproduce from the PR checkout:

```sh
npm ci
git worktree add --detach /tmp/c08-baseline 56a1f758bde901ff9739e5ea0ee8d44d55f7ba91
# Install locked dependencies in that worktree, then copy these same two harness files:
# tests/support/measure-avatar-rendering.ts and avatar-rendering-fixture.ts.
# Run the following in the baseline worktree, then the PR worktree, sequentially:
node --import tsx tests/support/measure-avatar-rendering.ts before
node --import tsx tests/support/measure-avatar-rendering.ts after
```

Run each label in its corresponding worktree; outputs go to `artifacts/c08/` and
`docs/reviews/c08/`. Do not run both measurements concurrently. The checked-in
GitHub workflow also pins the baseline SHA and shares installed packages while
isolating Vite optimizer caches.

## Regression and visual coverage

New tests exercise actual compositing, cache bounds/LRU behavior, in-flight sharing,
queued cancellation, failed-asset recovery, scratch release, semantic key ordering,
changed palettes, CSS/DPR resize, stale asynchronous results and unmount cleanup.
Clock tests cover server offset/revision correction, no transport-parent tick,
one-shot intro expiry, untimed phases and timer cleanup.

Eight full-detail-vs-sized image comparisons cover both bodies, four starter
styles and custom equipment colors at 96×156. Mean visible RGB difference over
white must stay below 2/255. A 24-avatar native before/after contact sheet was
visually inspected: silhouettes, gear and palettes remain consistent. Small
raster-edge differences are expected when clipping/scaling directly at output
resolution. The existing real equipment-rendering and Avatar Workshop Acceptance
suites remain required.

## Browser verification

The comparison on `515cfe2` passed all ten before/after cases, and the existing
combat, production initial-loading and Avatar Workshop suites pass. Full CI
passes **283 tests**, TypeScript and client/Worker builds. That comparison also
logged a React warning during 60-avatar resize, so it was not treated as the
final warning-free gate. The follow-up guards redundant healthy-avatar error-clear
dispatches and makes update-depth/render-loop warnings fail the browser test.
Final warning-free rerun: **PASSED**, [39083039834](https://github.com/Orsnoire/FightSchool/actions/runs/39083039834), on `99ea24c`. All three jobs pass. [CI 39083039895](https://github.com/Orsnoire/FightSchool/actions/runs/39083039895) and [Avatar Workshop 39083039912](https://github.com/Orsnoire/FightSchool/actions/runs/39083039912) also pass on that exact runtime.

The new fixture checks 30/60-member teacher and student views, 1366×768 at DPR1,
390×844 at DPR2, and a 60-member 3840×2160 DPR2 projector. It records mounted canvas
bytes, page/battlefield/avatar executions over 10.2 seconds, roster interaction
and cold readiness. It also exercises question controls, student typing and native
ResizeObserver. One teacher case uses 4× Chromium CPU throttling. This is controlled
emulation, **not physical Chromebook certification**. API/WebSocket fixtures do
not establish live transport latency or classroom hardware performance.

Fixture debugging is retained in the PR history. The initial Vite roots shared
an optimizer cache; they now have separate caches. The old renderer needed more
than the default 30-second locator allowance in the 4× CPU case. Instrumentation
now matches Vite's numeric suffixes on memo function names and selects combat
sockets explicitly, excluding development HMR. The controlled clock is installed
before application timers, and resize checks await the native observer. Playwright
is installed separately so the application retains its locked dependencies.
Earlier failures were not used as before/after measurements.


[Permanent raw browser measurements](c08/browser.json); screenshots are in the
workflow's `battlefield-rendering-evidence` artifact (seven-day retention; the
fixture regenerates them). All five cases exceed the proposed 80% allocation gate.

| View / players / DPR | Mounted bytes before → after | Reduction | Page / board / avatar executions before → after |
| --- | ---: | ---: | --- |
| teacher 1366×768 / 30 / 1 | 280,800,000 → 312,000 | 99.889% | 44 / 43 / 1290 → 0 / 0 / 0 |
| teacher 1366×768 / 60 / 1 | 561,600,000 → 624,000 | 99.889% | 45 / 44 / 2640 → 0 / 0 / 0 |
| student 390×844 / 30 / 2 | 280,800,000 → 485,056 | 99.827% | 41 / 41 / 1230 → 0 / 0 / 0 |
| student 390×844 / 60 / 2 | 561,600,000 → 797,056 | 99.858% | 45 / 44 / 2640 → 0 / 0 / 0 |
| teacher 3840×2160 / 60 / 2 | 561,600,000 → 3,594,240 | 99.36% | 42 / 42 / 2520 → 0 / 0 / 0 |

Countdowns advanced from 35/36 to 25 seconds. Host question visibility and student
typing did not rerender the board; viewport changes updated backing sizes. The
new warning-sensitive gate passes during both 60-avatar resizes.

Cold results remain a limitation: the 4× CPU teacher case took **37,710 → 34,113 ms**
to finish artwork. Its single automated roster click was **1,008 → 3,153 ms**, so
this run does **not** establish a uniform input-latency improvement. Other cold
click samples range from 25 to 14,812 ms before and 44 to 840 ms after; raw data
retains every sample. Scheduling and automation overhead make these single samples
noisy. Physical Chromebook observation and repeated input/long-task profiling
remain open; off-thread recoloring is a possible measured follow-up, not part of
this package. The verified benefits are backing allocation, cache reuse and
removal of repeated countdown-driven page/board/avatar work.

## Review and release boundary

C08 is **VERIFIED IN CI / DRAFT / NOT MERGED / NOT DEPLOYED**. PR #71 contains
implementation, regression fixtures, pinned before/after measurements and the
resume checkpoint. Physical Chromebook observation remains explicitly unverified.
C09 is next and unstarted. Merge/deployment and canonical live acceptance remain
separate actions; the deployed release is C07 runtime
`8f280b7b75479aa05bfb7dfd069f37e3f5d72334`.
