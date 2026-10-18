import { AvatarAppearanceEditor } from '@/components/AvatarAppearanceEditor';
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { StaticAvatar } from '@/components/StaticAvatar';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AVATAR_JOBS, JOB_PRESENTATION, type AvatarJob } from '@shared/avatar/appearance';
import { getUnlockedJobs } from "@shared/jobSystem";
import { ALL_CHARACTER_CLASSES, type CharacterClass, type StudentJobLevel } from "@shared/schema";

import type { LobbyStudent } from "./types";
import type { useClassAppearance } from "./useClassAppearance";
import type { useLobbyEquipment } from "./useLobbyEquipment";

export function ClassAppearanceDialog({ student, jobLevels, equippedVisuals, controller }: {
  student: LobbyStudent; jobLevels: StudentJobLevel[];
  equippedVisuals: ReturnType<typeof useLobbyEquipment>['equippedVisuals'];
  controller: ReturnType<typeof useClassAppearance>;
}) {
  const { savedAppearance, appearanceDraft, setAppearanceDraft, previewJob, setPreviewJob, showClassModal, setShowClassModal, handleClassChange } = controller;
  return (
    <Dialog open={showClassModal} onOpenChange={setShowClassModal}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">Select Your Class</DialogTitle>
          <DialogDescription>
            Preview your starter outfit, then select a class below to save. Gear and cross-class ability choices are remembered for each job. Your appearance is shared across jobs. Unfinished weapons display empty hands.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4 items-center">
          <StaticAvatar appearance={appearanceDraft} job={previewJob} loadout={previewJob === student.characterClass ? student : undefined} visuals={previewJob === student.characterClass ? equippedVisuals : undefined} className="h-72 aspect-[1200/1950] mx-auto" />
          <div className="space-y-4">
            <label className="block text-sm">Preview job<select aria-label="Preview job" className="block w-full mt-1 rounded border p-2 bg-background" value={previewJob} onChange={e => setPreviewJob(e.target.value as AvatarJob)}>
              {AVATAR_JOBS.map(job => <option key={job} value={job}>{JOB_PRESENTATION[job].name}</option>)}
            </select></label>
            <AvatarAppearanceEditor value={appearanceDraft} onChange={setAppearanceDraft} modelLocked />
            <p className="text-sm text-muted-foreground">{previewJob === student.characterClass ? "Previewing your equipped gear." : "Starter gear preview. Returning jobs restore their saved loadout."}</p>
            <Button disabled={savedAppearance.isLoading || savedAppearance.isError || savedAppearance.saving} onClick={() => student.characterClass && handleClassChange(student.characterClass)}>Save Appearance</Button>
            {savedAppearance.isError && <p role="alert">Your saved appearance could not load. <button className="underline" onClick={() => savedAppearance.refetch()}>Try again</button></p>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
          {(() => {
            // Convert job levels array to map
            const jobLevelMap: Record<CharacterClass, number> = Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, 0])) as Record<CharacterClass, number>;

            jobLevels.forEach(jl => {
              jobLevelMap[jl.jobClass] = jl.level;
            });

            // Get only unlocked jobs based on requirements
            const unlockedJobs = getUnlockedJobs(jobLevelMap, student.grantedJobs || []);

            return unlockedJobs.map((classType) => {
              const level = jobLevelMap[classType] || 0;
              const isCurrentClass = student.characterClass === classType;

              return (
                <Card
                  key={classType}
                  className={`cursor-pointer hover-elevate transition-all ${isCurrentClass ? "ring-2 ring-primary bg-primary/5" : ""
                    }`}
                  onClick={() => handleClassChange(classType)}
                  data-testid={`modal-class-${classType}`}
                >
                  <CardContent className="p-4 flex flex-col items-center gap-3">
                    <div className="relative">
                      <PlayerAvatar
                        characterClass={classType}
                        appearance={appearanceDraft}
                        loadout={classType === student.characterClass ? student : undefined} visuals={classType === student.characterClass ? equippedVisuals : undefined}
                        gender={student.gender || undefined}
                        size="md"
                      />
                      <Badge
                        className="absolute -bottom-2 -right-2 h-6 w-6 flex items-center justify-center p-0 rounded-full text-xs font-bold"
                        variant={level > 0 ? "default" : "secondary"}
                      >
                        {level}
                      </Badge>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold capitalize text-sm">
                        {classType.replace('_', ' ')}
                      </p>
                      {isCurrentClass && (
                        <p className="text-xs text-primary mt-1">Current</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
