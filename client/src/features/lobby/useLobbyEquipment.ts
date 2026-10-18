import { fetchEquipmentItems } from "@/lib/equipment";
import { EQUIPMENT_SLOTS } from "@shared/equipment-catalog";
import { type EquipmentItemDb, type Student } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";


export function useLobbyEquipment(student: Student | undefined) {
  // Fetch equipped items
  const equippedItemIds = EQUIPMENT_SLOTS.map(slot => student?.[slot]).filter(Boolean) as string[];
  const { data: equippedItems = [], isFetching: equipmentFetching, isError: equipmentError } = useQuery<EquipmentItemDb[]>({
    queryKey: ['equipment-items', { ids: equippedItemIds.sort() }],
    queryFn: async () => {
      if (equippedItemIds.length === 0) return [];
      return fetchEquipmentItems(equippedItemIds);
    },
    enabled: equippedItemIds.length > 0,
  });

  const equippedVisuals = Object.fromEntries(EQUIPMENT_SLOTS.flatMap(slot => { const item = equippedItems.find(i => i.id === student?.[slot]); return item?.visual ? [[slot, item.visual]] : []; }));

  // Fetch inventory items
  const inventoryIds = [...(student?.inventory || [])];
  const { data: inventoryItems = [] } = useQuery<EquipmentItemDb[]>({
    queryKey: ['equipment-items', { ids: inventoryIds.sort() }],
    queryFn: async () => {
      if (inventoryIds.length === 0) return [];
      return fetchEquipmentItems(inventoryIds);
    },
    enabled: inventoryIds.length > 0,
  });

  // Create a lookup map for equipped items
  const equippedItemsMap = (equippedItems || []).reduce((acc: Record<string, EquipmentItemDb>, item: EquipmentItemDb) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<string, EquipmentItemDb>);

  return { equippedItems, inventoryItems, equippedItemsMap, equippedVisuals, equipmentFetching, equipmentError };
}
