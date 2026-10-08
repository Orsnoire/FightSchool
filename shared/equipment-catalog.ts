import type { CharacterClass, EquipmentItem, EquipmentSlot } from './schema';
import { EQUIPMENT_SLOTS } from './equipment-slots';
export { EQUIPMENT_SLOTS, SLOT_LABELS } from './equipment-slots';
export type ArmorCategory = 'heavy_armor'|'leather_armor'|'light_armor';
export const ARMOR_EXCLUSIONS:Record<CharacterClass,readonly ArmorCategory[]> = {
 warrior:[],paladin:[],dark_knight:[],blood_knight:[],
 scout:['heavy_armor'],ranger:['heavy_armor'],monk:['heavy_armor'],bard:['heavy_armor'],
 wizard:['heavy_armor','leather_armor'],herbalist:['heavy_armor','leather_armor'],priest:['heavy_armor','leather_armor'],warlock:['heavy_armor','leather_armor'],
};
const item=(id:string,name:string,slot:EquipmentSlot,armorCategory?:ArmorCategory,stats:EquipmentItem['stats']={}):EquipmentItem=>({id,name,slot,armorCategory,rarity:'common',tier:0,stats});
/** These permanent items are an entitlement, independent of purchased/looted inventory. */
export const STARTER_EQUIPMENT:Record<string,EquipmentItem> = {
 basic_sword:{...item('basic_sword','Starter Sword','weapon',undefined,{atk:1}),weaponType:'sword'},
 basic_staff:{...item('basic_staff','Starter Staff','weapon',undefined,{mat:1}),weaponType:'staff'},
 basic_bow:{...item('basic_bow','Starter Bow','weapon',undefined,{rtk:1}),weaponType:'bow'},
 basic_herbs:{...item('basic_herbs','Herb Pouch & Herbs','weapon',undefined,{mnd:1}),weaponType:'herbs'},
 basic_helm:item('basic_helm','Imperial Helm','headgear','heavy_armor',{def:1}),
 basic_armor:item('basic_armor','Starter Plate Armor','armor','heavy_armor',{def:1}),
 basic_plate_arms:item('basic_plate_arms','Starter Vambraces','arms','heavy_armor'),
 basic_leather_arms:item('basic_leather_arms','Starter Bracers','arms','leather_armor'),
 basic_cloth_arms:item('basic_cloth_arms','Starter Sleeves','arms','light_armor'),
 basic_cloth_gloves:item('basic_cloth_gloves','Starter Linen Gloves','hands','light_armor'),
 basic_cloth_legs:item('basic_cloth_legs','Starter Linen Pants','legs','light_armor'),
 basic_cloth_boots:item('basic_cloth_boots','Starter Cloth Shoes','feet','light_armor'),
 basic_claws:{...item('basic_claws','Starter Claws','weapon',undefined,{atk:1}),weaponType:'claws'},
 basic_spoon:{...item('basic_spoon','Starter Spoon','weapon',undefined,{rtk:1}),weaponType:'spoon'},
 basic_plate_gloves:item('basic_plate_gloves','Starter Gauntlets','hands','heavy_armor'),
 basic_plate_legs:item('basic_plate_legs','Starter Plate Leggings','legs','heavy_armor'),
 basic_plate_boots:item('basic_plate_boots','Starter Plate Boots','feet','heavy_armor'),
 basic_leather_armor:item('basic_leather_armor','Starter Leather Armor','armor','leather_armor',{def:1}),
 basic_leather_gloves:item('basic_leather_gloves','Starter Leather Gloves','hands','leather_armor'),
 basic_leather_legs:item('basic_leather_legs','Starter Leather Leggings','legs','leather_armor'),
 basic_leather_boots:item('basic_leather_boots','Starter Leather Boots','feet','leather_armor'),
 basic_robe:item('basic_robe','Linen Robe','armor','light_armor',{def:1}),
 basic_wizard_cap:item('basic_wizard_cap','Wizard Cap','headgear','light_armor',{def:1}),
 basic_laurel:item('basic_laurel','Gold & Green Laurel','headgear','light_armor',{def:1}),
 basic_rakes_cap:item('basic_rakes_cap',"Rake’s Cap",'headgear','leather_armor',{def:1}),
 basic_shield:{...item('basic_shield','Starter Shield','offhand'),offhandType:'shield'},
 basic_potion:{...item('basic_potion','Starter Potion','offhand'),offhandType:'potion'},
 basic_quiver:{...item('basic_quiver','Starter Quiver','offhand'),offhandType:'quiver'},
 // Existing advanced-job fallback weapons remain available without new acquisition rules.
 basic_fist:{...item('basic_fist','Basic Fist Wraps','weapon',undefined,{atk:1}),weaponType:'fist'},
 basic_claymore:{...item('basic_claymore','Starter Claymore (Two-Handed Sword)','weapon',undefined,{atk:2}),weaponType:'two-handed-sword'},
 basic_harp:{...item('basic_harp','Basic Harp','weapon',undefined,{rtk:1}),weaponType:'harp'},
};
export const STARTER_ITEM_IDS=Object.keys(STARTER_EQUIPMENT);
export type EquipmentLoadout = Record<EquipmentSlot,string|null>;
const cloth=(weapon:string,headgear='basic_wizard_cap',offhand:string|null=null):EquipmentLoadout=>({weapon,headgear,armor:'basic_robe',arms:'basic_cloth_arms',hands:'basic_cloth_gloves',legs:'basic_cloth_legs',feet:'basic_cloth_boots',offhand});
const plate=(weapon='basic_sword',offhand:string|null='basic_shield'):EquipmentLoadout=>({weapon,headgear:'basic_helm',armor:'basic_armor',arms:'basic_plate_arms',hands:'basic_plate_gloves',legs:'basic_plate_legs',feet:'basic_plate_boots',offhand});
const leather=(weapon='basic_bow',offhand:string|null='basic_quiver'):EquipmentLoadout=>({weapon,headgear:'basic_rakes_cap',armor:'basic_leather_armor',arms:'basic_leather_arms',hands:'basic_leather_gloves',legs:'basic_leather_legs',feet:'basic_leather_boots',offhand});
export const STARTER_LOADOUTS:Record<CharacterClass,EquipmentLoadout> = {
 warrior:plate(),wizard:cloth('basic_staff'),scout:leather(),herbalist:cloth('basic_herbs','basic_laurel','basic_potion'),
 warlock:cloth('basic_staff'),priest:cloth('basic_staff','basic_laurel'),paladin:plate(),dark_knight:plate(),blood_knight:plate('basic_claymore',null),
 monk:leather('basic_fist',null),ranger:leather(),bard:leather('basic_harp',null),
};
export function ownedEquipment(inventory:readonly string[] = []) { return [...new Set([...STARTER_ITEM_IDS,...inventory])]; }

/** Copy only public slot selections; normalize absent legacy fields to empty. */
export function snapshotEquipmentLoadout(source:Partial<EquipmentLoadout>):EquipmentLoadout {
 return Object.fromEntries(EQUIPMENT_SLOTS.map(slot=>[slot,source[slot]??null])) as EquipmentLoadout;
}
