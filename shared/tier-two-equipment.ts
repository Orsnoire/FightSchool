import type { EquipmentItem, EquipmentSlot } from './schema';

const slots: EquipmentSlot[] = ['headgear', 'armor', 'arms', 'hands', 'legs', 'feet'];
const sets = {
  soldier: { prefix: "Soldier's", category: 'heavy_armor', names: ['Helm', 'Cuirass', 'Vambraces', 'Gauntlets', 'Greaves', 'Sabatons'] },
  ranger: { prefix: "Ranger's", category: 'leather_armor', names: ['Cap', 'Jerkin', 'Bracers', 'Gloves', 'Trousers', 'Boots'] },
  acolyte: { prefix: "Acolyte's", category: 'light_armor', names: ['Hat', 'Robes', 'Sleeves', 'Gloves', 'Trousers', 'Shoes'] },
  ascetic: { prefix: "Ascetic's", category: 'light_armor', names: ['Laurel', 'Robes', 'Sleeves', 'Gloves', 'Trousers', 'Slippers'] },
} as const;
export const TIER_TWO_EQUIPMENT: Record<string, EquipmentItem> = {};
export const TIER_TWO_HEALING_ITEMS = new Set<string>();
for (const [family, set] of Object.entries(sets)) {
  slots.forEach((slot, index) => {
    const support = ['arms', 'hands', 'legs'].includes(slot);
    const stats: EquipmentItem['stats'] = family === 'soldier'
      ? { def: 2, str: 1, ...(support ? { vit: 1 } : { atk: 1 }) }
      : family === 'ranger' ? { def: 1, agi: 1, rtk: 1 }
      : family === 'acolyte' ? { def: 1, int: 1, mat: 1 }
      : { def: 1, mnd: 1 };
    const id = `t2_${family}_${slot}`;
    TIER_TWO_EQUIPMENT[id] = { id, name: `${set.prefix} ${set.names[index]}`, slot,
      tier: 2, rarity: 'common', armorCategory: set.category, stats };
    if (family === 'ascetic' && support) TIER_TWO_HEALING_ITEMS.add(id);
  });
}
