# Teacher guild roster statistics

Owner request, October 28, 2026. The guild owner's Members tab shows each
player ID and nickname, all 12 permanent job levels (0 without a progression
record), lifetime AA points earned including spent points, weekly active hours,
and daily academic accuracy. Student roster responses remain unchanged.

## Windows and interpretation

- Hours cover this player's active use across student game pages, including
  menus and fights. The rolling window is the preceding 168 hours, independent
  of local midnight or DST. Values are estimates displayed to two decimal places.
- The browser samples complete 30-second periods while visible and within two
  minutes of pointer, keyboard, touch or scroll activity. Hidden tabs, timer
  suspension, idle periods and offline replay do not earn samples. Opening a
  page establishes tracking availability but awards no time. Partial periods
  under 30 seconds are not saved; there is no unload backfill.
- The server assigns each successful active pulse to its most recent completed
  30-second bucket using server time. Buckets are unique per player, preventing
  simultaneous tabs/devices from multiplying hours. Pulse IDs also deduplicate
  retries. Sampling can shift an interval by up to 30 seconds; this is engagement
  telemetry, not an anti-cheat or exact billing clock.
- Tracking begins with the player's first visit using the new client. Until
  seven days have elapsed the roster labels partial history. A player with no
  tracking marker shows Not recorded; a tracked player with no samples shows
  0.00 h. No past time is fabricated from login or combat-session duration.
- Accuracy is correct / total recorded questions in this guild over the last
  24 hours, weighted by question count rather than averaging fight percentages.
  Incorrect and recorded unanswered attempts count in the denominator. Includes
  in-progress fights; questions outside the window are excluded even if the
  same fight has recent questions. Lower bound inclusive, upper exclusive.
- A completed legacy fight with no per-question records falls back to stored
  correct/answered totals if completed in the window. The UI discloses that
  legacy results may lack unanswered counts. Results and attempts never count
  twice. No observations are shown as No fights or No recorded answers, not 0%.

## Persistence and authorization

The roster endpoint requires the guild's owning teacher. Activity writes require
an authenticated student matching the URL ID. Payloads accept only a UUID pulse
ID and active boolean, never client timestamps, duration or another player ID.
No key values, page contents or input details are collected. Failure to record
telemetry never interrupts gameplay. Data uses the existing Postgres driver.

Additive migration 0019 adds tracking markers, samples and a recent-guild-attempt
index; it does not rewrite progression, rewards or applied migrations. Per-player
samples older than eight days are pruned on that player's next pulse; inactive
players retain at most their bounded final sample window until return or account
deletion. Deleting a player cascades both new tables. Rollback can retain these
additive tables while restoring a compatible earlier runtime.

The unmerged campaign branch also uses migration numbers beginning at 0019.
Whichever feature integrates second must reconcile the unapplied history and
regenerate its snapshots; do not rewrite any migration already applied to an
environment or run the classroom migration against the campaign preview.

The roster refreshes every minute while visible, on window focus and manually.
Failures are visible and retained values are explicitly labeled stale.
