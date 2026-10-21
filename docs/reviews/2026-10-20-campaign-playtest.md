# Campaign pilot: isolated playtest, October 20, 2026

## Target and source

- Owner request: test PR #81 and provide a playable preview with access instructions.
- Preview: https://questacademy-campaign-preview.coxsonator.workers.dev/
- Source: `a688e8f18d2c539612cb87d0360f92fe8f5cbf18`; tree
  `f89d4d9ebb7924b32d3778e79b012dd0b1447eca`.
- Preview deployed
  October 20 at 16:20:26 UTC.
- This revision changes campaign page background contrast only, relative to the
  first preview at `53ca31f1cb8f97d719b2b493bfa4d549c00b16bf`. Server code is identical.
- PR remains unmerged. No classroom deployment, classroom database migration or
  C12 rehearsal mutation was performed. Later documentation commits are not
  new deployed runtime versions.

## Preview isolation

The preview uses a separately created Worker, empty Neon database, object bucket,
and local combat-room namespace. Names were checked for availability before
creation. No classroom or C12 branch was cloned. The empty database and intended
role were checked before applying the 19 committed migrations through 0018,
including the matching Drizzle migration ledger.

Fresh preview secrets were used. Provider checks verified dedicated bindings and
no classroom custom-domain route or shared combat namespace. No classroom or C12
configuration was changed. Internal provider identifiers and credentials are not
published in this repository.

The preview remains available for owner playtesting. No automatic deletion or
resource expiry was scheduled. Preserve its isolation on future updates.

## Fixtures

All accounts/content were created through ordinary authenticated app routes,
against the verified preview origin, with redirects disabled. One teacher, two
students, one guild, one quiz and one campaign exist. Passwords were randomly
generated and retained outside Git. There is no runtime test-user backdoor.

- Campaign: **The Lantern Key**.
- Guild: **Campaign Playtest**.
- Dungeon/quiz: **Lantern Cave**, ten synthetic arithmetic/algebra warmups.
- One generated **Lantern Key Keeper**. Teacher gate is left open; each student
  must still collect the key.
- **CampaignTester** is the owner's fresh character. **CampaignQA** is used for
  automated checks. A completed teacher-authored supplies quest awards 500 gold
  through existing reward rules. No direct gold/progression SQL edits were made.

## Automated regression and visual checks

- [CI 39456186245](https://github.com/Orsnoire/FightSchool/actions/runs/39456186245):
  all 329 tests, TypeScript, client build and Worker build pass.
- [Browser run 39456186313](https://github.com/Orsnoire/FightSchool/actions/runs/39456186313):
  all four jobs pass. Campaign creation, gates, movement, field healing, inn/job
  changes, shops and resume checks run at 1366×900 and 390×844.
- Screenshots from artifact `12280542414` were inspected. The initial transparent
  page gradient made pale headings unreadable on a light system theme. The fix
  supplies an opaque dark campaign background, including page gutters. Updated
  desktop/phone screenshots are retained in the browser run.
- Browser campaign checks use API fixtures. A browser visit separately confirmed
  the actual preview serves its Student/Teacher sign-in page. Authenticated live
  campaign checks below use real HTTP/WebSocket requests, not browser mocks.

## Real-server acceptance

**PASS for the pilot's tested core loop.** The corrected state-driven acceptance
completed at 2026-10-20T16:29:19.019Z. See the
[structured results](2026-10-20-campaign-playtest-results.json).

- Teacher closed gates reject key collection and cave entry and leave the
  overworld question pool empty. Opening, collecting, closing and reopening a
  previously claimed key updates eligibility correctly. Command replay is
  idempotent.
- Both shops purchase the requested item, deduct its exact price and reject
  duplicate ownership. Inn job switching preserves the classroom job; explicit
  rest restores resources.
- A real solo wild encounter completed in three rounds, saving **9/10 HP**.
  The reconnect check retained HP and the current question deadline. The
  exploration menu then healed using one saved potion charge.
- Generated-map travel reaches the cave and guardian. Leaving an active
  encounter settles it and releases exploration; two incidental battles were
  left after the completed wild-encounter test.
- The guardian's five-question sample repeats until victory. It completed on
  round **28**, saving **6/10 HP**, marking the cave cleared, and retaining
  exploration/clear/resources on refresh. This was a level-one herbalist using
  basic attacks and included an interruption of the test driver; it is not a
  clean speed benchmark or approval of that job's solo balance.
- Returning to town and resting succeeds. The owner character remains at its
  initial town position, full HP, **500 gold**, and no collected keys. The class
  gate is open, ready for the owner to collect its key.

### Findings and limits

1. **Fixed:** pale campaign headings on a light page background. The opaque
   campaign background is deployed and its updated desktop/phone screenshots
   were inspected.
2. **Watch item:** the first live combat run timed out after 35 seconds waiting
   for the four-second answer-feedback transition. Later provider alarms showed
   the room continued, but the cause of that delay was not established. The next
   wild fight and the subsequent guardian sequence progressed. No server timing
   fix or claim of reliable latency under load is made here. If owner playtesting
   repeats this, capture the session/phase/time before changing combat rules.
3. **Test driver corrected:** it incorrectly required an `enemy_ai` snapshot
   after every player resolution. Valid empty playback can advance straight to
   the next question. Following actual saved state transitions completed the
   guardian; no gameplay change was needed for this harness error.
4. **Balance remains open:** a solo level-one healer using basic attacks is slow
   against the guardian. Gather owner feedback on question count and job choice
   before tuning enemy HP or adding party support.
5. Defeat/zero-HP inn recovery, duplicate combat settlement and authorization
   isolation have migrated automated coverage. This live run did not intentionally
   cause a full party defeat, simulate outages/load or interact with signed-in
   live screens in a browser. Do not equate it with those separate gates.

## Scope

This validates a solo one-cave pilot. It does not certify multiplayer matchmaking,
transport gates, other biome art, teacher-assigned loot chests, random tier-gear
boss rewards, production load, or physical Chromebook performance. See the
[playtest guide](../CAMPAIGN_PLAYTEST.md) and
[development roadmap](../CAMPAIGN_DEVELOPMENT_ROADMAP.md).
