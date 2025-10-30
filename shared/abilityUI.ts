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
  | "CircleDot" | "Waypoints"                      // Monk
  | "Plus";                                         // Cross-class abilities

// Ability display configuration
export interface AbilityDisplay {
  id: string;
  icon: AbilityIcon;
  name: string;
  description: string;       // Description shown in ability cards
  requiresTarget?: boolean;  // Shows target selection UI
  opensHealingWindow?: boolean; // Opens healing window in phase 2
  isToggle?: boolean;        // Toggle on/off (like fireball charging)
  isPassive?: boolean;       // Passive abilities (always active, no button click)
}

// Maps ability ID to display configuration
export const ABILITY_DISPLAYS: Record<string, AbilityDisplay> = {
  // WARRIOR
  "warrior_block": { id: "warrior_block", icon: "Shield", name: "Block", description: "Absorb incoming damage for an ally", requiresTarget: true },
  "shield_bash": { id: "shield_bash", icon: "Swords", name: "Shield Bash", description: "Deal bonus damage based on defense", isPassive: true },
  "provoke": { id: "provoke", icon: "Target", name: "Provoke", description: "Force enemies to target you" },
  "crushing_blow": { id: "crushing_blow", icon: "Zap", name: "Crushing Blow", description: "Deal massive damage that ignores defense" },
  
  // WIZARD
  "fireball": { id: "fireball", icon: "Flame", name: "Fireball", description: "Charge up powerful fire attacks", isToggle: true },
  "frostbolt": { id: "frostbolt", icon: "Snowflake", name: "Frost Bolt", description: "Deal magic damage with a chance to slow enemies" },
  "manashield": { id: "manashield", icon: "ShieldHalf", name: "Manashield", description: "Convert mana into a protective shield" },
  "fireblast": { id: "fireblast", icon: "Bomb", name: "Fireblast", description: "Unleash explosive magic damage to all enemies" },
  
  // SCOUT
  "headshot": { id: "headshot", icon: "Crosshair", name: "Headshot", description: "Precise shot that deals critical damage" },
  "aim": { id: "aim", icon: "Eye", name: "Aim", description: "Boost accuracy for guaranteed critical hits" },
  "mark": { id: "mark", icon: "Focus", name: "Mark", description: "Mark an enemy to increase party damage against them", requiresTarget: true },
  "dodge": { id: "dodge", icon: "Skull", name: "Dodge", description: "Evade incoming attacks completely" },
  
  // HERBALIST
  "healing_potion": { id: "healing_potion", icon: "Heart", name: "Healing Potion", description: "Restore health to an ally", opensHealingWindow: true },
  "craft_healing_potion": { id: "craft_healing_potion", icon: "Beaker", name: "Craft Potion", description: "Create healing potions for future use" },
  "craft_shield_potion": { id: "craft_shield_potion", icon: "FlaskRound", name: "Craft Shield", description: "Brew protective shield potions" },
  "shield_potion": { id: "shield_potion", icon: "ShieldCheck", name: "Shield Potion", description: "Grant temporary shield to an ally", requiresTarget: true },
  "potion_diffuser": { id: "potion_diffuser", icon: "Leaf", name: "Diffuser", description: "Apply potion effects to entire party" },
  
  // WARLOCK
  "hex": { id: "hex", icon: "Ghost", name: "Hex", description: "Curse an enemy to reduce their power", requiresTarget: true },
  "siphon": { id: "siphon", icon: "LifeBuoy", name: "Siphon", description: "Drain enemy health to restore your own" },
  "pact_surge": { id: "pact_surge", icon: "TrendingUp", name: "Pact Surge", description: "Channel dark power for increased magic attack" },
  "abyssal_drain": { id: "abyssal_drain", icon: "Waves", name: "Abyssal Drain", description: "Unleash void energy to drain all enemies" },
  
  // PRIEST
  "mend": { id: "mend", icon: "Sparkles", name: "Mend", description: "Heal an ally with holy magic", opensHealingWindow: true },
  "purify": { id: "purify", icon: "Wind", name: "Purify", description: "Remove negative effects from an ally", requiresTarget: true },
  "bless": { id: "bless", icon: "Sun", name: "Bless", description: "Grant divine protection to an ally", requiresTarget: true },
  "holy_light": { id: "holy_light", icon: "Star", name: "Holy Light", description: "Radiate healing light to all allies" },
  
  // PALADIN
  "healing_guard": { id: "healing_guard", icon: "HeartPulse", name: "Healing Guard", description: "Block damage while healing allies", opensHealingWindow: true },
  "lay_on_hands": { id: "lay_on_hands", icon: "Hand", name: "Lay on Hands", description: "Powerful healing touch that restores an ally", requiresTarget: true },
  "aegis": { id: "aegis", icon: "ShieldCheck", name: "Aegis", description: "Grant divine shield to protect an ally", requiresTarget: true },
  "sacred_strike": { id: "sacred_strike", icon: "Sword", name: "Sacred Strike", description: "Holy attack that deals damage and heals" },
  
  // DARK KNIGHT
  "ruin_strike": { id: "ruin_strike", icon: "Axe", name: "Ruin Strike", description: "Devastating attack using dark power" },
  "blood_sword": { id: "blood_sword", icon: "Droplet", name: "Blood Sword", description: "Sacrifice health for increased damage" },
  "blood_price": { id: "blood_price", icon: "UserX", name: "Blood Price", description: "Convert health into powerful strikes" },
  "dread_aura": { id: "dread_aura", icon: "Cloud", name: "Dread Aura", description: "Emit dark energy that weakens enemies" },
  
  // BLOOD KNIGHT
  "crimson_slash": { id: "crimson_slash", icon: "Syringe", name: "Crimson Slash", description: "Vampiric attack that steals enemy health" },
  "dark_vigor": { id: "dark_vigor", icon: "Activity", name: "Dark Vigor", description: "Gain strength from bloodshed", isPassive: true },
  "hemorrhage": { id: "hemorrhage", icon: "Dna", name: "Hemorrhage", description: "Inflict bleeding wounds on enemies" },
  "vampiric_guard": { id: "vampiric_guard", icon: "CloudRain", name: "Vampiric Guard", description: "Heal when blocking attacks", isPassive: true },
  
  // MONK
  "fortify": { id: "fortify", icon: "Shield", name: "Fortify", description: "Channel inner strength to boost defense", isToggle: true },
  "flurry": { id: "flurry", icon: "Zap", name: "Flurry", description: "Unleash rapid strikes on enemies" },
  "deflect": { id: "deflect", icon: "ShieldHalf", name: "Deflect", description: "Redirect incoming attacks", isToggle: true },
  "focused_palm": { id: "focused_palm", icon: "Target", name: "Focused Palm", description: "Precise strike that deals critical damage" },
  "inner_peace": { id: "inner_peace", icon: "Star", name: "Inner Peace", description: "Find balance to restore health and mana" },
  
  // ULTIMATE/CROSS-CLASS ABILITIES (Level 15)
  "unbreakable": { id: "unbreakable", icon: "Shield", name: "Unbreakable", description: "Ultimate defensive stance - become invincible for a turn" },
  "manabomb": { id: "manabomb", icon: "Bomb", name: "Manabomb", description: "Ultimate spell - massive explosion dealing devastating damage" },
  "killshot": { id: "killshot", icon: "Crosshair", name: "Killshot", description: "Ultimate precision - guaranteed critical hit with massive damage" },
  "life_potion": { id: "life_potion", icon: "Heart", name: "Life Potion", description: "Ultimate healing - fully restore an ally's health" },
  "soul_echo": { id: "soul_echo", icon: "Ghost", name: "Soul Echo", description: "Ultimate curse - enemies take damage over time", isPassive: true },
  "divine_grace": { id: "divine_grace", icon: "Star", name: "Divine Grace", description: "Ultimate blessing - restore all allies to full health" },
  "holy_judgment": { id: "holy_judgment", icon: "Sword", name: "Holy Judgment", description: "Ultimate holy strike - massive damage that heals the party" },
  "shadow_requiem": { id: "shadow_requiem", icon: "Cloud", name: "Shadow Requiem", description: "Ultimate darkness - drain life from all enemies" },
  "raining_blood": { id: "raining_blood", icon: "CloudRain", name: "Raining Blood", description: "Ultimate blood magic - sacrifice health for overwhelming power" },
  
  // CROSS-CLASS UNLOCK ABILITIES (Level 8)
  "block_crossclass": { id: "block_crossclass", icon: "Shield", name: "Block", description: "Absorb incoming damage for an ally", requiresTarget: true },
  "fireball_crossclass": { id: "fireball_crossclass", icon: "Flame", name: "Fireball", description: "Charge up powerful fire attacks", isToggle: true },
  "headshot_crossclass": { id: "headshot_crossclass", icon: "Target", name: "Headshot", description: "Precise shot that deals critical damage" },
  "healing_potion_crossclass": { id: "healing_potion_crossclass", icon: "Beaker", name: "Healing Potion", description: "Restore health to an ally", opensHealingWindow: true },
  "hex_crossclass": { id: "hex_crossclass", icon: "Skull", name: "Hex", description: "Curse an enemy to reduce their power", requiresTarget: true },
  "mend_crossclass": { id: "mend_crossclass", icon: "Plus", name: "Mend", description: "Heal an ally with holy magic", opensHealingWindow: true },
  "healing_guard_ally_crossclass": { id: "healing_guard_ally_crossclass", icon: "ShieldCheck", name: "Healing Guard", description: "Block damage while healing allies", requiresTarget: true, opensHealingWindow: true },
  "ruin_strike_crossclass": { id: "ruin_strike_crossclass", icon: "Zap", name: "Ruin Strike", description: "Devastating attack using dark power" },
  "crimson_slash_crossclass": { id: "crimson_slash_crossclass", icon: "Swords", name: "Crimson Slash", description: "Vampiric attack that steals enemy health" },
  "fortify_crossclass": { id: "fortify_crossclass", icon: "Shield", name: "Fortify", description: "Channel inner strength to boost defense", isToggle: true },
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
  monk: {
    level1: "fortify",
    level4: "flurry",
    level10: "deflect",
    level12: "focused_palm",
    level15: "inner_peace",
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
