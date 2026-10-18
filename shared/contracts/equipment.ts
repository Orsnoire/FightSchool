import { z } from "zod";
import { equipmentVisualSchema } from "../avatar/visuals";
import { EQUIPMENT_SLOTS } from "../equipment-slots";
import { equipmentIdSchema } from "../equipment-id";
const text = z.string().trim().min(1).max(200);
const bounded = z.number().int().min(0).max(1000);
export const itemSchema = z.object({
  visual: equipmentVisualSchema.nullable().optional(),
  name: text,
  iconUrl: z.string().max(2000).nullable().optional(),
  itemType: z.enum([
    "sword",
    "wand",
    "bow",
    "staff",
    "herbs",
    "two-handed-sword",
    "fist",
    "claws",
    "harp",
    "spoon",
    "light_armor",
    "leather_armor",
    "armor",
    "helmet",
    "cap",
    "hat",
    "consumable", "spellbook", "shield", "potion", "quiver", "bracers", "gloves", "leggings", "boots",
  ]),
  quality: z.enum(["common", "rare", "epic", "legendary"]),
  tier: z.number().int().min(1).max(10).default(1),
  slot: z.enum(EQUIPMENT_SLOTS),
  armorCategory: z.enum(["heavy_armor", "leather_armor", "light_armor"]).nullable().optional(),
  offhandType: z.enum(["shield", "potion", "quiver", "spellbook"]).nullable().optional(),
  weaponType: z
    .enum([
      "wand",
      "sword",
      "staff",
      "bow",
      "herbs",
      "two-handed-sword",
      "fist",
      "claws",
      "harp",
      "spoon",
    ])
    .nullable()
    .optional(),
  stats: z
    .object({
      str: bounded.optional(),
      int: bounded.optional(),
      agi: bounded.optional(),
      mnd: bounded.optional(),
      vit: bounded.optional(),
      def: bounded.optional(),
      atk: bounded.optional(),
      mat: bounded.optional(),
      rtk: bounded.optional(),
    })
    .default({}),
  shopPrice: z.number().int().min(1).max(1000000).nullable().optional(),
  isPurchasable: z.boolean().default(true),
});
export type EquipmentInput = z.infer<typeof itemSchema>;
export const loadoutInput = z
  .object({
    ...Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, z.string().max(100).nullable().optional()])) as Record<typeof EQUIPMENT_SLOTS[number], z.ZodOptional<z.ZodNullable<z.ZodString>>>,
    crossClassAbility1: z.string().max(100).nullable().optional(),
    crossClassAbility2: z.string().max(100).nullable().optional(),
  });
export type LoadoutInput = z.infer<typeof loadoutInput>;
export const purchaseInput = z.object({ itemId: equipmentIdSchema });
