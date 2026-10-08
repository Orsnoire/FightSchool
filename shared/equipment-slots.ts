/** Stable save/API keys. Labels may change without migrating saved equipment. */
export const EQUIPMENT_SLOTS = ['weapon', 'offhand', 'headgear', 'armor', 'arms', 'hands', 'legs', 'feet'] as const;
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];
export const SLOT_DEFINITIONS = {
  weapon: { label: 'Weapon', armor: false },
  offhand: { label: 'Off hand', armor: false },
  headgear: { label: 'Head', armor: true },
  armor: { label: 'Chest', armor: true },
  arms: { label: 'Arms', armor: true },
  hands: { label: 'Hands', armor: true },
  legs: { label: 'Pants', armor: true },
  feet: { label: 'Feet', armor: true },
} satisfies Record<EquipmentSlot, { label: string; armor: boolean }>;
export const SLOT_LABELS = Object.fromEntries(
  EQUIPMENT_SLOTS.map(slot => [slot, SLOT_DEFINITIONS[slot].label]),
) as Record<EquipmentSlot, string>;
