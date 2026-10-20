# One-dungeon campaign pilot

**IMPLEMENTED / ISOLATED PREVIEW DEPLOYED — owner authorized October 20, 2026.** Branch:
`feature/campaign-pilot`. This is a separately requested campaign pilot; C12
continues on its own branch. No production merge, migration, or deployment is
included in this development request.

Play the [isolated preview and follow the walkthrough](CAMPAIGN_PLAYTEST.md).
The classroom site has not received this pilot.

## Owner requirements added after the roadmap

- Build a test campaign with one dungeon, unlocks, exploration, and town services.
- Carry current HP between campaign encounters. Starting another encounter does
  not automatically heal the student.
- Provide an exploration menu for the current job's healing abilities and
  consumables.
- Include an inn where students can change jobs.
- Include separate weapon and armor shops.
- Generate a quest giver for every required campaign unlock.
- Owner playtest follow-up: immediate movement feedback and in-adventure equipment
  changes showing only currently usable owned gear. Workshop the placeholder UI
  before visual acceptance.

These requirements extend [the campaign roadmap](CAMPAIGN_DEVELOPMENT_ROADMAP.md).
Existing classroom fights retain their current independent encounter resources.

## Pilot scope

The first implementation uses one teacher-owned quiz and one active guild,
a saved generated overworld and cave, and a named dungeon key controlled by the
teacher. A generated quest giver represents each configured gate and explains its
requirement; teacher-granted availability does not imply an invented automatic
academic objective. The teacher can open the gate for the class.

The campaign is created explicitly by a teacher; it never seeds production test
students or content. Quiz selection uses the teacher's real authored quizzes,
guild filtering, and name search. Use a frozen content version for active
encounters. The world has an inn, separate equipment shops, a dungeon entrance,
and a quest giver per required unlock.

Campaign resource state is separate from permanent earned progression and
classroom combat. Combat outcomes are settled from the server's saved combat
state, not browser-supplied HP. Opening a second tab, refreshing, or replaying a
completion must not replenish HP or duplicate rewards. During a campaign
encounter, town/menu mutations are unavailable. Job changes use existing unlock
and loadout rules and do not implicitly restore HP.

Only existing supported healing actions with defined healing amounts and costs
can appear in the exploration menu. Consumable use must spend an actual saved
charge. For this prototype, a separate free inn-rest action restores HP/MP and
the existing five healing charges. Defeat returns the character to town at zero
HP, where rest is required. These are pilot tuning defaults, not settled economy
design. Job changing alone never restores resources. Shops use existing prices.

The pilot must make limitations visible: one dungeon/theme initially, and
campaign boss matchmaking/party exploration remain separately tracked roadmap
packages unless actually implemented and verified in this branch. Do not label
the full CAM-00 through CAM-09 roadmap complete after shipping this slice.

## Verification

- Permissions: teacher ownership and active guild membership at creation/access.
- Generation: saved layout, reachable town/dungeon, gates and generated NPCs.
- Encounters: unlocked content only, repeatable question stream, authoritative HP
  handoff and result settlement, no parallel adventures for the same state.
- Services: town-only job/shop actions, existing job and item restrictions,
  persistent consumables, safe health normalization after job changes.
- Recovery: reconnect, stale requests, duplicate completion, and zero-HP handling.
- UI: teacher creation/access controls and student map/menu/services on desktop
  and phone-sized layouts.
- Existing classroom regression suite and additive migration verification.

## Checkpoint

Implemented in [PR #81](https://github.com/Orsnoire/FightSchool/pull/81):
teacher creation/access controls, saved maps, movement and discoveries, zero to
three named key keepers, normal cave entry/exit and guardian, wild encounters,
server-saved HP/MP/charges, field healing, inn rest/job changes and both shops.
See [active work](ACTIVE_WORK.md) and the live PR for the exact tested head and CI.
No production migration, merge, deployment or live acceptance has occurred.

Runtime `e9e241329c860cc45b3394b38cf3bef972f8397e` passes all 329 automated
tests, TypeScript and both builds in [CI](https://github.com/Orsnoire/FightSchool/actions/runs/39450683377).
The [browser acceptance job](https://github.com/Orsnoire/FightSchool/actions/runs/39450683813/job/118724352599)
passes campaign setup, gates, recovery, inn, shops and resume at 1366×900 and
390×844. Server integration uses a disposable migrated PostgreSQL instance;
browser interaction uses API fixtures. Production load and live campaign
acceptance are not established by those tests.

## Test walkthrough

1. As a teacher, open **Campaigns** from the dashboard. Choose an active guild
   and an owned quiz with questions; use the guild/name filters if needed.
2. Generate the campaign. Required key names each create a keeper; blank keys
   create an open dungeon. Initial gates are closed. Open them when ready.
3. As a student in that guild, open **Campaigns** from the lobby and enter the
   adventure. Use arrow buttons/WASD or click an adjacent tile. The layout and
   explored tiles survive refreshes.
4. Walk beside a `!` keeper and collect its key after the teacher opens the gate.
   A closed gate excludes the cave's quiz from future overworld encounters;
   opening the gate and collecting keys includes it before the cave is cleared.
5. Visit `I` to change to an unlocked campaign job or rest. Weapon (`W`) and armor
   (`A`) shops use existing tier-1 inventory and prices. Purchased gear joins the
   student's inventory. The adventure **Equipment** panel changes the current
   campaign job's saved loadout and shows only usable owned gear (including
   permanent starters), filtered by effective level, job, slot and hand pairing.
6. Leave town and enter `D`. Wild encounters sample up to two quiz questions;
   the cave guardian samples up to five. The existing engine repeats the sample
   until the encounter ends. All pilot encounters are tier 1, capped at level 4.
7. Finish or leave an encounter, then return to the adventure. Remaining HP,
   MP and consumable charges carry over. Defeat returns to town at zero HP;
   walk to the inn and rest. Refresh/reconnect resumes an active encounter.

## Explicit pilot limits and extension points

- Single-player exploration and a solo guardian exercise the loop. This is not
  the planned matchmade boss: the decided minimum tank/healer/DPS party and cap
  of eight remain CAM-05/06 work.
- One normal-cave theme with code-rendered map tiles and the existing combat
  scene. Dedicated biome tilesets/backgrounds, transport gates, larger campaigns,
  assigned loot chests and encounter-tier authored gear rolls remain roadmap work.
- Existing XP/gold result rules apply; no random classroom fallback loot is
  injected. Key givers represent teacher-controlled unlocks, not automatic
  academic quest completion. More elaborate quest objectives remain open.
- Campaigns freeze quiz content at creation. Existing encounters keep their
  snapshot if a teacher closes a gate mid-fight; future encounters use current
  access. Updating a campaign's content/version is a later authoring feature.
- Campaign jobs/resources are isolated from classroom entry resources. Healing
  shows only supported, unlocked current-job/cross-class actions; crafting,
  revival and combat cooldown actions do not become free menu actions.
- Migration `0018_campaign_pilot.sql` adds three tables and two Worker-owned SQL
  functions. Apply it through the normal reviewed release workflow. No fixture
  users, campaigns or authored questions are seeded into production.

## October 20 playtest follow-up — movement, equipment and UI

The original screen waited for every movement request and rebuilt the combat
profile twice per step. The follow-up predicts legal movement locally, buffers
at most eight unconfirmed steps, and sends queued steps as bounded paths. The
server validates every tile and stops at the first encounter. Local walls and
collision checks remain immediate; teacher gates, HP, battle outcomes, gold and
rewards remain authoritative on the server. Polling cannot overwrite pending
movement. A conflict or connection error clears queued input and reloads saved
state. An encounter stops travel and opens the existing combat screen.

The action response reuses its already-validated combat profile when job/loadout
revision still matches, avoiding the second rebuild. This is responsiveness work,
not an offline or client-authoritative combat mode.

Equipment is available throughout exploration and locked during combat or pending
movement. Selections use the current campaign job and tier-1 effective level cap;
other-job, unowned, too-high-level and incompatible hand-pair choices are hidden.
The server applies the same eligibility checks. Changes save to that job's loadout,
including the character's active slots when it is also the classroom job, without
changing the classroom job. HP/MP clamp to new maxima but never refill. Remove an
incompatible off-hand item before changing weapons. Migration 0019 updates only
the existing atomic campaign action routine; it does not rewrite migration 0018,
reset progress, or add fixture data.

### UI workshop — pending owner review

The owner specified a 16-bit-era FF/DQ visual direction and supplied map/tileset
references. See [campaign art direction](CAMPAIGN_ART_DIRECTION.md).

The current tiles, map layout and sidebar are a mechanics prototype, not the final
UI. Workshop the exploration screen before visual acceptance. Proposed direction:
a map-first screen with a larger exploration viewport, compact HP/MP/job status,
and equipment, healing, quests and services opened when needed. Review map scale,
movement feedback, service discoverability, keyboard/touch controls and desktop/
phone layouts together. Biome artwork and the environment bestiaries remain in
CAM-08; this proposal does not approve a final layout or asset style.
