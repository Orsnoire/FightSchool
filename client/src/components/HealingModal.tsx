import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { Sparkles, Clock, Heart, Swords } from "lucide-react";
import type { PlayerState, CharacterClass } from "@shared/schema";
import { HEALER_CLASSES } from "@shared/schema";

interface HealingModalProps {
  open: boolean;
  players: Record<string, PlayerState>;
  currentPlayerId: string;
  currentHealTarget: string | null;
  healerClass: CharacterClass;
  timeRemaining?: number; // Timer in seconds
  hasChosenToHeal: boolean; // Parent-managed state
  onChooseToHeal: () => void; // Callback when player chooses to heal
  onSelectTarget: (targetId: string) => void;
  onDeclineHealing?: () => void; // Callback when player chooses not to heal
}

export function HealingModal({ 
  open, 
  players, 
  currentPlayerId, 
  currentHealTarget,
  healerClass,
  timeRemaining,
  hasChosenToHeal,
  onChooseToHeal,
  onSelectTarget,
  onDeclineHealing
}: HealingModalProps) {
  // Filter: Only show players with missing HP
  const filteredPlayers = Object.values(players).filter(p => {
    if (p.isDead) return false;
    return p.health < p.maxHealth;
  });

  // Sort: By most missing HP to least (descending missing HP)
  const sortedPlayers = filteredPlayers.sort((a, b) => {
    const aMissingHP = a.maxHealth - a.health;
    const bMissingHP = b.maxHealth - b.health;
    return bMissingHP - aMissingHP; // Most missing HP first
  });
  
  const getHealerTypeLabel = (characterClass: CharacterClass) => {
    if (characterClass === "herbalist") return "Potion Healing";
    if (characterClass === "priest") return "Mend Spell";
    if (characterClass === "paladin") return "Healing Guard";
    return "Healing";
  };
  
  // If player hasn't chosen to heal yet, show choice screen
  if (!hasChosenToHeal) {
    return (
      <Dialog open={open}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center">
              Choose Your Action
            </DialogTitle>
            {timeRemaining !== undefined && (
              <div className="flex items-center justify-center gap-2 text-lg font-semibold text-muted-foreground pt-2">
                <Clock className="h-5 w-5" />
                <span>{timeRemaining}s remaining</span>
              </div>
            )}
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-6">
            <p className="text-center text-muted-foreground">
              If you choose to heal, you won't deal damage this turn (even if you answer correctly)
            </p>
            
            <Button
              size="lg"
              variant="default"
              className="h-20 text-lg bg-health hover:bg-health/90 border-health"
              onClick={onChooseToHeal}
              data-testid="button-choose-heal"
            >
              <Heart className="h-6 w-6 mr-2" />
              Heal an Ally
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              className="h-20 text-lg"
              onClick={() => {
                if (onDeclineHealing) {
                  onDeclineHealing();
                }
              }}
              data-testid="button-choose-damage"
            >
              <Swords className="h-6 w-6 mr-2" />
              Deal Damage Instead
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[75vw] max-h-[75vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center text-health">
            {getHealerTypeLabel(healerClass)} - Select Target
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
              const isMyTarget = currentHealTarget === player.studentId;
              const allHealers = Object.values(players).filter(
                p => p.isHealing && 
                p.healTarget === player.studentId && 
                HEALER_CLASSES.includes(p.characterClass) && 
                !p.isDead
              );
              const otherHealers = allHealers.filter(p => p.studentId !== currentPlayerId);
              const isBeingHealed = allHealers.length > 0;
              
              const healthPercentage = (player.health / player.maxHealth) * 100;
              const needsHealing = healthPercentage < 80;
              
              return (
                <Button
                  key={player.studentId}
                  variant={isBeingHealed ? "default" : "outline"}
                  className={`h-auto p-6 flex flex-col items-center gap-3 ${
                    isBeingHealed ? 'bg-health border-health text-white' : ''
                  } ${isMyTarget ? 'ring-2 ring-health ring-offset-2' : ''} ${
                    needsHealing ? 'border-health/50' : ''
                  }`}
                  onClick={() => onSelectTarget(player.studentId)}
                  data-testid={`button-heal-${player.studentId}`}
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
                    {needsHealing && (
                      <div className="text-xs text-health font-medium flex items-center justify-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        <span>Needs Healing</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {isMyTarget && (
                      <div className="flex items-center gap-1 text-health font-bold">
                        <Sparkles className="h-4 w-4" />
                        <span>Your Target</span>
                      </div>
                    )}
                    {otherHealers.length > 0 && (
                      <div className="text-xs opacity-70">
                        +{otherHealers.length} other healer{otherHealers.length > 1 ? 's' : ''}
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
