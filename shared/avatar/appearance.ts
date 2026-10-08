import { AVATAR_PALETTES } from './palettes';
import { STARTER_LOADOUTS } from '../equipment-catalog';
import type { CharacterClass } from '../schema';

export const STARTER_JOBS = ['warrior', 'wizard', 'scout', 'herbalist'] as const;
export type StarterJob = typeof STARTER_JOBS[number];
export type AvatarJob = CharacterClass;
export const AVATAR_JOBS = Object.keys(STARTER_LOADOUTS) as AvatarJob[];
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
export type ArmorLook = 'plate' | 'leather' | 'linen';
export function starterVisual(job:AvatarJob) {
  const loadout=STARTER_LOADOUTS[job];
  const armor:ArmorLook=loadout.armor==='basic_armor'?'plate':loadout.armor==='basic_leather_armor'?'leather':'linen';
  const weaponBodies:Record<string,StarterJob>={basic_sword:'warrior',basic_staff:'wizard',basic_bow:'scout',basic_herbs:'herbalist'};
  const fitted=loadout.weapon?weaponBodies[loadout.weapon]:undefined;
  const headwear:StarterJob=loadout.headgear==='basic_helm'?'warrior':loadout.headgear==='basic_rakes_cap'?'scout':loadout.headgear==='basic_laurel'?'herbalist':'wizard';
  return {armor,headwear,body:fitted||'empty-bodies',missingWeapon:!fitted?loadout.weapon:null};
}
interface JobPresentation {name:string;head:string;right:string;left:string;clothing:string;missingWeapon:string|null}
export const JOB_PRESENTATION=Object.fromEntries(AVATAR_JOBS.map(job=>{
 const visual=starterVisual(job),body=visual.body,weapon=STARTER_LOADOUTS[job].weapon;
 return [job,{
  name:job.split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),
  head:{warrior:'Imperial Italic helmet',wizard:'Purple conical hat',scout:'Brown rake’s cap',herbalist:'Gold & green laurel'}[visual.headwear],
  right:body==='warrior'?'Sword':body==='wizard'?'Staff':body==='herbalist'?'Herbs':weapon==='basic_claymore'?'Claymore':weapon==='basic_fist'?'Fist wraps':weapon==='basic_harp'?'Harp':'Empty',
  left:body==='warrior'?'Shield':body==='scout'?'Bow':body==='herbalist'?'Potion':'Empty',
  clothing:visual.armor==='plate'?'Steel & blue armor':visual.armor==='leather'?'Brown leather armor'+(body==='scout'?' · right-shoulder quiver':''):'Grey linen robes'+(body==='herbalist'?' · green herb pouch':''),
  missingWeapon:null,
 }];
})) as Record<AvatarJob,JobPresentation>;

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
export function selectAvatarJob(appearance: AvatarAppearance, job: AvatarJob) {
  if (!validAppearance(appearance) || !AVATAR_JOBS.includes(job)) throw new Error('Invalid avatar selection');
  return { appearance: { ...appearance }, job, kit: JOB_PRESENTATION[job] };
}

export function appearanceColors(appearance: AvatarAppearance) {
  if (!validAppearance(appearance)) throw new Error('Invalid appearance');
  return Object.fromEntries(CHANNELS.map(channel => [channel, PALETTES[channel].find(option => option.id === appearance[COLOR_FIELDS[channel]])!.hex])) as Record<AppearanceChannel, string>;
}
