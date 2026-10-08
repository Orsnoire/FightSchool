import type { EquipmentItem, EquipmentSlot } from './schema';

/** Visual briefs are metadata until individual equipment overlays are available. */
export const TIER_ONE_STYLES = {
 healer: 'White robes with a white tasseled fringe, dark grey gloves, white trousers and shoes.',
 caster: 'Light violet robes with a dark reddish fringe, black gloves and shoes, purple trousers.',
 forester: 'Green-dyed leather and green bow.',
 fighter: 'Starter plate styling, with red replacing the blue details.',
};
const armorSlots: EquipmentSlot[] = ['headgear','armor','arms','hands','legs','feet'];
const names = {
 healer: ['Hood','Robes','Sleeves','Gloves','Trousers','Slippers'],
 caster: ['Hat','Robes','Sleeves','Gloves','Trousers','Shoes'],
 forester: ['Cap','Jerkin','Bracers','Gloves','Trousers','Boots'],
 fighter: ['Helm','Cuirass','Vambraces','Gauntlets','Greaves','Sabatons'],
};
const prefixes = {healer:"Healer's",caster:"Caster's",forester:"Forester's",fighter:"Fighter's"};
export const TIER_ONE_EQUIPMENT: Record<string, EquipmentItem> = {};
for (const set of Object.keys(names) as (keyof typeof names)[]) {
  armorSlots.forEach((slot,i) => {
    const defensive = ['headgear','armor','feet'].includes(slot);
    const primary = set === 'healer' ? 'mnd' : set === 'caster' ? 'int' : 'agi';
    const stats = set === 'fighter' ? (defensive ? {def:1,str:1} : {vit:1}) : (defensive ? {def:1} : {[primary]:1});
    const id = `t1_${set}_${slot}`;
    TIER_ONE_EQUIPMENT[id] = {id,name:`${prefixes[set]} ${names[set][i]}`,slot,tier:1,rarity:'common',stats,
      armorCategory:set === 'fighter' ? 'heavy_armor' : set === 'forester' ? 'leather_armor' : 'light_armor'};
  });
}
const add = (id:string,name:string,slot:EquipmentSlot,stats:EquipmentItem['stats'],extra:Partial<EquipmentItem>={}) => {
  TIER_ONE_EQUIPMENT[id] = {id,name,slot,stats,tier:1,rarity:'common',...extra};
};
// Preserve the family's starter weapon power in addition to its attribute bonuses.
add('t1_healer_herbs',"Healer's Herbs",'weapon',{mnd:1},{weaponType:'herbs'});
add('t1_healer_potion',"Healer's Potion",'offhand',{}, {offhandType:'potion'});
add('t1_healer_ankh',"Healer's Ankh Wand",'weapon',{mat:1},{weaponType:'wand',classRestriction:['priest']});
add('t1_caster_staff',"Caster's Staff",'weapon',{mat:1,int:2},{weaponType:'staff',classRestriction:['wizard','warlock']});
add('t1_caster_wand',"Caster's Wand",'weapon',{mat:1,int:1},{weaponType:'wand',classRestriction:['wizard','warlock']});
add('t1_caster_book','Spell Book','offhand',{int:1},{offhandType:'spellbook',classRestriction:['wizard','warlock']});
add('t1_forester_bow',"Forester's Bow",'weapon',{rtk:1,agi:1},{weaponType:'bow'});
add('t1_forester_quiver',"Forester's Quiver",'offhand',{agi:1},{offhandType:'quiver'});
add('t1_fighter_sword',"Fighter's Sword",'weapon',{atk:1,str:2},{weaponType:'sword'});
add('t1_fighter_shield',"Fighter's Shield",'offhand',{def:2},{offhandType:'shield'});
add('t1_fighter_claymore',"Fighter's Claymore",'weapon',{atk:2,str:3},{weaponType:'two-handed-sword'});
add('t1_fighter_claws',"Fighter's Claws",'weapon',{atk:1,agi:2},{weaponType:'claws'});
add('t1_bard_lute',"Bard's Lute",'weapon',{rtk:1,agi:1,str:1,vit:1},{weaponType:'harp'});

/** Four loot families include weapons. Bard's instrument joins its leather family. */
export const TIER_ONE_LOOT_POOLS = Object.fromEntries(Object.keys(names).map(set => [set,
  Object.keys(TIER_ONE_EQUIPMENT).filter(id => id.startsWith(`t1_${set}_`) || (set === 'forester' && id === 't1_bard_lute')),
])) as Record<keyof typeof names,string[]>;
export function equipmentEffects(loadout:Partial<Record<EquipmentSlot,string|null>>) {
  return {healingBonus:loadout.weapon === 't1_healer_ankh' ? 1 : 0,
    potionAttackBonus:loadout.offhand === 't1_healer_potion' ? 1 : 0};
}
export function equipmentEffectText(id:string) {
  return id === 't1_healer_ankh' ? '+1 HP to every heal, including First Aid.' :
    id === 't1_healer_potion' ? 'Healing potions grant +1 ATK for 3 rounds. Refreshes; does not stack.' : '';
}
