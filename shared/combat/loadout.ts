import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../equipment-slots';
import { EQUIPMENT_ITEMS, getStartingEquipment, type CharacterClass, type EquipmentItemStats, type EquipmentStats } from '../schema';
import { equipmentExclusion, equipmentRequiredLevel, handConflict, weaponType, type EquippableItem } from '../equipment-rules';
import { resolveAAEffects, type AARanks } from '../aa';

export type ProfileItem = EquippableItem & { tier?: number; stats: EquipmentItemStats };
/** Shared tier/loadout projection for server admission and student stat previews. Never mutates a save. */
export function projectCombatLoadout(job: CharacterClass, saved: Partial<Record<EquipmentSlot, string | null>>,
  level: number, ranks: AARanks | undefined, tier: number, custom: readonly ProfileItem[] = []) {
  const catalog: Record<string, ProfileItem> = { ...EQUIPMENT_ITEMS, ...Object.fromEntries(custom.map(item => [item.id, item])) };
  const permitted = resolveAAEffects(ranks, tier).ranks;
  const starters = getStartingEquipment(job);
  const loadout = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => {
    const id = saved[slot], item = id ? catalog[id] : undefined;
    return [slot, id && (!item || item.slot !== slot || equipmentRequiredLevel(item.tier ?? 1) > level || equipmentExclusion(job, item, permitted))
      ? starters[slot] || null : id || null];
  })) as Record<EquipmentSlot, string | null>;
  const get = (slot: EquipmentSlot) => catalog[loadout[slot] || ''] || null;
  if (handConflict(get('weapon'), get('offhand'))) loadout.offhand = null;
  const equipment: EquipmentStats = { str: 0, int: 0, agi: 0, mnd: 0, vit: 0, atk: 0, mat: 0, rtk: 0, def: 0 };
  for (const slot of EQUIPMENT_SLOTS) {
    const item = get(slot);
    if (item) for (const key of Object.keys(equipment) as (keyof EquipmentStats)[]) equipment[key] += item.stats[key] || 0;
  }
  const weaponKind = get('weapon') ? weaponType(get('weapon')!) : null;
  return { loadout, equipment, weaponKind, advancement: resolveAAEffects(ranks, tier, weaponKind) };
}
