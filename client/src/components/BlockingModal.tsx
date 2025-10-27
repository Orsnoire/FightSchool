import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { Shield } from "lucide-react";
import type { PlayerState } from "@shared/schema";
import { TANK_CLASSES } from "@shared/schema";

interface BlockingModalProps {
  open: boolean;
  players: Record<string, PlayerState>;
  currentPlayerId: string;
  currentBlockTarget: string | null;
  onSelectTarget: (targetId: string) => void;
}

export function BlockingModal({ 
  open, 
  players, 
  currentPlayerId, 
  currentBlockTarget,
  onSelectTarget 
}: BlockingModalProps) {
  const alivePlayers = Object.values(players).filter(p => !p.isDead);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[75vw] max-h-[75vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center">
            Select Ally to Protect
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {alivePlayers.map((player) => {
              const isMyTarget = currentBlockTarget === player.studentId;
              const allBlockers = Object.values(players).filter(
                p => p.blockTarget === player.studentId && 
                TANK_CLASSES.includes(p.characterClass) && 
                !p.isDead
              );
              const otherBlockers = allBlockers.filter(p => p.studentId !== currentPlayerId);
              const isBeingBlocked = allBlockers.length > 0;
              
              return (
                <Button
                  key={player.studentId}
                  variant={isBeingBlocked ? "default" : "outline"}
                  className={`h-auto p-6 flex flex-col items-center gap-3 ${
                    isBeingBlocked ? 'bg-warrior border-warrior text-white' : ''
                  } ${isMyTarget ? 'ring-2 ring-warrior ring-offset-2' : ''}`}
                  onClick={() => onSelectTarget(player.studentId)}
                  data-testid={`button-block-${player.studentId}`}
                >
                  <PlayerAvatar 
                    characterClass={player.characterClass} 
                    gender={player.gender} 
                    size="md" 
                  />
                  <span className="text-base font-semibold">{player.nickname}</span>
                  <div className="w-full space-y-1">
                    <HealthBar 
                      current={player.health} 
                      max={player.maxHealth} 
                      showText={true} 
                      className="w-full" 
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {isMyTarget && (
                      <div className="flex items-center gap-1 text-warrior font-bold">
                        <Shield className="h-4 w-4" />
                        <span>You're Protecting</span>
                      </div>
                    )}
                    {otherBlockers.length > 0 && (
                      <div className="text-xs opacity-70">
                        +{otherBlockers.length} other tank{otherBlockers.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
