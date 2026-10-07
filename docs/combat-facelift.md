# Combat facelift

Vision captured October 1, 2026. This is a presentation direction and exploration
brief, not an implemented combat layout. It follows [Source of Truth](Source_of_Truth.md),
the [avatar art direction](avatar-art-direction.md), and the current
[student combat overlays](combat/student-overlays.md). Combat calculations,
target eligibility, timers, and player progression remain server-authoritative.

## The intended experience

Replace the plain white combat backdrop with a biome scene. Start with a default
grassland: distant mountains and sky, with trees behind the player formation.
The terrain should frame the characters and leave ample clear ground for combat.
Avoid dense foliage, strong foreground objects, or high-contrast detail competing
with sprites, effects, nameplates, and target indicators.

The scene should feel populated by the people actually in the encounter. A solo
character or duo is substantially larger on screen than a five-player group,
and much larger than a classroom of roughly thirty. As players join, existing
characters move and scale smoothly to make room. The formation should feel
natural and roughly semicircular, reaching toward the midpoint of the field.

## Scene composition and facing

Treat these proportions as approximate art targets within the available combat
scene, after reserving essential HUD space. Responsive layouts still need review.

| Region | Intended use |
| --- | --- |
| Upper third | Sky, distant mountains, and background depth |
| Lower two thirds | Mostly open battlefield, with ground contact and room for movement/effects |
| Left half of battlefield | Player sprites facing screen-right, with trees behind their formation |
| Right half of battlefield | Enemy sprites facing screen-left and their action space |
| Midfield | Visual encounter boundary and space for attacks/projectiles to read clearly |

The owner confirmed the side assignment on October 1: **players left, enemies
right**. This supersedes the reversed split in the initial description. The
current Human combat reference already faces screen-right toward the enemy side.
Up to four players begin in a column on the left. If any future view is mirrored,
preserve anatomical equipment ownership and intended draw order; do not silently
swap the equipped sword and shield between hands.

## Population and sprite scale

The first layout study should compare 1, 2, 4, 5, 10, 20, and 30 players in the
same scene. The owner has proposed a single column for up to four players, then
a broader formation for five or more. Existing characters should reposition
when the formation expands, including the four-to-five transition.

Suggested study targets, pending visual approval:

| Population | Formation to test | Visual priority |
| --- | --- | --- |
| 1–2 | One or two prominent figures on the player side | Readable equipment, expressions, and full motion |
| 3–4 | A shallow column with depth spacing | Keep silhouettes distinct without making everyone tiny |
| 5–12 | Two or more staggered curved rows | Expand naturally toward midfield |
| 13–20 | Wider semicircular formation with additional depth | Preserve targeting and prevent dense overlap |
| 21–30 | Compact semicircle using the player half effectively | Distinct feet, selected-player emphasis, readable identities |

Choose scale from the usable formation bounds and sprite footprints, with
continuous interpolation and approved minimum/maximum sizes. Do not simply use
`1 / playerCount`; thirty characters must remain recognizable. Account for tall
hats, wide weapons, shields, labels, and animation overshoot. Perspective may
make rear rows slightly smaller, but the population-driven scale change should
be clearly stronger than that subtle depth cue.

On a narrow viewport, shrinking everything indefinitely is not acceptable.
Review a responsive composition with compact labels and an accessible party
roster for selection; decide any alternate framing with the owner before release.

## Formation approach to prototype

The owner suggested a Fibonacci spiral as one possible way to fill the field;
the exact pattern is open. Begin by comparing **staggered curved rows clipped
to a semicircle** with a **clipped golden-angle distribution**. The first is the
recommended initial prototype because its rows and spacing are easier to tune
for visible faces, feet, and equipment. A golden-angle pattern may provide more
organic distribution, but needs explicit exclusion zones and overlap checks.

Keep positions slightly irregular only when it improves the composition. Any
variation should be deterministic, so the same roster does not reshuffle on
every render or reconnect. Maintain stable player identities and slot assignments;
when the slot set changes, prefer nearby new positions and minimize unnecessary
crossings. Do not sort the formation by rapidly changing HP, threat, or damage.
Those values may sort a target list without moving everyone's avatar.

Measure overlap with sprite and equipment footprints, not just anchor points.
Ground anchors determine depth sorting, with explicit exceptions during an
approved action. Keep the formation within its own battlefield half; provide
space for weapons and action effects near the central boundary.

## Joining and repositioning

1. Derive the target layout from the authoritative roster and current viewport.
2. Match existing players to stable or nearby slots; allocate a slot to the joiner.
3. Animate existing ground positions and overall scale together toward the new
   layout. Start by testing a gentle 400–800 ms transition, then tune by review.
4. Introduce the joining character without a large flash or an abrupt roster-wide
   jump. The precise entrance gesture is a later art choice.
5. If another join arrives mid-transition, continue from the currently displayed
   positions toward the newest target layout rather than snapping back.

Layout movement belongs to the outer character transform. Idle, attack, and
equipment motion remain local to that character's rig. Formation transitions
must not alter target IDs, replay attacks, restart questions, or extend deadlines.
Avoid moving a target under a pointer during a selection: keep the existing
stable target controls authoritative and design any direct-sprite targeting
explicitly. Reduced motion should settle immediately with a restrained appearance
change rather than animate the entire class across the field.

Do not remove or reshuffle a character merely because they are KO'd. A reconnect
should restore that player's identity and place. Define genuine departure and
late-join presentation from the server roster rules; this document does not
change who may enter a running encounter.

## Relationship to overlays and animation data

The battlefield remains mounted behind the centered question, action, waiting,
and resolution dialogs. Keep those dialogs, their keyboard behavior, resource
visibility, and target selection usable over the illustrated background. This
facelift does not remove the approved overlay flow. How much the scene dims,
and when an action needs an unobscured stage, require a visual pass that preserves
the current phase and timer contract.

Use the reusable rig and animation clips from the avatar workflow. GIFs are
review exports only. A scene requests an animation by ID, chooses equipment and
appearance, and places the character with an outer transform. Character creator,
equipment preview, and combat can reuse the same underlying assets and clips.
Visual impact markers synchronize presentation of resolved outcomes; they never
apply damage or spend resources themselves.

## Next review and acceptance

- Preserve the confirmed player-left/enemy-right split and inward-facing sprites.
- Approve one grassland composition with explicit clear battlefield bounds.
- Compare static layouts at all seven population sizes, including weapon clearance.
- Review animated 1→2, 4→5, 10→20, and 20→30 transitions, rapid joins, departures,
  reconnects, and window resizing. Existing characters should travel smoothly
  without crossing excessively or losing their identities.
- Verify selected-player emphasis, name/HP readability, keyboard targeting,
  reduced motion, and the centered dialogs on Chromebook and phone viewports.
- Measure a thirty-character scene with representative equipment and effects
  on target classroom devices before selecting a performance budget and release.

Biome art, final positions/scales, formation algorithm, and entrance choreography
are not yet approved. This brief records the direction
without beginning live combat integration or bypassing the avatar readiness gate.

## October 5 static-first sequencing

The owner now permits front-facing static starter avatars before animations.
Combat snapshots may carry saved appearance and the current board may display
those static starters without changing phase timing, damage resolution, player
positions or the centered overlay flow. This does not approve the proposed new
biome composition or formation algorithm. Keep that scene's 1/2/4/5/10/20/30
player, transition and classroom-device checks as a separate implementation gate.
Static starter ownership and off-hand rules are in [starter wardrobe](starter-wardrobe.md).

## October 7 battlefield and participation approval

The owner approved implementation of the static battlefield: full-width grassland,
players left and enemies right, stable curved formations, saved starter avatars.
This supersedes the earlier no-integration gate and centered waiting modal.
Student self avatars have a consistent foreground size and a private resource HUD;
other avatars show HP only when damaged. Enemy HP remains visible overhead.
Names appear on hover/focus/selection. Threat retains its crown; the highest
cumulative actual damage receives a star (incumbent wins ties; no zero-damage star).
KO players keep their place. Static front-facing art remains approved; this is
not an approval of unfinished animation rigs. Narrow screens retain left/right
sides, a prominent self avatar and an accessible party roster for inspection.

The host keeps the control banner, a collapsible current question, a movable,
resizable/minimizable in-page log, and fullscreen of the complete combat view.
KO resurrection remains available; a separate hover/focus red circled X removes
an active or queued participant after confirmation. Removed accounts must request
host approval to return. Allow, Deny, and Block future rejoin requests apply only
to this room; one outstanding request per student and a 30-second denial cooldown
prevent dialog flooding. Moderation survives host refresh and room hibernation.

Students may join/rejoin active classroom fights by code, entering at the next
question. Reconnects retain active membership. Voluntary departures and removals
archive the student's original job, HP, resources, activity and attendance;
readmission restores them without a refill. Enemy HP does not rescale. Pending
entrants do not answer, become targets, hold up phases, or earn the current round.
KO attendance counts. A resolved question counts one round, including question
cycles; each active participant receives one round of attendance at resolution.
An absent student receives no result unless they return before completion.

Completion base XP and victory gold use attended/resolved rounds; activity XP
is not prorated. Host-ended base XP additionally uses the fraction of combined
enemy starting HP depleted. Defeat grants only activity XP; early host ending
does not newly grant victory gold or loot. Zero-round entrants earn no reward,
loot, or stamina charge. Stamina applies afterward, preserving fractional XP.
Migration 0010 widens the existing XP audit field and award function input;
no saved students, historical results or existing XP are reset.
