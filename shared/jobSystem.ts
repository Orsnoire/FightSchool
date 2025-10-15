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

// Passive stat bonuses
export interface PassiveBonus {
  hp?: number;
  attack?: number;
  defense?: number;
}

// Level rewards for a job
export interface JobLevelReward {
  abilities?: Ability[];
  passives?: PassiveBonus;
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
  2: 20,     // 20 XP to reach level 2
  3: 25,     // 25 more XP (45 total)
  4: 30,     // 30 more XP (75 total)
  5: 35,     // 35 more XP (110 total)
  6: 40,     // 40 more XP (150 total)
  7: 45,     // 45 more XP (195 total)
  8: 50,     // 50 more XP (245 total)
  9: 55,     // 55 more XP (300 total)
  10: 60,    // 60 more XP (360 total)
  11: 65,    // 65 more XP (425 total)
  12: 70,    // 70 more XP (495 total)
  13: 75,    // 75 more XP (570 total)
  14: 80,    // 80 more XP (650 total)
  15: 85,    // 85 more XP (735 total) - MAX LEVEL
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
  knight: {
    id: "knight",
    name: "Knight",
    description: "Tank - High health, blocks damage for allies",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      // USER: Fill in levels 1-15 with abilities and passives
      1: { passives: { hp: 2, defense: 1 } },
      // Add levels 2-15 here
    }
  },

  wizard: {
    id: "wizard",
    name: "Wizard",
    description: "DPS - High attack, streak bonus damage",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      // USER: Fill in levels 1-15 with abilities and passives
      1: { passives: { attack: 1 } },
      // Add levels 2-15 here
    }
  },

  scout: {
    id: "scout",
    name: "Scout",
    description: "DPS - High attack, streak bonus damage",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      // USER: Fill in levels 1-15 with abilities and passives
      1: { passives: { attack: 1 } },
      // Add levels 2-15 here
    }
  },

  herbalist: {
    id: "herbalist",
    name: "Herbalist",
    description: "Healer - Can heal allies and create potions",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      // USER: Fill in levels 1-15 with abilities and passives
      1: { passives: { hp: 1 } },
      // Add levels 2-15 here
    }
  },

  // ADVANCED CLASSES (Require job levels to unlock)
  paladin: {
    id: "paladin",
    name: "Paladin",
    description: "Holy Tank - Knight + Herbalist fusion",
    maxLevel: 15,
    unlockRequirements: { knight: 5, herbalist: 3 },
    levelRewards: {
      // USER: Fill in levels 1-15 with abilities and passives
      1: { passives: { hp: 2, defense: 1 } },
      // Add levels 2-15 here
    }
  },

  dark_knight: {
    id: "dark_knight",
    name: "Dark Knight",
    description: "Aggressive Tank - High damage, self-sustaining",
    maxLevel: 15,
    unlockRequirements: { knight: 7, wizard: 5 },
    levelRewards: {
      // USER: Fill in levels 1-15 with abilities and passives
      1: { passives: { hp: 2, attack: 1 } },
      // Add levels 2-15 here
    }
  },

  sage: {
    id: "sage",
    name: "Sage",
    description: "Advanced Mage - Wizard evolution",
    maxLevel: 15,
    unlockRequirements: { wizard: 10 },
    levelRewards: {
      // USER: Fill in levels 1-15
      1: { passives: { attack: 2 } },
      // Add levels 2-15 here
    }
  },

  ranger: {
    id: "ranger",
    name: "Ranger",
    description: "Master Scout - Scout evolution",
    maxLevel: 15,
    unlockRequirements: { scout: 10 },
    levelRewards: {
      // USER: Fill in levels 1-15
      1: { passives: { attack: 2 } },
      // Add levels 2-15 here
    }
  },

  druid: {
    id: "druid",
    name: "Druid",
    description: "Nature Healer - Herbalist evolution",
    maxLevel: 15,
    unlockRequirements: { herbalist: 10 },
    levelRewards: {
      // USER: Fill in levels 1-15
      1: { passives: { hp: 2 } },
      // Add levels 2-15 here
    }
  },

  monk: {
    id: "monk",
    name: "Monk",
    description: "Balanced Fighter - All-rounder",
    maxLevel: 15,
    unlockRequirements: { knight: 5, scout: 5 },
    levelRewards: {
      // USER: Fill in levels 1-15
      1: { passives: { hp: 1, attack: 1, defense: 1 } },
      // Add levels 2-15 here
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
  const total: PassiveBonus = { hp: 0, attack: 0, defense: 0 };
  
  for (const [jobClass, level] of Object.entries(jobLevels)) {
    const jobConfig = JOB_TREE[jobClass as CharacterClass];
    if (!jobConfig) continue;

    for (let lvl = 1; lvl <= level; lvl++) {
      const reward = jobConfig.levelRewards[lvl];
      if (reward?.passives) {
        total.hp = (total.hp || 0) + (reward.passives.hp || 0);
        total.attack = (total.attack || 0) + (reward.passives.attack || 0);
        total.defense = (total.defense || 0) + (reward.passives.defense || 0);
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
