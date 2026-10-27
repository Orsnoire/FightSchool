import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { LoadoutInput } from "../../shared/contracts/equipment";
import { EQUIPMENT_SLOTS, ownedEquipment } from "../../shared/equipment-catalog";
import { equipmentExclusion, equipmentRequiredLevel, handConflict } from "../../shared/equipment-rules";
import { builtinShopItem } from "../../shared/equipment-shop";
import { getCrossClassAbilities } from "../../shared/jobSystem";
import { EQUIPMENT_ITEMS, calculateTierPrice, type CharacterClass } from "../../shared/schema";
import type { GameDatabase } from "../db/database";
import * as s from "../db/schema";
import { GameError as ApiError } from "./errors";
import { crossClassSelections } from '../../shared/job-loadouts';
import { resolveAAEffects } from '../../shared/aa';
const uuid = z.string().uuid();
export async function updateStudentEquipment(db: GameDatabase, student: s.StudentRecord, input: LoadoutInput) {
  const id = student.id;
  const jobs = await db
    .select()
    .from(s.studentJobLevels)
    .where(eq(s.studentJobLevels.studentId, id));
  const levels = Object.fromEntries(jobs.map((j) => [j.jobClass, j.level]));
  const cross = getCrossClassAbilities(student.characterClass || "warrior", levels as Record<CharacterClass, number>);
  const hasList = 'crossClassAbilities' in input;
  const hasLegacy = 'crossClassAbility1' in input || 'crossClassAbility2' in input;
  if (hasList && hasLegacy) throw new ApiError('Use one cross-class loadout format');
  const selections = crossClassSelections(student);
  if (hasLegacy) {
    if ('crossClassAbility1' in input) selections[0] = input.crossClassAbility1 ?? null;
    if ('crossClassAbility2' in input) selections[1] = input.crossClassAbility2 ?? null;
  }
  if (hasList || hasLegacy) {
    input = { ...input, crossClassAbilities: hasList ? input.crossClassAbilities : selections };
    const chosen = input.crossClassAbilities!;
    const capacity = 2 + resolveAAEffects(student.aaRanks, 4).extraSlots;
    if (chosen.some((id, index) => !!id && (index >= capacity || !cross.some(a => a.id === id))))
      throw new ApiError('Cross-class slot or ability not unlocked');
    const populated = chosen.filter(Boolean);
    if (new Set(populated).size !== populated.length) throw new ApiError('Choose different cross-class abilities');
    input.crossClassAbility1 = chosen[0] ?? null;
    input.crossClassAbility2 = chosen[1] ?? null;
  }
  for (const [slot, itemId] of Object.entries(input)) {
    if (slot === 'crossClassAbilities') continue;
    if (!itemId || typeof itemId !== 'string')
      continue;
    if (slot.startsWith("crossClass")) {
      if (!cross.some((a) => a.id === itemId))
        throw new ApiError("Cross-class ability not unlocked");
      continue;
    }
    const builtin = EQUIPMENT_ITEMS[itemId];
    const [custom] = builtin
      ? []
      : await db
        .select()
        .from(s.equipmentItems)
        .where(eq(s.equipmentItems.id, uuid.parse(itemId)));
    const item = builtin || custom;
    if (item) {
      const exclusion = equipmentExclusion(student.characterClass || 'warrior', item, student.aaRanks);
      if (exclusion)
        throw new ApiError(exclusion);
    }
    if (!item ||
      item.slot !== slot ||
      !ownedEquipment([...student.inventory, ...EQUIPMENT_SLOTS.map(slot => student[slot]).filter((id): id is string => !!id)]).includes(itemId))
      throw new ApiError("Equipment is not owned or has the wrong slot");
    const tier = item.tier ?? 1;
    const level = levels[student.characterClass || "warrior"] || 1;
    if (level < equipmentRequiredLevel(tier))
      throw new ApiError("Job level is too low for this tier");
  }
  if ('weapon' in input || 'offhand' in input) {
    const nextWeapon = 'weapon' in input ? input.weapon : student.weapon;
    const nextOffhand = 'offhand' in input ? input.offhand : student.offhand;
    const resolveItem = async (id: string | null | undefined) => !id ? null : EQUIPMENT_ITEMS[id] || (await db.select().from(s.equipmentItems).where(eq(s.equipmentItems.id, uuid.parse(id))))[0] || null;
    const weapon = await resolveItem(nextWeapon), offhand = await resolveItem(nextOffhand);
    if (handConflict(weapon, offhand))
      throw new ApiError('The weapon and off-hand item are incompatible. Change or remove both together.');
  }
  const nextAbilities = { ...student, ...input };
  if (nextAbilities.crossClassAbility1 && nextAbilities.crossClassAbility1 === nextAbilities.crossClassAbility2)
    throw new ApiError("Choose different cross-class abilities");
  const [updated] = await db.update(s.students).set({ ...input, loadoutRevision: sql`${s.students.loadoutRevision} + 1` }).where(and(eq(s.students.id, id), eq(s.students.loadoutRevision, student.loadoutRevision), sql`${s.students.characterClass} IS NOT DISTINCT FROM ${student.characterClass}`, ...EQUIPMENT_SLOTS.map(slot => sql`${s.students[slot]} IS NOT DISTINCT FROM ${student[slot]}`))).returning();
  if (!updated)
    throw new ApiError('Your equipment changed. Refresh and try again.', 409);
  return updated;
}
// The caller resolves the authenticated student's guild before this operation.
// Charge and inventory grant remain one guarded SQL UPDATE across concurrent requests.
export async function purchaseItem(db: GameDatabase, id: string, g: typeof s.guilds.$inferSelect, itemId: string) {
  const builtin = builtinShopItem(itemId);
  const [custom] = uuid.safeParse(itemId).success ? await db
    .select()
    .from(s.equipmentItems)
    .where(eq(s.equipmentItems.id, itemId)) : [];
  const item = builtin || (custom?.teacherId === g.teacherId ? custom : undefined);
  if (!item ||
    !item.isPurchasable ||
    item.tier > g.unlockedTier)
    throw new ApiError("Item is unavailable");
  const price = item.shopPrice || calculateTierPrice(item.tier, item.quality);
  const rows = await db
    .update(s.students)
    .set({
      gold: sql`${s.students.gold}-${price}`,
      inventory: sql`${s.students.inventory} || ${JSON.stringify([item.id])}::jsonb`,
    })
    .where(and(eq(s.students.id, id), sql`${s.students.gold}>=${price}`, sql`NOT(${s.students.inventory} @> ${JSON.stringify([item.id])}::jsonb)`))
    .returning();
  if (!rows.length)
    throw new ApiError("Not enough gold or item already owned", 409);
  return rows[0];
}
export async function studentItemIds(db: GameDatabase, id: string) {
  const [student] = await db
    .select()
    .from(s.students)
    .where(eq(s.students.id, id));
  const guilds = await db
    .select({ teacherId: s.guilds.teacherId })
    .from(s.guildMemberships)
    .innerJoin(s.guilds, eq(s.guilds.id, s.guildMemberships.guildId))
    .where(eq(s.guildMemberships.studentId, id));
  const loot = await db.execute(sql`SELECT DISTINCT item->>'itemId' AS id
    FROM combat_results r CROSS JOIN LATERAL jsonb_array_elements(r.loot_table) item
    WHERE r.student_id=${id}::uuid AND item->>'itemId' IS NOT NULL`);
  return {
    teacherIds: guilds.map((g) => g.teacherId),
    itemIds: [
      ...(student?.inventory || []),
      ...loot.rows.map(r => String(r.id)),
    ],
  };
}
