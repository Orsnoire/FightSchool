import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { Shield, Clock } from "lucide-react";
import type { PlayerState } from "@shared/schema";
import { TANK_CLASSES } from "@shared/schema";

interface BlockingModalProps {
  open: boolean;
  players: Record<string, PlayerState>;
  currentPlayerId: string;
  currentBlockTarget: string | null;
  threatLeaderId?: string;
  timeRemaining?: number; // Timer in seconds
  onSelectTarget: (targetId: string) => void;
}

export function BlockingModal({ 
  open, 
  players, 
  currentPlayerId, 
  currentBlockTarget,
  threatLeaderId,
  timeRemaining,
  onSelectTarget 
}: BlockingModalProps) {
  // Filter: Only show players that are threat leader OR have missing HP
  const filteredPlayers = Object.values(players).filter(p => {
    if (p.isDead) return false;
    const isThreatLeader = threatLeaderId === p.studentId;
    const hasMissingHP = p.health < p.maxHealth;
    return isThreatLeader || hasMissingHP;
  });

  // Sort: 1st by threat (highest first), 2nd by HP (lowest first)
  const sortedPlayers = filteredPlayers.sort((a, b) => {
    // Primary sort: threat (descending)
    if (b.threat !== a.threat) {
      return b.threat - a.threat;
    }
    // Secondary sort: HP (ascending - lowest HP first)
    return a.health - b.health;
  });

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[75vw] max-h-[75vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center">
            Select Ally to Protect
          </DialogTitle>
          {timeRemaining !== undefined && (
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-muted-foreground pt-2">
              <Clock className="h-5 w-5" />
              <span>{timeRemaining}s remaining</span>
            </div>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {sortedPlayers.map((player) => {
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
