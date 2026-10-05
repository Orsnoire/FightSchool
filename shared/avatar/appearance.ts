import { AVATAR_PALETTES } from './palettes';

export const STARTER_JOBS = ['warrior', 'wizard', 'scout', 'herbalist'] as const;
export type StarterJob = typeof STARTER_JOBS[number];
export type AvatarModelId = 'human-male-v1' | 'human-female-v1';
export interface AvatarAppearance {
  modelId: AvatarModelId;
  hairColorId: string;
  eyeColorId: string;
  skinColorId: string;
}
export const CHANNELS = ['hair', 'eyes', 'skin'] as const;
export type AppearanceChannel = typeof CHANNELS[number];
export const COLOR_FIELDS = { hair: 'hairColorId', eyes: 'eyeColorId', skin: 'skinColorId' } as const;
export const PALETTES = {
  hair: AVATAR_PALETTES['human-hair-v1'],
  eyes: AVATAR_PALETTES['human-eyes-v1'],
  skin: AVATAR_PALETTES['human-skin-v1'],
};
export const JOB_PRESENTATION = {
  warrior: { name: 'Warrior', head: 'Imperial Italic helmet', right: 'Sword', left: 'Shield', clothing: 'Steel & blue armor' },
  wizard: { name: 'Wizard', head: 'Purple conical hat', right: 'Staff', left: 'Empty', clothing: 'Grey linen robes' },
  scout: { name: 'Scout', head: 'Brown Robin Hood cap', right: 'Empty', left: 'Bow', clothing: 'Brown leather armor · right-shoulder quiver' },
  herbalist: { name: 'Herbalist', head: 'Gold & green laurel', right: 'Herbs', left: 'Potion', clothing: 'Grey linen robes · green herb pouch' },
} as const;

/** One appearance shared by every job. A job has no private copy of these fields. */
export function initialAppearance(previous?: AvatarAppearance | null, modelId: AvatarModelId = 'human-male-v1', random = Math.random): AvatarAppearance {
  if (previous) return { ...previous };
  const choose = (channel: AppearanceChannel) => {
    const n = random();
    if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('Invalid random value');
    return PALETTES[channel][Math.floor(n * PALETTES[channel].length)].id;
  };
  return { modelId, hairColorId: choose('hair'), eyeColorId: choose('eyes'), skinColorId: choose('skin') };
}

export function validAppearance(value: unknown): value is AvatarAppearance {
  if (!value || typeof value !== 'object') return false;
  const v = value as AvatarAppearance;
  return ['human-male-v1', 'human-female-v1'].includes(v.modelId) && CHANNELS.every(c => PALETTES[c].some(option => option.id === v[COLOR_FIELDS[c]]));
}

/** Derived equipment changes on every job switch; identity always uses the latest shared values. */
export function selectAvatarJob(appearance: AvatarAppearance, job: StarterJob) {
  if (!validAppearance(appearance) || !STARTER_JOBS.includes(job)) throw new Error('Invalid avatar selection');
  return { appearance: { ...appearance }, job, kit: JOB_PRESENTATION[job] };
}

export function appearanceColors(appearance: AvatarAppearance) {
  if (!validAppearance(appearance)) throw new Error('Invalid appearance');
  return Object.fromEntries(CHANNELS.map(channel => [channel, PALETTES[channel].find(option => option.id === appearance[COLOR_FIELDS[channel]])!.hex])) as Record<AppearanceChannel, string>;
}
