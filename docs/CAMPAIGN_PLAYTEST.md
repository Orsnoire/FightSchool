# Campaign pilot playtest

> October 27 compatibility reconciliation is **review-only and not deployed**.
> The preview still runs the October 21 build. Before a future authorized release,
> follow the [current release-safety procedure](reviews/2026-10-28-campaign-release-safety.md).
> Legacy preview migration numbers below describe the historical release; canonical
> campaign numbers are now 0020–0024 after production AA 0018 and roster 0019. Do not apply the
> standard migrator to the legacy preview before its guarded bridge. No reset is needed.


Preview: https://questacademy-campaign-preview.coxsonator.workers.dev/

This is the isolated PR #81 preview, with synthetic accounts and its own database,
object bucket and combat rooms. Use the playtest credentials supplied in the
owner conversation. Classroom credentials and progress do not transfer here.
Credentials must not be committed to this repository.

## Play as a student

1. Open the preview, choose **Student**, and sign in as **CampaignTester**.
2. Choose **Campaigns**, then **The Lantern Key**, select **Enter adventure**.
3. Use the on-screen movement arrows, keyboard arrows/WASD, or adjacent map tiles.
   Walk beside **!**, the Lantern Key Keeper, and select **Collect key**.
   The teacher gate is already open; the student still needs to collect the key.
4. Walk beside **I** to see Hearthlight Inn. **Rest at the inn** restores HP, MP
   and five healing charges. The **Campaign job** menu changes jobs. Switching
   jobs alone does not heal. Try **herbalist** to expose Healing Potion in the
   adventure menu; return to warrior if preferred. Rest after switching for a
   full resource bar.
5. Visit **W** and **A** to try the separate weapon and armor shops. This character
   starts with **500 gold**. Purchased equipment goes into inventory; existing
   job/level equip requirements still apply. Open **Equipment** in the adventure menu to change gear. Only owned gear
   usable by your campaign job and effective level appears. Tier 1 equipment
   requires job level 2; purchased gear stays hidden until usable.
6. Follow the path east to **D** and select **Enter Lantern Cave**. Random battles
   can interrupt exploration. Answer questions, select actions/support and ready
   up through the normal combat screen. Use **Return to adventure** after battle.
7. Check that remaining HP, MP and charges carry back to the map and into the next
   battle. Heal from the adventure menu, or return to town and rest.
8. Reach **◆** in the cave and select **Challenge guardian**. The quiz keeps
   supplying questions until the guardian is defeated. Check that the cave stays
   cleared after refreshing.

Services appear when standing on or next to their marker. On a narrow screen,
they appear below the map. **Return to town** is available outside combat;
**Resume encounter** returns to an unfinished battle. At zero HP, walk through
the safe town to the inn and rest.

The prebuilt quiz contains ten short math warmups so the mechanics are easy to
inspect. It is synthetic test content, not an authored ACT curriculum campaign.

## Try the teacher controls

Use a separate/private browser window and choose **Teacher**. Sign in with the
supplied `campaign-teacher@example.invalid` playtest credentials. Open
**Campaigns**. Close/open **Lantern Key** and refresh the student campaign to
observe access and the overworld question pool. A closed gate removes that
quiz's questions from future encounters, even if the student already owns its
key; an encounter already in progress keeps its frozen question set.

The teacher has one guild, **Campaign Playtest**, and one owned quiz,
**Lantern Cave — Math Warmup**, available in the campaign creator. Creating
another campaign generates and saves another stable overworld/cave layout.

Teacher and student use the same cookie name on this preview, so logging in as
both in one browser profile replaces the other session. Separate/private windows
avoid that confusion.

## What to judge

- Can you find the keeper, inn, shops and cave without outside explanation?
- Does movement feel immediate, including several quick steps? It should stop at
  walls and encounters, show saving status, and recover after a lost connection.
- Can you change usable equipment without leaving the adventure? Are services
  and battle-return controls obvious?
- Does persistent damage make healing and the inn useful without becoming tedious?
- Does the guardian require an appropriate number of questions, for each job?
- Does teacher gate control match how you would pace an instructional unit?

This build is a **solo, one-cave mechanics prototype**. The simple map tiles are
placeholder presentation. Cooperative movement, 3–8-player matchmaking with
role requirements, transport unlocks, other biomes, teacher-assigned loot chests,
and tier-specific random gear rewards remain in the
[development roadmap](CAMPAIGN_DEVELOPMENT_ROADMAP.md).

Verification and preview scope are recorded in
[the October 20 playtest report](reviews/2026-10-20-campaign-playtest.md).

Movement and equipment follow-up: [verification and remaining limits](reviews/2026-10-20-campaign-movement-equipment.md). Refresh the page to load the updated controls. The FF/DQ visual workshop is specified in [campaign art direction](CAMPAIGN_ART_DIRECTION.md).

## October 21 item shop follow-up — live on the preview

The item shop, consumable menus and combat publication update are deployed.
[Deployment](https://github.com/Orsnoire/FightSchool/actions/runs/39644095594) and
authenticated QA checks pass; the owner subsequently reported the preview working.
See [active work](ACTIVE_WORK.md) for the exact runtime and verification status.

Refresh the page and walk east within town to **S**. Buy a Potion, then
open **Items** in the adventure menu to see its quantity and bag weight. Use it
when injured. Try a protection item before a battle and check the remaining
turns. Combat Items are available during questions and before Ready; status cures
can be used while disabled. Bought items never refill at the inn. See
[all eight effects and prototype defaults](CAMPAIGN_CONSUMABLES.md).

## Resetting your adventure — live on the preview

Refresh the student campaign lobby. **Reset campaign** appears beside **Enter adventure**.
Open it to review the confirmation; **Cancel** leaves the adventure untouched.
Confirming restarts only your progress in that campaign: explored locations,
collected campaign keys and dungeon completion clear; you return to town with
full HP/MP and starting job charges. Active item protections end.

Your current job, levels, XP, gold, equipment and purchased consumables remain.
The saved map, teacher gates, academic records and other students are unaffected.
Finish or leave an active encounter before resetting. This is an explicit personal
restart, not procedural map regeneration; refreshing or deploying does not reset
anyone. [Deployment and verification](reviews/2026-10-21-campaign-reset.md) pass;
owner acceptance is pending. Check [active work](ACTIVE_WORK.md) for the runtime.

## Boss stamina reward — live on the preview

After a guardian victory, the saved result shows the stamina restored. Each win
adds 20 percentage points to post-fight stamina, capped at 100%; the visible
amount can be smaller near full. The winning fight uses its ordinary XP rate;
recovery benefits your next fight. Check the stamina bar in combat or the main
lobby. Ordinary enemies and losses do not grant this bonus.

This applies to repeat boss victories as well. The pilot remains solo: use Reset
campaign for another complete run; direct/random boss matchmaking is future work.
See [active work](ACTIVE_WORK.md) and [boss stamina evidence](reviews/2026-10-21-campaign-boss-stamina.md) for release details.
