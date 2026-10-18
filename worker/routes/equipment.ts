import { and, or, isNull, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "../db/schema";
import { GameError as ApiError } from "../services/errors";
import { json, method } from "../http/game-response";
import { readJson } from "../http/json";
import type { GameRouteContext } from "./game-context";

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
import { validVisualSlot } from "../../shared/avatar/visuals";
import { itemSchema } from "../../shared/contracts/equipment";
import { EQUIPMENT_SLOTS, ownedEquipment } from "../../shared/equipment-catalog";
import { EQUIPMENT_ITEMS, calculateTierPrice, type CharacterClass } from "../../shared/schema";
import { builtinShopItems, builtinShopItem } from "../../shared/equipment-shop";
import { armorClassificationError, equipmentExclusion, handConflict, equipmentRequiredLevel } from "../../shared/equipment-rules";
import { getCrossClassAbilities } from "../../shared/jobSystem";
import { equipmentIdSchema } from "../../shared/equipment-id";
import type { GameDatabase } from "../db/game-repository";
import { safeStudent } from "../projections/student";

export async function handleEquipment(context: GameRouteContext): Promise<Response | null> {
  const { request, url, db, actor, teacher, ownStudent, requireTeacher, guild } = context;
  const path = url.pathname;
  const teacherList = path.match(/^\/api\/teacher\/([^/]+)\/equipment-items$/);
  if (teacherList) {
    requireTeacher();
    if (teacherList[1] !== actor.actorId) throw new ApiError("Forbidden", 403);
    return json(await db.select().from(s.equipmentItems).where(eq(s.equipmentItems.teacherId, actor.actorId)));
  }
      if (path === "/api/equipment-items/shop") {
        const id = url.searchParams.get("studentId") || actor.actorId;
        ownStudent(id);
        const [student] = await db
          .select()
          .from(s.students)
          .where(eq(s.students.id, id));
        if (!student?.guildId) return json([]);
        const g = await guild(student.guildId);
        const current = g;
        return json(
          [
            ...builtinShopItems(),
            ...await db
              .select()
              .from(s.equipmentItems)
              .where(
                and(
                  eq(s.equipmentItems.teacherId, g.teacherId),
                  eq(s.equipmentItems.isPurchasable, true),
                ),
              )
          ]
            .filter((item) => item.tier <= current.unlockedTier)
            .map((item) => ({
              ...item,
              shopPrice:
                item.shopPrice || calculateTierPrice(item.tier, item.quality),
            })),
        );
      }
      if (path === "/api/equipment-items" && method(request, "POST")) {
        requireTeacher();
        const input = itemSchema.parse(await readJson(request));
        if (!validVisualSlot(input.visual,input.slot)) throw new ApiError("Base sprite must match the equipment slot");
        const classificationError = armorClassificationError(input);
        if (classificationError) throw new ApiError(classificationError);
        return json(
          (
            await db
              .insert(s.equipmentItems)
              .values({ ...input, teacherId: actor.actorId })
              .returning()
          )[0],
          201,
        );
      }
      const im = path.match(/^\/api\/equipment-items\/([^/]+)$/);
      if (im && im[1] !== "shop") {
        const [item] = await db
          .select()
          .from(s.equipmentItems)
          .where(eq(s.equipmentItems.id, uuid.parse(im[1])));
        if (!item) throw new ApiError("Item not found", 404);
        if (teacher && item.teacherId !== actor.actorId)
          throw new ApiError("Forbidden", 403);
        if (!teacher) {
          const permitted = await studentItemIds(db, actor.actorId);
          if (
            !permitted.teacherIds.includes(item.teacherId) &&
            !permitted.itemIds.includes(item.id)
          )
            throw new ApiError("Forbidden", 403);
        }
        if (method(request, "GET")) return json(item);
        requireTeacher();
        if (method(request, "PATCH")) {
          const input = itemSchema.partial().parse(await readJson(request));
  if (!validVisualSlot(input.visual===undefined?item.visual:input.visual,input.slot||item.slot)) throw new ApiError("Base sprite must match the equipment slot");
          // Older unspecified armor can receive unrelated edits without changing its category.
          if ('slot' in input || 'itemType' in input || 'armorCategory' in input || item.armorCategory) {
            const classificationError = armorClassificationError({...item,...input});
            if (classificationError) throw new ApiError(classificationError);
          }
          return json(
            (
              await db
                .update(s.equipmentItems)
                .set(input)
                .where(eq(s.equipmentItems.id, item.id))
                .returning()
            )[0],
          );
        }
        if (method(request, "DELETE")) {
          await db
            .delete(s.equipmentItems)
            .where(eq(s.equipmentItems.id, item.id));
          return json({ success: true });
        }
      }
      if (path === "/api/equipment-items" && method(request, "GET")) {
        const ids = (url.searchParams.get("ids") || "")
          .split(",")
          .filter(Boolean);
        if (ids.length > 100) throw new ApiError("Too many items");
        const builtin = ids
          .filter((id) => EQUIPMENT_ITEMS[id])
          .map((id) => ({ ...EQUIPMENT_ITEMS[id], tier: EQUIPMENT_ITEMS[id].tier ?? 1, quality: "common" }));
        const custom = ids.filter((id) => !EQUIPMENT_ITEMS[id]);
        custom.forEach((id) => uuid.parse(id));
        if (!custom.length) return json(builtin);
        let rows = await db
          .select()
          .from(s.equipmentItems)
          .where(inArray(s.equipmentItems.id, custom));
        if (teacher) rows = rows.filter((i) => i.teacherId === actor.actorId);
        else {
          const allowed = await studentItemIds(db, actor.actorId);
          rows = rows.filter(
            (i) =>
              allowed.itemIds.includes(i.id) ||
              allowed.teacherIds.includes(i.teacherId),
          );
        }
        return json([...builtin, ...rows]);
      }
  return null;
}

export async function handleStudentEquipment(context: GameRouteContext, student: s.StudentRecord, tail: string): Promise<Response | null> {
  const { request, db, guild } = context;
  const id = student.id;
  if (tail === "equipment" && method(request, "PATCH")) {
    const input = z
      .object({
        ...Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, z.string().max(100).nullable().optional()])) as Record<typeof EQUIPMENT_SLOTS[number], z.ZodOptional<z.ZodNullable<z.ZodString>>>,
        crossClassAbility1: z.string().max(100).nullable().optional(),
        crossClassAbility2: z.string().max(100).nullable().optional(),
      })
      .parse(await readJson(request));
    const jobs = await db
      .select()
      .from(s.studentJobLevels)
      .where(eq(s.studentJobLevels.studentId, id));
    const levels = Object.fromEntries(
      jobs.map((j) => [j.jobClass, j.level]),
    );
    const cross = getCrossClassAbilities(
      student.characterClass || "warrior",
      levels as Record<CharacterClass, number>,
    );
    for (const [slot, itemId] of Object.entries(input)) {
      if (!itemId) continue;
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
        const exclusion = equipmentExclusion(student.characterClass || 'warrior', item);
        if (exclusion) throw new ApiError(exclusion);
      }
      if (
        !item ||
        item.slot !== slot ||
        !ownedEquipment([...student.inventory, ...EQUIPMENT_SLOTS.map(slot => student[slot]).filter((id): id is string => !!id)]).includes(itemId)
      )
        throw new ApiError("Equipment is not owned or has the wrong slot");
      const tier = item.tier ?? 1;
      const level = levels[student.characterClass || "warrior"] || 1;
      if (level < equipmentRequiredLevel(tier))
        throw new ApiError("Job level is too low for this tier");

    }
    if ('weapon' in input || 'offhand' in input) {
      const nextWeapon = 'weapon' in input ? input.weapon : student.weapon;
      const nextOffhand = 'offhand' in input ? input.offhand : student.offhand;
      const resolveItem = async (id:string|null|undefined) => !id ? null : EQUIPMENT_ITEMS[id] || (await db.select().from(s.equipmentItems).where(eq(s.equipmentItems.id, uuid.parse(id))))[0] || null;
      const weapon = await resolveItem(nextWeapon), offhand = await resolveItem(nextOffhand);
      if (handConflict(weapon, offhand)) throw new ApiError('The weapon and off-hand item are incompatible. Change or remove both together.');
    }
    const nextAbilities = {...student, ...input};
    if (nextAbilities.crossClassAbility1 && nextAbilities.crossClassAbility1 === nextAbilities.crossClassAbility2)
      throw new ApiError("Choose different cross-class abilities");
    const [updated] = await db.update(s.students).set({...input, loadoutRevision: sql`${s.students.loadoutRevision} + 1`}).where(and(
      eq(s.students.id,id),
      eq(s.students.loadoutRevision, student.loadoutRevision),
      sql`${s.students.characterClass} IS NOT DISTINCT FROM ${student.characterClass}`,
      ...EQUIPMENT_SLOTS.map(slot => sql`${s.students[slot]} IS NOT DISTINCT FROM ${student[slot]}`),
    )).returning();
    if (!updated) throw new ApiError('Your equipment changed. Refresh and try again.',409);
    return json(safeStudent(updated));
  }
  if (tail === "purchase-item" && method(request, "POST")) {
    const { itemId } = z
      .object({ itemId: equipmentIdSchema })
      .parse(await readJson(request));
    if (!student.guildId) throw new ApiError("Join a guild first");
    const g = await guild(student.guildId);
    const builtin = builtinShopItem(itemId);
    const [custom] = uuid.safeParse(itemId).success ? await db
      .select()
      .from(s.equipmentItems)
      .where(eq(s.equipmentItems.id, itemId)) : [];
    const item = builtin || (custom?.teacherId === g.teacherId ? custom : undefined);
    if (
      !item ||
      !item.isPurchasable ||
      item.tier > g.unlockedTier
    )
      throw new ApiError("Item is unavailable");
    const price =
      item.shopPrice || calculateTierPrice(item.tier, item.quality);
    const rows = await db
      .update(s.students)
      .set({
        gold: sql`${s.students.gold}-${price}`,
        inventory: sql`${s.students.inventory} || ${JSON.stringify([item.id])}::jsonb`,
      })
      .where(
        and(
          eq(s.students.id, id),
          sql`${s.students.gold}>=${price}`,
          sql`NOT(${s.students.inventory} @> ${JSON.stringify([item.id])}::jsonb)`,
        ),
      )
      .returning();
    if (!rows.length)
      throw new ApiError("Not enough gold or item already owned", 409);
    return json(safeStudent(rows[0]));
  }
  return null;
}

async function studentItemIds(db: GameDatabase, id: string) {
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
