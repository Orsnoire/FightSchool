# Combat sprite registry

Only the seven types in `shared/combat/enemy-catalog.ts` belong in the teacher
picker. New types need a defined moveset, default AI and a verified sprite before
being added. `tests/phase4/enemy-ai-authoring.test.ts` checks the complete roster,
default rules, PNG decoding and actual alpha transparency.

## October 8 replacement work

- `goblin-v1.png`: previously approved single-creature sprite from the goblin swarm branch.
- `zombie-v2.png`, `ghost-v2.png`, `spider-v2.png`: generated replacement sprites,
  visually inspected and verified as transparent PNGs.
- `vampire-v2.png`, `slime-v2.png`, `samhain-v2.png`: generation was interrupted.
  These files are pending; the asset verification gate intentionally fails until
  they are supplied and reviewed. Do not deploy this draft with missing sprites.

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

Pending subjects: a pale aristocratic vampire in a black coat and crimson cape;
an emerald gelatinous slime with amber eyes; and Samhain as a skull-faced hooded
harvest lord in black iron and bronze armor, with a pumpkin ornament and scythe.
Samhain's skull face must remain visible; his head is not a pumpkin.
