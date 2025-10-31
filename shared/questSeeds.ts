import type { InsertQuest, QuestType, CharacterClass } from "./schema";
import { ALL_CHARACTER_CLASSES } from "./schema";

// Personal milestone quests (auto-generated for each student when joining guild)
export function generatePersonalMilestoneQuests(studentId: string, guildId: string): InsertQuest[] {
  const quests: InsertQuest[] = [];
  
  // Level milestone quests for each base class (levels 4, 8, 10)
  const baseClasses: CharacterClass[] = ["warrior", "wizard", "scout", "herbalist"];
  
  for (const jobClass of baseClasses) {
    // Level 4 quest
    quests.push({
      studentId,
      guildId,
      questType: "personal" as QuestType,
      title: `${jobClass.charAt(0).toUpperCase() + jobClass.slice(1)} Journeyman`,
      description: `Reach level 4 as ${jobClass} to unlock cross-class abilities.`,
      criteria: {
        type: "reach_job_level",
        targetJob: jobClass,
        targetLevel: 4
      },
      rewards: {
        gold: 200
      },
      isSeeded: true
    });
    
    // Level 8 quest
    quests.push({
      studentId,
      guildId,
      questType: "personal" as QuestType,
      title: `${jobClass.charAt(0).toUpperCase() + jobClass.slice(1)} Expert`,
      description: `Reach level 8 as ${jobClass} to unlock advanced classes.`,
      criteria: {
        type: "reach_job_level",
        targetJob: jobClass,
        targetLevel: 8
      },
      rewards: {
        gold: 500
      },
      isSeeded: true
    });
    
    // Level 10 quest
    quests.push({
      studentId,
      guildId,
      questType: "personal" as QuestType,
      title: `${jobClass.charAt(0).toUpperCase() + jobClass.slice(1)} Master`,
      description: `Reach level 10 as ${jobClass}.`,
      criteria: {
        type: "reach_job_level",
        targetJob: jobClass,
        targetLevel: 10
      },
      rewards: {
        gold: 1000
      },
      isSeeded: true
    });
  }
  
  return quests;
}

// Advanced class unlock quests with special tier 1 epic/legendary rewards
export const ADVANCED_CLASS_UNLOCK_QUESTS: Record<CharacterClass, Partial<InsertQuest>> = {
  // Base classes don't have unlock quests
  warrior: {},
  wizard: {},
  scout: {},
  herbalist: {},
  
  // Paladin - Warrior Lv.2 + Herbalist Lv.2
  paladin: {
    questType: "personal" as QuestType,
    title: "Path of the Paladin",
    description: "Reach level 2 as Warrior and Herbalist to unlock the Paladin class.",
    criteria: {
      type: "unlock_cross_class",
      targetJob: "paladin"
    },
    rewards: {
      gold: 300,
      equipmentItemId: "paladin_crusaders_cap" // Tier 1 Epic: +1 DEF +1 VIT +1 STR
    },
    isSeeded: true
  },
  
  // Warlock - Wizard Lv.2 + Scout Lv.2
  warlock: {
    questType: "personal" as QuestType,
    title: "Pact of the Warlock",
    description: "Reach level 2 as Wizard and Scout to unlock the Warlock class.",
    criteria: {
      type: "unlock_cross_class",
      targetJob: "warlock"
    },
    rewards: {
      gold: 300,
      equipmentItemId: "warlock_necrohol" // Tier 1 Epic: +1 VIT +1 INT +1 MAT
    },
    isSeeded: true
  },
  
  // Priest - Herbalist Lv.2 + Wizard Lv.2
  priest: {
    questType: "personal" as QuestType,
    title: "Calling of the Priest",
    description: "Reach level 2 as Herbalist and Wizard to unlock the Priest class.",
    criteria: {
      type: "unlock_cross_class",
      targetJob: "priest"
    },
    rewards: {
      gold: 300,
      equipmentItemId: "priest_holy_miter" // Tier 1 Epic: +2 MND +1 DEF +1 MAT
    },
    isSeeded: true
  },
  
  // Dark Knight - Warrior Lv.2 + Wizard Lv.2
  dark_knight: {
    questType: "personal" as QuestType,
    title: "Rise of the Dark Knight",
    description: "Reach level 2 as Warrior and Wizard to unlock the Dark Knight class.",
    criteria: {
      type: "unlock_cross_class",
      targetJob: "dark_knight"
    },
    rewards: {
      gold: 300,
      equipmentItemId: "dark_knight_shadow_helm" // Tier 1 Epic: +1 STR +1 INT +1 VIT +1 ATK
    },
    isSeeded: true
  },
  
  // Blood Knight - Warrior Lv.2 + Herbalist Lv.2 (alternate to Paladin)
  blood_knight: {
    questType: "personal" as QuestType,
    title: "Oath of the Blood Knight",
    description: "Reach level 2 as Warrior and Herbalist, then choose the Blood Knight path.",
    criteria: {
      type: "unlock_cross_class",
      targetJob: "blood_knight"
    },
    rewards: {
      gold: 300,
      equipmentItemId: "blood_knight_crimson_plate" // Tier 1 Epic: +2 VIT +1 STR +1 DEF
    },
    isSeeded: true
  },
  
  // Monk - Scout Lv.2 + Herbalist Lv.2
  monk: {
    questType: "personal" as QuestType,
    title: "Discipline of the Monk",
    description: "Reach level 2 as Scout and Herbalist to unlock the Monk class.",
    criteria: {
      type: "unlock_cross_class",
      targetJob: "monk"
    },
    rewards: {
      gold: 300,
      equipmentItemId: "monk_meditation_headband" // Tier 1 Epic: +1 AGI +1 MND +1 VIT +1 DEF
    },
    isSeeded: true
  },
  
  // Ranger - Scout Lv.2 + Warrior Lv.2
  ranger: {
    questType: "personal" as QuestType,
    title: "Call of the Wild Ranger",
    description: "Reach level 2 as Scout and Warrior to unlock the Ranger class.",
    criteria: {
      type: "unlock_cross_class",
      targetJob: "ranger"
    },
    rewards: {
      gold: 300,
      equipmentItemId: "ranger_tracker_hood" // Tier 1 Epic: +2 AGI +1 STR +1 RTK
    },
    isSeeded: true
  },
  
  // Bard - Wizard Lv.2 + Herbalist Lv.2
  bard: {
    questType: "personal" as QuestType,
    title: "Song of the Bard",
    description: "Reach level 2 as Wizard and Herbalist to unlock the Bard class.",
    criteria: {
      type: "unlock_cross_class",
      targetJob: "bard"
    },
    rewards: {
      gold: 300,
      equipmentItemId: "bard_spoon" // Tier 1 Legendary: +1 to all stats, -3 RTK
    },
    isSeeded: true
  }
};

// Guild progression quests (unlock shop tiers, features, etc.)
export function generateGuildProgressionQuests(guildId: string): InsertQuest[] {
  return [
    // Tier 1 unlock (starting tier, auto-unlocked)
    {
      guildId,
      questType: "guild" as QuestType,
      title: "Guild Foundation",
      description: "Your guild has been established! The Guild Store Tier 1 is now available.",
      criteria: {
        type: "guild_level",
        targetAmount: 1
      },
      rewards: {
        unlockTier: 1
      },
      isSeeded: true
    },
    
    // Tier 2 unlock
    {
      guildId,
      questType: "guild" as QuestType,
      title: "Growing Strength",
      description: "Earn 100 total correct answers as a guild to unlock Tier 2 equipment.",
      criteria: {
        type: "total_correct_answers",
        targetAmount: 100
      },
      rewards: {
        unlockTier: 2,
        guildXP: 200
      },
      isSeeded: true
    },
    
    // Tier 3 unlock (Guild Level 3)
    {
      guildId,
      questType: "guild" as QuestType,
      title: "Veteran Warriors",
      description: "Reach Guild Level 3 to unlock Tier 3 equipment.",
      criteria: {
        type: "guild_level",
        targetAmount: 3
      },
      rewards: {
        unlockTier: 3
      },
      isSeeded: true
    },
    
    // Tier 4 unlock
    {
      guildId,
      questType: "guild" as QuestType,
      title: "Elite Training",
      description: "Earn 500 total correct answers as a guild to unlock Tier 4 equipment.",
      criteria: {
        type: "total_correct_answers",
        targetAmount: 500
      },
      rewards: {
        unlockTier: 4,
        guildXP: 500
      },
      isSeeded: true
    },
    
    // Tier 5 unlock (Guild Level 5)
    {
      guildId,
      questType: "guild" as QuestType,
      title: "Legendary Guild",
      description: "Reach Guild Level 5 to unlock Ultimate Tier equipment.",
      criteria: {
        type: "guild_level",
        targetAmount: 5
      },
      rewards: {
        unlockTier: 5
      },
      isSeeded: true
    },
    
    // Daily quest unlock
    {
      guildId,
      questType: "guild" as QuestType,
      title: "Unlock Daily Quests",
      description: "Reach Guild Level 4 to unlock Daily Guild Quests.",
      criteria: {
        type: "guild_level",
        targetAmount: 4
      },
      rewards: {
        guildXP: 100
      },
      isSeeded: true
    }
  ];
}

// Weekly guild quests (reset every Monday at 00:00 GMT)
export function generateWeeklyGuildQuests(guildId: string): InsertQuest[] {
  return [
    {
      guildId,
      questType: "weekly" as QuestType,
      title: "Weekly Accuracy Challenge",
      description: "Guild achieved 70% average accuracy this week.",
      criteria: {
        type: "custom",
        customDescription: "Achieve 70% accuracy on group sessions this week"
      },
      rewards: {
        guildXP: 300
      },
      isSeeded: true
    },
    {
      guildId,
      questType: "weekly" as QuestType,
      title: "Perfect Performance",
      description: "Guild achieved 100% accuracy on a group session (teacher-initiated).",
      criteria: {
        type: "custom",
        customDescription: "Achieve 100% accuracy on a teacher-initiated group session"
      },
      rewards: {
        guildXP: 500
      },
      isSeeded: true
    }
  ];
}
