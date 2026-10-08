import { EQUIPMENT_ITEMS, WEAPON_RESTRICTIONS, type CharacterClass, type EquipmentSlot, type WeaponType } from './schema';
import { SLOT_DEFINITIONS } from './equipment-slots';
import { ARMOR_EXCLUSIONS, type ArmorCategory } from './equipment-catalog';
export interface EquippableItem {
 id:string;slot:EquipmentSlot;weaponType?:string|null;armorCategory?:string|null;
 offhandType?:string|null;itemType?:string|null;classRestriction?:CharacterClass[];
}
export function armorCategory(item:EquippableItem):ArmorCategory|null {
 if(item.armorCategory)return item.armorCategory as ArmorCategory;
 if(['armor','helmet'].includes(item.itemType||'') || ['chainmail','plate_armor','dragon_scale','steel_helmet'].includes(item.id))return 'heavy_armor';
 if(item.itemType==='leather_armor'||['leather_armor','leather_helm'].includes(item.id))return 'leather_armor';
 if(SLOT_DEFINITIONS[item.slot].armor)return 'light_armor';
 return null;
}
export function weaponType(item:EquippableItem):string|null {return item.weaponType || (item.itemType==='wand'?'staff':item.slot==='weapon'?item.itemType:null) || null;}
export function equipmentExclusion(job:CharacterClass,item:EquippableItem):string|null {
 if(item.classRestriction&&!item.classRestriction.includes(job))return 'This item is excluded for this job';
 const category=armorCategory(item);
 if(category&&ARMOR_EXCLUSIONS[job].includes(category))return 'This armor category is excluded for this job';
 if(item.slot==='weapon'&&!WEAPON_RESTRICTIONS[job].includes(weaponType(item) as WeaponType))return 'This weapon is excluded for this job';
 if(item.slot==='offhand') {
  const kind=item.offhandType||item.itemType;
  if(kind==='shield'&&!['warrior','paladin','dark_knight','blood_knight'].includes(job))return 'This job cannot use a shield';
  if(kind==='quiver'&&!['scout','ranger'].includes(job))return 'This job cannot use a quiver';
  if(kind==='potion'&&job!=='herbalist')return 'This job cannot use a potion off hand';
  if(!['shield','quiver','potion'].includes(kind||''))return 'Unknown off-hand type';
 }
 return null;
}
/** Quivers are worn support items and do not occupy a bow's draw hand. */
export function handConflict(weapon:EquippableItem|null,offhand:EquippableItem|null):boolean {
 if(!offhand)return false;
 const type=weapon?weaponType(weapon):null,kind=offhand.offhandType||offhand.itemType;
 if(kind==='quiver')return type!=='bow';
 if(kind==='potion')return type!=='herbs';
 return type!=='sword';
}
export const builtinItem=(id:string|null|undefined)=>id?EQUIPMENT_ITEMS[id]||null:null;
