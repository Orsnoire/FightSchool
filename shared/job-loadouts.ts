import { EQUIPMENT_SLOTS } from './equipment-slots';
import { EQUIPMENT_ITEMS, getStartingEquipment, type CharacterClass } from './schema';
import { ownedEquipment } from './equipment-catalog';
import { equipmentUnavailable, handConflict, type EquippableItem } from './equipment-rules';
import { getCrossClassAbilities } from './jobSystem';
import { resolveAAEffects, type AARanks } from './aa';

export const LOADOUT_FIELDS = [...EQUIPMENT_SLOTS, 'crossClassAbility1', 'crossClassAbility2'] as const;
export type JobLoadout = Record<typeof LOADOUT_FIELDS[number], string | null> & { crossClassAbilities?: (string | null)[] | null };
export type SavedJobLoadouts = Partial<Record<CharacterClass, JobLoadout>>;
export function crossClassSelections(student: Pick<Partial<JobLoadout>, 'crossClassAbilities' | 'crossClassAbility1' | 'crossClassAbility2'>): (string | null)[] {
  return student.crossClassAbilities ? student.crossClassAbilities.slice(0, 5) : [student.crossClassAbility1 ?? null, student.crossClassAbility2 ?? null];
}
export function captureLoadout(student: Partial<JobLoadout>): JobLoadout {
  const abilities = crossClassSelections(student);
  return { ...Object.fromEntries(LOADOUT_FIELDS.map(key => [key, student[key] ?? null])),
    crossClassAbility1: abilities[0] ?? null, crossClassAbility2: abilities[1] ?? null, crossClassAbilities: abilities } as JobLoadout;
}
/** Revalidate saved selections; explicit empty slots stay empty. Invalid gear uses its starter fallback. */
export function restoreLoadout(job: CharacterClass, saved: JobLoadout | undefined,
  inventory: string[], levels: Record<string, number>, custom: Record<string, EquippableItem & {tier?:number}>, ranks: AARanks = {}) {
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
      equipmentUnavailable(job, gear, levels[job] || 1, slot === 'offhand' ? item(result.weapon) : null, null, ranks)) {
      result[slot] = defaults[slot];
    }
  }
  if (handConflict(item(result.weapon), item(result.offhand))) result.offhand = null;
  const allowed = getCrossClassAbilities(job, levels as Record<CharacterClass, number>);
  const seen = new Set<string>();
  result.crossClassAbilities = crossClassSelections(result).map((id, index) => {
    if (!id || seen.has(id) || index >= 2 + resolveAAEffects(ranks, 4).extraSlots || !allowed.some(ability => ability.id === id)) return null;
    seen.add(id); return id;
  });
  return captureLoadout(result);
}
