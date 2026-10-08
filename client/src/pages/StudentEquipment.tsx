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
import { Shield as ShieldIcon, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getCrossClassAbilities } from "@shared/jobSystem";
import { type Student, type StudentJobLevel, type CharacterClass, type EquipmentItemDb } from "@shared/schema";
import type { Ability } from "@shared/jobSystem";

export default function StudentEquipment() {
  const { toast } = useToast();
  const studentId = localStorage.getItem("studentId");

  const client = useQueryClient();
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

  const availableAbilities = student && student.characterClass ? getCrossClassAbilities(student.characterClass, jobLevelMap) : [];

  const handleEquipAbility = (slot: 1 | 2, abilityId: string | null) => {
    if (slot === 1) {
      updateEquipmentMutation.mutate({ crossClassAbility1: abilityId });
    } else {
      updateEquipmentMutation.mutate({ crossClassAbility2: abilityId });
    }
  };

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

  const equippedAbility1 = availableAbilities.find(a => a.id === student.crossClassAbility1);
  const equippedAbility2 = availableAbilities.find(a => a.id === student.crossClassAbility2);

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
          <EquipmentPermissions job={student.characterClass || 'warrior'} />
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
                      const reason = equipmentUnavailable(student.characterClass || 'warrior', item, jobLevelMap[student.characterClass || 'warrior'] || 1, equippedItemsMap[student.weapon || ''] || null, equippedItemsMap[student.offhand || ''] || null);
                      return <SelectItem key={item.id} value={item.id} disabled={!!reason}>{item.name} · Tier {item.tier}{reason ? ` — ${reason}` : ''}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <details className="basis-full"><summary className="cursor-pointer text-sm">Compare {SLOT_LABELS[slot]} options</summary><div className="grid gap-2 sm:grid-cols-2 mt-2">{getEquipmentOptions(slot).map(item=><GearComparison key={item.id} item={item} context={{student,items:equippedItemsMap,level:jobLevelMap[student.characterClass || 'warrior'] || 1,loading:loadoutFetching || equipmentFetching,error:loadoutError || equipmentError}}><p className="text-sm">{item.name}</p></GearComparison>)}</div></details>
              </div>)}
            </CardContent>
          </Card>

          {/* Cross-Class Abilities Section */}
          <Card data-testid="card-cross-class-abilities">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Cross-Class Abilities
              </CardTitle>
              <CardDescription>
                Equip abilities from other jobs you've unlocked (max 2)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ability Slot 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Ability Slot 1</p>
                  {equippedAbility1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEquipAbility(1, null)}
                      data-testid="button-remove-ability-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {equippedAbility1 ? (
                  <div className="p-3 bg-muted rounded-md" data-testid="ability-slot-1">
                    <p className="font-medium">{equippedAbility1.name}</p>
                    <p className="text-sm text-muted-foreground">{equippedAbility1.description}</p>
                  </div>
                ) : (
                  <Select
                    value={student.crossClassAbility1 || "none"}
                    onValueChange={(value) => handleEquipAbility(1, value === "none" ? null : value)}
                  >
                    <SelectTrigger data-testid="select-ability-1">
                      <SelectValue placeholder="Select ability..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {availableAbilities
                        .filter(a => a.id !== student.crossClassAbility2)
                        .map(ability => (
                          <SelectItem key={ability.id} value={ability.id}>
                            {ability.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Ability Slot 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Ability Slot 2</p>
                  {equippedAbility2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEquipAbility(2, null)}
                      data-testid="button-remove-ability-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {equippedAbility2 ? (
                  <div className="p-3 bg-muted rounded-md" data-testid="ability-slot-2">
                    <p className="font-medium">{equippedAbility2.name}</p>
                    <p className="text-sm text-muted-foreground">{equippedAbility2.description}</p>
                  </div>
                ) : (
                  <Select
                    value={student.crossClassAbility2 || "none"}
                    onValueChange={(value) => handleEquipAbility(2, value === "none" ? null : value)}
                  >
                    <SelectTrigger data-testid="select-ability-2">
                      <SelectValue placeholder="Select ability..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {availableAbilities
                        .filter(a => a.id !== student.crossClassAbility1)
                        .map(ability => (
                          <SelectItem key={ability.id} value={ability.id}>
                            {ability.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {availableAbilities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No cross-class abilities available yet.</p>
                  <p className="text-sm mt-1">Level up other jobs to unlock cross-class abilities!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
