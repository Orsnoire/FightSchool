import { z } from "zod";
import { EQUIPMENT_ITEMS } from "./schema";

// Built-in catalog keys and custom UUIDs share equipment APIs. Validating an ID
// does not authorize acquisition: claims require earned loot; purchases require
// available guild stock, sufficient gold and no existing ownership.
export const equipmentIdSchema = z.union([
  z.string().uuid(),
  z.string().refine(id => Object.hasOwn(EQUIPMENT_ITEMS, id), "Unknown equipment item"),
]);
