# One-dungeon campaign pilot

**IN DEVELOPMENT — owner authorized October 20, 2026.** Branch:
`feature/campaign-pilot`. This is a separately requested campaign pilot; C12
continues on its own branch. No production merge, migration, or deployment is
included in this development request.

## Owner requirements added after the roadmap

- Build a test campaign with one dungeon, unlocks, exploration, and town services.
- Carry current HP between campaign encounters. Starting another encounter does
  not automatically heal the student.
- Provide an exploration menu for the current job's healing abilities and
  consumables.
- Include an inn where students can change jobs.
- Include separate weapon and armor shops.
- Generate a quest giver for every required campaign unlock.

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
charge. New recovery prices, automatic resurrection, and shop restocking rules
are not assumed. The inn's explicitly requested service is job changing.

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

Planning/claim only. No campaign code or migration has been implemented yet.
Next: implement domain contracts, persistence and authenticated route boundaries,
then exploration/services and combat integration; publish small checkpoints.
