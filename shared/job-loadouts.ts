import { EQUIPMENT_SLOTS } from './equipment-slots';
import { EQUIPMENT_ITEMS, getStartingEquipment, type CharacterClass } from './schema';
import { ownedEquipment } from './equipment-catalog';
import { equipmentUnavailable, handConflict, type EquippableItem } from './equipment-rules';
import { getCrossClassAbilities } from './jobSystem';

export const LOADOUT_FIELDS = [...EQUIPMENT_SLOTS, 'crossClassAbility1', 'crossClassAbility2'] as const;
export type JobLoadout = Record<typeof LOADOUT_FIELDS[number], string | null>;
export type SavedJobLoadouts = Partial<Record<CharacterClass, JobLoadout>>;
export function captureLoadout(student: Partial<JobLoadout>): JobLoadout {
  return Object.fromEntries(LOADOUT_FIELDS.map(key => [key, student[key] ?? null])) as JobLoadout;
}
/** Revalidate saved selections; explicit empty slots stay empty. Invalid gear uses its starter fallback. */
export function restoreLoadout(job: CharacterClass, saved: JobLoadout | undefined,
  inventory: string[], levels: Record<string, number>, custom: Record<string, EquippableItem & {tier?:number}>) {
  const defaults = captureLoadout(getStartingEquipment(job));
  if (!saved) return defaults;
  const result = captureLoadout(saved);
  const owned = new Set(ownedEquipment(inventory));
  const item = (id: string | null) => id ? EQUIPMENT_ITEMS[id] || custom[id] || null : null;
  for (const slot of EQUIPMENT_SLOTS) {
    const id = result[slot];
    if (!id) continue;
    const gear = item(id);
    if (!owned.has(id) || !gear || gear.slot !== slot ||
      equipmentUnavailable(job, gear, levels[job] || 1, slot === 'offhand' ? item(result.weapon) : null, null)) {
      result[slot] = defaults[slot];
    }
  }
  if (handConflict(item(result.weapon), item(result.offhand))) result.offhand = null;
  const allowed = getCrossClassAbilities(job, levels as Record<CharacterClass, number>);
  for (const key of ['crossClassAbility1', 'crossClassAbility2'] as const) {
    if (!allowed.some(ability => ability.id === result[key])) result[key] = null;
  }
  if (result.crossClassAbility1 === result.crossClassAbility2) result.crossClassAbility2 = null;
  return result;
}
