# Combat sprite registry

Only the seven types in `shared/combat/enemy-catalog.ts` belong in the teacher
picker. New types need a defined moveset, default AI and a verified sprite before
being added. `tests/phase4/enemy-ai-authoring.test.ts` checks the complete roster,
default rules, PNG decoding and actual alpha transparency.

## October 8 replacement work

- `goblin-v1.png`: previously approved single-creature sprite from the goblin swarm branch.
- `zombie-v2.png`, `ghost-v2.png`, `spider-v2.png`: generated replacement sprites,
  visually inspected and verified as transparent PNGs.
- `vampire-v2.png`, `slime-v2.png`, `samhain-v2.png`: completed after resuming
  generation, visually inspected, and verified as transparent PNGs. Each has a
  full, left-facing silhouette without a backdrop. All seven registered sprites
  are now present.

## Generation prompts

Tool: ImageGen, generation mode, transparent background enabled. Each generated
sprite used the following shared direction plus its subject description:

> Production enemy combat sprite for QuestAcademy, an educational fantasy JRPG.
> ONE isolated full-body creature, facing LEFT in a three-quarter side view toward
> the player party. Cohesive premium 2D hand-painted cartoon game art, confident
> dark outlines, clean cel shading with restrained painterly texture, slightly
> exaggerated proportions, strong readable silhouette at 150px, adventurous
> Halloween fantasy tone suitable for a high-school classroom. Square canvas,
> entire creature, feet and weapon visible, generous transparent padding. Actual
> transparent alpha background; no scene, ground plane, square backdrop, text,
> watermark, UI or gore.

Zombie: muted teal skin, heavy brow, amber eyes, ragged dark-plum tunic and torn
brown trousers. Hunched, both claws reaching left; one hand with pale-blue frost.
No open wounds.

Ghost: pale ivory/lilac hoodlike spectral head, glowing turquoise eyes, dark mouth,
long spectral claws reaching left, tapered wisps, restrained purple edge light.
One ghost only, without extra objects.

Spider: violet-black chitin, plum abdomen, exactly eight legs, amber eyes, ivory
fangs and a small green poison accent. Facing left, no web backdrop.

The final Vampire, Slime and Samhain prompts are recorded in
[remaining-sprite-prompts.md](remaining-sprite-prompts.md). Samhain retains a
visible skull face under his hood, black iron and bronze harvest armor, pumpkin
ornaments and a scythe.
