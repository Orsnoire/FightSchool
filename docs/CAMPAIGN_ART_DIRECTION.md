# Campaign exploration art and UI direction

**Owner direction — October 20, 2026.** Target the feel of 16-bit-era Final Fantasy
and Dragon Quest. The current solo pilot is a mechanics prototype; its map tiles,
letter markers, layout and persistent sidebar are not the final presentation.
This document records the visual workshop brief, not approval of finished art.

## References supplied by the owner

| Reference | What to study |
| --- | --- |
| `DQ5DS_Faerie_Realm_Spring_Tileset_Map_Final.png` | Continuous coastlines, dense forests, mountain chains, recognizable cave/landmark silhouettes and geography that communicates routes |
| `DQ5DS_Overworld_Tileset.png` | Continental scale, distinct terrain regions, oceans and narrow crossings, small settlements and dungeon entrances within the landscape |
| `image(20261020-171421).png` | Dark stone dungeon palette, masonry and doorway edges, stairs, water channels and readable interactive props |
| `image(20261020-171441).png` | Compact terrain vocabulary: water edges, grass, forest, hills, mountains, buildings and entrance icons |
| [Maru's MV Bits](https://forums.rpgmakerweb.com/threads/marus-mv-bits.46811/) | Town/interior detail, environmental props, forest transitions, seasonal variations and expressive location dressing |

These are visual references. Do not infer permission to redistribute uploaded
commercial-game art from a filename or its availability online. Maru's posted
terms limit the listed RTP edits to licensed RPG Maker MV use in RPG Maker
projects and require credit; use that page as reference for this web game unless
separate applicable permission is established. Ship original or appropriately
licensed assets, with their source/terms recorded alongside the asset manifest.

## Proposed first workshop: overworld and Hearthlight town

- Make the game world the main screen: a large exploration viewport with a small
  adventurer sprite, a camera that follows movement, and an optional world-map
  overview. Maintain a consistent pixel scale with crisp edges and no smoothing.
- Use continuous terrain transitions and grouped natural features. Forests,
  grassland, water, coast, mountains and roads should read at a glance, including
  their traversal implications. A hidden logical grid should not look like a
  matrix of individual UI buttons.
- Give towns, caves and landmarks recognizable silhouettes. The inn, weapon shop,
  armor shop and key keepers should be identifiable through buildings, signs and
  NPCs, with accessible labels and clear interaction prompts.
- Keep HP, MP, current job and a Menu control in a compact framed display. Open
  Equipment, healing/items and quests when requested. Use opaque JRPG-style
  panels with readable type, a visible selection cursor and consistent controls.
- Preserve legible mathematics and question text. Pixel styling must not reduce
  quiz readability, keyboard access or touch target sizes.
- Keep movement immediate, with short tile-to-tile transitions and subtle saving
  feedback. Encounters interrupt travel cleanly. Menus and dialogue capture input
  so navigation keys do not also move the character behind them.
- On phones, retain a generous map viewport and reachable directional/menu
  controls; menus can occupy the screen while open. Avoid compressing the whole
  world into tiny tiles to fit a permanent sidebar.

The proposed first review should show the same small region in overworld play,
town interaction and the open equipment menu. Review camera/scale, palette,
terrain readability, character proportion, menu framing and desktop/phone use
before expanding the artwork to every biome. A separate walkable town map is a
workshop option, not an already-approved change to the pilot's generation model.

## Asset and generation contract

Choose one native tile scale, palette family, perspective and sprite scale in the
workshop. Terrain edge/corner variants, collision metadata, landmarks, entrances,
NPC positions and encounter-environment tags must align with generated maps.
Keep artwork and collision definitions separate; the new presentation must
preserve saved layouts and access rules rather than regenerate existing worlds.

Each environment eventually has a matching battle background and its own 3–5-enemy
bestiary under [CAM-08](CAMPAIGN_DEVELOPMENT_ROADMAP.md#cam-08-polish-acceptance--environment-bestiaries).
That enemy selection is independent of the unlocked-dungeon academic question pool.

## October 28, 2026 workshop implementation

The owner approved the original landmark icon direction and requested forests and a complete edge/corner vocabulary. For this pass, mountains frame the overworld and cave walls frame the cavern. Exact 47-case adjacency geometry covers straight edges, outer/inner corners, isolated blocks and narrow connections; original material fills provide the artwork. Existing interior blocked terrain displays forest, without regenerating maps or altering traversal. Grass/path/water transitions remain later work. See [asset contract and prompts](campaign-art-v1.md) and [PR #90](https://github.com/Orsnoire/FightSchool/pull/90). The final assembled screens still need visual review before beta.

## October 29, 2026 terrain correction

The owner clarified that terrain is a tileset, not a texture stretched over the whole map. Repeat each complete material swatch at the map's 48px tile size for grass, paths, water, cave floor, mountains, forests and cave walls. Retain the existing 47 edge/corner masks; connectivity changes the silhouette, not the texture scale. Follow mode and overview must use the same tiled world. Landmarks and the equipped avatar retain their approved rendering.
