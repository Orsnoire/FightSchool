import { EQUIPMENT_ITEMS, calculateTierPrice, type EquipmentItem } from "./schema";

/** Defined progression gear stocks every guild; starters and untiered legacy drops do not. */
export function builtinShopItems(catalog: Record<string, EquipmentItem> = EQUIPMENT_ITEMS) {
  return Object.values(catalog)
    .filter((item): item is EquipmentItem & { tier: number } =>
      typeof item.tier === "number" && Number.isInteger(item.tier) && item.tier > 0,
    )
    .map((item) => ({
      ...item,
      quality: item.rarity,
      iconUrl: null,
      itemType: item.weaponType || item.offhandType || item.armorCategory || item.slot,
      isPurchasable: true,
      shopPrice: calculateTierPrice(item.tier, item.rarity),
    }));
}

/** Purchase resolution uses exactly the same catalog as the shop listings. */
export function builtinShopItem(id: string) {
  return builtinShopItems().find((item) => item.id === id);
}
