import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { ABILITY_DISPLAYS } from "@shared/abilityUI";
import { getCrossClassAbilities, type Ability } from "@shared/jobSystem";
import { ALL_CHARACTER_CLASSES, type CharacterClass, type StudentJobLevel } from "@shared/schema";
import { Filter, Lock, Sparkles } from "lucide-react";
import { useState } from "react";

import { AbilityIcon, AbilitySlot, DraggableAbility } from "./AbilityDragItems";
import type { LobbyStudent } from "./types";

export function CrossClassPanel({ student, jobLevels, updateCrossClassAbility }: {
  student: LobbyStudent; jobLevels: StudentJobLevel[];
  updateCrossClassAbility: (slot: 1 | 2, abilityId: string | null) => Promise<void>;
}) {
  const [draggedAbility, setDraggedAbility] = useState<Ability | null>(null);
  const [abilityFilter, setAbilityFilter] = useState<"all" | "healing" | "spell" | "physical" | "ultimate">("all");
  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Drag-and-drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const ability = event.active.data.current?.ability as Ability;
    setDraggedAbility(ability);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedAbility(null);

    if (!over) return;

    const ability = active.data.current?.ability as Ability;
    const slotId = over.id as string;

    if (slotId === "slot-1") {
      updateCrossClassAbility(1, ability.id);
    } else if (slotId === "slot-2") {
      updateCrossClassAbility(2, ability.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Cross-Class Abilities
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Equip up to 2 abilities from other classes you've leveled up
        </p>
      </CardHeader>
      <CardContent>
        {(() => {
          // Create job level map
          const jobLevelMap: Record<CharacterClass, number> = Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, 0])) as Record<CharacterClass, number>;
          jobLevels.forEach(jl => {
            jobLevelMap[jl.jobClass] = jl.level;
          });

          const availableAbilities = student?.characterClass
            ? getCrossClassAbilities(student.characterClass, jobLevelMap)
            : [];

          if (availableAbilities.length === 0) {
            return (
              <div className="text-center py-8 text-muted-foreground">
                <p>No cross-class abilities unlocked yet</p>
                <p className="text-xs mt-2">Level other jobs to unlock abilities!</p>
              </div>
            );
          }

          const equippedAbility1 = availableAbilities.find(a => a.id === student?.crossClassAbility1);
          const equippedAbility2 = availableAbilities.find(a => a.id === student?.crossClassAbility2);

          // Slot 2 is locked until level 30
          const currentLevel = jobLevels.find(jl => jl.jobClass === student?.characterClass)?.level || 0;
          const slot2Locked = currentLevel < 30;

          // Filter abilities based on selected filter
          const filteredAbilities = abilityFilter === "all"
            ? availableAbilities
            : availableAbilities.filter(ability => {
              const display = ABILITY_DISPLAYS[ability.id];
              if (!display || !display.abilityClass) return false;
              // Check if the ability has the selected filter in its abilityClass array
              return display.abilityClass.includes(abilityFilter);
            });

          return (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-4">
                {/* Equipment Slots */}
                <div className="flex gap-3">
                  <AbilitySlot
                    slotNumber={1}
                    equippedAbility={equippedAbility1}
                    isLocked={false}
                    onRemove={() => updateCrossClassAbility(1, null)}
                  />
                  <AbilitySlot
                    slotNumber={2}
                    equippedAbility={equippedAbility2}
                    isLocked={slot2Locked}
                    onRemove={() => updateCrossClassAbility(2, null)}
                  />
                </div>

                {/* Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={abilityFilter === "all" ? "default" : "outline"}
                      onClick={() => setAbilityFilter("all")}
                      data-testid="filter-all"
                    >
                      All
                    </Button>
                    <Button
                      size="sm"
                      variant={abilityFilter === "healing" ? "default" : "outline"}
                      onClick={() => setAbilityFilter("healing")}
                      data-testid="filter-healing"
                    >
                      Healing
                    </Button>
                    <Button
                      size="sm"
                      variant={abilityFilter === "spell" ? "default" : "outline"}
                      onClick={() => setAbilityFilter("spell")}
                      data-testid="filter-spell"
                    >
                      Spell
                    </Button>
                    <Button
                      size="sm"
                      variant={abilityFilter === "physical" ? "default" : "outline"}
                      onClick={() => setAbilityFilter("physical")}
                      data-testid="filter-physical"
                    >
                      Physical
                    </Button>
                    <Button
                      size="sm"
                      variant={abilityFilter === "ultimate" ? "default" : "outline"}
                      onClick={() => setAbilityFilter("ultimate")}
                      data-testid="filter-ultimate"
                    >
                      Ultimate
                    </Button>
                  </div>
                </div>

                {/* Ability Grid */}
                <div className="border-2 border-border rounded-md p-4 bg-muted/20 min-h-[200px]">
                  {filteredAbilities.length === 0 ? (
                    <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                      <p className="text-sm">No abilities in this category</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {filteredAbilities.map((ability) => (
                        <DraggableAbility key={ability.id} ability={ability} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/20 rounded-md">
                  <p className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <strong>Drag & Drop:</strong> Drag ability icons to equipment slots
                  </p>
                  <p className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <strong>Hover:</strong> See ability name on hover
                  </p>
                  <p className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <strong>Right-click/Long-press:</strong> View full ability description
                  </p>
                  {slot2Locked && (
                    <p className="flex items-center gap-1 text-primary">
                      <Lock className="h-3 w-3" />
                      <strong>Slot 2 unlocks at level 30</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Drag Overlay */}
              <DragOverlay>
                {draggedAbility && <AbilityIcon ability={draggedAbility} isDragging={true} />}
              </DragOverlay>
            </DndContext>
          );
        })()}
      </CardContent>
    </Card>
  );
}
