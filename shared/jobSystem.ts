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
        passives: { hp: 2, defense: 1 },
        abilities: [{
          id: "warrior_block",
          name: "Block",
          description: "In Phase 2, reduce minor damage. Draws threat when answering correctly.",
          isCrossClass: false,
        }]
      },
      2: { passives: { hp: 1, defense: 1 } },
      3: { passives: { hp: 1 } },
      4: { 
        abilities: [{
          id: "shield_bash",
          name: "Shield Bash",
          description: "Active, CD 2. Block this round's first incoming hit (-1 DMG) and deal +1 phys DMG to target enemy.",
          isCrossClass: false,
        }]
      },
      5: { passives: { hp: 1, attack: 1 } },
      6: { passives: { hp: 1 } },
      7: { passives: { hp: 1, defense: 1 } },
      8: { 
        abilities: [{
          id: "block_crossclass",
          name: "Block",
          description: "Passive. When used on any class, reduces first incoming hit by 1 DMG.",
          isCrossClass: true,
        }]
      },
      9: { passives: { hp: 1 } },
      10: { 
        abilities: [{
          id: "provoke",
          name: "Provoke",
          description: "Active, CD 3. For one round, all incorrect-answer damage from enemies is redirected to you. Warrior takes it at normal mitigation.",
          isCrossClass: false,
        }]
      },
      11: { passives: { hp: 1, attack: 1 } },
      12: { 
        abilities: [{
          id: "crushing_blow",
          name: "Crushing Blow",
          description: "Active, CD 3. Heavy strike for 4 phys DMG and +1 threat to all enemies.",
          isCrossClass: false,
        }]
      },
      13: { passives: { hp: 1 } },
      14: { passives: { hp: 1, defense: 1 } },
      15: { 
        abilities: [{
          id: "unbreakable",
          name: "Unbreakable",
          description: "Ultimate, once/encounter. Become invincible for one round; all enemy damage is blocked and absorbed by you (0 DMG to party).",
          isCrossClass: true,
        }]
      },
    }
  },

  wizard: {
    id: "wizard",
    name: "Wizard",
    description: "DPS - Fireball master with channeled damage",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      1: { 
        abilities: [{
          id: "fireball",
          name: "Fireball",
          description: "Active (cast): Begin a 2-round channel. Each correct answer adds +1 dmg/round. If both rounds are correct → total +2 dmg added when it lands. Base 2 dmg + accumulated fire bonus. CD 5 rds.",
          isCrossClass: false,
        }]
      },
      2: { }, // Fireball cooldown -1 (→ 4 rds) - mechanic upgrade only
      3: { passives: { attack: 1 } },
      4: { 
        abilities: [{
          id: "frostbolt",
          name: "Frostbolt",
          description: "Phase 2 instant cast: 3 magic DMG to one enemy, always hits; resets streak. CD 3 rds.",
          isCrossClass: false,
        }]
      },
      5: { }, // Fireball +1 DMG per round (→ +2 → +3 total if full cast) - mechanic upgrade only
      6: { passives: { hp: 1 } },
      7: { }, // Fireball cooldown -1 (→ 3 rds) - mechanic upgrade only
      8: { 
        abilities: [{
          id: "fireball_crossclass",
          name: "Fireball",
          description: "Grants Fireball as a usable spell for any class equipped with the cross-class slot. Uses current Wizard's cooldown/charge rules.",
          isCrossClass: true,
        }]
      },
      9: { passives: { attack: 1 } },
      10: { 
        abilities: [{
          id: "manashield",
          name: "Manashield",
          description: "Reactive, CD 3 rds: absorb the next 2 DMG you take OR preserve an in-progress Fireball if you miss a question.",
          isCrossClass: false,
        }]
      },
      11: { }, // Fireball +1 DMG per round (→ +4 total if full 2-round cast) - mechanic upgrade only
      12: { 
        abilities: [{
          id: "manaward",
          name: "Manaward",
          description: "Party buff, CD 4 rds: all allies gain Barrier 1 vs. next 1 DMG this round.",
          isCrossClass: false,
        }]
      },
      13: { }, // Fireball can now charge 3 rounds (max bonus +6 DMG if perfect cast) - mechanic upgrade only
      14: { }, // Fireball +1 DMG per round (→ +5 per round × 3 = 15 potential bonus) - mechanic upgrade only
      15: { 
        abilities: [{
          id: "manabomb",
          name: "Manabomb",
          description: "Ultimate, once/encounter Phase 2 cast: deal 10 instant MAG DMG to all enemies on screen. Usable by any class that has unlocked cross-class slots.",
          isCrossClass: true,
        }]
      },
    }
  },

  scout: {
    id: "scout",
    name: "Scout",
    description: "DPS - High attack, streak bonus damage",
    maxLevel: 15,
    unlockRequirements: null,
    levelRewards: {
      1: { 
        abilities: [{
          id: "headshot",
          name: "Headshot",
          description: "Costs 3 Combo Points; CD 5 rounds. Consumes all points to deal heavy single-target damage. Starts with 3-point cap. Combo points gained from correct-answer streaks. If blocked damage preserves streak.",
          isCrossClass: false,
        }]
      },
      2: { passives: { attack: 1 } }, // +1 Base DMG (early precision buff)
      3: { passives: { hp: 1 } }, // +1 HP
      4: { 
        abilities: [{
          id: "aim",
          name: "Aim",
          description: "Costs 1 Combo Point; CD 2. Doubles the Scout's damage that round. Used in Phase 1 immediately after answering, before Phase 2 begins.",
          isCrossClass: false,
        }]
      },
      5: { passives: { attack: 1 } }, // +1 Base DMG
      6: { passives: { hp: 1 } }, // +1 HP
      7: { }, // Headshot Cooldown -1 round (→ 4 rds) - mechanic upgrade only
      8: { 
        abilities: [{
          id: "headshot_crossclass",
          name: "Headshot / Combo System",
          description: "Grants access to Headshot (and combo-point mechanics) for any class equipped with a cross-class slot.",
          isCrossClass: true,
        }]
      },
      9: { passives: { attack: 1 } }, // +1 Base DMG
      10: { 
        abilities: [{
          id: "mark",
          name: "Mark",
          description: "No Cost; CD 3. Marks the current enemy; all players deal double damage to that target this round. (Applied in Phase 1.)",
          isCrossClass: false,
        }]
      },
      11: { passives: { hp: 1 } }, // +1 HP
      12: { 
        abilities: [{
          id: "dodge",
          name: "Dodge",
          description: "Phase 2 reaction; CD 3. Avoids the next attack entirely and preserves streak if hit that round.",
          isCrossClass: false,
        }]
      },
      13: { passives: { attack: 1 } }, // +1 Base DMG
      14: { }, // +3 Maximum Combo Points (cap = 6) - mechanic upgrade only
      15: { 
        abilities: [{
          id: "killshot",
          name: "Killshot",
          description: "Costs 5 Combo Points; once/encounter. Deals 20 damage. For each 5% of enemy HP below 45%, adds +10% chance to instantly kill the target (e.g., 30% HP → +40% kill chance).",
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
      // USER: Fill in levels 1-15 with abilities and passives
      1: { passives: { hp: 1 } },
      // Add levels 2-15 here
    }
  },

  // ADVANCED CLASSES (Require job levels to unlock)
  knight: {
    id: "knight",
    name: "Knight",
    description: "Holy Warrior - Advanced tank specialization",
    maxLevel: 15,
    unlockRequirements: { warrior: 10 },
    levelRewards: {
      1: { passives: { hp: 2, defense: 1 } },
    }
  },

  paladin: {
    id: "paladin",
    name: "Paladin",
    description: "Holy Tank - Warrior + Herbalist fusion",
    maxLevel: 15,
    unlockRequirements: { warrior: 5, herbalist: 3 },
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
    unlockRequirements: { warrior: 7, wizard: 5 },
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
    unlockRequirements: { warrior: 5, scout: 5 },
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
