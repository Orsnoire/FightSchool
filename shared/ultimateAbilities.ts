import type { CharacterClass } from "./schema";

export type AnimationType = "fire" | "ice" | "holy" | "dark" | "nature" | "lightning" | "spirit";

export interface UltimateAbility {
  id: string;
  name: string;
  description: string;
  jobClass: CharacterClass;
  animationType: AnimationType;
  cooldown: number;
  effect: {
    type: "damage" | "heal" | "buff";
    value: string;
  };
}

export const ULTIMATE_ABILITIES: Record<string, UltimateAbility> = {
  unbreakable: {
    id: "unbreakable",
    name: "Unbreakable",
    description: "Warrior blocks all damage for the remainder of the round. 1 use per fight. Shield bash can activate on damage blocked in this way.",
    jobClass: "warrior",
    animationType: "lightning",
    cooldown: 1,
    effect: {
      type: "buff",
      value: "Block all damage this round",
    },
  },

  manabomb: {
    id: "manabomb",
    name: "Manabomb",
    description: "Once per encounter. Phase 2 cast. Deal INT*2 Arcane damage to all current enemies.",
    jobClass: "wizard",
    animationType: "fire",
    cooldown: 1,
    effect: {
      type: "damage",
      value: "INT × 2 to all enemies",
    },
  },

  killshot: {
    id: "killshot",
    name: "Killshot",
    description: "Once per encounter. Deals RTK*AGI*2 ranged damage. For each 5% of enemy HP below 45%, adds +10% chance to instantly kill the target.",
    jobClass: "scout",
    animationType: "dark",
    cooldown: 1,
    effect: {
      type: "damage",
      value: "RTK × AGI × 2 + execute chance",
    },
  },

  life_potion: {
    id: "life_potion",
    name: "Life Potion",
    description: "Phase 2 instant. Revive all KO'd allies (return each KOed player to MND HP).",
    jobClass: "herbalist",
    animationType: "nature",
    cooldown: 1,
    effect: {
      type: "heal",
      value: "Revive all KO'd allies to MND HP",
    },
  },

  soul_echo: {
    id: "soul_echo",
    name: "Soul Echo",
    description: "Passive: Hex now deals bonus curse damage in the first combat round after it is cast.",
    jobClass: "warlock",
    animationType: "dark",
    cooldown: 0,
    effect: {
      type: "buff",
      value: "Enhanced hex damage",
    },
  },

  divine_grace: {
    id: "divine_grace",
    name: "Divine Grace",
    description: "Heal all players to full HP and restore any KO'ed players to full HP. Phase 2 ability. Limit: 1 use per fight. Costs 5 MP.",
    jobClass: "priest",
    animationType: "holy",
    cooldown: 1,
    effect: {
      type: "heal",
      value: "100% HP to all allies, revive KO'ed",
    },
  },

  holy_judgment: {
    id: "holy_judgment",
    name: "Holy Judgment",
    description: "Heals all current players for (VIT+MND) HP and deals (STR+VIT+MND)/3 healing damage to all current enemies.",
    jobClass: "paladin",
    animationType: "holy",
    cooldown: 1,
    effect: {
      type: "heal",
      value: "(VIT+MND) to allies, (STR+VIT+MND)/3 damage",
    },
  },

  shadow_requiem: {
    id: "shadow_requiem",
    name: "Shadow Requiem",
    description: "Deals ATK*(STR+VIT+INT) melee dmg to all current enemies. Dark Knight is healed for all damage done in this way. Once per fight.",
    jobClass: "dark_knight",
    animationType: "dark",
    cooldown: 1,
    effect: {
      type: "damage",
      value: "ATK × (STR+VIT+INT) + 100% lifesteal",
    },
  },

  raining_blood: {
    id: "raining_blood",
    name: "Raining Blood",
    description: "Deal ATK*(STR+VIT+INT) magic damage to all current enemies. Heal all allies for 50% of the damage dealt in this way.",
    jobClass: "blood_knight",
    animationType: "dark",
    cooldown: 1,
    effect: {
      type: "damage",
      value: "ATK × (STR+VIT+INT) + 50% party heal",
    },
  },

  arrowstorm: {
    id: "arrowstorm",
    name: "Arrowstorm",
    description: "The ranger deals 10 waves of damage to all targets, and 1 final hit to the marked target. Each wave deals base damage, final hit deals base damage × 2. Once per encounter.",
    jobClass: "ranger",
    animationType: "nature",
    cooldown: 1,
    effect: {
      type: "damage",
      value: "10 waves of base damage + final hit × 2",
    },
  },
};

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
  switch (ultimateId) {
    case "unbreakable":
      return 0; // Buff effect, no damage/heal value
    
    case "manabomb":
      return playerStats.int * 2;
    
    case "killshot":
      return playerStats.rtk * playerStats.agi * 2;
    
    case "life_potion":
      return playerStats.mnd; // Revive amount per ally
    
    case "soul_echo":
      return 0; // Passive effect
    
    case "divine_grace":
      return playerStats.maxHealth; // Full heal to all allies, revive KO'ed
    
    case "holy_judgment":
      return playerStats.vit + playerStats.mnd; // Healing amount
    
    case "shadow_requiem":
      return playerStats.atk * (playerStats.str + playerStats.vit + playerStats.int);
    
    case "raining_blood":
      return playerStats.atk * (playerStats.str + playerStats.vit + playerStats.int);
    
    case "arrowstorm":
      return playerStats.rtk + (2 * playerStats.agi); // Base damage per wave
    
    default:
      return 0;
  }
}
