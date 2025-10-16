import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sword, Shield as ShieldIcon, Crown, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getCrossClassAbilities } from "@shared/jobSystem";
import { EQUIPMENT_ITEMS, type Student, type StudentJobLevel, type CharacterClass } from "@shared/schema";
import type { Ability } from "@shared/jobSystem";

export default function StudentEquipment() {
  const { toast } = useToast();
  const studentId = localStorage.getItem("studentId");

  const { data: student, isLoading: studentLoading } = useQuery<Student>({
    queryKey: [`/api/student/${studentId}`],
  });

  const { data: jobLevels = [], isLoading: levelsLoading } = useQuery<StudentJobLevel[]>({
    queryKey: [`/api/student/${studentId}/job-levels`],
    enabled: !!studentId,
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async (data: { weapon?: string; headgear?: string; armor?: string; crossClassAbility1?: string | null; crossClassAbility2?: string | null }) => {
      return apiRequest("PATCH", `/api/student/${studentId}/equipment`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/student/${studentId}`] });
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

  const availableAbilities = student ? getCrossClassAbilities(student.characterClass, jobLevelMap) : [];

  const handleEquipAbility = (slot: 1 | 2, abilityId: string | null) => {
    if (slot === 1) {
      updateEquipmentMutation.mutate({ crossClassAbility1: abilityId });
    } else {
      updateEquipmentMutation.mutate({ crossClassAbility2: abilityId });
    }
  };

  const handleEquipmentChange = (slot: "weapon" | "headgear" | "armor", itemId: string) => {
    updateEquipmentMutation.mutate({ [slot]: itemId });
  };

  const getEquipmentOptions = (slot: "weapon" | "headgear" | "armor") => {
    return Object.values(EQUIPMENT_ITEMS).filter(item => {
      if (item.slot !== slot) return false;
      if (item.classRestriction && !item.classRestriction.includes(student?.characterClass || "knight")) return false;
      return true;
    });
  };

  if (studentLoading || levelsLoading) {
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
              {/* Weapon */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Sword className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Weapon</p>
                    <p className="text-sm text-muted-foreground">
                      {EQUIPMENT_ITEMS[student.weapon]?.name || "Basic Weapon"}
                    </p>
                  </div>
                </div>
                <Select
                  value={student.weapon}
                  onValueChange={(value) => handleEquipmentChange("weapon", value)}
                >
                  <SelectTrigger className="w-48" data-testid="select-weapon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getEquipmentOptions("weapon").map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Headgear */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Headgear</p>
                    <p className="text-sm text-muted-foreground">
                      {EQUIPMENT_ITEMS[student.headgear]?.name || "Basic Headgear"}
                    </p>
                  </div>
                </div>
                <Select
                  value={student.headgear}
                  onValueChange={(value) => handleEquipmentChange("headgear", value)}
                >
                  <SelectTrigger className="w-48" data-testid="select-headgear">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getEquipmentOptions("headgear").map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Armor */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ShieldIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Armor</p>
                    <p className="text-sm text-muted-foreground">
                      {EQUIPMENT_ITEMS[student.armor]?.name || "Basic Armor"}
                    </p>
                  </div>
                </div>
                <Select
                  value={student.armor}
                  onValueChange={(value) => handleEquipmentChange("armor", value)}
                >
                  <SelectTrigger className="w-48" data-testid="select-armor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getEquipmentOptions("armor").map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
