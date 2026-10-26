import { CrossClassPanel } from "@/features/lobby/CrossClassPanel";
import { useLoadoutActions } from "@/features/lobby/useLoadoutActions";
import { GearComparison } from "@/components/GearComparison";
import { equipmentEffectText } from "@shared/tier-one-equipment";
import { EquipmentPermissions } from "@/components/EquipmentPermissions";
import { useStudentLoadout } from "@/hooks/useStudentLoadout";
import { saveStudentLoadout } from "@/lib/studentLoadout";
import { fetchEquipmentItems } from "@/lib/equipment";
import { EQUIPMENT_SLOTS, SLOT_LABELS } from "@shared/equipment-catalog";
import { equipmentUnavailable } from "@shared/equipment-rules";
import type { EquipmentSlot } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield as ShieldIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type CharacterClass, type EquipmentItemDb } from "@shared/schema";

export default function StudentEquipment() {
  const { toast } = useToast();
  const studentId = localStorage.getItem("studentId");

  const client = useQueryClient();
  const { updateCrossClassAbility } = useLoadoutActions(studentId);
  const {student,jobLevels,isLoading:studentLoading,isFetching:loadoutFetching,isError:loadoutError} = useStudentLoadout(studentId);

  // Fetch equipped items
  const equippedItemIds = EQUIPMENT_SLOTS.map(slot => student?.[slot]).filter(Boolean) as string[];
  const { data: equippedItems = [], isFetching:equipmentFetching, isError:equipmentError } = useQuery<EquipmentItemDb[]>({
    queryKey: ['equipment-items', { ids: equippedItemIds.sort() }],
    queryFn: async () => {
      if (equippedItemIds.length === 0) return [];
      return fetchEquipmentItems(equippedItemIds);
    },
    enabled: equippedItemIds.length > 0,
  });

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

  // Create lookup map for equipped items
  const equippedItemsMap = (equippedItems || []).reduce((acc: Record<string, EquipmentItemDb>, item: EquipmentItemDb) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<string, EquipmentItemDb>);

  const updateEquipmentMutation = useMutation({
    mutationFn: async (data: Partial<Record<EquipmentSlot,string|null>> & { crossClassAbility1?: string | null; crossClassAbility2?: string | null }) => {
      return saveStudentLoadout(client, studentId!, "equipment", data);
    },
    onSuccess: () => {
      toast({ title: "Equipment updated!" });
    },
    onError: () => {
      toast({ title: "Failed to update equipment", variant: "destructive" });
    },
  });

  const jobLevelMap = jobLevels.reduce((acc, jl) => {
    acc[jl.jobClass] = jl.level;
    return acc;
  }, {} as Record<CharacterClass, number>);

  const handleEquipmentChange = (slot: EquipmentSlot, itemId: string) => {
    updateEquipmentMutation.mutate({ [slot]: itemId === "none" ? null : itemId });
  };

  const getEquipmentOptions = (slot: EquipmentSlot) => {
    return inventoryItems.filter(item => item.slot === slot);
  };

  if (studentLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading equipment...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Student not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-serif font-bold text-primary" data-testid="text-title">
            Equipment & Abilities
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-4xl font-serif font-bold mb-2" data-testid="text-page-title">
            Character Loadout
          </h2>
          <p className="text-muted-foreground">
            Customize your equipment and cross-class abilities
          </p>
        </div>

        <div className="grid gap-6">
          <EquipmentPermissions job={student.characterClass || 'warrior'} ranks={student.aaRanks} />
          {/* Equipment Section */}
          <Card data-testid="card-equipment">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldIcon className="h-5 w-5" />
                Equipment
              </CardTitle>
              <CardDescription>
                Choose your gear for battle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {EQUIPMENT_SLOTS.map(slot => <div key={slot} className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <label htmlFor={`equipment-${slot}`} className="font-medium">{SLOT_LABELS[slot]}</label>
                  <p className="text-sm text-muted-foreground">{student[slot] ? (equippedItemsMap[student[slot]] ? `${equippedItemsMap[student[slot]].name} · Tier ${equippedItemsMap[student[slot]].tier}` : 'Loading item…') : 'None'}</p>
                  {equipmentEffectText(student[slot] || "") && <p className="text-sm">{equipmentEffectText(student[slot] || "")}</p>}
                </div>
                <Select value={student[slot] || 'none'} onValueChange={value => handleEquipmentChange(slot, value)} disabled={updateEquipmentMutation.isPending}>
                  <SelectTrigger id={`equipment-${slot}`} className="w-48" data-testid={`select-${slot}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {getEquipmentOptions(slot).map(item => {
                      const reason = equipmentUnavailable(student.characterClass || 'warrior', item, jobLevelMap[student.characterClass || 'warrior'] || 1, equippedItemsMap[student.weapon || ''] || null, equippedItemsMap[student.offhand || ''] || null, student.aaRanks);
                      return <SelectItem key={item.id} value={item.id} disabled={!!reason}>{item.name} · Tier {item.tier}{reason ? ` — ${reason}` : ''}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <details className="basis-full"><summary className="cursor-pointer text-sm">Compare {SLOT_LABELS[slot]} options</summary><div className="grid gap-2 sm:grid-cols-2 mt-2">{getEquipmentOptions(slot).map(item=><GearComparison key={item.id} item={item} context={{student,items:equippedItemsMap,level:jobLevelMap[student.characterClass || 'warrior'] || 1,loading:loadoutFetching || equipmentFetching,error:loadoutError || equipmentError}}><p className="text-sm">{item.name}</p></GearComparison>)}</div></details>
              </div>)}
            </CardContent>
          </Card>

          {student.characterClass && student.gender && <CrossClassPanel
            student={{ ...student, characterClass: student.characterClass, gender: student.gender }}
            jobLevels={jobLevels} updateCrossClassAbility={updateCrossClassAbility} />}
        </div>
      </main>
    </div>
  );
}
