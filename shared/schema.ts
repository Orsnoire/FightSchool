import { z } from "zod";
import { STARTER_EQUIPMENT, STARTER_LOADOUTS } from "./equipment-catalog";
import { getTotalPassiveBonuses, getTotalMechanicUpgrades } from "./jobSystem";

// Generate 6-character alphanumeric ID (used for session IDs and guild codes)
export function generateSessionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars: 0,O,1,I
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate unique guild code for teachers (same format as session IDs)
export function generateGuildCode(): string {
  return generateSessionId();
}

// Character classes and equipment types
export type CharacterClass = "warrior" | "wizard" | "scout" | "herbalist" | "warlock" | "priest" | "paladin" | "dark_knight" | "blood_knight" | "monk" | "ranger" | "bard";
export type BaseClass = "warrior" | "wizard" | "scout" | "herbalist";
export const BASE_CLASSES: BaseClass[] = ["warrior", "wizard", "scout", "herbalist"];
export const ALL_CHARACTER_CLASSES: CharacterClass[] = ["warrior", "wizard", "scout", "herbalist", "warlock", "priest", "paladin", "dark_knight", "blood_knight", "monk", "ranger", "bard"];
export const TANK_CLASSES: CharacterClass[] = ["warrior", "paladin", "dark_knight", "blood_knight", "monk"];
export const HEALER_CLASSES: CharacterClass[] = ["herbalist", "priest", "paladin"];
export type Gender = "A" | "B";
export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type EquipmentSlot = "weapon" | "headgear" | "armor" | "offhand" | "hands" | "legs" | "feet";
export type ItemType = "shield" | "potion" | "quiver" | "gloves" | "leggings" | "boots" | "sword" | "wand" | "bow" | "staff" | "herbs" | "two-handed-sword" | "fist" | "claws" | "harp" | "spoon" | "light_armor" | "leather_armor" | "armor" | "helmet" | "cap" | "hat" | "consumable";
export type ItemQuality = "common" | "rare" | "epic" | "legendary";
export type WeaponType = "sword" | "staff" | "bow" | "herbs" | "two-handed-sword" | "fist" | "claws" | "harp" | "spoon";

// Teachers table



// Students table



// Equipment stats type matching EquipmentStats interface
export interface EquipmentItemStats {
  str?: number;
  int?: number;
  agi?: number;
  mnd?: number;
  vit?: number;
  def?: number;
  atk?: number;
  mat?: number;
  rtk?: number;
}

// Equipment items table (teacher-created custom items)



// Loot table item (references equipment items)
export interface LootItem {
  itemId: string; // References EQUIPMENT_ITEMS
}

// Fights table


// Student job levels table (tracks progression)



// Combat sessions table (active game state)


// Combat stats table (post-fight performance tracking)



// Guilds table (teacher-created groups for organizing fights and students)



// Guild memberships (many-to-many: students can join multiple guilds)



// Guild fight assignments (many-to-many: fights can be assigned to multiple guilds)



// Guild settings (teacher-configurable options per guild)



// Student currencies table (for guild shop and economy)



// Quest types
export type QuestType = "personal" | "guild" | "weekly" | "teacher_custom";

// Quest criteria for custom teacher quests
export interface CustomQuestCriterion {
  fightId?: string; // Reference to specific fight
  mode?: "solo" | "teacher" | "any"; // Combat mode requirement
  accuracy?: number; // Minimum accuracy percentage (50-100 in steps of 10)
  performanceType?: "individual" | "class_average"; // Individual or class-wide performance
}

// Quest criteria types for different quest goals
export type QuestCriteriaType = 
  | "reach_job_level"           // Personal: Reach specific level in a job
  | "unlock_cross_class"        // Personal: Unlock an advanced class
  | "unlock_ultimate"           // Personal: Unlock ultimate ability
  | "guild_level"               // Guild: Reach specific guild level
  | "total_correct_answers"     // Guild: Total correct answers across guild
  | "total_damage"              // Guild: Total damage dealt
  | "total_healing"             // Guild: Total healing done
  | "custom";                   // Teacher custom quest

// Guild quests (achievements and group goals)
export interface QuestCriteria {
  type: QuestCriteriaType;
  
  // For reach_job_level quests
  targetJob?: CharacterClass;
  targetLevel?: number;
  
  // For unlock_cross_class quests
  targetClass?: CharacterClass;
  
  // For guild progression quests (guild_level, total_correct_answers, etc.)
  targetAmount?: number;
  
  // For custom quests
  customDescription?: string;
  
  // Teacher custom quest criteria (up to 3)
  criteria1?: CustomQuestCriterion;
  criteria2?: CustomQuestCriterion;
  criteria3?: CustomQuestCriterion;
}

// Quest rewards
export interface QuestReward {
  gold?: number;
  equipmentItemId?: string; // Reference to equipment_items table
  guildXP?: number;
  unlockTier?: number; // Unlock shop tier
}




// Legacy guild quests table - kept for backwards compatibility but will be migrated to quests table



// Question schema
export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer: string;
  timeLimit: number; // in seconds
}

export const questionSchema = z.object({
  id: z.string(),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  timeLimit: z.number().min(5).max(300),
});

// Enemy schema
export interface Enemy {
  id: string;
  name: string;
  image: string;
  difficultyMultiplier: number; // 1-100: counterattack damage and share of the encounter HP budget
}

export const enemySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  image: z.string(),
  difficultyMultiplier: z.number().min(1).max(100).default(10),
});

// Fight schema (teacher creates)
export interface Fight {
  id: string;
  teacherId: string;
  title: string;
  guildCode: string | null; // Deprecated: use guild_fights table instead
  questions: Question[];
  enemies: Enemy[];
  baseXP: number;
  baseEnemyDamage: number;
  enemyDisplayMode: "simultaneous" | "consecutive";
  lootTable: LootItem[];
  randomizeQuestions: boolean;
  shuffleOptions: boolean;
  questionCount?: number;
  soloModeEnabled?: boolean;
  enemyScript?: string; // Future: custom AI behavior script
  createdAt: number;
}

export const insertFightSchema = z.object({
  teacherId: z.string().min(1),
  title: z.string().min(1),
  guildCode: z.string().optional().nullable(), // Deprecated: use guild_fights table
  questions: z.array(questionSchema).min(1),
  enemies: z.array(enemySchema).default([]),
  baseXP: z.number().min(1).max(100).default(10),
  baseEnemyDamage: z.number().min(1).max(10).default(1),
  enemyDisplayMode: z.enum(["simultaneous", "consecutive"]).default("consecutive"),
  lootTable: z.array(z.object({ itemId: z.string() })).default([]),
  randomizeQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(true),
});

export type InsertFight = z.infer<typeof insertFightSchema>;

// Combat state (active game session)
export interface PlayerState {
  studentId: string;
  nickname: string;
  characterClass: CharacterClass;
  gender: Gender;
  health: number;
  maxHealth: number;
  mp: number; // Magic Points - (INT + MND) × 3
  maxMp: number; // Maximum MP
  comboPoints: number; // For Scout and cross-class Headshot users
  maxComboPoints: number; // AGI × 2
  streakCounter: number; // DEPRECATED: Use comboPoints instead (kept for backward compat)
  
  // Calculated combat stats (cached from job + equipment + passives)
  str: number;  // Strength
  int: number;  // Intelligence
  agi: number;  // Agility
  mnd: number;  // Mind
  vit: number;  // Vitality
  def: number;  // Defense (from armor + VIT/2)
  atk: number;  // Attack (from weapon + STR)
  mat: number;  // Magic Attack (from weapon + INT)
  rtk: number;  // Ranged Attack (from weapon + AGI)
  
  isDead: boolean;
  currentAnswer?: string;
  hasAnswered: boolean;
  answeredCurrentQuestionCorrectly: boolean; // Track if the current question was answered correctly (for abilities phase eligibility)
  hasSelectedAbility: boolean; // Track if student has already selected an ability this phase (prevents modal from reopening)
  isHealing: boolean;
  healTarget?: string; // Student ID to heal
  blockTarget?: string; // Student ID to block (for tanks)
  potionCount: number; // For herbalists - starts with 5
  isCreatingPotion: boolean; // For herbalists - choosing to create potion instead of damage
  
  // Job system integration
  jobLevels: Record<CharacterClass, number>; // Level for each job class (0 if not started)
  
  // Cross-class abilities
  crossClassAbility1?: string | null; // ID of equipped cross-class ability 1
  crossClassAbility2?: string | null; // ID of equipped cross-class ability 2
  
  // Wizard fireball ability
  isChargingFireball: boolean; // For wizards - manually charging fireball
  fireballChargeRounds: number; // 0-2 rounds charged
  fireballCooldown: number; // Rounds remaining before can use again (0-5)
  
  // Warlock abilities
  hexedEnemyId?: string; // ID of enemy currently hexed by this warlock
  hexRoundsRemaining: number; // Rounds remaining for hex effect
  hexDamage: number; // Damage dealt per round by hex (INT - 1)
  pactSurgeBoost: number; // Temporary ATK boost from Pact Surge
  abyssalDrainActive: boolean; // Whether Abyssal Drain buff is active
  abyssalDrainRounds: number; // Rounds remaining for Abyssal Drain buff
  
  // Combat statistics tracking (for XP calculation)
  questionsAnswered: number;
  questionsCorrect: number;
  questionsIncorrect: number;
  damageDealt: number;
  damageBlocked: number; // For tanks
  bonusDamage: number; // Damage exceeding base (streak bonuses)
  healingDone: number;
  damageTaken: number;
  deaths: number;
  lastActionDamage: number; // Damage dealt in the most recent action (for UI display)
  
  // Enemy AI targeting
  threat: number; // Enemy targeting priority (default 1)
  
  // Ultimate abilities (level 15+ job abilities)
  fightCount: number; // Total fights completed (for ultimate cooldown tracking)
  lastUltimatesUsed: Record<string, number>; // Maps ultimate ID to fight number when last used
  
  // Unified abilities phase action tracking
  pendingAction?: {
    abilityId: string; // "base_attack", "block", or actual ability ID
    targetId?: string; // Enemy ID or student ID
    targetType?: "enemy" | "ally"; // Target category
  };
  lastTargetId?: string; // Last target for auto-selection on timeout
}

export interface CombatState {
  sessionId: string; // 6-character code for this session
  fightId: string; // Reference to fight template
  currentQuestionIndex: number;
  currentPhase: "waiting" | "question" | "abilities" | "question_resolution" | "enemy_ai" | "state_check" | "game_over";
  players: Record<string, PlayerState>;
  enemies: Array<{ id: string; name: string; image: string; health: number; maxHealth: number }>;
  questionStartTime?: number;
  phaseStartTime?: number;
  questionOrder?: number[]; // Array of question indices (shuffled if randomizeQuestions is true)
  threatLeaderId?: string; // Student ID of the current threat leader (for crown icon)
  isFirstQuestionOfSession?: boolean; // Track if this is the first question of the session
  
  // Solo mode fields
  questionCount?: number;
  soloModeEnabled?: boolean;
  soloModeHostId?: string; // Student ID of the host
  soloModeStartHP?: number; // Starting HP for solo mode (scales with players)
  soloModeAIEnabled?: boolean; // Whether AI players are enabled
  soloModeJoinersBlocked?: boolean; // Whether new players can join
}

// Equipment item definition
export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: "common" | "rare" | "epic" | "legendary";
  stats: {
    str?: number;
    int?: number;
    agi?: number;
    mnd?: number;
    vit?: number;
    def?: number;    // Direct defense bonus
    atk?: number;    // Direct attack bonus (melee)
    mat?: number;    // Direct magic attack bonus
    rtk?: number;    // Direct ranged attack bonus
  };
  classRestriction?: CharacterClass[]; // undefined = available to all
  weaponType?: WeaponType; // Weapon type for class weapon restrictions
  offhandType?: "shield" | "potion" | "quiver";
  armorCategory?: "heavy_armor" | "leather_armor" | "light_armor"; // Armor category (optional)
}

// Weapon type restrictions by character class
export const WEAPON_RESTRICTIONS: Record<CharacterClass, WeaponType[]> = {
  warrior: ["sword"],
  wizard: ["staff"],
  scout: ["bow"],
  herbalist: ["herbs"],
  warlock: ["staff"],
  priest: ["staff"],
  paladin: ["sword", "two-handed-sword"],
  dark_knight: ["sword", "two-handed-sword"],
  blood_knight: ["two-handed-sword"],
  monk: ["fist", "claws"],
  ranger: ["bow"],
  bard: ["harp", "spoon"],
};

// Equipment items database (single source of truth)
export const EQUIPMENT_ITEMS: Record<string, EquipmentItem> = {
  // Class-specific basic equipment (starting gear)
  basic_sword: {
    id: "basic_sword",
    name: "Basic Sword",
    slot: "weapon",
    rarity: "common",
    stats: { atk: 1 },
    classRestriction: ["warrior"],
    weaponType: "sword",
  },
  basic_staff: {
    id: "basic_staff",
    name: "Basic Staff",
    slot: "weapon",
    rarity: "common",
    stats: { mat: 1 },
    classRestriction: ["wizard", "warlock"],
    weaponType: "staff",
  },
  basic_bow: {
    id: "basic_bow",
    name: "Basic Bow",
    slot: "weapon",
    rarity: "common",
    stats: { rtk: 1 },
    classRestriction: ["scout"],
    weaponType: "bow",
  },
  basic_herbs: {
    id: "basic_herbs",
    name: "Basic Herbs",
    slot: "weapon",
    rarity: "common",
    stats: { mnd: 1 },
    classRestriction: ["herbalist"],
    weaponType: "herbs",
  },
  basic_fist: {
    id: "basic_fist",
    name: "Basic Fist Wraps",
    slot: "weapon",
    rarity: "common",
    stats: { atk: 1 },
    classRestriction: ["monk"],
    weaponType: "fist",
  },
  basic_helm: {
    id: "basic_helm",
    name: "Basic Helm",
    slot: "headgear",
    rarity: "common",
    stats: { def: 1 },
    armorCategory: "heavy_armor",
  },
  basic_armor: {
    id: "basic_armor",
    name: "Basic Armor",
    slot: "armor",
    rarity: "common",
    stats: { def: 1 },
    armorCategory: "heavy_armor",
  },
  basic_claymore: {
    id: "basic_claymore",
    name: "Basic Claymore",
    slot: "weapon",
    rarity: "common",
    stats: { atk: 2 },
    classRestriction: ["paladin", "dark_knight", "blood_knight"],
    weaponType: "two-handed-sword",
  },
  basic_knuckles: {
    id: "basic_knuckles",
    name: "Basic Knuckles",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 1, str: 1 },
    classRestriction: ["monk"],
    weaponType: "fist",
  },
  basic_harp: {
    id: "basic_harp",
    name: "Basic Harp",
    slot: "weapon",
    rarity: "common",
    stats: { rtk: 1 },
    classRestriction: ["bard"],
    weaponType: "harp",
  },
  
  // Common drops
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    slot: "weapon",
    rarity: "common",
    stats: { atk: 2, str: 1 },
    classRestriction: ["warrior"],
    weaponType: "sword",
  },
  steel_bow: {
    id: "steel_bow",
    name: "Steel Bow",
    slot: "weapon",
    rarity: "rare",
    stats: { rtk: 3, agi: 1 },
    classRestriction: ["scout"],
    weaponType: "bow",
  },
  magic_staff: {
    id: "magic_staff",
    name: "Magic Staff",
    slot: "weapon",
    rarity: "rare",
    stats: { mat: 3, int: 1 },
    classRestriction: ["wizard", "warlock"],
    weaponType: "staff",
  },
  basic_claws: {
    id: "basic_claws",
    name: "Basic Claws",
    slot: "weapon",
    rarity: "common",
    stats: { atk: 2, agi: 1 },
    classRestriction: ["monk"],
    weaponType: "claws",
  },
  leather_helm: {
    id: "leather_helm",
    name: "Leather Helm",
    slot: "headgear",
    rarity: "common",
    stats: { def: 2 },
  },
  steel_helmet: {
    id: "steel_helmet",
    name: "Steel Helmet",
    slot: "headgear",
    rarity: "rare",
    stats: { def: 3, vit: 1 },
  },
  arcane_crown: {
    id: "arcane_crown",
    name: "Arcane Crown",
    slot: "headgear",
    rarity: "epic",
    stats: { mat: 2, int: 2 },
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    slot: "armor",
    rarity: "common",
    stats: { def: 2 },
  },
  chainmail: {
    id: "chainmail",
    name: "Chainmail",
    slot: "armor",
    rarity: "rare",
    stats: { def: 4 },
  },
  plate_armor: {
    id: "plate_armor",
    name: "Plate Armor",
    slot: "armor",
    rarity: "epic",
    stats: { def: 5, vit: 2 },
  },
  dragon_scale: {
    id: "dragon_scale",
    name: "Dragon Scale Armor",
    slot: "armor",
    rarity: "legendary",
    stats: { def: 7, vit: 3, str: 1 },
  },
  legendary_blade: {
    id: "legendary_blade",
    name: "Legendary Blade",
    slot: "weapon",
    rarity: "legendary",
    stats: { atk: 5, str: 2 },
    classRestriction: ["warrior"],
    weaponType: "sword",
  },
};

// Universal ownership; each job selects a compatible starter loadout.
Object.assign(EQUIPMENT_ITEMS, STARTER_EQUIPMENT);
export function getStartingEquipment(characterClass: CharacterClass) {
  return { ...STARTER_LOADOUTS[characterClass] };
}

// Calculate total equipment bonuses
export interface EquipmentStats {
  str: number;
  int: number;
  agi: number;
  mnd: number;
  vit: number;
  def: number;
  atk: number;
  mat: number;
  rtk: number;
}

export function calculateEquipmentStats(weapon: string | null, headgear: string | null, armor: string | null, ...additional: (string | null)[]): EquipmentStats {
  const stats: EquipmentStats = { str: 0, int: 0, agi: 0, mnd: 0, vit: 0, def: 0, atk: 0, mat: 0, rtk: 0 };
  
  const items = [weapon, headgear, armor, ...additional];
  for (const itemId of items) {
    const item = itemId ? EQUIPMENT_ITEMS[itemId] : undefined;
    if (item) {
      stats.str += item.stats.str || 0;
      stats.int += item.stats.int || 0;
      stats.agi += item.stats.agi || 0;
      stats.mnd += item.stats.mnd || 0;
      stats.vit += item.stats.vit || 0;
      stats.def += item.stats.def || 0;
      stats.atk += item.stats.atk || 0;
      stats.mat += item.stats.mat || 0;
      stats.rtk += item.stats.rtk || 0;
    }
  }
  
  return stats;
}

// Base job starting stats (these are NOT awarded as passive bonuses)
export interface BaseJobStats {
  baseHP: number;
  str?: number;
  int?: number;
  agi?: number;
  mnd?: number;
  vit?: number;
  role: string;
}

// Character class stats using new stat system
export const CLASS_STATS: Record<CharacterClass, BaseJobStats> = {
  warrior: { baseHP: 15, vit: 1, str: 1, role: "Tank - Can block for allies" },
  wizard: { baseHP: 7, int: 2, role: "DPS - Magical damage" },
  scout: { baseHP: 7, agi: 2, role: "DPS - Ranged damage" },
  herbalist: { baseHP: 10, mnd: 1, role: "Healer - Can heal allies" },
  warlock: { baseHP: 7, int: 2, role: "Curse specialist - DoT damage" },
  priest: { baseHP: 10, mnd: 3, role: "Healer - Advanced healing specialist" },
  paladin: { baseHP: 16, vit: 1, str: 1, mnd: 1, role: "Tank/Healer - Holy defender" },
  dark_knight: { baseHP: 14, vit: 1, str: 1, int: 1, role: "Tank/DPS - Dark magic melee" },
  blood_knight: { baseHP: 20, str: 1, int: 2, vit: 1, role: "Tank/DPS - Lifesteal specialist" },
  monk: { baseHP: 10, vit: 1, str: 1, agi: 1, role: "Tank/DPS - Stance-based combo fighter" },
  ranger: { baseHP: 7, agi: 3, role: "DPS - Ranged damage with enhanced mobility" },
  bard: { baseHP: 7, int: 1, mnd: 1, role: "Support/DPS - Song-based buffs and damage" },
};

// Complete character stats (all stats combined)
export interface CharacterStats {
  // Base stats (from job + equipment + passives)
  str: number;  // Strength - Adds damage to physical attacks
  int: number;  // Intelligence - Adds MP and damage to magical attacks
  agi: number;  // Agility - Adds damage to ranged attacks, grants critical hit chance (2 AGI = 1% crit, 2x damage)
  mnd: number;  // Mind - Adds MP and healing to spells
  vit: number;  // Vitality - Reduces damage by VIT/2 and adds VIT HP
  
  // Derived stats
  hp: number;       // Hit Points: Job baseHP + VIT
  maxHp: number;    // Maximum HP
  mp: number;       // Magic Points: (INT + MND) × 3
  maxMp: number;    // Maximum MP
  def: number;      // Defense: Reduces damage by DEF points
  atk: number;      // Attack: Raises melee damage by ATK points
  mat: number;      // Magic Attack: Raises magic damage by MAT points
  rtk: number;      // Ranged Attack: Raises ranged attack damage by RTK points
  comboPoints: number;     // Current combo points (for Scout and cross-class users)
  maxComboPoints: number;  // Starting Max Combo Points = AGI × 2
}

// Calculate complete character stats
export function calculateCharacterStats(
  characterClass: CharacterClass,
  equipmentStats: EquipmentStats,
  passiveBonuses: { str?: number; int?: number; agi?: number; mnd?: number; vit?: number },
  mechanicUpgrades: { maxComboPoints?: number; potionCraftBonus?: number; hexDuration?: number; siphonHealBonus?: number } = {}
): CharacterStats {
  const baseJob = CLASS_STATS[characterClass];
  
  // Calculate base stats (job + equipment + passives)
  const str = (baseJob.str || 0) + (equipmentStats?.str || 0) + (passiveBonuses?.str || 0);
  const int = (baseJob.int || 0) + (equipmentStats?.int || 0) + (passiveBonuses?.int || 0);
  const agi = (baseJob.agi || 0) + (equipmentStats?.agi || 0) + (passiveBonuses?.agi || 0);
  const mnd = (baseJob.mnd || 0) + (equipmentStats?.mnd || 0) + (passiveBonuses?.mnd || 0);
  const vit = (baseJob.vit || 0) + (equipmentStats?.vit || 0) + (passiveBonuses?.vit || 0);
  
  // Calculate derived stats
  const maxHp = baseJob.baseHP + vit;
  const maxMp = (int + mnd) * 3;
  const def = (equipmentStats?.def || 0);
  const atk = (equipmentStats?.atk || 0);
  const mat = (equipmentStats?.mat || 0);
  const rtk = (equipmentStats?.rtk || 0);
  const maxComboPoints = (agi * 2) + (mechanicUpgrades.maxComboPoints || 0);
  
  return {
    str,
    int,
    agi,
    mnd,
    vit,
    hp: maxHp,  // Start at max HP
    maxHp,
    mp: maxMp,  // Start at max MP
    maxMp,
    def,
    atk,
    mat,
    rtk,
    comboPoints: 0,  // Start with 0 combo points
    maxComboPoints,
  };
}

// Calculate player's current combat stats from PlayerState
export function getPlayerCombatStats(playerState: PlayerState, weapon: string, headgear: string, armor: string): CharacterStats {
  const passiveBonuses = getTotalPassiveBonuses(playerState.jobLevels);
  const mechanicUpgrades = getTotalMechanicUpgrades(playerState.jobLevels);
  const equipmentStats = calculateEquipmentStats(weapon, headgear, armor);
  
  return calculateCharacterStats(
    playerState.characterClass,
    equipmentStats,
    passiveBonuses,
    mechanicUpgrades
  );
}

// Calculate critical hit chance and apply multiplier
export function calculateCriticalHit(agi: number): { isCritical: boolean; multiplier: number } {
  // 2 AGI = 1% critical hit chance
  const critChance = (agi / 2) / 100;
  const isCritical = Math.random() < critChance;
  return {
    isCritical,
    multiplier: isCritical ? 2 : 1
  };
}

// Calculate damage for different attack types
export function calculatePhysicalDamage(atk: number, str: number, agi: number): number {
  const baseDamage = atk + str;
  const { multiplier } = calculateCriticalHit(agi);
  return Math.floor(baseDamage * multiplier);
}

export function calculateMagicalDamage(mat: number, int: number): number {
  return mat + int;
}

export function calculateRangedDamage(rtk: number, agi: number): number {
  const baseDamage = rtk + agi;
  const { multiplier } = calculateCriticalHit(agi);
  return Math.floor(baseDamage * multiplier);
}

export function calculateHybridDamage(mat: number, agi: number, mnd: number): number {
  // For Herbalist base damage (no critical hits on hybrid damage)
  return mat + agi + mnd;
}

// Calculate damage reduction
export function calculateDamageReduction(def: number, vit: number): number {
  return def + Math.floor(vit / 2);
}

// Calculate base damage for a player (without critical hit variance)
export function calculatePlayerBaseDamage(stats: CharacterStats, job: CharacterClass): number {
  const {atk,mat,rtk,str,int,agi,mnd,vit}=stats;
  return {warrior:atk+str,wizard:mat+int,scout:rtk+agi,herbalist:mat+agi+mnd,warlock:mat+int,priest:mat+mnd,paladin:atk+str+mnd,dark_knight:atk+str+vit,blood_knight:atk+str+int,monk:atk+str+agi,ranger:rtk+2*agi,bard:rtk+str+int+agi+mnd+vit}[job];
}

// Calculate solo mode enemy scaling
export function calculateSoloModeEnemyScaling(
  playerStats: CharacterStats,
  characterClass: CharacterClass,
  questionCount: number
): { enemyHP: number; enemyDamageCap: number } {
  // Step 1: Calculate base damage per round
  const baseDamage = calculatePlayerBaseDamage(playerStats, characterClass);
  
  // Step 2: Initial enemy HP = base damage × question count
  let enemyHP = baseDamage * questionCount;
  
  // Step 3: Enemy AI damage cap = player HP ÷ question count (min 1)
  const enemyDamageCap = Math.max(1, Math.floor(playerStats.hp / questionCount));
  
  // Step 4: Survivability check
  // Player survives for Math.floor(playerHP / enemyDamageCap) rounds
  const roundsToSurvive = Math.floor(playerStats.hp / enemyDamageCap);
  
  // At 100% accuracy, player deals baseDamage per round for roundsToSurvive rounds
  const damageAt100Percent = baseDamage * roundsToSurvive;
  
  // If player can't win at 100% accuracy, scale down
  if (damageAt100Percent < enemyHP) {
    // Reduce to 70% accuracy scenario: player wins with 1 round to spare
    // At 70% accuracy with N questions, player gets ~0.7N correct
    // They survive roundsToSurvive rounds, so can answer that many questions
    // Damage = baseDamage × (roundsToSurvive - 1) to ensure victory before death
    enemyHP = baseDamage * Math.max(1, roundsToSurvive - 1);
  }
  
  return {
    enemyHP: Math.floor(enemyHP),
    enemyDamageCap: enemyDamageCap
  };
}

// Guild level system (exponential curve for quest progression)
// Levels 1-5 use fixed values: 1000, 2000, 4000, 8000, 16000
const GUILD_XP_REQUIREMENTS: Record<number, number> = {
  2: 1000,   // Level 1 → 2: 1000 XP
  3: 2000,   // Level 2 → 3: 2000 XP
  4: 4000,   // Level 3 → 4: 4000 XP
  5: 8000,   // Level 4 → 5: 8000 XP
  6: 16000,  // Level 5 → 6: 16000 XP (if extending beyond 5)
};

export function getGuildXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return GUILD_XP_REQUIREMENTS[level] || 0;
}

export function getTotalGuildXPForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getGuildXPForLevel(i);
  }
  return total;
}

export function getGuildLevelFromXP(xp: number): number {
  let level = 1;
  let cumulativeXP = 0;
  
  while (level < 5) { // Max level 5 for now
    const xpNeededForNext = getGuildXPForLevel(level + 1);
    if (xpNeededForNext === 0 || cumulativeXP + xpNeededForNext > xp) {
      break;
    }
    cumulativeXP += xpNeededForNext;
    level++;
  }
  
  return level;
}

// Gold calculation based on difficulty using logistic curve
// Center of steep curve around level 40, starts increasing dramatically around level 20
export function calculateGoldReward(difficultySlider: number): number {
  // difficultySlider ranges from 1 to 100
  // Logistic function: gold = L / (1 + e^(-k(x - x0))) + offset
  // Where:
  //   L = max value (asymptote)
  //   k = steepness
  //   x0 = midpoint (center of curve)
  //   x = difficultySlider
  
  const L = 10000;      // Maximum gold at difficulty 100
  const k = 0.15;       // Steepness (higher = steeper curve)
  const x0 = 40;        // Center of curve at difficulty 40
  const offset = 10;    // Minimum gold at difficulty 1
  
  const exponential = Math.exp(-k * (difficultySlider - x0));
  const gold = L / (1 + exponential) + offset;
  
  const minimum = L / (1 + Math.exp(-k * (1 - x0))) + offset;
  const maximum = L / (1 + Math.exp(-k * (100 - x0))) + offset;
  return Math.round(10 + (Math.max(minimum, Math.min(maximum,gold)) - minimum) / (maximum - minimum) * 9990);
}

// Calculate base tier price for equipment in guild shop
export function calculateTierPrice(tier: number, quality: ItemQuality): number {
  // Base prices for each tier (common quality)
  const tierBasePrices: Record<number, number> = {
    1: 150,
    2: 500,
    3: 1200,
    4: 2000,
    5: 3500,
    6: 5500,
    7: 8000,
    8: 11000,
    9: 15000,
    10: 20000,
  };
  
  const basePrice = tierBasePrices[tier] || 100;
  
  // Quality multipliers
  const qualityMultipliers: Record<ItemQuality, number> = {
    common: 1.0,
    rare: 1.5,
    epic: 2.0,
    legendary: 3.0,
  };
  
  return Math.floor(basePrice * qualityMultipliers[quality]);
}

// Question Resolution Feedback Types
export type ResolutionFeedbackType =
  | "correct_damage"             // Student answered correctly and dealt base damage
  | "incorrect_damage"           // Student answered incorrectly and took damage
  | "correct_ability"            // Student answered correctly and used an ability (phase 1)
  | "blocked_for_player"         // Tank successfully blocked damage for another player
  | "got_blocked"                // Student got their damage blocked by a tank
  | "healed_player"              // Healer successfully healed another player
  | "ability_damage_phase2"      // Student used a block/healing phase ability that dealt damage
  | "ability_missed"             // Student used an ability but answered incorrectly, ability missed

export interface ResolutionFeedback {
  type: ResolutionFeedbackType;
  damage?: number;              // Damage dealt or taken
  defendedAmount?: number;      // Amount of damage defended (for incoming damage)
  enemyName?: string;           // Enemy that was damaged or that attacked
  abilityName?: string;         // Name of ability used
  blockedPlayer?: string;       // Player who was blocked (for blocked_for_player)
  blockedDamage?: number;       // Amount of damage blocked
  blockingPlayer?: string;      // Player who did the blocking (for got_blocked)
  healedPlayer?: string;        // Player who was healed
  healedAmount?: number;        // Amount of HP healed
}

export interface EnemyAIAttackData {
  enemyName: string;
  enemyImage: string;
  enemyId: string;
  targetPlayer: string;      // Threat leader nickname
  damage: number;
  defendedAmount?: number;   // Amount of damage defended (for unblocked attacks)
  blocked: boolean;
  blockerName?: string;      // If blocked, who blocked it
}

export interface PartyDamageData {
  totalDamage: number;
  enemiesHit: Array<{
    enemyId: string;
    enemyName: string;
    enemyImage: string;
    damageTaken: number;
  }>;
}

// Public transport types. Database tables and credential fields live only in worker/db/schema.ts.
import type * as DB from '../worker/db/schema';
export type Teacher = Omit<DB.TeacherRecord,'passwordHash'|'emailNormalized'>;
export type Student = Omit<DB.StudentRecord,'passwordHash'|'nicknameNormalized'|'createdAt'>;
export type EquipmentItemDb = typeof DB.equipmentItems.$inferSelect;
export type StudentJobLevel = typeof DB.studentJobLevels.$inferSelect;
export type Guild = typeof DB.guilds.$inferSelect;
export type GuildMembership = typeof DB.guildMemberships.$inferSelect;
export type GuildMember = Student & {joinedAt:number;studentId:string};
export type GuildFight = typeof DB.guildFights.$inferSelect;
export type GuildSettings = typeof DB.guildSettings.$inferSelect;
export type Quest = typeof DB.quests.$inferSelect;
export type GuildQuest = Quest;
export type CombatStat = Omit<typeof DB.combatResults.$inferSelect,'totals'> & import('./combat/model').CombatTotals & {nickname:string;lootItemClaimed:string|null};
export type DbFight = DB.FightRecord;
export type InsertQuest = typeof DB.quests.$inferInsert;
export type InsertEquipmentItem = typeof DB.equipmentItems.$inferInsert;
export type InsertGuild = typeof DB.guilds.$inferInsert;
export type InsertGuildQuest = InsertQuest;
export type InsertGuildSettings = typeof DB.guildSettings.$inferInsert;
export type InsertStudentJobLevel = typeof DB.studentJobLevels.$inferInsert;
export type InsertGuildMembership = typeof DB.guildMemberships.$inferInsert;
export type InsertGuildFight = typeof DB.guildFights.$inferInsert;
export const insertEquipmentItemSchema = z.object({
 teacherId:z.string(),name:z.string().min(1),iconUrl:z.string().nullable().optional(),
 itemType:z.enum(['sword','wand','bow','staff','herbs','two-handed-sword','fist','claws','harp','spoon','light_armor','leather_armor','armor','helmet','cap','hat','consumable','shield','potion','quiver','gloves','leggings','boots']),
 quality:z.enum(['common','rare','epic','legendary']),tier:z.number().int().min(1).max(10).default(1),slot:z.enum(['weapon','headgear','armor','offhand','hands','legs','feet']),
 armorCategory:z.enum(['heavy_armor','leather_armor','light_armor']).nullable().optional(),
 offhandType:z.enum(['shield','potion','quiver']).nullable().optional(),
 weaponType:z.enum(['sword','staff','bow','herbs','two-handed-sword','fist','claws','harp','spoon']).nullable().optional(),
 stats:z.object({str:z.number().optional(),int:z.number().optional(),agi:z.number().optional(),mnd:z.number().optional(),vit:z.number().optional(),def:z.number().optional(),atk:z.number().optional(),mat:z.number().optional(),rtk:z.number().optional()}).default({}),
 shopPrice:z.number().nullable().optional(),isPurchasable:z.boolean().default(true)
});
export const insertGuildSchema=z.object({teacherId:z.string(),name:z.string().min(1),description:z.string().nullable().optional()});
