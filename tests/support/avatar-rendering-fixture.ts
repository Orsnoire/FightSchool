import { AVATAR_JOBS, PALETTES, STARTER_JOBS } from '../../shared/avatar/appearance';
import type { AvatarAppearance } from '../../shared/avatar/appearance';
import { STARTER_LOADOUTS } from '../../shared/equipment-catalog';
export function avatarFixture(index: number) {
  const job = AVATAR_JOBS[index % AVATAR_JOBS.length];
  const appearance: AvatarAppearance = {
    modelId: Math.floor(index / 12) % 2 ? 'human-female-v1' : 'human-male-v1',
    hairColorId: PALETTES.hair[index % 8].id,
    eyeColorId: PALETTES.eyes[Math.floor(index / 8) % 8].id,
    skinColorId: PALETTES.skin[(index * 3) % 8].id,
  };
  const loadout = { ...STARTER_LOADOUTS[job] };
  if (index % 5 === 0) loadout.headgear = null;
  if (index % 7 === 0) loadout.hands = 't1_caster_hands';
  return { job, appearance, loadout };
}
export function avatarAssetPaths() {
  const root = new URL('../../attached_assets/characters/human/', import.meta.url);
  return Object.fromEntries([
    ...['male','female'].flatMap(model => ['neutral','hair','eyes','skin'].map(channel => [
      `${model}-${channel}`, new URL(`v1/recolor/${channel === 'neutral' ? `neutral/human-${model}-front.png` : `masks/human-${model}-front-${channel}.png`}`, root).pathname,
    ])),
    ...[...STARTER_JOBS, 'empty-bodies'].map(name => [name, new URL(`static-starters-v1/source/${name}.png`, root).pathname]),
    ...['tier-one-outfits','tier-one-caster','props','starter-harp'].map(name => [name, new URL(`equipment-static-v1/source/${name}.png`, root).pathname]),
  ]);
}
