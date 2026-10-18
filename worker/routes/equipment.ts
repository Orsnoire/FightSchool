import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { validVisualSlot } from "../../shared/avatar/visuals";
import { itemSchema, loadoutInput, purchaseInput } from "../../shared/contracts/equipment";
import { armorClassificationError } from "../../shared/equipment-rules";
import { builtinShopItems } from "../../shared/equipment-shop";
import { EQUIPMENT_ITEMS, calculateTierPrice } from "../../shared/schema";
import * as s from "../db/schema";
import { json, method } from "../http/game-response";
import { readJson } from "../http/json";
import { safeStudent } from "../projections/student";
import { purchaseItem, studentItemIds, updateStudentEquipment } from "../services/equipment";
import { GameError as ApiError } from "../services/errors";
import type { GameRouteContext } from "./game-context";
const uuid = z.string().uuid();
export async function handleEquipment(context: GameRouteContext): Promise<Response | null> {
  const { request, url, db, actor, teacher, ownStudent, requireTeacher, guild } = context;
  const path = url.pathname;
  const teacherList = path.match(/^\/api\/teacher\/([^/]+)\/equipment-items$/);
  if (teacherList) {
    requireTeacher();
    if (teacherList[1] !== actor.actorId)
      throw new ApiError("Forbidden", 403);
    return json(await db.select().from(s.equipmentItems).where(eq(s.equipmentItems.teacherId, actor.actorId)));
  }
  if (path === "/api/equipment-items/shop") {
    const id = url.searchParams.get("studentId") || actor.actorId;
    ownStudent(id);
    const [student] = await db
      .select()
      .from(s.students)
      .where(eq(s.students.id, id));
    if (!student?.guildId)
      return json([]);
    const g = await guild(student.guildId);
    const current = g;
    return json([
      ...builtinShopItems(),
      ...await db
        .select()
        .from(s.equipmentItems)
        .where(and(eq(s.equipmentItems.teacherId, g.teacherId), eq(s.equipmentItems.isPurchasable, true)))
    ]
      .filter((item) => item.tier <= current.unlockedTier)
      .map((item) => ({
        ...item,
        shopPrice: item.shopPrice || calculateTierPrice(item.tier, item.quality),
      })));
  }
  if (path === "/api/equipment-items" && method(request, "POST")) {
    requireTeacher();
    const input = itemSchema.parse(await readJson(request));
    if (!validVisualSlot(input.visual, input.slot))
      throw new ApiError("Base sprite must match the equipment slot");
    const classificationError = armorClassificationError(input);
    if (classificationError)
      throw new ApiError(classificationError);
    return json((await db
      .insert(s.equipmentItems)
      .values({ ...input, teacherId: actor.actorId })
      .returning())[0], 201);
  }
  const im = path.match(/^\/api\/equipment-items\/([^/]+)$/);
  if (im && im[1] !== "shop") {
    const [item] = await db
      .select()
      .from(s.equipmentItems)
      .where(eq(s.equipmentItems.id, uuid.parse(im[1])));
    if (!item)
      throw new ApiError("Item not found", 404);
    if (teacher && item.teacherId !== actor.actorId)
      throw new ApiError("Forbidden", 403);
    if (!teacher) {
      const permitted = await studentItemIds(db, actor.actorId);
      if (!permitted.teacherIds.includes(item.teacherId) &&
        !permitted.itemIds.includes(item.id))
        throw new ApiError("Forbidden", 403);
    }
    if (method(request, "GET"))
      return json(item);
    requireTeacher();
    if (method(request, "PATCH")) {
      const input = itemSchema.partial().parse(await readJson(request));
      if (!validVisualSlot(input.visual === undefined ? item.visual : input.visual, input.slot || item.slot))
        throw new ApiError("Base sprite must match the equipment slot");
      // Older unspecified armor can receive unrelated edits without changing its category.
      if ('slot' in input || 'itemType' in input || 'armorCategory' in input || item.armorCategory) {
        const classificationError = armorClassificationError({ ...item, ...input });
        if (classificationError)
          throw new ApiError(classificationError);
      }
      return json((await db
        .update(s.equipmentItems)
        .set(input)
        .where(eq(s.equipmentItems.id, item.id))
        .returning())[0]);
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
    if (ids.length > 100)
      throw new ApiError("Too many items");
    const builtin = ids
      .filter((id) => EQUIPMENT_ITEMS[id])
      .map((id) => ({ ...EQUIPMENT_ITEMS[id], tier: EQUIPMENT_ITEMS[id].tier ?? 1, quality: "common" }));
    const custom = ids.filter((id) => !EQUIPMENT_ITEMS[id]);
    custom.forEach((id) => uuid.parse(id));
    if (!custom.length)
      return json(builtin);
    let rows = await db
      .select()
      .from(s.equipmentItems)
      .where(inArray(s.equipmentItems.id, custom));
    if (teacher)
      rows = rows.filter((i) => i.teacherId === actor.actorId);
    else {
      const allowed = await studentItemIds(db, actor.actorId);
      rows = rows.filter((i) => allowed.itemIds.includes(i.id) ||
        allowed.teacherIds.includes(i.teacherId));
    }
    return json([...builtin, ...rows]);
  }
  return null;
}
export async function handleStudentEquipment(context: GameRouteContext, student: s.StudentRecord, tail: string): Promise<Response | null> {
  const { request, db, guild } = context;
  const id = student.id;
  if (tail === "equipment" && method(request, "PATCH")) {
    const input = loadoutInput.parse(await readJson(request));
    return json(safeStudent(await updateStudentEquipment(db, student, input)));
  }
  if (tail === "purchase-item" && method(request, "POST")) {
    const { itemId } = purchaseInput
      .parse(await readJson(request));
    if (!student.guildId)
      throw new ApiError("Join a guild first");
    const g = await guild(student.guildId);
    return json(safeStudent(await purchaseItem(db, id, g, itemId)));
  }
  return null;
}
