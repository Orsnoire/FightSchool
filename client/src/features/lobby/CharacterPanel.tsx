import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EQUIPMENT_SLOTS, SLOT_LABELS } from "@shared/equipment-catalog";
import { type EquipmentItemDb } from "@shared/schema";
import { RefreshCw } from "lucide-react";

import type { LobbyStudent } from "./types";
import type { useClassAppearance } from "./useClassAppearance";
import type { useLobbyEquipment } from "./useLobbyEquipment";

export function CharacterPanel({ student, equippedItemsMap, equippedVisuals, savedAppearance, openClassModal }: {
  student: LobbyStudent;
  equippedItemsMap: Record<string, EquipmentItemDb>;
  equippedVisuals: ReturnType<typeof useLobbyEquipment>['equippedVisuals'];
  savedAppearance: ReturnType<typeof useClassAppearance>['savedAppearance'];
  openClassModal: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Character</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <PlayerAvatar
          characterClass={student.characterClass}
          appearance={savedAppearance.data}
          loadout={student} visuals={equippedVisuals}
          gender={student.gender}
          size="lg"
        />
        {savedAppearance.data && <p className="text-xs text-muted-foreground">Equipped appearance</p>}
        <div className="text-center">
          <h2 className="text-2xl font-bold break-words" data-testid="text-nickname">{student.characterName || student.nickname}</h2>
          <p className="text-muted-foreground capitalize">{student.characterClass}</p>
        </div>
        <div className="w-full space-y-2 text-sm">
          {EQUIPMENT_SLOTS.map(slot => <div key={slot} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{SLOT_LABELS[slot]}:</span>
            <span className="font-semibold text-right" data-testid={`text-${slot}`}>
              {student[slot] ? (equippedItemsMap[student[slot]] ? `${equippedItemsMap[student[slot]].name} · Tier ${equippedItemsMap[student[slot]].tier}` : "Loading item…") : "None"}
            </span>
          </div>)}
        </div>

        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={openClassModal}
          data-testid="button-open-class-modal"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Change Class or Appearance
        </Button>
      </CardContent>
    </Card>
  );
}
