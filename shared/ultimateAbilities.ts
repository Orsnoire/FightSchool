import type { CharacterClass } from "./schema";

export type AnimationType = "fire" | "ice" | "holy" | "dark" | "nature" | "lightning" | "spirit";

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
  // Base class ultimates (level 15 cross-class abilities)
  warrior: {
    id: "berserker_rage",
    name: "Berserker Rage",
    description: "Enter a battle frenzy, dealing devastating physical damage to all enemies",
    jobClass: "warrior",
    animationType: "lightning",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "STR × 6 + ATK × 4",
    },
  },

  wizard: {
    id: "arcane_barrage",
    name: "Arcane Barrage",
    description: "Unleash a torrent of pure magical energy that obliterates all foes",
    jobClass: "wizard",
    animationType: "fire",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "INT × 6 + MAT × 4",
    },
  },

  scout: {
    id: "assassinate",
    name: "Assassinate",
    description: "Strike from the shadows with lethal precision, dealing massive damage",
    jobClass: "scout",
    animationType: "dark",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "AGI × 6 + RTK × 4",
    },
  },

  herbalist: {
    id: "sacred_grove",
    name: "Sacred Grove",
    description: "Call upon nature's blessing to fully restore all allies",
    jobClass: "herbalist",
    animationType: "nature",
    cooldown: 3,
    effect: {
      type: "heal",
      value: "100% HP to all allies",
    },
  },

  // Advanced class ultimates
  warlock: {
    id: "soul_drain",
    name: "Soul Drain",
    description: "Drain the life force from all enemies to restore your own",
    jobClass: "warlock",
    animationType: "dark",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "INT × 4 (heals for 50% damage dealt)",
    },
  },

  priest: {
    id: "divine_grace",
    name: "Divine Grace",
    description: "Heal all players to full HP and restore any KO'ed players to full HP",
    jobClass: "priest",
    animationType: "holy",
    cooldown: 3,
    effect: {
      type: "heal",
      value: "100% HP to all allies, revive KO'ed",
    },
  },

  paladin: {
    id: "holy_judgment",
    name: "Holy Judgment",
    description: "Heals all players for (VIT+MND) HP and deals (STR+VIT+MND)/3 healing damage to all enemies",
    jobClass: "paladin",
    animationType: "holy",
    cooldown: 3,
    effect: {
      type: "heal",
      value: "(VIT+MND) to allies, (STR+VIT+MND)/3 damage",
    },
  },

  dark_knight: {
    id: "shadow_requiem",
    name: "Shadow Requiem",
    description: "Deals ATK*(STR+VIT+INT) melee damage to all enemies. Dark Knight is healed for all damage done",
    jobClass: "dark_knight",
    animationType: "dark",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "ATK × (STR+VIT+INT) (heals for 100% damage)",
    },
  },

  blood_knight: {
    id: "raining_blood",
    name: "Raining Blood",
    description: "Deal ATK*(STR+VIT+INT) magic damage to all enemies. Heal all allies for 50% of damage dealt",
    jobClass: "blood_knight",
    animationType: "dark",
    cooldown: 3,
    effect: {
      type: "damage",
      value: "ATK × (STR+VIT+INT) (heals allies 50%)",
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
    vit: number;
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
    case "berserker_rage":
      return playerStats.str * 6 + playerStats.atk * 4;
    
    case "arcane_barrage":
      return playerStats.int * 6 + playerStats.mat * 4;
    
    case "assassinate":
      return playerStats.agi * 6 + playerStats.rtk * 4;
    
    case "sacred_grove":
      return playerStats.maxHealth; // Full heal to all allies
    
    case "soul_drain":
      return playerStats.int * 4; // Heals for 50% of this damage
    
    case "divine_grace":
      return playerStats.maxHealth; // Full heal to all allies, revive KO'ed
    
    case "holy_judgment":
      // Returns healing amount for allies: VIT + MND (damage to enemies = (STR+VIT+MND)/3)
      return playerStats.vit + playerStats.mnd;
    
    case "shadow_requiem":
      return playerStats.atk * (playerStats.str + playerStats.vit + playerStats.int);
    
    case "raining_blood":
      return playerStats.atk * (playerStats.str + playerStats.vit + playerStats.int);
    
    default:
      return 0;
  }
}
