import type { CharacterClass } from "./schema";

export type AnimationType = "warrior" | "wizard" | "scout" | "herbalist";

export interface UltimateAbility {
  id: string;
  name: string;
  description: string;
  jobClass: CharacterClass;
  animationType: AnimationType;
  cooldown: number; // Number of fights before can use again
  effect: {
    type: "damage" | "heal" | "buff";
    value: string; // Formula description (e.g., "STR × 3 + ATK × 2")
  };
}

export const ULTIMATE_ABILITIES: Record<string, UltimateAbility> = {
  // Warrior tree ultimates
  knight: {
    id: "divine_slash",
    name: "Divine Slash",
    description: "Unleash a holy strike that deals massive damage to all enemies",
    jobClass: "knight",
    animationType: "warrior",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "STR × 5 + ATK × 3",
    },
  },

  paladin: {
    id: "holy_restoration",
    name: "Holy Restoration",
    description: "Channel divine energy to fully heal all allies",
    jobClass: "paladin",
    animationType: "warrior",
    cooldown: 4,
    effect: {
      type: "heal",
      value: "100% HP to all allies",
    },
  },

  dark_knight: {
    id: "shadow_rend",
    name: "Shadow Rend",
    description: "Sacrifice your own HP to deal devastating dark damage",
    jobClass: "dark_knight",
    animationType: "warrior",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "(Current HP × 0.5) + (STR × 4)",
    },
  },

  // Wizard tree ultimates
  sage: {
    id: "meteor_storm",
    name: "Meteor Storm",
    description: "Rain destruction from the heavens upon all foes",
    jobClass: "sage",
    animationType: "wizard",
    cooldown: 4,
    effect: {
      type: "damage",
      value: "INT × 6 + MAT × 4",
    },
  },

  warlock: {
    id: "soul_drain",
    name: "Soul Drain",
    description: "Drain the life force from all enemies to restore your own",
    jobClass: "warlock",
    animationType: "wizard",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "INT × 4 (heals for 50% damage dealt)",
    },
  },

  // Scout tree ultimates
  ranger: {
    id: "rapid_barrage",
    name: "Rapid Barrage",
    description: "Fire a devastating volley of arrows at lightning speed",
    jobClass: "ranger",
    animationType: "scout",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "AGI × 5 + RTK × 3",
    },
  },

  monk: {
    id: "thousand_fists",
    name: "Thousand Fists",
    description: "Unleash an unstoppable flurry of strikes",
    jobClass: "monk",
    animationType: "scout",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "(STR + AGI) × 3",
    },
  },

  // Herbalist tree ultimates
  druid: {
    id: "natures_wrath",
    name: "Nature's Wrath",
    description: "Call upon the fury of nature to devastate enemies and heal allies",
    jobClass: "druid",
    animationType: "herbalist",
    cooldown: 4,
    effect: {
      type: "damage",
      value: "MND × 4 + MAT × 2 (heals all allies for 25% damage)",
    },
  },
};

// Helper to check if player has ultimate available
export function getAvailableUltimates(
  jobLevels: Record<CharacterClass, number>,
  lastUltimatesUsed: Record<string, number>, // Maps ultimate ID to fights ago
  currentFight: number
): UltimateAbility[] {
  const available: UltimateAbility[] = [];

  for (const [jobClass, ultimate] of Object.entries(ULTIMATE_ABILITIES)) {
    const level = jobLevels[jobClass as CharacterClass] || 0;
    
    // Must be level 15 in this job
    if (level >= 15) {
      const lastUsed = lastUltimatesUsed[ultimate.id] || -999;
      const fightsAgo = currentFight - lastUsed;
      
      // Check if cooldown has expired
      if (fightsAgo >= ultimate.cooldown || lastUsed === -999) {
        available.push(ultimate);
      }
    }
  }

  return available;
}

// Calculate ultimate damage/healing based on player stats
export function calculateUltimateEffect(
  ultimateId: string,
  playerStats: {
    str: number;
    int: number;
    agi: number;
    mnd: number;
    atk: number;
    mat: number;
    rtk: number;
    health: number;
    maxHealth: number;
  }
): number {
  const ultimate = Object.values(ULTIMATE_ABILITIES).find(u => u.id === ultimateId);
  if (!ultimate) return 0;

  switch (ultimateId) {
    case "divine_slash":
      return playerStats.str * 5 + playerStats.atk * 3;
    
    case "holy_restoration":
      return playerStats.maxHealth; // Full heal
    
    case "shadow_rend":
      return Math.floor(playerStats.health * 0.5) + playerStats.str * 4;
    
    case "meteor_storm":
      return playerStats.int * 6 + playerStats.mat * 4;
    
    case "soul_drain":
      return playerStats.int * 4;
    
    case "rapid_barrage":
      return playerStats.agi * 5 + playerStats.rtk * 3;
    
    case "thousand_fists":
      return (playerStats.str + playerStats.agi) * 3;
    
    case "natures_wrath":
      return playerStats.mnd * 4 + playerStats.mat * 2;
    
    default:
      return 0;
  }
}
