import { Button } from "@/components/ui/button";
import { 
  Shield, Swords, Target, Zap, Flame, Snowflake, ShieldHalf, Bomb,
  Crosshair, Eye, Focus, Skull, Heart, Beaker, FlaskRound, Leaf,
  Ghost, LifeBuoy, TrendingUp, Waves, Sparkles, Wind, Sun, Star,
  HeartPulse, Hand, ShieldCheck, Sword, Axe, Droplet, UserX, Cloud,
  Syringe, Activity, Dna, CloudRain, Plus, LucideIcon
} from "lucide-react";
import type { CharacterClass } from "@shared/schema";
import { getJobAbilities, ABILITY_DISPLAYS, type AbilityIcon } from "@shared/abilityUI";
import { ULTIMATE_ABILITIES } from "@shared/ultimateAbilities";

// Map icon names to Lucide components
const ICON_MAP: Record<AbilityIcon, LucideIcon> = {
  Shield, Swords, Target, Zap, Flame, Snowflake, ShieldHalf, Bomb,
  Crosshair, Eye, Focus, Skull, Heart, Beaker, FlaskRound, Leaf,
  Ghost, LifeBuoy, TrendingUp, Waves, Sparkles, Wind, Sun, Star,
  HeartPulse, Hand, ShieldCheck, Sword, Axe, Droplet, UserX, Cloud,
  Syringe, Activity, Dna, CloudRain, Plus
};

interface AbilityBarProps {
  currentJob: CharacterClass;
  currentJobLevel: number;
  crossClassAbility1?: string; // Ultimate ability ID (from other job)
  crossClassAbility2?: string; // Ultimate ability ID (from other job)
  onAbilityClick: (abilityId: string) => void;
  disabledAbilities?: Set<string>; // Abilities currently on cooldown or unavailable
  isDead?: boolean;
  isWaitingPhase?: boolean;
}

export function AbilityBar({
  currentJob,
  currentJobLevel,
  crossClassAbility1,
  crossClassAbility2,
  onAbilityClick,
  disabledAbilities = new Set(),
  isDead = false,
  isWaitingPhase = false,
}: AbilityBarProps) {
  const jobAbilities = getJobAbilities(currentJob, currentJobLevel);
  
  const renderAbilitySlot = (
    slotNumber: number,
    abilityId: string | undefined,
    isUnlocked: boolean,
    isCrossClass: boolean = false
  ) => {
    // Empty cross-class slot
    if (isCrossClass && !abilityId) {
      return (
        <div
          key={`slot-${slotNumber}`}
          className="w-16 h-16 rounded-md border-2 border-border/50 bg-muted/20"
          data-testid={`ability-slot-${slotNumber}-empty`}
        />
      );
    }
    
    // Get ability display config
    const display = abilityId ? ABILITY_DISPLAYS[abilityId] : undefined;
    
    // For ultimates (cross-class abilities), get from ULTIMATE_ABILITIES
    const ultimate = isCrossClass && abilityId ? ULTIMATE_ABILITIES[abilityId] : undefined;
    const IconComponent = display ? ICON_MAP[display.icon] : undefined;
    
    if (!display || !IconComponent) {
      return (
        <div
          key={`slot-${slotNumber}`}
          className="w-16 h-16 rounded-md border-2 border-border/50 bg-muted/20"
          data-testid={`ability-slot-${slotNumber}-empty`}
        />
      );
    }
    
    const isDisabled = !isUnlocked || isDead || isWaitingPhase || (abilityId ? disabledAbilities.has(abilityId) : false);
    const isPassive = display.isPassive;
    
    return (
      <Button
        key={`slot-${slotNumber}`}
        size="icon"
        variant={isUnlocked && !isDisabled ? "default" : "outline"}
        onClick={() => !isPassive && isUnlocked && abilityId && onAbilityClick(abilityId)}
        disabled={isDisabled || isPassive}
        className="w-16 h-16 rounded-md"
        data-testid={`ability-slot-${slotNumber}-${abilityId || 'empty'}`}
        title={ultimate ? ultimate.description : display.name}
        style={{
          opacity: isUnlocked ? (isDisabled ? 0.5 : 1) : 0.3,
        }}
      >
        <IconComponent className="h-8 w-8" />
      </Button>
    );
  };
  
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-sm border-t border-border p-3"
      style={{ paddingLeft: '10vw', paddingRight: '10vw', paddingBottom: '10vh' }}
      data-testid="ability-bar"
    >
      <div className="flex items-center justify-center gap-3">
        {/* Slots 1-5: Current job abilities */}
        {jobAbilities.map((ability) =>
          renderAbilitySlot(ability.slot, ability.abilityId, ability.isUnlocked, false)
        )}
        
        {/* Slots 6-7: Cross-class abilities */}
        {renderAbilitySlot(6, crossClassAbility1, !!crossClassAbility1, true)}
        {renderAbilitySlot(7, crossClassAbility2, !!crossClassAbility2, true)}
      </div>
    </div>
  );
}
