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
export function weaponType(item:EquippableItem):string|null {return item.weaponType || (item.slot==='weapon'?item.itemType:null) || null;}
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
  if(kind==='spellbook'&&!['wizard','warlock'].includes(job))return 'This job cannot use a spell book';
  if(!['shield','quiver','potion','spellbook'].includes(kind||''))return 'Unknown off-hand type';
 }
 return null;
}
/** Quivers are worn support items and do not occupy a bow's draw hand. */
export function handConflict(weapon:EquippableItem|null,offhand:EquippableItem|null):boolean {
 if(!offhand)return false;
 const type=weapon?weaponType(weapon):null,kind=offhand.offhandType||offhand.itemType;
 if(kind==='spellbook')return type!=='wand';
 if(kind==='quiver')return type!=='bow';
 if(kind==='potion')return type!=='herbs';
 return type!=='sword';
}
export const builtinItem=(id:string|null|undefined)=>id?EQUIPMENT_ITEMS[id]||null:null;

export const ARMOR_LABELS:Record<ArmorCategory,string>={heavy_armor:'Heavy / plate',leather_armor:'Leather',light_armor:'Cloth / light'};
export const WEAPON_LABELS:Record<WeaponType,string>={wand:'Wand',sword:'Sword',staff:'Staff',bow:'Bow',herbs:'Herbs','two-handed-sword':'Two-handed sword',fist:'Fist wraps',claws:'Claws',harp:'Harp',spoon:'Spoon'};
export function equipmentPermissions(job:CharacterClass) {
 return {
  offhands:['shield','quiver','potion','spellbook'].filter(kind=>{
   const item={id:kind,slot:'offhand' as const,offhandType:kind};
   return !equipmentExclusion(job,item) && WEAPON_RESTRICTIONS[job].some(type=>!handConflict({id:type,slot:'weapon',weaponType:type},item));
  }),
  weapons:WEAPON_RESTRICTIONS[job].map(type=>WEAPON_LABELS[type]),
  armor:(Object.keys(ARMOR_LABELS) as ArmorCategory[]).filter(type=>!ARMOR_EXCLUSIONS[job].includes(type)).map(type=>ARMOR_LABELS[type]),
 };
}
/** Required for new armor; legacy category inference remains read-compatible. */
export function armorClassificationError(item:{slot:EquipmentSlot;armorCategory?:string|null}):string|null {
 if(SLOT_DEFINITIONS[item.slot].armor && !item.armorCategory)return 'Choose an explicit armor category for this armor slot.';
 if(!SLOT_DEFINITIONS[item.slot].armor && item.armorCategory)return 'Armor category applies only to body equipment slots.';
 return null;
}

/** Display the same job, tier and hand-pair blockers that the equip API enforces. */
export function equipmentUnavailable(job:CharacterClass,item:EquippableItem & {tier?:number},level:number,weapon:EquippableItem|null,offhand:EquippableItem|null):string|null {
 const exclusion=equipmentExclusion(job,item);
 if(exclusion)return exclusion;
 const tier=item.tier ?? 1;
 const required=equipmentRequiredLevel(tier);
 if(level<required)return `Requires job level ${required} (Tier ${tier}).`;
 if(item.slot==='weapon' && handConflict(item,offhand))return 'Remove the incompatible off-hand item first.';
 if(item.slot==='offhand' && handConflict(weapon,item))return 'Equip a compatible weapon first.';
 return null;
}

/** Tier 0 is available immediately; Tier 1 starts at job level 2. Higher gates are unchanged. */
export const equipmentRequiredLevel = (tier:number) => tier===0 ? 1 : [2,2,4,6,8,10,11,12,13,15][tier-1] ?? Infinity;
