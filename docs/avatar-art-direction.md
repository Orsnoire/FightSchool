# Avatar art and animation direction

This guide defines how QuestAcademy produces reusable Human avatars through
visual direction, iterative art review, and technical implementation. It covers
the male and female base models, skeletons, equipment, and animations required
for the static-first release and subsequent animated release.

The product owner describes and approves the appearance and motion. The
implementer translates that direction into image layers, rigs, attachment
transforms, animation data, previews, and tests. The owner does not need to
supply artwork, joint coordinates, or code.

## Authority and scope

The pre-integration requirements below were specified on September 30, 2026.
Follow [Source of Truth](Source_of_Truth.md) for conflicts. This guide controls
avatar presentation and production workflow, not ability mechanics, equipment
stats, ownership, or unlock rules. The Expanded Class List controls job design;
Core Guild Design controls equipment progression. Repository catalogs provide
implementation IDs and must be checked against those designs.

The initial art scope is Human male and female for Warrior, Wizard, Scout, and
Herbalist. Additional species and advanced-job outfit collections are separate
work. An advanced-job ability legally equipped on a base job still needs an
explicit coverage decision before integration; do not silently hide it or
change its unlock rules to fit the available art.

Technical conventions and job outfit motifs in this guide are working defaults
to validate in the first prototype. They are not claims that the corresponding
art has been approved or implemented.

## October 5 static-first release

The owner's October 5 direction allows non-animated, front-facing avatars to
ship before the animation collection is complete. The earlier September 30
all-animation prerequisite is superseded **only for this static release**.

| Job | Clothing and headwear | Character's right hand | Character's left hand |
| --- | --- | --- | --- |
| Warrior | Steel/blue starter armor; Imperial Italic helmet with blue detail | Sword | Shield; hand hidden behind it |
| Wizard | Grey linen robe; purple conical hat | Staff | Empty |
| Herbalist | Grey linen robe; gold filament/green leaf laurel; leather belt and green herb pouch | Herbs | Potion |
| Scout | Brown leather armor; matching rake's/Robin Hood cap; quiver over anatomical right shoulder | Free to draw arrows | Bow |

Use the approved face-on head identity and the existing independent palettes.
Both body models and all four outfits require review. Job controls in the
workshop, creator and job-change screen use the latest shared appearance;
returning to an earlier job must never restore stale colors. Initial channels
randomize independently once and are explicitly saved. An initial retry or
reconnect must preserve the saved choice.

October 5 review feedback accepts the starter outfit designs while requesting
fit corrections. Review 02 uses a continuous, palette-matched neck and upper
chest between the back collar and its front lip. The hidden lower neck has no
closing outline. Each of the four kits and all empty-handed armor variants
has its own collar edge for each body. The Imperial helmet brow band sits just
above the eyebrows; the scout cap sits slightly higher. Helmet rear neck flares
render behind the head, with brow band and cheek plates in front. Crown hair
is contained by these closed hats; the visible fringe and side hair remain.
The Wizard brim split is retained. Review 03 centers the female Warrior and
Wizard bodies beneath the shared neck after comparison with Scout and Herbalist:
Warrior moves 14 reference pixels left and Wizard 16 right. Their existing
collar masks follow the body. The owner approved review 03 and authorized live deployment on October 5, 2026.
This approval covers the static collection; the animated integration gate remains separate.

The static sheets under `static-starters-v1` are workshop candidates, not
approved production rigs. Their body clothing/props are combined starter art;
headwear and the existing head/masks are composited separately. Arbitrary
item-by-item equipped visuals require further segmentation and fit work. Label
the current displayed look as starter appearance. Do not imply new custom-gear
art or animation coverage exists.

Static release signoff requires eight fitted looks, light/dark palette and
occlusion checks, authenticated saved-appearance tests, permanent starter
ownership/compatibility review, migration verification and classroom browser
acceptance. The owner's later October 5 direction removes every placeholder job
portrait: all twelve jobs reuse the starter armor for their armor type. Known
weapons reuse their fitted starter look; unfinished weapons use empty hands in
the original face-on rest pose. These missing visuals do not remove an equipped
item's gameplay stats. The new combat formation/scenery work remains its own acceptance
track. See [workshop publishing](workshop-routing.md) and
[starter wardrobe](starter-wardrobe.md).

## Required before animated integration

All five requirements below remain mandatory for the later animated release.
A successful single-character prototype does not approve an incomplete animation collection.

| Requirement | Required coverage | Completion evidence |
| --- | --- | --- |
| Skeleton-connected bases | Male and female, front and right near-profile views | Segmented parts, bind poses, connected joint hierarchy, deformation previews |
| Rigging hooks | Both models and all supported equipment slots | Calibrated attachment transforms, hand grips, effect anchors, draw order |
| Starting gear | Four jobs × two body models | Eight fitted starter kits, each reviewed in both views |
| Signature job gear | Four jobs × two body models | Eight fitted signature kits, each reviewed in both views |
| Ability animations with currently unlocked weapons | Every in-scope ability and legal weapon combination on both models | Complete coverage register and approved moving previews with starter and signature kits |

This means at least sixteen fitted outfit kits and thirty-two outfit/view
compositions to review, not thirty-two unrelated flattened character paintings.
Parts and clips may be shared when their fit and behavior have been verified.
Signature gear is the visually distinctive “awesome stuff”; preparing its art
does not grant it to players or decide its acquisition tier.

As of this guide's creation, four approved assembled source images, twelve
color masks, four neutral bases, palettes, and an avatar database foundation
exist. Segmented bodies, calibrated rigs, finished gear kits, and animation
clips do not. Live avatar integration remains pending. See the
[asset catalog](../attached_assets/characters/human/v1/README.md),
[recoloring contract](../attached_assets/characters/human/v1/recolor/README.md),
and [database specification](avatar-database.md).

October 1 checkpoint: the
[male combat rig workshop](../attached_assets/characters/human/rig-prototype-v1/README.md)
implements the first isolated prototype with starter/armor swaps, idle, sword
attack, and shield raise. Its GIFs are review exports of reusable rig/clip data.
It awaits visual approval and does not satisfy the full pre-integration gate.

## Visual identity

- Preserve the approved chibi proportions, large expressive eyes, clear black
  pen contours, simple shading, and readable silhouette. Measure proportions
  from the approved source art when building the rig; do not invent a new ratio
  independently for each generated part or outfit.
- Keep male and female models compatible in scale and joint structure. Retain
  modest, distinguishable body contours beneath clothing, including the approved
  female torso contour. Use equivalent coverage and practical gear for both.
  Avoid exaggerated anatomy, sexualized poses, or revealing armor.
- Reconcile the female front torso with the approved combat reference before
  approving the final segmented model; the original front art predates that
  adjustment. Preserve the original files as references.
- Preserve the front view and approximately 80-degree screen-right combat
  direction. The angle is an art target, not a measured 3D rotation. Author and
  calibrate each view separately. A turn between them needs additional art.
- Hair, irises, and skin remain independent natural-tone channels with eight
  options each. Randomize each once at initial creation, then persist choices.
  Never reroll on render, equipment change, animation, or job change.
- Keep ink, pupils, eye whites, and highlights out of color masks. Hair color
  includes eyebrows. Newly exposed skin and replacement hand drawings need
  matching masks. Any garment tinting uses separate channels, if later approved.
- Judge silhouettes, expressions, and effects at actual game display size as
  well as source resolution. Equipment must not obscure essential expressions
  or make actions unreadable. Communicate effects by shape and motion as well
  as color; avoid strobing and provide reduced-motion presentation.

Starter gear should look simple but intentional. Signature gear should add job
identity through silhouette, materials, motifs, and restrained effects while
keeping the same pen-art language and body proportions.

## Segmentation and rig contract

The approved PNGs are assembled concepts, not runtime puppets. Separate body,
hair, clothing, and equipment. Reconstruct hidden overlap at shoulders, elbows,
wrists, hips, knees, ankles, and beneath garments so movement reveals no holes.
Use a modest neutral underlayer for unequipped areas; hidden technical body
parts are not a player-facing unclothed mode.

Keep head, neck, torso, pelvis, left/right upper arms, forearms, hands, thighs,
shins, and feet independently addressable. Split front/back hair and garments
where motion or overlap requires it. Tunics, pants, boots, gloves, and armor
must be removable layers rather than permanent paint on the body. Replacements
need explicit coverage rules to hide the covered body or starter garment;
do not stack two incompatible outfits and hope the upper one conceals the lower.

Use the existing `human-chibi-v1` rig family and seeded bone names in
`avatar_model_slots`. A ground-root controls character placement; pelvis and
torso connect the leg, arm, neck, and head chains. Share semantic bone names
across models, with separately calibrated rest transforms and fitted artwork.
Do not stretch one body model into the other or assume identical pixel pivots.

Distinguish three concepts:

- **Bind pose:** the technical arrangement in which parts and equipment align.
- **Rest pose:** the visible standing pose for a view and equipped loadout.
- **Idle animation:** small looping movement around that rest pose.

Working authoring convention: retain the 1024 × 1536 reference canvas, origin
at its top-left, positive X right, positive Y down, and clockwise-positive
rotation in degrees. Bone transforms are parent-relative. Record each part's
canvas offset, pivot, scale, and parent; cropped exports must retain offsets.
Specify the ground-root coordinates and reference pose in the rig file before
authoring equipment. A different runtime convention needs an explicit export
conversion, not an implicit flip or scale.

Technical acceptance requires stable bone IDs, valid parents without cycles,
documented rotation limits, closed seams across the approved motion range,
planted feet where intended, and deliberate near/far layering. Shared clips
must be reviewed on both bodies; per-model corrections are allowed.

## Equipment and effect hooks

The database reserves eighteen slots: head, neck, torso, pelvis; left/right
upper arm, forearm, hand, thigh, shin, and foot; and separate left/right grips.
Use anatomical sides consistently. Near/far is view-dependent draw order and
must never silently swap the player's equipped hands.

Each attachment needs its model, view, rig version, parent bone, local position,
rotation, scale, draw order, and covered regions. Gloves and held items coexist.
A multi-part outfit maps to all covered slots and is equipped atomically;
visual slots do not independently grant gameplay stats.

| Hook or constraint | Purpose |
| --- | --- |
| Left and right hand grips | Sword, staff, bow, herbs, potion props, shield |
| Secondary hand target | Maintain two-hand contact with bows or other approved two-hand poses |
| Item-local tip or release point | Sword trail, staff spell origin, arrow departure, potion release |
| Head and torso anchors | Headgear, status and casting presentation |
| Ground and target anchors | Contact shadows and resolved impact effects |

These effect hooks are planned rig/item metadata, not existing database columns.
Grips use the seeded hand bones. Add item-local anchors and any extra rig bones
only through a versioned asset contract. Hand drawings may switch between open,
gripping, casting, and bow-drawing poses without changing character proportions.
Define attached, stowed, released, and restored prop states where necessary.

Warrior blocking and Shield Bash need an approved shield representation.
The current gameplay catalog does not define a separate shield weapon item.
Decide whether the shield is a persistent kit component or an ability prop
before finalizing that kit; do not invent an inventory grant or DEF bonus.

## Job equipment direction

The weapon mapping below is the current implementation baseline from
[`shared/schema.ts`](../shared/schema.ts), not proof of any player's unlocks.
The clothing directions are proposals for visual review.

| Job | Current weapon family and starter ID | Starter direction | Signature direction |
| --- | --- | --- | --- |
| Warrior | Sword, `basic_sword` | Steel/blue armor, Imperial Italic helmet, sword and shield | Distinctive armor silhouette, bold trim, coordinated blade and shield presentation |
| Wizard | Staff, `basic_staff` | Grey linen robe, purple conical hat and staff | Layered arcane garments and a recognizable staff focus |
| Scout | Bow, `basic_bow` | Brown leather kit, rake’s cap, bow and right-shoulder quiver | Fitted ranger-like gear, bracers, quiver, distinctive bow |
| Herbalist | Herbs, `basic_herbs` | Grey linen robe, laurel, herbs, potion and green herb pouch | Apothecary kit with recognizable botanical motifs and potion tools |

Create and fit each approved kit for both bodies and both views. Keep hair and
headgear compatibility explicit; avoid erasing hairstyle identity as a shortcut.
An upgrade must remain recognizable at game size without requiring more exposed
skin or larger anatomy. Choose final colors, materials, ornament, handedness,
and shield behavior through review before mass-producing variants.

Additional built-in weapon IDs to audit are `iron_sword`, `legendary_blade`,
`magic_staff`, and `steel_bow`. These are catalog candidates, not confirmed
currently unlocked weapons. Teacher-created items and guild/campaign unlocks
must also be included when applicable. Do not infer availability from rarity
or from an item merely existing in code.

## Ability and weapon coverage

At the start of an animation batch, record an explicit release inventory:
job IDs, model/view versions, available weapon item IDs and families, legal
grip configurations, ability IDs, and the rule or configuration establishing
availability. “Currently unlocked” means that agreed release inventory, not a
guess about one student's account. A player's actual choices still follow
server-authoritative ownership and unlock checks.

The production target includes all native base-job abilities through level 15;
players see only those they have unlocked. The following baseline enumerates
the required actions using current canonical implementation IDs. These are
animation briefs, not new mechanics or finalized choreography.

| Job | Ability IDs | Required visual beats |
| --- | --- | --- |
| Warrior | `warrior_block` | Raise guard, hold, receive resolved block, recover |
| Warrior | `shield_bash` | Block response and bash only when the resolved counter occurs |
| Warrior | `provoke` | Readable challenge gesture and threat presentation |
| Warrior | `crushing_blow` | Weighted wind-up, sword strike, recovery |
| Warrior | `unbreakable` | Distinct guarded stance and resolved defensive impacts |
| Wizard | `fireball` | Gather, release fire projectile, recover |
| Wizard | `frostbolt` | Distinct ice cast and projectile release |
| Wizard | `manashield` | Cast, shield appearance, absorb or expire presentation |
| Wizard | `fireblast` | Stronger fire charge and release |
| Wizard | `manabomb` | Ultimate charge, release, multi-target arcane effects |
| Scout | `headshot` | Bow draw, deliberate aim, release, recovery |
| Scout | `aim` | Focused ranged attack with a distinct timing profile |
| Scout | `mark` | Target designation gesture and mark presentation |
| Scout | `dodge` | Evade and return to a stable stance |
| Scout | `killshot` | Ultimate aim/release; impact follows the resolved outcome |
| Herbalist | `healing_potion` | Ready and deliver potion, target healing response |
| Herbalist | `craft_healing_potion` | Mix or prepare, finish, stow |
| Herbalist | `craft_shield_potion` | Distinguishable shield-potion preparation |
| Herbalist | `shield_potion` | Deliver potion and target protection effect |
| Herbalist | `potion_diffuser` | Activate diffuser and present the resolved group effect |
| Herbalist | `life_potion` | Ultimate preparation, group revive effects, ally recovery |

Also cover each job's basic attack and shared idle, ready, hit reaction, KO,
revive, and victory states. Add approach/retreat or other locomotion only when
the approved choreography uses it. Front views need fitted gear and rest/idle
presentation; combat ability clips target the near-profile view unless another
view is explicitly included in the release inventory.

Resolve cross-class aliases through
[`canonicalAbility`](../shared/combat/abilities.ts); aliases do not require
duplicate art. They do require testing on every legal receiving job/loadout.
A bowless user of Headshot or a staff-less user of Fireball cannot silently
materialize a newly owned weapon. Approve a temporary visual prop, compatible
gesture, or other presentation without altering gameplay equipment rules.

The class source lists Herbalist crafting both alongside level 1 and separately
at level 4, and does not fully define Potion Diffuser's behavior. The current
implementation exposes crafting at level 4 and defines a diffuser action.
Include both animations in the art inventory, but resolve any timing or unlock
ambiguity against product direction before binding them to live events. Do not
use this art guide to settle conflicting mechanics.

Maintain one coverage row per legal `(model, combat view, canonical ability,
weapon/loadout)` with clip ID, kit fits tested, effects, approval evidence, and
status. Parameterize shared motion by weapon geometry where useful. Different
skins may share a clip, but each item still needs grip, length, clearance, and
effect-anchor validation. Do not apply a sword swing to a bow or treat an
unreviewed generic clip as completed coverage.

## Prompt driven production workflow

1. **Brief and inventory.** Select one model/view, kit or action, reference
   versions, intended emotion, and acceptance criteria. Record unresolved
   choices. Freeze the batch's ability/weapon inventory.
2. **Approve visual references.** Generate and refine concepts against the
   approved silhouette and style. Review male/female fits side by side.
   A concept approval is not a rig or animation approval.
3. **Build the reusable base.** Separate parts and starter clothes, restore
   hidden overlap, build masks, calibrate bind/rest poses, and attach the rig.
   Test joint extremes before producing a large equipment collection.
4. **Prove one complete example.** Preview idle, one weapon action, and a gear
   swap on one model; verify the same rig contract on the second model. Review
   actual motion and seams, not just a generated keyframe sheet.
5. **Produce both equipment collections.** Complete the eight starter and
   eight signature fits, including hand poses, coverage rules, and both views.
6. **Author and review ability clips.** Start with anticipation, action/release,
   contact or resolved effect, and recovery. Add interpolation, holds, secondary
   motion, and layering. Review all required loadouts in the coverage register.
7. **Package and verify.** Save versioned source assets, runtime assets, data,
   previews, and checks. Obtain visual approval and technical validation before
   marking the collection ready for live integration.

Prompt example: “Using the approved Human combat model, keep the rear foot
planted, raise the shield to shoulder height, lean into the impact, then settle
back into guard. Preserve the head size, limb lengths, clothing, and camera.”

The implementer handles pivots, interpolation, attachment constraints, and
technical cleanup. The owner can request “less stiff,” “heavier,” “faster,” or
“keep the face visible.” Record the revision in the brief and show the changed
clip. Generated poses are references; final skeletal data and registered parts
provide repeatability. Never promise exact registration from generation alone.

## Asset delivery and runtime boundaries

Keep current approved originals immutable. New layered assets should use a
new versioned directory under `attached_assets/characters/human/`; record their
relationship to the original model and view IDs. Each release package needs:

- Part images, masks, original-canvas offsets, pivots, and source hashes.
- Skeleton hierarchy, bind/rest poses, calibrated equipment/effect hooks, and
  per-view layer order.
- Kit-to-part mappings, covered regions, compatible model/rig versions, item
  identity links, and any optional garment color definitions.
- Clip IDs, keyframe times and transforms, easing, loops, hand/prop changes,
  visual event markers, transitions, and reduced-motion alternatives.
- Coverage register, revision notes, visual approval, diagnostic stills, and
  moving previews with the exact asset versions used.

Exact rig/clip file schemas and renderer choice remain implementation work.
Choose a portable representation and validate it; this guide does not mandate
a commercial animation editor or introduce new database tables. Update
`rigPath`, `partsPath`, equipment visuals, and readiness flags only after the
referenced artifacts exist and pass checks. A database reference alone is not
proof of usable art. Do not overwrite the v1 mask geometry with a newly posed
character and retain its old hashes.

Animation presents server-calculated outcomes. A hit marker may synchronize
effects with an already resolved hit; it must not apply damage, spend resources,
grant an item, or determine whether an ability succeeds. Replays, skipped
animations, reconnects, and reduced motion must preserve the same combat state.
Separate caster motion, props/projectiles, target response, and visual effects
so multi-target actions and concurrent classroom combat remain manageable.

## Animated integration signoff

- [ ] Both models have approved segmented geometry and reconciled proportions.
- [ ] Both views have valid rigs, bind/rest poses, and calibrated hooks.
- [ ] Starter and signature kits pass fit review for all four jobs and both bodies.
- [ ] Every release-inventory ability/weapon/loadout row has approved coverage.
- [ ] Cross-class loadouts and temporary prop rules have no unresolved gaps.
- [ ] Light/dark palettes preserve ink, eyes, skin, and identity during motion.
- [ ] Joint seams, draw-order changes, planted feet, grips, and garment occlusion pass moving review.
- [ ] Transitions, KO/revive, interruptions, replay, and reduced motion behave correctly.
- [ ] Asset paths, hashes, schemas, references, and compatibility checks pass.
- [ ] Representative multi-avatar performance is measured on target classroom devices; budget and results are recorded.
- [ ] Product owner approves the collection and implementer records technical signoff.

For the animated release, only then begin live integration under its own implementation plan: asset
delivery, authenticated avatar/equipment APIs, character creation, persisted
appearance, combat presentation, and approved replacements for each unfinished weapon.
Local workshops and test previews may run earlier without changing live users.
