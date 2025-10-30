import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { Sparkles, Clock, Heart, Swords, Shield, ShieldCheck, Star, Cloud, Beaker, Plus, Ghost, Flame, Target, Locate } from "lucide-react";
import type { PlayerState, CharacterClass } from "@shared/schema";
import { HEALER_CLASSES } from "@shared/schema";
import { ABILITY_DISPLAYS, JOB_ABILITY_SLOTS, type AbilityDisplay } from "@shared/abilityUI";
import { ULTIMATE_ABILITIES } from "@shared/ultimateAbilities";

interface HealingModalProps {
  open: boolean;
  players: Record<string, PlayerState>;
  currentPlayerId: string;
  currentHealTarget: string | null;
  healerClass: CharacterClass;
  timeRemaining?: number; // Timer in seconds
  hasChosenToHeal: boolean; // Parent-managed state
  onChooseToHeal: (abilityId: string) => void; // Callback when player chooses to heal with specific ability
  onSelectTarget: (targetId: string) => void;
  onDeclineHealing?: () => void; // Callback when player chooses not to heal
}

// Helper to map icon names to Lucide components
const ICON_MAP: Record<string, any> = {
  Heart, Shield, ShieldCheck, Star, Cloud, Beaker, Plus, Ghost, Flame, Target, Locate, Sparkles
};

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
  const currentPlayer = players[currentPlayerId];
  
  // Get available healing abilities for this player
  const getAvailableHealingAbilities = (): { ability: AbilityDisplay; available: boolean; reason?: string }[] => {
    if (!currentPlayer) return [];
    
    const results: { ability: AbilityDisplay; available: boolean; reason?: string }[] = [];
    
    // Get current job level
    const currentJobLevel = currentPlayer.jobLevels?.[currentPlayer.characterClass] || 1;
    
    // Check job-specific healing abilities
    const jobAbilities = JOB_ABILITY_SLOTS[currentPlayer.characterClass];
    if (jobAbilities) {
      Object.entries(jobAbilities).forEach(([levelKey, abilityId]) => {
        const ability = ABILITY_DISPLAYS[abilityId];
        if (ability && ability.abilityClass.includes("healing") && ability.opensHealingWindow) {
          // Check if player has this ability based on level
          const levelRequired = parseInt(levelKey.replace("level", ""));
          const hasAbility = currentJobLevel >= levelRequired;
          
          if (hasAbility) {
            // Check resources
            let available = true;
            let reason: string | undefined;
            
            if (abilityId === "healing_potion" && currentPlayer.potionCount <= 0) {
              available = false;
              reason = "No potions";
            } else if ((abilityId === "mend" || abilityId === "healing_guard") && currentPlayer.mp < 1) {
              available = false;
              reason = "No MP";
            }
            
            results.push({ ability, available, reason });
          }
        }
      });
    }
    
    // Check cross-class healing abilities
    [currentPlayer.crossClassAbility1, currentPlayer.crossClassAbility2].forEach(abilityId => {
      if (abilityId) {
        const ability = ABILITY_DISPLAYS[abilityId];
        if (ability && ability.abilityClass.includes("healing") && ability.opensHealingWindow) {
          let available = true;
          let reason: string | undefined;
          
          if (abilityId === "healing_potion_crossclass" && currentPlayer.potionCount <= 0) {
            available = false;
            reason = "No potions";
          } else if ((abilityId === "mend_crossclass" || abilityId === "healing_guard_ally_crossclass") && currentPlayer.mp < 1) {
            available = false;
            reason = "No MP";
          }
          
          results.push({ ability, available, reason });
        }
      }
    });
    
    // Check ultimate healing abilities (level 15)
    const ultimateAbility = jobAbilities?.level15;
    if (ultimateAbility && currentJobLevel >= 15) {
      const ability = ABILITY_DISPLAYS[ultimateAbility];
      if (ability && ability.abilityClass.includes("healing") && ability.abilityClass.includes("ultimate")) {
        // Check if on cooldown
        const available = !currentPlayer.lastUltimatesUsed?.includes(ultimateAbility);
        const reason = available ? undefined : "On cooldown";
        
        results.push({ ability, available, reason });
      }
    }
    
    return results;
  };
  
  const availableHealingAbilities = getAvailableHealingAbilities();
  
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center">
              Use a Healing Ability?
            </DialogTitle>
            {timeRemaining !== undefined && (
              <div className="flex items-center justify-center gap-2 text-lg font-semibold text-muted-foreground pt-2">
                <Clock className="h-5 w-5" />
                <span>{timeRemaining}s remaining</span>
              </div>
            )}
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <p className="text-center text-muted-foreground text-sm">
              If you choose to heal, you won't deal damage this turn (even if you answer correctly)
            </p>
            
            {availableHealingAbilities.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {availableHealingAbilities.map(({ ability, available, reason }) => {
                  const IconComponent = ICON_MAP[ability.icon] || Heart;
                  
                  return (
                    <Button
                      key={ability.id}
                      variant={available ? "default" : "outline"}
                      className={`h-32 flex-col gap-2 ${
                        available 
                          ? 'bg-health hover:bg-health/90 border-health text-white' 
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => {
                        if (available) {
                          onChooseToHeal(ability.id);
                        }
                      }}
                      disabled={!available}
                      data-testid={`button-heal-ability-${ability.id}`}
                    >
                      <IconComponent className="h-12 w-12" />
                      <span className="text-sm font-semibold text-center">{ability.name}</span>
                      {!available && reason && (
                        <span className="text-xs opacity-70">{reason}</span>
                      )}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <p>No healing abilities available</p>
              </div>
            )}
            
            <div className="pt-4">
              <Button
                size="lg"
                variant="outline"
                className="w-full h-16 text-lg"
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
