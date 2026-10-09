import { z } from "zod";
import { EQUIPMENT_ITEMS } from "./schema";

// Built-in catalog keys and custom UUIDs share the claim API. Validating an ID
// does not authorize an award; the saved combat result must contain the item.
export const equipmentIdSchema = z.union([
  z.string().uuid(),
  z.string().refine(id => Object.hasOwn(EQUIPMENT_ITEMS, id), "Unknown equipment item"),
]);
