import { STARTER_EQUIPMENT, STARTER_LOADOUTS, snapshotEquipmentLoadout, type EquipmentLoadout } from '../equipment-catalog';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../equipment-slots';
import { TIER_ONE_EQUIPMENT } from '../tier-one-equipment';
import { TIER_TWO_EQUIPMENT } from '../tier-two-equipment';
import type { AvatarJob, StarterJob } from './appearance';

export type AvatarLoadout = Partial<EquipmentLoadout>;
export type ArmorStyle = 'plate'|'leather'|'linen'|'fighter'|'forester'|'healer'|'caster';
const items = {...STARTER_EQUIPMENT,...TIER_ONE_EQUIPMENT,...TIER_TWO_EQUIPMENT};
/** Missing snapshots use job starters; explicit empty slots never restore equipment. */
export function avatarEquipment(job:AvatarJob, loadout?:AvatarLoadout):EquipmentLoadout {
  const source=loadout ?? STARTER_LOADOUTS[job];
  return snapshotEquipmentLoadout(source);
}
export function armorStyle(id:string|null):ArmorStyle {
  if(id?.startsWith('t2_') && items[id]) return ({soldier:'fighter',ranger:'forester',acolyte:'caster',ascetic:'healer'} as const)[id.split('_')[1] as 'soldier'|'ranger'|'acolyte'|'ascetic'];
  if(id&&items[id]?.armorCategory&&id.startsWith('t1_')) {
    const family=id.split('_')[1];
    if(['fighter','forester','healer','caster'].includes(family))return family as ArmorStyle;
  }
  const category=id?items[id]?.armorCategory:undefined;
  return category==='heavy_armor'?'plate':category==='leather_armor'?'leather':'linen';
}
export function headStyle(id:string|null):StarterJob|null {
  if(!id||items[id]?.slot!=='headgear')return null;
  return ['basic_helm','t1_fighter_headgear','t2_soldier_headgear'].includes(id)?'warrior':
    ['basic_rakes_cap','t1_forester_headgear','t2_ranger_headgear'].includes(id)?'scout':
    ['basic_laurel','t1_healer_headgear','t2_ascetic_headgear'].includes(id)?'herbalist':'wizard';
}
export function unknownEquipment(loadout:EquipmentLoadout) {
  return EQUIPMENT_SLOTS.filter(slot=>loadout[slot]&&!items[loadout[slot]!]);
}
export function propStyle(id:string|null) {
  const item=id?items[id]:undefined;
  return item?.weaponType||item?.offhandType||null;
}
export const ARMOR_RENDER_ORDER = ['legs','feet','arms','armor','hands'] as const satisfies readonly EquipmentSlot[];
