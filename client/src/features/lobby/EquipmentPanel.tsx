import { EquipmentPermissions } from "@/components/EquipmentPermissions";
import { GearComparison } from "@/components/GearComparison";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EQUIPMENT_SLOTS, SLOT_LABELS } from "@shared/equipment-catalog";
import { equipmentUnavailable } from "@shared/equipment-rules";
import { type EquipmentItemDb, type EquipmentSlot, type StudentJobLevel } from "@shared/schema";
import { equipmentEffectText } from "@shared/tier-one-equipment";
import { Crown, Shield, Sword } from "lucide-react";
import { useState } from "react";

import type { LobbyStudent } from "./types";
const RARITY_COLORS = {
  common: "border-gray-400",
  rare: "border-blue-500",
  epic: "border-purple-500",
  legendary: "border-yellow-500",
};


export function EquipmentPanel({ student, jobLevels, inventoryItems, equippedItemsMap, loadoutFetching, equipmentFetching, loadoutError, equipmentError, updateEquipment }: {
  student: LobbyStudent; jobLevels: StudentJobLevel[];
  inventoryItems: EquipmentItemDb[]; equippedItemsMap: Record<string, EquipmentItemDb>;
  loadoutFetching: boolean; equipmentFetching: boolean; loadoutError: boolean; equipmentError: boolean;
  updateEquipment: (slot: EquipmentSlot, itemId: string | null) => Promise<void>;
}) {
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>("weapon");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment</CardTitle>
        <p className="text-sm text-muted-foreground">Your starter wardrobe stays available for every job. Only compatible items are shown.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {EQUIPMENT_SLOTS.map((slot) => (
            <Button
              key={slot}
              variant={selectedSlot === slot ? "default" : "outline"}
              onClick={() => setSelectedSlot(slot)}
              className="capitalize"
              data-testid={`button-slot-${slot}`}
            >
              {SLOT_LABELS[slot]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <EquipmentPermissions job={student.characterClass} ranks={student.aaRanks} />
        {student[selectedSlot] && <Button variant="outline" size="sm" className="mb-4" onClick={() => updateEquipment(selectedSlot, null)}>Unequip {SLOT_LABELS[selectedSlot]}</Button>}
        {inventoryItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No equipment in inventory</p>
            <p className="text-xs mt-2">Defeat enemies to collect loot!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {inventoryItems
              .filter((item) => {
                // Filter by slot
                if (item.slot !== selectedSlot) return false;

                return true;
              })
              .map((item) => {
                const unavailable = equipmentUnavailable(student.characterClass!, item, jobLevels.find(row => row.jobClass === student.characterClass)?.level || 1, equippedItemsMap[student.weapon || ''] || null, equippedItemsMap[student.offhand || ''] || null, student.aaRanks);
                const isEquipped =
                  student[selectedSlot] === item.id;

                return (
                  <GearComparison key={item.id} item={item} context={{ student, items: equippedItemsMap, level: jobLevels.find(row => row.jobClass === student.characterClass)?.level || 1, loading: loadoutFetching || equipmentFetching, error: !!loadoutError || !!equipmentError }}>
                    <Card
                      className={`cursor-pointer hover-elevate ${isEquipped ? "ring-2 ring-primary" : ""
                        } border-2 ${RARITY_COLORS[item.quality as keyof typeof RARITY_COLORS]}`}
                      aria-disabled={!!unavailable}
                      onClick={() => { if (!unavailable) updateEquipment(selectedSlot, item.id); }}
                      data-testid={`item-${item.id}`}
                    >
                      <CardContent className="p-4 text-center">
                        <div className="h-16 flex items-center justify-center mb-2">
                          {item.iconUrl ? (
                            <img src={item.iconUrl} alt={item.name} className="h-12 w-12" />
                          ) : (
                            <div className="text-muted-foreground">
                              {item.slot === "weapon" && <Sword className="h-12 w-12" />}
                              {item.slot !== "weapon" && item.slot !== "headgear" && <Shield className="h-12 w-12" />}
                              {item.slot === "headgear" && <Crown className="h-12 w-12" />}
                            </div>
                          )}
                        </div>
                        <p className="font-semibold text-sm">{item.name}</p>
                        {equipmentEffectText(item.id) && <p className="text-xs">{equipmentEffectText(item.id)}</p>}
                        {unavailable && <p className="text-xs text-destructive">{unavailable}</p>}
                        <p className="text-xs text-muted-foreground">Tier {item.tier}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.quality}</p>
                        <div className="text-xs mt-1 space-y-0.5">
                          {item.stats.str && item.stats.str > 0 && <div className="text-damage">+{item.stats.str} STR</div>}
                          {item.stats.int && item.stats.int > 0 && <div className="text-primary">+{item.stats.int} INT</div>}
                          {item.stats.agi && item.stats.agi > 0 && <div className="text-mana">+{item.stats.agi} AGI</div>}
                          {item.stats.mnd && item.stats.mnd > 0 && <div className="text-healing">+{item.stats.mnd} MND</div>}
                          {item.stats.vit && item.stats.vit > 0 && <div className="text-health">+{item.stats.vit} VIT</div>}
                          {item.stats.atk && item.stats.atk > 0 && <div className="text-damage">+{item.stats.atk} ATK</div>}
                          {item.stats.def && item.stats.def > 0 && <div className="text-primary">+{item.stats.def} DEF</div>}
                          {item.stats.mat && item.stats.mat > 0 && <div className="text-primary">+{item.stats.mat} MAT</div>}
                          {item.stats.rtk && item.stats.rtk > 0 && <div className="text-mana">+{item.stats.rtk} RTK</div>}
                        </div>
                      </CardContent>
                    </Card>
                  </GearComparison>
                );
              })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
