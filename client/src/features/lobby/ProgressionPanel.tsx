import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTotalPassiveBonuses } from "@shared/jobSystem";
import { ALL_CHARACTER_CLASSES, type CharacterClass, type StudentJobLevel } from "@shared/schema";
import { Crosshair, Heart, Shield, Sparkles, Sword, TrendingUp, Zap } from "lucide-react";

import type { CharacterStats } from "@shared/schema";
import type { LobbyStudent } from "./types";

export function ProgressionPanel({ student, jobLevels, previewStats }: { student: LobbyStudent; jobLevels: StudentJobLevel[]; previewStats: CharacterStats }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Class Progression
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(() => {
          // Convert job levels array to map
          const jobLevelMap: Record<CharacterClass, number> = Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, 0])) as Record<CharacterClass, number>;

          jobLevels.forEach(jl => {
            jobLevelMap[jl.jobClass] = jl.level;
          });

          const currentClassLevel = jobLevelMap[student.characterClass] || 0;
          const currentJobLevel = jobLevels.find(jl => jl.jobClass === student.characterClass);
          const currentExp = currentJobLevel?.experience || 0;
          const passiveBonuses = getTotalPassiveBonuses(jobLevelMap);

          return (
            <>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Current Class Level</div>
                <div className="text-3xl font-bold text-primary capitalize">
                  {student.characterClass} Lv{currentClassLevel}
                </div>
                <div className="text-sm text-muted-foreground mt-1" data-testid="text-experience">
                  {currentExp} XP
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-muted-foreground">Character Stats</div>
                {(() => {
                  const stats = previewStats;
                  return (
                    <>
                      {/* Primary Stats */}
                      <div className="grid grid-cols-5 gap-2 text-center">
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">STR</div>
                          <div className="font-bold text-damage">{stats.str}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">INT</div>
                          <div className="font-bold text-primary">{stats.int}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">AGI</div>
                          <div className="font-bold text-mana">{stats.agi}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">MND</div>
                          <div className="font-bold text-healing">{stats.mnd}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground">VIT</div>
                          <div className="font-bold text-health">{stats.vit}</div>
                        </div>
                      </div>

                      {/* Derived Combat Stats */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Heart className="h-3 w-3" />
                            HP
                          </div>
                          <div className="font-bold text-health">{stats.hp}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Zap className="h-3 w-3" />
                            MP
                          </div>
                          <div className="font-bold text-mana">{stats.mp}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Shield className="h-3 w-3" />
                            DEF
                          </div>
                          <div className="font-bold text-primary">{stats.def}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Sword className="h-3 w-3" />
                            ATK
                          </div>
                          <div className="font-bold text-damage">{stats.atk}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            MAT
                          </div>
                          <div className="font-bold text-primary">{stats.mat}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                            <Crosshair className="h-3 w-3" />
                            RTK
                          </div>
                          <div className="font-bold text-mana">{stats.rtk}</div>
                        </div>
                      </div>

                      {/* Max Combo Points if applicable */}
                      {stats.maxComboPoints > 0 && (
                        <div className="p-2 bg-muted rounded text-center">
                          <div className="text-xs text-muted-foreground">Max Combo Points</div>
                          <div className="font-bold text-primary">{stats.maxComboPoints}</div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

            </>
          );
        })()}
      </CardContent>
    </Card>
  );
}
