import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { Clock, Crown } from "lucide-react";
import type { PlayerState, CharacterClass } from "@shared/schema";
import { TANK_CLASSES } from "@shared/schema";
import { useModalTimer } from "@/hooks/useModalTimer";

interface Enemy {
  id: string;
  name: string;
  image: string;
  health: number;
  maxHealth: number;
}

interface TargetSelectionModalProps {
  open: boolean;
  targetType: "enemy" | "ally";
  enemies?: Enemy[];
  players?: Record<string, PlayerState>;
  currentPlayerId: string;
  threatLeaderId?: string;
  timeRemaining?: number; // Phase timer in seconds
  onSelectTarget: (targetId: string) => void;
}

export function TargetSelectionModal({
  open,
  targetType,
  enemies = [],
  players = {},
  currentPlayerId,
  threatLeaderId,
  timeRemaining,
  onSelectTarget,
}: TargetSelectionModalProps) {
  const { canSkip } = useModalTimer(3, open);

  // Get title based on target type
  const getTitle = () => {
    if (targetType === "enemy") {
      return "Select Enemy Target";
    } else {
      return "Select Ally Target";
    }
  };

  // Filter and sort players for ally targeting
  const getFilteredPlayers = () => {
    const playerList = Object.values(players).filter(p => !p.isDead);
    
    if (targetType === "ally") {
      // For healing/support: prioritize players with missing HP
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
    }
    
    return playerList;
  };

  // Sort enemies by HP (highest HP first for default targeting)
  const getSortedEnemies = () => {
    return [...enemies].sort((a, b) => b.health - a.health);
  };

  const filteredPlayers = getFilteredPlayers();
  const sortedEnemies = getSortedEnemies();

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[80vw] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center">
            {getTitle()}
          </DialogTitle>
          {timeRemaining !== undefined && (
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-muted-foreground pt-2">
              <Clock className="h-5 w-5" />
              <span>{timeRemaining}s remaining</span>
            </div>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-4">
          {targetType === "enemy" && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedEnemies.map((enemy) => (
                <Button
                  key={enemy.id}
                  variant="outline"
                  className="h-auto p-4 flex flex-col items-center gap-3 hover-elevate"
                  onClick={() => onSelectTarget(enemy.id)}
                  data-testid={`target-enemy-${enemy.id}`}
                >
                  <img
                    src={enemy.image}
                    alt={enemy.name}
                    className="w-24 h-24 object-contain"
                  />
                  <span className="font-semibold text-center">{enemy.name}</span>
                  <HealthBar
                    current={enemy.health}
                    max={enemy.maxHealth}
                    className="w-full"
                  />
                  <span className="text-sm text-muted-foreground">
                    {Math.round(enemy.health)} / {Math.round(enemy.maxHealth)} HP
                  </span>
                </Button>
              ))}
            </div>
          )}
          
          {targetType === "ally" && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPlayers.map((player) => {
                const isThreatLeader = player.studentId === threatLeaderId;
                const isSelf = player.studentId === currentPlayerId;
                const allBlockers = Object.values(players).filter(
                  p => p.blockTarget === player.studentId && 
                  TANK_CLASSES.includes(p.characterClass) && 
                  !p.isDead
                );
                const isBeingBlocked = allBlockers.length > 0;
                
                return (
                  <Button
                    key={player.studentId}
                    variant={isBeingBlocked ? "default" : "outline"}
                    className={`h-auto p-4 flex flex-col items-center gap-3 ${
                      isBeingBlocked ? 'bg-warrior border-warrior text-white' : ''
                    } ${isSelf ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    onClick={() => onSelectTarget(player.studentId)}
                    data-testid={`target-player-${player.studentId}`}
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
                      {isSelf && " (You)"}
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
                    
                    {isBeingBlocked && (
                      <span className="text-xs font-semibold text-white">
                        Protected by {allBlockers.map(b => b.nickname).join(", ")}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Skip button (appears after minimum display time) */}
        {canSkip && sortedEnemies.length > 0 && targetType === "enemy" && (
          <div className="flex justify-end px-4 pb-2">
            <button
              className="text-sm text-muted-foreground hover:text-foreground underline"
              onClick={() => onSelectTarget(sortedEnemies[0].id)}
              data-testid="button-skip-target"
            >
              Next (auto-select highest HP)
            </button>
          </div>
        )}
        
        {canSkip && filteredPlayers.length > 0 && targetType === "ally" && (
          <div className="flex justify-end px-4 pb-2">
            <button
              className="text-sm text-muted-foreground hover:text-foreground underline"
              onClick={() => onSelectTarget(filteredPlayers[0].studentId)}
              data-testid="button-skip-target"
            >
              Next (auto-select most critical)
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
