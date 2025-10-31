import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Swords } from "lucide-react";
import type { PlayerState, CharacterClass } from "@shared/schema";
import { ABILITY_DISPLAYS, JOB_ABILITY_SLOTS, type AbilityDisplay } from "@shared/abilityUI";
import { ULTIMATE_ABILITIES } from "@shared/ultimateAbilities";
import { useModalTimer } from "@/hooks/useModalTimer";
import * as LucideIcons from "lucide-react";

interface AbilitySelectionModalProps {
  open: boolean;
  player: PlayerState;
  timeRemaining?: number; // Phase timer in seconds
  onSelectAbility: (abilityId: string) => void;
  onSelectBaseDamage: () => void;
}

// Helper to map icon names to Lucide components
const getIconComponent = (iconName: string): React.ComponentType<any> => {
  return (LucideIcons as any)[iconName] || Swords;
};

export function AbilitySelectionModal({
  open,
  player,
  timeRemaining,
  onSelectAbility,
  onSelectBaseDamage,
}: AbilitySelectionModalProps) {
  const { canSkip, remainingTime } = useModalTimer(5, open);

  // Get all available abilities for this player
  const getAvailableAbilities = (): { ability: AbilityDisplay; available: boolean; reason?: string }[] => {
    const results: { ability: AbilityDisplay; available: boolean; reason?: string }[] = [];
    
    // Get current job level
    const currentJobLevel = player.jobLevels?.[player.characterClass] || 1;
    
    // Check job-specific abilities (exclude passives)
    const jobAbilities = JOB_ABILITY_SLOTS[player.characterClass];
    if (jobAbilities) {
      Object.entries(jobAbilities).forEach(([levelKey, abilityId]) => {
        const ability = ABILITY_DISPLAYS[abilityId];
        if (!ability || ability.isPassive) return; // Skip passives
        
        // Check if player has this ability based on level
        const levelRequired = parseInt(levelKey.replace("level", ""));
        const hasAbility = currentJobLevel >= levelRequired;
        
        if (hasAbility) {
          // Check resources
          let available = true;
          let reason: string | undefined;
          
          // Check MP for spells
          if (ability.abilityClass.includes("spell") && player.mp < 1) {
            available = false;
            reason = "No MP";
          }
          
          // Check combo points for scout abilities
          if (abilityId === "headshot" && player.comboPoints < 3) {
            available = false;
            reason = `Need 3 combo (${player.comboPoints}/3)`;
          }
          
          // Check potion count for herbalist
          if (abilityId === "healing_potion" && player.potionCount <= 0) {
            available = false;
            reason = "No potions";
          }
          
          // Check cooldowns (example for abilities with cooldowns)
          // TODO: Add cooldown tracking to player state
          
          results.push({ ability, available, reason });
        }
      });
    }
    
    // Check cross-class abilities
    [player.crossClassAbility1, player.crossClassAbility2].forEach(abilityId => {
      if (abilityId) {
        const ability = ABILITY_DISPLAYS[abilityId];
        if (!ability || ability.isPassive) return;
        
        let available = true;
        let reason: string | undefined;
        
        // Check resources
        if (ability.abilityClass.includes("spell") && player.mp < 1) {
          available = false;
          reason = "No MP";
        }
        
        if (abilityId === "healing_potion_crossclass" && player.potionCount <= 0) {
          available = false;
          reason = "No potions";
        }
        
        results.push({ ability, available, reason });
      }
    });
    
    // Check ultimate abilities (level 15+)
    if (currentJobLevel >= 15) {
      const ultimateId = jobAbilities?.level15;
      if (ultimateId) {
        const ultimate = ULTIMATE_ABILITIES[ultimateId];
        if (ultimate) {
          const ability = ABILITY_DISPLAYS[ultimateId];
          if (ability) {
            // Check if on cooldown (3-fight cooldown)
            const lastUsed = player.lastUltimatesUsed?.[ultimateId] || 0;
            const available = (player.fightCount - lastUsed) >= 3;
            const reason = available ? undefined : `Cooldown (${3 - (player.fightCount - lastUsed)} fights)`;
            
            results.push({ ability, available, reason });
          }
        }
      }
    }
    
    return results;
  };
  
  const availableAbilities = getAvailableAbilities();

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-[80vw] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center">
            Would you like to use an ability?
          </DialogTitle>
          {timeRemaining !== undefined && (
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-muted-foreground pt-2">
              <Clock className="h-5 w-5" />
              <span>{timeRemaining}s remaining</span>
            </div>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-4">
          {/* Abilities Grid */}
          {availableAbilities.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Your Abilities</h3>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {availableAbilities.map(({ ability, available, reason }) => {
                  const IconComponent = getIconComponent(ability.icon);
                  
                  return (
                    <Button
                      key={ability.id}
                      variant={available ? "default" : "outline"}
                      disabled={!available}
                      className="h-auto p-4 flex flex-col items-center gap-2"
                      onClick={() => onSelectAbility(ability.id)}
                      data-testid={`ability-${ability.id}`}
                    >
                      <IconComponent className="h-8 w-8" />
                      <span className="text-xs font-semibold text-center leading-tight">
                        {ability.name}
                      </span>
                      {!available && reason && (
                        <span className="text-xs text-destructive font-medium">
                          {reason}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Special Actions */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Basic Actions</h3>
            
            {/* Base Damage button (everyone) */}
            <Button
              variant="outline"
              className="w-full h-16 text-lg font-semibold hover-elevate"
              onClick={onSelectBaseDamage}
              data-testid="button-base-damage"
            >
              <Swords className="h-6 w-6 mr-2" />
              Do Base Damage Instead
            </Button>
          </div>
        </div>
        
        {/* Skip button (appears after minimum display time) */}
        {canSkip && (
          <div className="flex justify-end px-4 pb-2">
            <button
              className="text-sm text-muted-foreground hover:text-foreground underline"
              onClick={onSelectBaseDamage}
              data-testid="button-skip"
            >
              Next ({remainingTime}s)
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
