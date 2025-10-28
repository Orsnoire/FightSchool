import type { CharacterClass } from "./schema";

// Lucide icon names for abilities
export type AbilityIcon = 
  | "Shield" | "Swords" | "Target" | "Zap"         // Warrior
  | "Flame" | "Snowflake" | "ShieldHalf" | "Bomb"  // Wizard
  | "Crosshair" | "Eye" | "Focus" | "Skull"        // Scout
  | "Heart" | "Beaker" | "FlaskRound" | "Leaf"     // Herbalist
  | "Ghost" | "LifeBuoy" | "TrendingUp" | "Waves"  // Warlock
  | "Sparkles" | "Wind" | "Sun" | "Star"           // Priest
  | "HeartPulse" | "Hand" | "ShieldCheck" | "Sword" // Paladin
  | "Axe" | "Droplet" | "UserX" | "Cloud"          // Dark Knight
  | "Syringe" | "Activity" | "Dna" | "CloudRain"   // Blood Knight
  | "Plus";                                         // Cross-class abilities

// Ability display configuration
export interface AbilityDisplay {
  id: string;
  icon: AbilityIcon;
  name: string;
  requiresTarget?: boolean;  // Shows target selection UI
  opensHealingWindow?: boolean; // Opens healing window in phase 2
  isToggle?: boolean;        // Toggle on/off (like fireball charging)
  isPassive?: boolean;       // Passive abilities (always active, no button click)
}

// Maps ability ID to display configuration
export const ABILITY_DISPLAYS: Record<string, AbilityDisplay> = {
  // WARRIOR
  "warrior_block": { id: "warrior_block", icon: "Shield", name: "Block", requiresTarget: true },
  "shield_bash": { id: "shield_bash", icon: "Swords", name: "Shield Bash", isPassive: true },
  "provoke": { id: "provoke", icon: "Target", name: "Provoke" },
  "crushing_blow": { id: "crushing_blow", icon: "Zap", name: "Crushing Blow" },
  
  // WIZARD
  "fireball": { id: "fireball", icon: "Flame", name: "Fireball", isToggle: true },
  "frostbolt": { id: "frostbolt", icon: "Snowflake", name: "Frost Bolt" },
  "manashield": { id: "manashield", icon: "ShieldHalf", name: "Manashield" },
  "fireblast": { id: "fireblast", icon: "Bomb", name: "Fireblast" },
  
  // SCOUT
  "headshot": { id: "headshot", icon: "Crosshair", name: "Headshot" },
  "aim": { id: "aim", icon: "Eye", name: "Aim" },
  "mark": { id: "mark", icon: "Focus", name: "Mark", requiresTarget: true },
  "dodge": { id: "dodge", icon: "Skull", name: "Dodge" },
  
  // HERBALIST
  "healing_potion": { id: "healing_potion", icon: "Heart", name: "Healing Potion", opensHealingWindow: true },
  "craft_healing_potion": { id: "craft_healing_potion", icon: "Beaker", name: "Craft Potion" },
  "craft_shield_potion": { id: "craft_shield_potion", icon: "FlaskRound", name: "Craft Shield" },
  "shield_potion": { id: "shield_potion", icon: "ShieldCheck", name: "Shield Potion", requiresTarget: true },
  "potion_diffuser": { id: "potion_diffuser", icon: "Leaf", name: "Diffuser" },
  
  // WARLOCK
  "hex": { id: "hex", icon: "Ghost", name: "Hex", requiresTarget: true },
  "siphon": { id: "siphon", icon: "LifeBuoy", name: "Siphon" },
  "pact_surge": { id: "pact_surge", icon: "TrendingUp", name: "Pact Surge" },
  "abyssal_drain": { id: "abyssal_drain", icon: "Waves", name: "Abyssal Drain" },
  
  // PRIEST
  "mend": { id: "mend", icon: "Sparkles", name: "Mend", opensHealingWindow: true },
  "purify": { id: "purify", icon: "Wind", name: "Purify", requiresTarget: true },
  "bless": { id: "bless", icon: "Sun", name: "Bless", requiresTarget: true },
  "holy_light": { id: "holy_light", icon: "Star", name: "Holy Light" },
  
  // PALADIN
  "healing_guard": { id: "healing_guard", icon: "HeartPulse", name: "Healing Guard", opensHealingWindow: true },
  "lay_on_hands": { id: "lay_on_hands", icon: "Hand", name: "Lay on Hands", requiresTarget: true },
  "aegis": { id: "aegis", icon: "ShieldCheck", name: "Aegis", requiresTarget: true },
  "sacred_strike": { id: "sacred_strike", icon: "Sword", name: "Sacred Strike" },
  
  // DARK KNIGHT
  "ruin_strike": { id: "ruin_strike", icon: "Axe", name: "Ruin Strike" },
  "blood_sword": { id: "blood_sword", icon: "Droplet", name: "Blood Sword" },
  "blood_price": { id: "blood_price", icon: "UserX", name: "Blood Price" },
  "dread_aura": { id: "dread_aura", icon: "Cloud", name: "Dread Aura" },
  
  // BLOOD KNIGHT
  "crimson_slash": { id: "crimson_slash", icon: "Syringe", name: "Crimson Slash" },
  "dark_vigor": { id: "dark_vigor", icon: "Activity", name: "Dark Vigor", isPassive: true },
  "hemorrhage": { id: "hemorrhage", icon: "Dna", name: "Hemorrhage" },
  "vampiric_guard": { id: "vampiric_guard", icon: "CloudRain", name: "Vampiric Guard", isPassive: true },
  
  // ULTIMATE/CROSS-CLASS ABILITIES (Level 15)
  "unbreakable": { id: "unbreakable", icon: "Shield", name: "Unbreakable" },
  "manabomb": { id: "manabomb", icon: "Bomb", name: "Manabomb" },
  "killshot": { id: "killshot", icon: "Crosshair", name: "Killshot" },
  "life_potion": { id: "life_potion", icon: "Heart", name: "Life Potion" },
  "soul_echo": { id: "soul_echo", icon: "Ghost", name: "Soul Echo", isPassive: true },
  "divine_grace": { id: "divine_grace", icon: "Star", name: "Divine Grace" },
  "holy_judgment": { id: "holy_judgment", icon: "Sword", name: "Holy Judgment" },
  "shadow_requiem": { id: "shadow_requiem", icon: "Cloud", name: "Shadow Requiem" },
  "raining_blood": { id: "raining_blood", icon: "CloudRain", name: "Raining Blood" },
  
  // CROSS-CLASS UNLOCK ABILITIES (Level 8)
  "block_crossclass": { id: "block_crossclass", icon: "Shield", name: "Block", requiresTarget: true },
  "fireball_crossclass": { id: "fireball_crossclass", icon: "Flame", name: "Fireball", isToggle: true },
  "headshot_crossclass": { id: "headshot_crossclass", icon: "Target", name: "Headshot" },
  "healing_potion_crossclass": { id: "healing_potion_crossclass", icon: "Beaker", name: "Healing Potion", opensHealingWindow: true },
  "hex_crossclass": { id: "hex_crossclass", icon: "Skull", name: "Hex", requiresTarget: true },
  "mend_crossclass": { id: "mend_crossclass", icon: "Plus", name: "Mend", opensHealingWindow: true },
  "healing_guard_ally_crossclass": { id: "healing_guard_ally_crossclass", icon: "ShieldCheck", name: "Healing Guard", requiresTarget: true, opensHealingWindow: true },
  "ruin_strike_crossclass": { id: "ruin_strike_crossclass", icon: "Zap", name: "Ruin Strike" },
  "crimson_slash_crossclass": { id: "crimson_slash_crossclass", icon: "Swords", name: "Crimson Slash" },
};

// Job ability progression (levels 1, 4, 10, 12, 15)
export const JOB_ABILITY_SLOTS: Record<CharacterClass, {
  level1: string;
  level4: string;
  level10: string;
  level12: string;
  level15: string; // Ultimate/cross-class ability
}> = {
  warrior: {
    level1: "warrior_block",
    level4: "shield_bash",
    level10: "provoke",
    level12: "crushing_blow",
    level15: "unbreakable",
  },
  wizard: {
    level1: "fireball",
    level4: "frostbolt",
    level10: "manashield",
    level12: "fireblast",
    level15: "manabomb",
  },
  scout: {
    level1: "headshot",
    level4: "aim",
    level10: "mark",
    level12: "dodge",
    level15: "killshot",
  },
  herbalist: {
    level1: "healing_potion",
    level4: "craft_healing_potion",
    level10: "craft_shield_potion",
    level12: "potion_diffuser",
    level15: "life_potion",
  },
  warlock: {
    level1: "hex",
    level4: "siphon",
    level10: "pact_surge",
    level12: "abyssal_drain",
    level15: "soul_echo",
  },
  priest: {
    level1: "mend",
    level4: "purify",
    level10: "bless",
    level12: "holy_light",
    level15: "divine_grace",
  },
  paladin: {
    level1: "healing_guard",
    level4: "lay_on_hands",
    level10: "aegis",
    level12: "sacred_strike",
    level15: "holy_judgment",
  },
  dark_knight: {
    level1: "ruin_strike",
    level4: "blood_sword",
    level10: "blood_price",
    level12: "dread_aura",
    level15: "shadow_requiem",
  },
  blood_knight: {
    level1: "crimson_slash",
    level4: "dark_vigor",
    level10: "hemorrhage",
    level12: "vampiric_guard",
    level15: "raining_blood",
  },
};

// Get abilities for a job based on current level
export function getJobAbilities(job: CharacterClass, level: number): {
  slot: number; // 1-5
  abilityId: string;
  isUnlocked: boolean;
}[] {
  const progression = JOB_ABILITY_SLOTS[job];
  
  return [
    { slot: 1, abilityId: progression.level1, isUnlocked: level >= 1 },
    { slot: 2, abilityId: progression.level4, isUnlocked: level >= 4 },
    { slot: 3, abilityId: progression.level10, isUnlocked: level >= 10 },
    { slot: 4, abilityId: progression.level12, isUnlocked: level >= 12 },
    { slot: 5, abilityId: progression.level15, isUnlocked: level >= 15 },
  ];
}
