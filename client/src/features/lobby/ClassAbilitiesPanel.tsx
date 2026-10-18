import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ABILITY_DISPLAYS, JOB_ABILITY_SLOTS } from "@shared/abilityUI";
import { abilityPreview, type AbilityContext } from "@shared/combat/abilityValues";
import { ALL_CHARACTER_CLASSES, type CharacterClass, type StudentJobLevel } from "@shared/schema";
import { Lock, Sparkles } from "lucide-react";

import type { LobbyStudent } from "./types";

export function ClassAbilitiesPanel({ student, jobLevels, previewPlayer, showAbilityValues }: { student: LobbyStudent; jobLevels: StudentJobLevel[]; previewPlayer: AbilityContext; showAbilityValues: boolean }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Class Abilities
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Abilities unlock as you level up your current class
        </p>
      </CardHeader>
      <CardContent>
        {(() => {
          if (!student?.characterClass) return null;

          // Convert job levels array to map
          const jobLevelMap: Record<CharacterClass, number> = Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, 0])) as Record<CharacterClass, number>;

          jobLevels.forEach(jl => {
            jobLevelMap[jl.jobClass] = jl.level;
          });

          const currentClassLevel = jobLevelMap[student.characterClass] || 0;
          const abilitySlots = JOB_ABILITY_SLOTS[student.characterClass];

          if (!abilitySlots || Object.keys(abilitySlots).length === 0) {
            return (
              <div className="text-center py-8 text-muted-foreground">
                <p>No abilities for this class</p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <p className="text-xs text-muted-foreground md:col-span-2">Values use your equipped gear and starting combat resources. Target bonuses and missing HP affect final results.</p>
              {[...(student.characterClass === "priest" ? [["level1", "first_aid"]] : []), ...Object.entries(abilitySlots)].map(([levelKey, abilityId]) => {
                // Extract number from "level1", "level4", etc.
                const unlockLevel = parseInt(levelKey.replace("level", ""));
                const isUnlocked = currentClassLevel >= unlockLevel;
                const abilityDisplay = ABILITY_DISPLAYS[abilityId];

                if (!abilityDisplay) return null;

                return (
                  <Card
                    key={abilityId}
                    className={`${!isUnlocked ? "opacity-60" : ""}`}
                    data-testid={`ability-${abilityId}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded bg-muted ${!isUnlocked ? "grayscale" : ""}`}>
                          <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm">{abilityDisplay.name}</h4>
                            {!isUnlocked && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {isUnlocked ? (
                              <><p>{abilityDisplay.description}</p>{showAbilityValues && abilityPreview(previewPlayer, abilityId, true) && <p className="mt-1 font-semibold" data-testid={`lobby-ability-preview-${abilityId}`}>{abilityPreview(previewPlayer, abilityId, true)}</p>}</>
                            ) : (
                              <div className="flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                <span>Unlocks at level {unlockLevel}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
