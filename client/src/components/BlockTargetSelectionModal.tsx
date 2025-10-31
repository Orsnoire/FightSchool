import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { Clock, Crown, Shield } from "lucide-react";
import type { PlayerState } from "@shared/schema";
import { useModalTimer } from "@/hooks/useModalTimer";

interface BlockTargetSelectionModalProps {
  open: boolean;
  players: Record<string, PlayerState>;
  currentPlayerId: string;
  threatLeaderId?: string;
  timeRemaining?: number; // Phase timer in seconds
  onSelectTarget: (targetId: string) => void;
}

export function BlockTargetSelectionModal({
  open,
  players,
  currentPlayerId,
  threatLeaderId,
  timeRemaining,
  onSelectTarget,
}: BlockTargetSelectionModalProps) {
  const { canSkip } = useModalTimer(3, open);

  // Filter and sort players for blocking
  // Exclude self and dead players
  const getProtectablePlayers = () => {
    const playerList = Object.values(players)
      .filter(p => !p.isDead && p.studentId !== currentPlayerId);
    
    // Prioritize by: 1) Threat leader, 2) Missing HP (most critical first)
    return playerList.sort((a, b) => {
      // Threat leader first
      const aThreat = a.studentId === threatLeaderId ? 1 : 0;
      const bThreat = b.studentId === threatLeaderId ? 1 : 0;
      if (aThreat !== bThreat) return bThreat - aThreat;
      
      // Then by missing HP (most critical first)
      const aMissingHP = a.maxHealth - a.health;
      const bMissingHP = b.maxHealth - b.health;
      return bMissingHP - aMissingHP;
    });
  };

  const protectablePlayers = getProtectablePlayers();

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[80vw] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center flex items-center justify-center gap-2">
            <Shield className="h-8 w-8" />
            Who do you want to protect?
          </DialogTitle>
          {timeRemaining !== undefined && (
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-muted-foreground pt-2">
              <Clock className="h-5 w-5" />
              <span>{timeRemaining}s remaining</span>
            </div>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {protectablePlayers.map((player) => {
              const isThreatLeader = player.studentId === threatLeaderId;
              
              return (
                <Button
                  key={player.studentId}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-3 hover-elevate"
                  onClick={() => onSelectTarget(player.studentId)}
                  data-testid={`block-target-${player.studentId}`}
                >
                  <div className="relative">
                    <PlayerAvatar
                      characterClass={player.characterClass}
                      gender={player.gender}
                      size="md"
                    />
                    {isThreatLeader && (
                      <Crown className="absolute -top-2 -right-2 h-6 w-6 text-yellow-500" />
                    )}
                  </div>
                  
                  <span className="font-semibold text-center">
                    {player.nickname}
                  </span>
                  
                  <span className="text-sm text-muted-foreground">
                    {player.characterClass.charAt(0).toUpperCase() + player.characterClass.slice(1)}
                  </span>
                  
                  <HealthBar
                    current={player.health}
                    max={player.maxHealth}
                    className="w-full"
                  />
                  
                  <span className="text-sm text-muted-foreground">
                    {Math.round(player.health)} / {Math.round(player.maxHealth)} HP
                  </span>
                  
                  {isThreatLeader && (
                    <span className="text-xs font-semibold text-yellow-600">
                      ⚠️ Threat Leader
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
        
        {/* Skip button (appears after minimum display time) */}
        {canSkip && protectablePlayers.length > 0 && (
          <div className="flex justify-end px-4 pb-2">
            <button
              className="text-sm text-muted-foreground hover:text-foreground underline"
              onClick={() => onSelectTarget(protectablePlayers[0].studentId)}
              data-testid="button-skip-block-target"
            >
              Next (auto-protect most critical)
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
