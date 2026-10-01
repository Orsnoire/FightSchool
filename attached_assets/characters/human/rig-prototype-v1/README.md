# Human warrior rig workshop 01

An isolated, equipment-swappable male Human combat-view prototype. This is a
working review artifact, not an approved production model or live integration.
It implements the first-example checkpoint in the
[avatar art guide](../../../../docs/avatar-art-direction.md).

## Review the movement

- [Offline interactive workshop](preview/workshop.html): download and open in a
  browser, or run `npm run preview:avatar-workshop` at the repository root and
  open `http://127.0.0.1:4179`. No account or network connection is needed by the
  exported page. It loads no external fonts, scripts, or images.
- [Equipment comparison](preview/equipment-comparison.gif): starter and armor
  share the same motion, cycling idle, sword attack, and shield raise.
- [MP4 comparison](preview/equipment-comparison.mp4): use the video playback
  controls if a chat/file viewer displays GIFs as still images. Individual MP4s:
  [idle](preview/idle.mp4), [attack](preview/attack.mp4), [shield raise](preview/block.mp4).
- Individual looping GIFs: [idle](preview/idle.gif), [attack](preview/attack.gif),
  [shield raise](preview/block.gif).
- [Inspection poses](preview/review-poses.png) and
  [export report](preview/export-report.json).

The workshop supports equipment switching at any animation time, hair/eye/skin
palettes, sword/shield visibility, playback speed, pause/restart, timeline
scrubbing, skeleton display, and a still-pose mode. The operating system's
reduced-motion preference starts it paused. Color defaults are preview choices
only, never player-creation defaults or saved student data.

### Fitting 03 — neck connection only

The head bind position is lowered another 40 reference pixels to close the front
neck seam. The lower-neck sprite (`underneck`) is attached directly to `torso`,
with the same world placement as before. Draw order is torso underlayer,
underneck, head, then torso equipment, so the front collar covers the lower neck
and the cropped head's neck overlap. Both starter and armor collars are checked
at rest and peak breathing in [neck close-ups](preview/neck-fit.png).
Breathing keyframes and timing are unchanged; this pass changes only the fit.
The owner considers the breathing movement right; seam fitting remains in review.

### Fitting 02 — owner feedback

The head moves down/right into the neck connection. Each sleeve now draws a rear
layer, the emerging arm, then the front shell/cuff lip. The shield hand starts in
a bent-arm guard, with its shield face drawn in front of the chest. The far foot
plants higher on the ground plane; the near boot points outward in the opposite
direction. New [far-foot art](far-boots-v2.png), generated with the built-in image
tool using [this prompt](far-boots-prompt.txt), adds an inner arch for both kits.
The source PNG is unchanged; explicit runtime crops use its actual 1774 × 887 size.
These adjustments remain subject to visual approval.

GIFs contain changing frames at 20 fps and an infinite-loop flag. Videos contain
the same frames with a visible elapsed-time counter. MP4 replay is controlled by
the viewer; the interactive workshop loops continuously unless paused or reduced
motion is enabled. These exports do not replace the reusable rig/keyframe data.

## The reusable deliverable is animation data

The GIFs are review exports. [rig.json](rig.json) holds the connected skeleton,
rest transforms, sprite regions, draw order, kits, and hooks.
[clips.json](clips.json) holds keyframe times and transform deltas with smooth
interpolation. No movement is recovered from a GIF. Both browser and GIF exports
use the same pure animation evaluator and Canvas renderer:

- `shared/avatar/rig.mjs`: deterministic sampling, parent transforms, schema
  checks, and two-bone leg constraints that keep ankle anchors planted.
- `shared/avatar/render.mjs`: body/equipment drawing and optional joint overlay.
- `shared/avatar/textures.mjs`: cached sprite regions and recoloring.

GUI contexts can share the rig, textures, and clips and choose a clip ID, elapsed
time, outfit, and appearance. `drawAvatar` draws in reference coordinates;
callers can apply an outer translate/scale transform for their screen placement.
`drawStage` supplies the workshop framing. The runtime modules do not import
combat logic, a clock, network transport, persistence, or the DOM. Texture
preparation receives a Canvas factory, allowing browser and offline rendering.

Visual event markers are metadata only. They do not apply damage, spend
resources, or send telemetry. Future combat integration must associate a clip
with an already resolved game event and handle replay/interruptions explicitly.

## Art and geometry

The original approved head is drawn from the existing neutral base and masks.
Its source geometry is preserved; its expression is static in this prototype.
The body/clothing/prop parts come from an unchanged transparent atlas produced
with the built-in image-generation tool. The exact
[generation prompt](generation-prompt.txt) and source hashes in
[manifest.json](manifest.json) document provenance. The generated sheet is
1254 × 1254; the requested 2048 size was not returned. Runtime sprite regions
use its actual dimensions. It is not treated as an exact regular grid.

Sprite regions trim unused transparent margins and joint-end strokes to allow
overlap, while the atlas remains unchanged. Transform fitting is explicit in
`rig.json`. Anatomical right is the near sword arm; left is the far shield arm.
Held props inherit their hand transforms. Armor replaces the tunic, shoulder
pieces, and boots and adds bracers; the starter garment is not drawn underneath
the replacement. Trouser pieces are currently shared by both kits.

The reference space is 1024 × 1536, top-left origin, positive Y down, clockwise
degrees, parent-relative joints. The ground root is `(520, 1480)`. The rig
family is `human-chibi-v1`; this prototype's asset ID is distinct from a
production rig version. Both feet are constrained throughout the three clips.

## Known limits and approval

- Male near-profile only. Female and front-view fitting remain pending.
- Joint seams, especially knees, and the generated clothing fit need visual
  approval and refinement. This is a rigid cutout rig, not a skinned mesh.
- Gripping hands are fixed drawings. Open hands, articulated fingers, facial
  animation, and secondary hair motion remain pending.
- Pants are not yet separated from full underlying bare-leg artwork. The modest
  torso underlayer exists; the full production body/garment requirement is not
  satisfied by this prototype.
- The shield and armor are visual workshop props, with no ownership, unlock,
  stat, or database equipment assignments.
- These are review loops, not the complete Warrior ability library. No combat
  event adapter, interrupt controller, or production readiness flag is added.

After approval, preserve the reviewed rig/clip version and its export-report
hashes. Changes to motion require regenerated GIFs and review. Complete both
body models, all required gear, and ability/weapon coverage before integration.

## Rebuild and validate

```sh
npm ci
npm run build:avatar-workshop
npm run preview:avatar-workshop
npm run render:avatar-review
node --import tsx --test tests/phase4/avatar-rig.test.ts
```

GIF export uses the development dependency `@napi-rs/canvas` and an installed
`ffmpeg` executable. The exporter renders at 20 fps, includes a rest between
action repetitions, and writes infinite-loop GIFs. Temporary PNG frames are
removed after encoding. The interactive HTML bundles its assets and is checked
in so the owner can download a single file. Rebuild it whenever source data or
runtime modules change.

`tests/browser/avatar-workshop.mjs` uses Playwright to check offline loading,
controls, preserved motion/colors when swapping equipment, reduced motion, and
desktop/phone layout. It accepts `PLAYWRIGHT_MODULE` and `AVATAR_BROWSER_PATH`
for isolated local test tooling. Browser screenshots are test artifacts, not
production assets. Physical thirty-player Chromebook performance is not yet
measured.
