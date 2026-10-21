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
commands. No post-change live latency improvement is claimed yet. Authentication,
question correctness, HP, item counts, gold and rewards remain server-owned.

**Not deployed:** Cloudflare connector search/execution repeatedly returned an
internal error, including a no-op execution. No alternate authenticated deployment
client was available. Migration 0020 has not been applied to the preview; its
existing runtime remains unchanged. The owner's playtester was not used or reset.
The branch is open/unmerged, and classroom deployment is outside this task.
