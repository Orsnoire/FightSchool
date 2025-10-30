import type { CharacterClass } from "./schema";

// Job unlock requirements
export interface JobRequirement {
  [jobClass: string]: number; // e.g., { knight: 5, herbalist: 3 } means need Knight lvl 5 AND Herbalist lvl 3
}

// Ability definition
export interface Ability {
  id: string;
  name: string;
  description: string;
  isCrossClass?: boolean; // Can be used by other jobs if unlocked
}

// Passive stat bonuses (from job levels)
export interface PassiveBonus {
  str?: number;   // Strength
  int?: number;   // Intelligence
  agi?: number;   // Agility
  mnd?: number;   // Mind
  vit?: number;   // Vitality
}

// Mechanic upgrades (non-stat improvements)
export interface MechanicUpgrade {
  maxComboPoints?: number;      // Scout: increase max combo points
  potionCraftBonus?: number;    // Herbalist: extra potions when crafting
  hexDuration?: number;          // Warlock: increase hex duration
  siphonHealBonus?: number;      // Warlock: extra healing from siphon
}

// Level rewards for a job
export interface JobLevelReward {
  abilities?: Ability[];
  passives?: PassiveBonus;
  mechanicUpgrades?: MechanicUpgrade;
}

// Complete job configuration
export interface JobConfig {
  id: CharacterClass;
  name: string;
  description: string;
  maxLevel: number;
  unlockRequirements: JobRequirement | null; // null = available from start
  levelRewards: Record<number, JobLevelReward>; // Level number -> rewards
}

// XP required for each level (1-15)
export const XP_REQUIREMENTS: Record<number, number> = {
  1: 0,      // Level 1 (starting level)
  2: 6,      // 6 XP to reach level 2 (total: 6)
  3: 12,     // 12 more XP (total: 18)
  4: 18,     // 18 more XP (total: 36)
  5: 24,     // 24 more XP (total: 60)
  6: 30,     // 30 more XP (total: 90)
  7: 36,     // 36 more XP (total: 126)
  8: 42,     // 42 more XP (total: 168)
  9: 48,     // 48 more XP (total: 216)
  10: 54,    // 54 more XP (total: 270)
  11: 60,    // 60 more XP (total: 330)
  12: 66,    // 66 more XP (total: 396)
  13: 72,    // 72 more XP (total: 468)
  14: 78,    // 78 more XP (total: 546)
  15: 84,    // 84 more XP (total: 630) - MAX LEVEL
};

// Calculate total XP needed to reach a specific level
export function getTotalXPForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += XP_REQUIREMENTS[i] || 0;
  }
  return total;
}

// Calculate XP formula: {correct} + {blocked} + {healed} + {bonus damage} - {incorrect} + {base XP}
export function calculateXP(stats: {
  questionsCorrect: number;
  questionsIncorrect: number;
  damageBlocked: number;
  healingDone: number;
  bonusDamage: number;
  baseFightXP: number;
}): number {
  const xp = 
    stats.questionsCorrect +
    stats.damageBlocked +
    stats.healingDone +
    stats.bonusDamage -
    stats.questionsIncorrect +
    stats.baseFightXP;
  
  return Math.max(0, xp); // Never negative
}

// Check if a player can level up with current XP
export function canLevelUp(currentLevel: number, currentXP: number): boolean {
  if (currentLevel >= 15) return false; // Max level reached
  const xpNeeded = XP_REQUIREMENTS[currentLevel + 1] || 0;
  return currentXP >= xpNeeded;
}

// Calculate new level after gaining XP
export function calculateNewLevel(currentLevel: number, newTotalXP: number): number {
  let level = currentLevel;
  while (level < 15 && canLevelUp(level, newTotalXP - getTotalXPForLevel(level))) {
    level++;
  }
  return level;
}

// Job tree configuration - USER WILL FILL IN LEVEL REWARDS
export const JOB_TREE: Record<CharacterClass, JobConfig> = {
  // BASE CLASSES (Available from start)
  warrior: {
    id: "warrior",
    name: "Warrior",
    description: "Tank - High health, blocks damage for allies",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      1: { 
        abilities: [{
          id: "warrior_block",
          name: "Block",
          description: "Prevents VIT/2 damage to targeted player this turn.",
          isCrossClass: false,
        }]
      },
      2: { passives: { vit: 1 } },
      3: { passives: { str: 1 } },
      4: { 
        abilities: [{
          id: "shield_bash",
          name: "Shield Bash",
          description: "Deals VIT/2 melee damage to enemy upon a successful block. CD 2.",
          isCrossClass: false,
        }]
      },
      5: { passives: { vit: 1 } },
      6: { passives: { str: 1 } },
      7: { passives: { vit: 1 } },
      8: { 
        abilities: [{
          id: "block_crossclass",
          name: "Block",
          description: "Cross-class unlock. Prevents VIT/2 damage to targeted player this turn.",
          isCrossClass: true,
        }]
      },
      9: { passives: { str: 1 } },
      10: { 
        abilities: [{
          id: "provoke",
          name: "Provoke",
          description: "CD 2. Gain current top agro + 1. Direct all damage from missed answers this round to the provoking warrior.",
          isCrossClass: false,
        }]
      },
      11: { passives: { vit: 1 } },
      12: { 
        abilities: [{
          id: "crushing_blow",
          name: "Crushing Blow",
          description: "Deals (ATK+STR) melee damage to target. +1 threat from all current enemies.",
          isCrossClass: false,
        }]
      },
      13: { passives: { str: 1 } },
      14: { passives: { vit: 1 } },
      15: { 
        abilities: [{
          id: "unbreakable",
          name: "Unbreakable",
          description: "Cross-class unlock. Warrior blocks all damage for the remainder of the round. 1 use per fight. Shield bash can activate on damage blocked in this way.",
          isCrossClass: true,
        }]
      },
    }
  },

  wizard: {
    id: "wizard",
    name: "Wizard",
    description: "DPS - Master of magical damage",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      1: { 
        abilities: [{
          id: "fireball",
          name: "Fireball",
          description: "Deals INT*3 damage to current target. Active. Costs 1 MP.",
          isCrossClass: false,
        }]
      },
      2: { passives: { int: 1 } },
      3: { passives: { vit: 1 } },
      4: { 
        abilities: [{
          id: "frostbolt",
          name: "Frost Bolt",
          description: "Can be cast during phase 2 for additional damage that round. Only usable when fireball hasn't been cast yet this round. Deals an additional INT*1 ice damage this round. Costs 1 MP.",
          isCrossClass: false,
        }]
      },
      5: { passives: { int: 1 } },
      6: { passives: { vit: 1 } },
      7: { passives: { int: 1 } },
      8: { 
        abilities: [{
          id: "fireball_crossclass",
          name: "Fireball",
          description: "Cross-class unlock. Deals INT*3 damage to current target. Costs 1 MP.",
          isCrossClass: true,
        }]
      },
      9: { passives: { int: 1 } },
      10: { 
        abilities: [{
          id: "manashield",
          name: "Manashield",
          description: "Active. CD 3. Reduce the next INT damage you would otherwise take.",
          isCrossClass: false,
        }]
      },
      11: { passives: { int: 1 } },
      12: { 
        abilities: [{
          id: "fireblast",
          name: "Fireblast",
          description: "Deals INT*(MP spent)*3 fire damage. Active. Costs all remaining MP.",
          isCrossClass: false,
        }]
      },
      13: { passives: { int: 1 } },
      14: { passives: { int: 1 } },
      15: { 
        abilities: [{
          id: "manabomb",
          name: "Manabomb",
          description: "Cross-class unlock. Once per encounter. Phase 2 cast. Deal INT*2 Arcane damage to all current enemies.",
          isCrossClass: true,
        }]
      },
    }
  },

  scout: {
    id: "scout",
    name: "Scout",
    description: "DPS - Ranged damage with combo points",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      1: { 
        abilities: [{
          id: "headshot",
          name: "Headshot",
          description: "Check box lights up when combo points reach 3. Deals RTK*(Combo Points)*AGI ranged damage. Costs 3 combo points.",
          isCrossClass: false,
        }]
      },
      2: { passives: { agi: 1 } },
      3: { passives: { vit: 1 } },
      4: { 
        abilities: [{
          id: "aim",
          name: "Aim",
          description: "Check box lights up if scout has at least 1 combo point available. Deals (RTK+AGI)*2 DMG to current target. Costs 1 combo point.",
          isCrossClass: false,
        }]
      },
      5: { passives: { agi: 1 } },
      6: { passives: { vit: 1 } },
      7: { mechanicUpgrades: { maxComboPoints: 1 } }, // +1 Combo Point max
      8: { 
        abilities: [{
          id: "headshot_crossclass",
          name: "Headshot",
          description: "Cross-class unlock (also unlocks combo points if equipped). Deals RTK*(Combo Points)*AGI ranged damage. Costs 3 combo points.",
          isCrossClass: true,
        }]
      },
      9: { passives: { agi: 1 } },
      10: { 
        abilities: [{
          id: "mark",
          name: "Mark",
          description: "Check box lights up if scout has at least 2 combo points available. Causes marked enemy to take 200% damage from all sources for the current turn. Costs 2 combo points. Used in phase 1 after answering but before the end of the phase.",
          isCrossClass: false,
        }]
      },
      11: { mechanicUpgrades: { maxComboPoints: 1 } }, // +1 Combo Point max
      12: { 
        abilities: [{
          id: "dodge",
          name: "Dodge",
          description: "Useable in phase 2 if the scout got an answer wrong. CD 3. Avoids the damage Scout would have taken this round from answering incorrectly.",
          isCrossClass: false,
        }]
      },
      13: { passives: { agi: 1 } },
      14: { passives: { agi: 1 } },
      15: { 
        abilities: [{
          id: "killshot",
          name: "Killshot",
          description: "Cross-class unlock (also unlocks combo points if equipped). Once per encounter. Deals RTK*AGI*2 ranged damage. For each 5% of enemy HP below 45%, adds +10% chance to instantly kill the target.",
          isCrossClass: true,
        }]
      },
    }
  },

  herbalist: {
    id: "herbalist",
    name: "Herbalist",
    description: "Healer - Can heal allies and create potions",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      1: { 
        abilities: [{
          id: "healing_potion",
          name: "Healing Potion",
          description: "Phase 1 action; player must choose to heal rather than damage. Heals MND+1 HP. Target selected in phase 2.",
          isCrossClass: false,
        }]
      },
      2: { passives: { vit: 1 } },
      3: { passives: { mnd: 1 } },
      4: { 
        abilities: [{
          id: "craft_healing_potion",
          name: "Craft Healing Potion",
          description: "Phase 1 action. You can craft Healing Potions (carry 5 by default 5 max). You cannot craft a potion on the turn you choose to heal rather than damage.",
          isCrossClass: false,
        }]
      },
      5: { passives: { mnd: 1 } },
      6: { mechanicUpgrades: { potionCraftBonus: 1 } }, // Potions when crafting +1
      7: { passives: { vit: 1 } },
      8: { 
        abilities: [{
          id: "healing_potion_crossclass",
          name: "Healing Potion",
          description: "Cross-class unlock. Phase 1 action; player must choose to heal rather than damage. Heals MND+1 HP. Target selected in phase 2.",
          isCrossClass: true,
        }]
      },
      9: { passives: { mnd: 1 } },
      10: { 
        abilities: [{
          id: "craft_shield_potion",
          name: "Craft Shield Potion",
          description: "Phase 1 action. You can craft Shield Potions (carry 0 default up to 3 max).",
          isCrossClass: false,
        },
        {
          id: "shield_potion",
          name: "Shield Potion",
          description: "Phase 1 action. Blocks the next MND damage that the target would have taken. Costs 1 Shield Potion.",
          isCrossClass: false,
        }]
      },
      11: { mechanicUpgrades: { potionCraftBonus: 1 } }, // Potions when crafting +1 (stacks with Lv 6)
      12: { 
        abilities: [{
          id: "potion_diffuser",
          name: "Potion Diffuser",
          description: "Use after answering, before Phase 2: The next potion you use this round affects the full raid (consumes only the one charge you use).",
          isCrossClass: false,
        }]
      },
      13: { passives: { mnd: 1 } },
      14: { passives: { vit: 1 } },
      15: { 
        abilities: [{
          id: "life_potion",
          name: "Life Potion",
          description: "Cross-class unlock. Phase 2 instant. Revive all KO'd allies (return each KOed player to MND HP).",
          isCrossClass: true,
        }]
      },
    }
  },

  warlock: {
    id: "warlock",
    name: "Warlock",
    description: "Curse specialist - Deals damage over time",
    maxLevel: 15,
    unlockRequirements: { wizard: 2 },
    levelRewards: {
      1: { 
        abilities: [{
          id: "hex",
          name: "Hex",
          description: "Deals the targeted enemy (HEXDMG) curse damage per round for the next (HEXDUR) rounds. (HEXDMG)= INT – 1. (HEXDUR)=2 + passives/equipment. Casting hex on a hexed target sets timer to y.",
          isCrossClass: false,
        }]
      },
      2: { passives: { int: 1 } },
      3: { mechanicUpgrades: { hexDuration: 1 } }, // +1 to (HEXDUR)
      4: { 
        abilities: [{
          id: "siphon",
          name: "Siphon",
          description: "Deals INT curse damage and heals INT/2 rounded up.",
          isCrossClass: false,
        }]
      },
      5: { mechanicUpgrades: { siphonHealBonus: 1 } }, // +1 to siphon healing
      6: { passives: { vit: 1 } },
      7: { passives: { int: 1 } },
      8: { 
        abilities: [{
          id: "hex_crossclass",
          name: "Hex",
          description: "Cross-class unlock. Deals the targeted enemy (INT-1) curse damage per round for the next (2 + duration upgrades) rounds.",
          isCrossClass: true,
        }]
      },
      9: { mechanicUpgrades: { hexDuration: 1 } }, // +1 to (HEXDUR)
      10: { 
        abilities: [{
          id: "pact_surge",
          name: "Pact Surge",
          description: "Spend HP/4 to gain ATK in the amount of the HP spent.",
          isCrossClass: false,
        }]
      },
      11: { passives: { vit: 1 } },
      12: { 
        abilities: [{
          id: "abyssal_drain",
          name: "Abyssal Drain",
          description: "Buff. Lasts 2 turns. Deal base dmg to all current enemies. Heal for HP = damage dealt. Costs 2 MP.",
          isCrossClass: false,
        }]
      },
      13: { passives: { int: 1 } },
      14: { mechanicUpgrades: { hexDuration: 1 } }, // +1 to (HEXDUR)
      15: { 
        abilities: [{
          id: "soul_echo",
          name: "Soul Echo",
          description: "Cross-class unlock. (passive) Hex now deals bonus curse damage equal to (hex damage × hex duration) / 2 in the first combat round after it is cast.",
          isCrossClass: true,
        }]
      },
    }
  },

  priest: {
    id: "priest",
    name: "Priest",
    description: "Advanced healer - Master of holy magic",
    maxLevel: 15,
    unlockRequirements: { herbalist: 2 },
    levelRewards: {
      1: { 
        abilities: [{
          id: "mend",
          name: "Mend",
          description: "Heals target for MND HP. Costs 1 MP.",
          isCrossClass: false,
        }]
      },
      2: { passives: { mnd: 1 } },
      3: { passives: { vit: 1 } },
      4: { 
        abilities: [{
          id: "purify",
          name: "Purify",
          description: "Removes enemy poison debuffs from ally. Phase 2. Costs 1 MP.",
          isCrossClass: false,
        }]
      },
      5: { passives: { mnd: 1 } },
      6: { passives: { vit: 1 } },
      7: { passives: { int: 1 } },
      8: { 
        abilities: [{
          id: "mend_crossclass",
          name: "Mend",
          description: "Cross-class unlock. Heals target for MND HP. Costs 1 MP.",
          isCrossClass: true,
        }]
      },
      9: { passives: { mnd: 1 } },
      10: { 
        abilities: [{
          id: "bless",
          name: "Bless",
          description: "Buff. Lasts MND/2 rounds. Raises AGI, STR and INT by MND/3.",
          isCrossClass: false,
        }]
      },
      11: { passives: { vit: 1 } },
      12: { 
        abilities: [{
          id: "holy_light",
          name: "Holy Light",
          description: "Heal all players in the fight for MND/2 HP. Costs 5 MP.",
          isCrossClass: false,
        }]
      },
      13: { passives: { vit: 1 } },
      14: { passives: { mnd: 1 } },
      15: { 
        abilities: [{
          id: "divine_grace",
          name: "Divine Grace",
          description: "Cross-class unlock. Heal all players to full HP and restore any KO'ed players to full HP. Phase 2 ability. Limit: 1 use per fight. Costs 5 MP.",
          isCrossClass: true,
        }]
      },
    }
  },

  paladin: {
    id: "paladin",
    name: "Paladin",
    description: "Holy defender - Tank/Healer hybrid",
    maxLevel: 15,
    unlockRequirements: { warrior: 4, priest: 2 },
    levelRewards: {
      1: { 
        abilities: [{
          id: "healing_guard",
          name: "Healing Guard",
          description: "Heals target as well as blocks for them this turn.",
          isCrossClass: false,
        }]
      },
      2: { passives: { mnd: 1 } },
      3: { passives: { vit: 1 } },
      4: { 
        abilities: [{
          id: "lay_on_hands",
          name: "Lay on Hands",
          description: "Heals target for (VIT+MND)/2. 5 round cooldown.",
          isCrossClass: false,
        }]
      },
      5: { passives: { str: 1 } },
      6: { passives: { vit: 1 } },
      7: { passives: { mnd: 1 } },
      8: { 
        abilities: [{
          id: "healing_guard_ally_crossclass",
          name: "Healing Guard Ally",
          description: "Cross-class unlock. Heals target as well as blocks for them this turn.",
          isCrossClass: true,
        }]
      },
      9: { passives: { str: 1 } },
      10: { 
        abilities: [{
          id: "aegis",
          name: "Aegis",
          description: "Blocks target and that target's aggro is transferred to the Paladin who used Aegis.",
          isCrossClass: false,
        }]
      },
      11: { passives: { mnd: 1 } },
      12: { 
        abilities: [{
          id: "sacred_strike",
          name: "Sacred Strike",
          description: "Deals ATK*(STR+MND+VIT) heal damage (if answer is incorrect, no damage is dealt – treat as a miss). Paladin takes no damage on wrong answer this round. 5 round cooldown.",
          isCrossClass: false,
        }]
      },
      13: { passives: { vit: 1 } },
      14: { passives: { str: 1 } },
      15: { 
        abilities: [{
          id: "holy_judgment",
          name: "Holy Judgment",
          description: "Cross-class unlock. Heals all current players for (VIT+MND) HP and deals (STR+VIT+MND)/3 healing damage to all current enemies.",
          isCrossClass: true,
        }]
      },
    }
  },

  dark_knight: {
    id: "dark_knight",
    name: "Dark Knight",
    description: "Dark warrior - Tank/DPS with shadow magic",
    maxLevel: 15,
    unlockRequirements: { warrior: 2, wizard: 4 },
    levelRewards: {
      1: { 
        abilities: [{
          id: "ruin_strike",
          name: "Ruin Strike",
          description: "Deals ATK*(STR + VIT + INT) melee dmg. Costs 1 MP.",
          isCrossClass: false,
        }]
      },
      2: { passives: { int: 1 } },
      3: { passives: { str: 1 } },
      4: { 
        abilities: [{
          id: "blood_sword",
          name: "Blood Sword",
          description: "Heals the dark knight for the damage he dealt this round. Can be used in conjunction with other abilities. Costs 1 MP.",
          isCrossClass: false,
        }]
      },
      5: { passives: { int: 1 } },
      6: { passives: { str: 1 } },
      7: { passives: { vit: 1 } },
      8: { 
        abilities: [{
          id: "ruin_strike_crossclass",
          name: "Ruin Strike",
          description: "Cross-class unlock. Deals ATK*(STR + VIT + INT) melee dmg. Costs 1 MP.",
          isCrossClass: true,
        }]
      },
      9: { passives: { str: 1 } },
      10: { 
        abilities: [{
          id: "blood_price",
          name: "Blood Price",
          description: "Deals ATK*(STR+VIT+INT)*2 melee dmg. Deals ATK dmg to the Dark Knight who used the ability.",
          isCrossClass: false,
        }]
      },
      11: { passives: { int: 1 } },
      12: { 
        abilities: [{
          id: "dread_aura",
          name: "Dread Aura",
          description: "Reduces enemy DMG by (INT)/3 (round up) for 3 rounds. Costs 3 MP.",
          isCrossClass: false,
        }]
      },
      13: { passives: { str: 1 } },
      14: { passives: { int: 1 } },
      15: { 
        abilities: [{
          id: "shadow_requiem",
          name: "Shadow Requiem",
          description: "Cross-class unlock. Deals ATK*(STR+VIT+INT) melee dmg to all current enemies. Dark Knight is healed for all damage done in this way. Once per fight.",
          isCrossClass: true,
        }]
      },
    }
  },

  blood_knight: {
    id: "blood_knight",
    name: "Blood Knight",
    description: "Vampiric warrior - Lifesteal specialist",
    maxLevel: 15,
    unlockRequirements: { warrior: 2, warlock: 2 },
    levelRewards: {
      1: { 
        abilities: [{
          id: "crimson_slash",
          name: "Crimson Slash",
          description: "Deals ATK * (VIT + STR)/2 melee damage to one target. Heal for 50% of the damage dealt. Active (choose in phase 1). Costs 1 MP.",
          isCrossClass: false,
        }]
      },
      2: { passives: { str: 1 } },
      3: { passives: { vit: 1 } },
      4: { 
        abilities: [{
          id: "dark_vigor",
          name: "Dark Vigor",
          description: "(passive) Heal for 25% of all damage dealt by this dark knight.",
          isCrossClass: false,
        }]
      },
      5: { passives: { str: 1 } },
      6: { passives: { vit: 1 } },
      7: { passives: { int: 1 } },
      8: { 
        abilities: [{
          id: "crimson_slash_crossclass",
          name: "Crimson Slash",
          description: "Cross-class unlock. Deals ATK * (VIT + STR)/2 melee damage to one target. Heal for 50% of the damage dealt. Costs 1 MP.",
          isCrossClass: true,
        }]
      },
      9: { passives: { str: 1 } },
      10: { 
        abilities: [{
          id: "hemorrhage",
          name: "Hemorrhage",
          description: "Deal a heavy strike that causes the enemy to bleed. Deals ATK melee dmg, and creates a bleed effect that deals ATK/2 per round for 2 rounds. Costs 1 MP.",
          isCrossClass: false,
        }]
      },
      11: { passives: { str: 1 } },
      12: { 
        abilities: [{
          id: "vampiric_guard",
          name: "Vampiric Guard",
          description: "(Passive) Now, when a Blood Knight takes damage, damage calculation ignores VIT. If the Blood Knight deals damage the next round, the Blood Knight gains MP equal to 100% + 5 of damage taken in this way.",
          isCrossClass: false,
        }]
      },
      13: { passives: { int: 1 } },
      14: { passives: { str: 1 } },
      15: { 
        abilities: [{
          id: "raining_blood",
          name: "Raining Blood",
          description: "Cross-class unlock. Deal ATK*(STR+VIT+INT) magic damage to all current enemies. Heal all allies for 50% of the damage dealt in this way.",
          isCrossClass: true,
        }]
      },
    }
  },

  monk: {
    id: "monk",
    name: "Monk",
    description: "Stance-based fighter - Tank/DPS hybrid with combo points",
    maxLevel: 15,
    unlockRequirements: { warrior: 2, scout: 2 },
    levelRewards: {
      1: { 
        abilities: [{
          id: "fortify",
          name: "Fortify",
          description: "Stance (toggle during question phase). Uses tank threat calculation while active. Grants 2*VIT HP while active. Generates 1 combo point per round when taking damage.",
          isCrossClass: false,
        }]
      },
      2: { passives: { vit: 1 } },
      3: { passives: { str: 1 } },
      4: { 
        abilities: [{
          id: "flurry",
          name: "Flurry",
          description: "Phase 1 ability. Costs 5 combo points. Deals (ATK + STR + AGI)*3 melee damage.",
          isCrossClass: false,
        }]
      },
      5: { passives: { vit: 1 } },
      6: { passives: { agi: 1 } },
      7: { passives: { str: 1 } },
      8: { 
        abilities: [{
          id: "fortify_crossclass",
          name: "Fortify",
          description: "Cross-class unlock. Stance (toggle during question phase). Uses tank threat calculation while active. Grants 2*VIT HP while active.",
          isCrossClass: true,
        }]
      },
      9: { passives: { agi: 1 } },
      10: { 
        abilities: [{
          id: "deflect",
          name: "Deflect",
          description: "Stance (toggle during question phase). Grants ability to select block targets. If you successfully block damage, reflect 75% of the blocked damage back to the current enemy target.",
          isCrossClass: false,
        }]
      },
      11: { passives: { str: 1 } },
      12: { 
        abilities: [{
          id: "focused_palm",
          name: "Focused Palm",
          description: "Phase 1 ability. Costs 5 combo points. Deals (ATK + 4*STR + 4*AGI) melee damage.",
          isCrossClass: false,
        }]
      },
      13: { passives: { vit: 1 } },
      14: { passives: { str: 1 } },
      15: { 
        abilities: [{
          id: "inner_peace",
          name: "Inner Peace",
          description: "Cross-class unlock. Gain top aggro +1. Heals the monk to full HP. Take no damage this turn. One use per fight.",
          isCrossClass: true,
        }]
      },
    }
  },

  ranger: {
    id: "ranger",
    name: "Ranger",
    description: "DPS - Advanced ranged damage with combo points and mobility",
    maxLevel: 15,
    unlockRequirements: { scout: 8 },
    levelRewards: {
      1: { 
        abilities: [{
          id: "prey",
          name: "Prey",
          description: "The Ranger marks one target enemy as his prey. Debuff. Until canceled or removed. Marked enemy takes 200% damage from all sources. Costs 2 combo points.",
          isCrossClass: false,
        }]
      },
      2: { passives: { agi: 1 } },
      3: { mechanicUpgrades: { maxComboPoints: 1 } },
      4: { 
        abilities: [{
          id: "twin_shot",
          name: "Twin Shot",
          description: "The ranger attacks with two arrows. On simultaneous mode, the extra hit always goes to the Prey target. Each arrow deals (RTK + AGI)*4 damage. Costs 2 combo points.",
          isCrossClass: false,
        }]
      },
      5: { passives: { agi: 1 } },
      6: { passives: { agi: 1 } },
      7: { mechanicUpgrades: { maxComboPoints: 1 } },
      8: { 
        abilities: [{
          id: "prey_crossclass",
          name: "Prey",
          description: "Cross-class unlock. The Ranger marks one target enemy as his prey. Debuff. Until canceled or removed. Marked enemy takes 200% damage from all sources. Costs 2 combo points.",
          isCrossClass: true,
        }]
      },
      9: { passives: { agi: 1 } },
      10: { 
        abilities: [{
          id: "disengage",
          name: "Disengage",
          description: "The ranger drops all aggro. Gains 1 combo point.",
          isCrossClass: false,
        }]
      },
      11: { passives: { agi: 1 } },
      12: { 
        abilities: [{
          id: "hunters_volley",
          name: "Hunter's Volley",
          description: "The ranger deals 5 waves of damage to all targets. Each wave deals (RTK + AGI)*2 damage to each target. Costs 5 combo points.",
          isCrossClass: false,
        }]
      },
      13: { passives: { agi: 1 } },
      14: { mechanicUpgrades: { maxComboPoints: 1 } },
      15: { 
        abilities: [{
          id: "arrowstorm",
          name: "Arrowstorm",
          description: "Cross-class unlock. The ranger deals 10 waves of damage to all targets, and 1 final hit to the marked target. Each wave deals base damage, final hit deals base damage × 2. Once per encounter.",
          isCrossClass: true,
        }]
      },
    }
  },
};

// Get all abilities a player has unlocked across all jobs
export function getUnlockedAbilities(jobLevels: Record<CharacterClass, number>): Ability[] {
  const abilities: Ability[] = [];
  
  for (const [jobClass, level] of Object.entries(jobLevels)) {
    const jobConfig = JOB_TREE[jobClass as CharacterClass];
    if (!jobConfig) continue;

    for (let lvl = 1; lvl <= level; lvl++) {
      const reward = jobConfig.levelRewards[lvl];
      if (reward?.abilities) {
        abilities.push(...reward.abilities);
      }
    }
  }

  return abilities;
}

// Get all cross-class abilities available to current job
export function getCrossClassAbilities(
  currentJob: CharacterClass,
  allJobLevels: Record<CharacterClass, number>
): Ability[] {
  const crossClassAbilities: Ability[] = [];
  
  for (const [jobClass, level] of Object.entries(allJobLevels)) {
    if (jobClass === currentJob) continue; // Skip current job's abilities
    
    const jobConfig = JOB_TREE[jobClass as CharacterClass];
    if (!jobConfig) continue;

    for (let lvl = 1; lvl <= level; lvl++) {
      const reward = jobConfig.levelRewards[lvl];
      if (reward?.abilities) {
        const crossClass = reward.abilities.filter(a => a.isCrossClass);
        crossClassAbilities.push(...crossClass);
      }
    }
  }

  return crossClassAbilities;
}

// Calculate total passive bonuses from all jobs
export function getTotalPassiveBonuses(jobLevels: Record<CharacterClass, number>): PassiveBonus {
  const total: PassiveBonus = { str: 0, int: 0, agi: 0, mnd: 0, vit: 0 };
  
  for (const [jobClass, level] of Object.entries(jobLevels)) {
    const jobConfig = JOB_TREE[jobClass as CharacterClass];
    if (!jobConfig) continue;

    for (let lvl = 1; lvl <= level; lvl++) {
      const reward = jobConfig.levelRewards[lvl];
      if (reward?.passives) {
        total.str = (total.str || 0) + (reward.passives.str || 0);
        total.int = (total.int || 0) + (reward.passives.int || 0);
        total.agi = (total.agi || 0) + (reward.passives.agi || 0);
        total.mnd = (total.mnd || 0) + (reward.passives.mnd || 0);
        total.vit = (total.vit || 0) + (reward.passives.vit || 0);
      }
    }
  }

  return total;
}

// Calculate total mechanic upgrades from all jobs
export function getTotalMechanicUpgrades(jobLevels: Record<CharacterClass, number>): MechanicUpgrade {
  const total: MechanicUpgrade = { 
    maxComboPoints: 0, 
    potionCraftBonus: 0, 
    hexDuration: 0, 
    siphonHealBonus: 0 
  };
  
  for (const [jobClass, level] of Object.entries(jobLevels)) {
    const jobConfig = JOB_TREE[jobClass as CharacterClass];
    if (!jobConfig) continue;

    for (let lvl = 1; lvl <= level; lvl++) {
      const reward = jobConfig.levelRewards[lvl];
      if (reward?.mechanicUpgrades) {
        total.maxComboPoints = (total.maxComboPoints || 0) + (reward.mechanicUpgrades.maxComboPoints || 0);
        total.potionCraftBonus = (total.potionCraftBonus || 0) + (reward.mechanicUpgrades.potionCraftBonus || 0);
        total.hexDuration = (total.hexDuration || 0) + (reward.mechanicUpgrades.hexDuration || 0);
        total.siphonHealBonus = (total.siphonHealBonus || 0) + (reward.mechanicUpgrades.siphonHealBonus || 0);
      }
    }
  }

  return total;
}

// Check which jobs a student can unlock
export function getUnlockedJobs(jobLevels: Record<CharacterClass, number>): CharacterClass[] {
  const unlocked: CharacterClass[] = [];
  
  for (const jobConfig of Object.values(JOB_TREE)) {
    // Base classes are always unlocked
    if (!jobConfig.unlockRequirements) {
      unlocked.push(jobConfig.id);
      continue;
    }

    // Check if requirements are met
    const requirementsMet = Object.entries(jobConfig.unlockRequirements).every(
      ([requiredJob, requiredLevel]) => {
        const studentLevel = jobLevels[requiredJob as CharacterClass] || 0;
        return studentLevel >= requiredLevel;
      }
    );

    if (requirementsMet) {
      unlocked.push(jobConfig.id);
    }
  }

  return unlocked;
}

// Wizard Fireball ability stat calculations based on level
export function getFireballCooldown(wizardLevel: number): number {
  let cooldown = 5; // Base cooldown
  
  if (wizardLevel >= 2) cooldown -= 1; // Lv2: cooldown -1 (5 → 4)
  if (wizardLevel >= 7) cooldown -= 1; // Lv7: cooldown -1 (4 → 3)
  if (wizardLevel >= 11) cooldown -= 1; // Lv11: cooldown -1 (3 → 2)
  
  return cooldown;
}

export function getFireballDamageBonus(wizardLevel: number): number {
  let bonus = 0; // Base damage bonus
  
  if (wizardLevel >= 5) bonus += 1; // Lv5: damage +1
  if (wizardLevel >= 13) bonus += 1; // Lv13: damage +1
  
  return bonus;
}

export function getFireballMaxChargeRounds(wizardLevel: number): number {
  if (wizardLevel >= 14) {
    return 3; // Lv14: can charge for 3 rounds
  }
  return 2; // Base: 2 charge rounds
}

// Scout Headshot ability stat calculations based on level
export function getHeadshotCooldown(scoutLevel: number): number {
  let cooldown = 5; // Base cooldown
  
  if (scoutLevel >= 7) cooldown -= 1; // Lv7: cooldown -1 (5 → 4)
  
  return cooldown;
}

export function getHeadshotMaxComboPoints(scoutLevel: number): number {
  if (scoutLevel >= 14) {
    return 6; // Lv14: +3 maximum combo points (3 → 6)
  }
  return 3; // Base: 3 combo points
}

// Herbalist ability stat calculations based on level
export function getHealingPower(herbalistLevel: number): number {
  let power = 1; // Base healing power
  
  if (herbalistLevel >= 3) power += 1; // Lv3: +1 healing power (potions heal 2)
  if (herbalistLevel >= 13) power += 1; // Lv13: +1 healing power (potions heal 3)
  
  return power;
}

export function getHealingPotionCapacity(herbalistLevel: number): number {
  let capacity = 5; // Base capacity
  
  if (herbalistLevel >= 5) capacity += 1; // Lv5: +1 max capacity (5 → 6)
  
  return capacity;
}

export function getShieldPotionCapacity(herbalistLevel: number): number {
  if (herbalistLevel < 8) return 0; // Shield potions unlock at Lv8
  
  let capacity = 3; // Base capacity at Lv8
  
  if (herbalistLevel >= 9) capacity += 1; // Lv9: +1 max capacity (3 → 4)
  
  return capacity;
}

export function getCraftEfficiency(herbalistLevel: number): number {
  let efficiency = 0; // No bonus by default
  
  if (herbalistLevel >= 6) efficiency += 1; // Lv6: +1 craft efficiency
  if (herbalistLevel >= 11) efficiency += 1; // Lv11: +1 craft efficiency (stacks)
  
  return efficiency;
}

export function getPoisonPotionUses(herbalistLevel: number): number {
  if (herbalistLevel >= 12) {
    return 3; // Lv12: 3 uses per fight
  }
  return 0; // Not unlocked
}

// Warrior block damage calculation
export function getWarriorBlockAmount(
  warriorLevel: number,
  baseDefense: number,
  equipmentDefense: number,
  allJobLevelsDefense: number
): number {
  // Total defense = base class defense + equipment bonuses + job passive bonuses
  const totalDefense = baseDefense + equipmentDefense + allJobLevelsDefense;
  
  // Block amount equals total defense (each point of defense blocks 1 damage)
  return totalDefense;
}
