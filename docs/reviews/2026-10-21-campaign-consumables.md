# Campaign consumables and combat publication — October 21, 2026

Implemented runtime: `ccb003f797e94b01f39329a477af8a009b7d7e98`,
[PR #81](https://github.com/Orsnoire/FightSchool/pull/81). This review covers the
owner's item-shop request and reported combat pauses. See
[the item rules](../CAMPAIGN_CONSUMABLES.md) for the eight items and explicit
playtest defaults.

## Changes

- A town item shop and exploration/combat Items menus expose owned quantities,
  effects and total weight. Full bags scroll within the available screen height.
- Bought items are separate from Herbalist charges. Purchases, field use and
  combat settlement preserve quantities through reloads, job changes and retries.
  Rest never refills bought items.
- Self-cures work during questions while disabled. Psychic Needle costs exactly
  1 HP without spending shields; its prototype 2-HP minimum prevents self-KO.
  Wards prevent their named status for exactly five enemy turns; unused turns
  survive an encounter and do not tick during exploration.
- Migration 0020 extends existing atomic routines and adds a shop to old saved
  maps without regeneration. No new table or production fixture is introduced.
- Campaign rooms publish a saved snapshot before optional reporting writes.
  Completion can show result-saving progress before rewards finish persisting.
  The four-second answer feedback and three-second question lead-in remain.

## Evidence

- Local full suite: **339 tests pass** (5 phase-two, 7 phase-three, 320 phase-four,
  7 rich-content), TypeScript and client/Worker builds pass.
- [Runtime CI](https://github.com/Orsnoire/FightSchool/actions/runs/39628357397)
  passes tests, TypeScript and both builds.
- Focused deterministic cases cover quantities/weight, no-op rejection,
  class-independent Potion use, each cure, five-turn expiry, hypnosis variants,
  exact self-damage, one-item-per-round/phase guards and public record projection.
- Migrated HTTP tests cover duplicate purchase charging, unavailable/forged
  items, insufficient gold, field use, frozen combat handoff, exactly-once
  carryover, old-map preservation and idempotent migration reapplication.
- Publication tests hold a reporting promise open and observe the new state
  only after its durable checkpoint. Failed checkpoints expose nothing; reward
  publication follows its saved receipt.
- [Browser acceptance](https://github.com/Orsnoire/FightSchool/actions/runs/39628357368)
  passes all four jobs (browser, initial-loading, battlefield-rendering and
  authoring-lobby). It verifies the item shop and menu at desktop/phone sizes, including multiple
  purchases, bag quantities, healing and self-cure command submission. Full-bag
  scrolling is exercised. Desktop and phone shop/full-bag screenshots were inspected;
  menus stay within the screen, and the emptied cure/remaining Potion state is
  visible after use.

## Live timing observation and limits

A separate QA character played two rounds against the previous preview runtime.
Command acknowledgments took **124–151 ms**. Support confirmation to visible
resolution took **998–1159 ms**. Final playback acknowledgment to the completion
screen took about **10 seconds**. The driver acknowledged animation batches after
750 ms; it did not measure the real browser's animation completion. This sample
identifies reporting/result work on the observed path, not every possible lag.

The publication change overlaps display with reporting; SQL still serializes room
commands. Authentication, question correctness, HP, item counts, gold and rewards
remain server-owned.

### Preview release and live follow-up

The connector remained unavailable, so a dedicated GitHub Actions preview path
was added with a fixed destination and preservation of existing secrets/storage.
[Read-only preflight](https://github.com/Orsnoire/FightSchool/actions/runs/39643804398)
passed using the existing deployment credential. Migration 0020 was applied only
to the isolated preview in a transaction, followed by its migration ledger entry:
21 entries, exactly one item-shop NPC, unchanged map-geometry and player-progress
digests. No map regeneration or player reset was performed.

[Deployment](https://github.com/Orsnoire/FightSchool/actions/runs/39644095594) rebuilt
exact runtime `ccb003f797e94b01f39329a477af8a009b7d7e98`, passing TypeScript, all
339 tests and both builds. Four deployment boundary tests also pass. Upload
completed at 17:31 UTC on October 21; the runtime marker and unchanged combat
namespace identity were checked. Public liveness and database/combat readiness
both return 200. See [deployment procedure](../CAMPAIGN_PREVIEW_DEPLOYMENT.md).

Dedicated CampaignQA live checks passed:

- All eight items appear with weight 1. Buying two Potions deducts 20 gold once;
  retrying the identical command does not charge or grant twice.
- A Potion heals 5 HP up to maximum and consumes one. Sticky Shoes applies five
  enemy-turn protection. Quantity/protection survives a fresh campaign request.
- The inn restores health without refilling purchased items.
- Combat inherits the saved bag. Psychic Crown consumes one and grants protection;
  a second item during the same round is rejected without consuming it.
- Trip/hypnosis protection counts down from five to four after one enemy turn,
  then continues across the three-round encounter. Remaining HP, quantities and
  protection persist back into adventure and survive reload.

A three-round post-deployment sample used the same 750-ms playback acknowledgment
rule as the previous probe:

| Observed interval | Previous preview | Updated preview |
| --- | --- | --- |
| Support phase/Ready to visible resolution | 998–1159 ms | 104–120 ms |
| Final playback completion command to completion state | about 9.9 s | about 196 ms |
| Completion state to saved rewards | not separately captured | about 2.3 s |

The final-playback estimate subtracts the driver's scheduled 750-ms playback wait;
it does not measure actual browser animation timing. The before/after encounters
lasted two and three rounds respectively. Ordinary acknowledgment samples were
79–353 ms after deployment; a late playback acknowledgment queued after combat
completion took 1.64 s. The improvement is visible-state publication, not removal
of all database/queue waits. These are small API/WebSocket samples, not a repeated
or loaded browser benchmark. Deliberate question lead-in and answer-feedback
intervals remain unchanged.

The owner's CampaignTester account was not used or reset. Owner acceptance of
this follow-up remains pending. PR #81 is open/unmerged; classroom deployment is
outside this task. The short-domain classroom redirect is a separate accepted
change and was not modified by this release.
