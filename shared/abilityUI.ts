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
  | "Locate" | "ArrowUpDown" | "Footprints" | "Target" | "CloudHail" // Ranger
  | "Plus";                                         // Cross-class abilities

// Ability classification types
export type AbilityClass = 
  | "healing"      // Restores HP
  | "spell"        // Magical abilities (INT/MAT/MND based)
  | "physical"     // Physical abilities (STR/ATK/AGI/RTK based)
  | "support"      // Buffs, debuffs, utility
  | "consumable"   // Potion/item-based abilities
  | "cross_class"  // Can be equipped by other classes
  | "ultimate";    // Level 15 ultimate abilities

// Ability display configuration
export interface AbilityDisplay {
  id: string;
  icon: AbilityIcon;
  name: string;
  description: string;       // Description shown in ability cards
  abilityClass: AbilityClass[]; // Classification tags for ability behavior
  requiresTarget?: boolean;  // Shows target selection UI
  opensHealingWindow?: boolean; // Opens healing window in phase 2
  isToggle?: boolean;        // Toggle on/off (like fireball charging)
  isPassive?: boolean;       // Passive abilities (always active, no button click)
}

// Maps ability ID to display configuration
export const ABILITY_DISPLAYS: Record<string, AbilityDisplay> = {
  // WARRIOR
  "warrior_block": { id: "warrior_block", icon: "Shield", name: "Block", description: "Absorb incoming damage for an ally", abilityClass: ["physical", "support"], requiresTarget: true },
  "shield_bash": { id: "shield_bash", icon: "Swords", name: "Shield Bash", description: "Deal bonus damage based on defense", abilityClass: ["physical"], isPassive: true },
  "provoke": { id: "provoke", icon: "Target", name: "Provoke", description: "Force enemies to target you", abilityClass: ["physical", "support"] },
  "crushing_blow": { id: "crushing_blow", icon: "Zap", name: "Crushing Blow", description: "Deal massive damage that ignores defense", abilityClass: ["physical"] },
  
  // WIZARD
  "fireball": { id: "fireball", icon: "Flame", name: "Fireball", description: "Charge up powerful fire attacks", abilityClass: ["spell"], isToggle: true },
  "frostbolt": { id: "frostbolt", icon: "Snowflake", name: "Frost Bolt", description: "Deal magic damage with a chance to slow enemies", abilityClass: ["spell"] },
  "manashield": { id: "manashield", icon: "ShieldHalf", name: "Manashield", description: "Convert mana into a protective shield", abilityClass: ["spell", "support"] },
  "fireblast": { id: "fireblast", icon: "Bomb", name: "Fireblast", description: "Unleash explosive magic damage to all enemies", abilityClass: ["spell"] },
  
  // SCOUT
  "headshot": { id: "headshot", icon: "Crosshair", name: "Headshot", description: "Precise shot that deals critical damage", abilityClass: ["physical"] },
  "aim": { id: "aim", icon: "Eye", name: "Aim", description: "Boost accuracy for guaranteed critical hits", abilityClass: ["physical", "support"] },
  "mark": { id: "mark", icon: "Focus", name: "Mark", description: "Mark an enemy to increase party damage against them", abilityClass: ["physical", "support"], requiresTarget: true },
  "dodge": { id: "dodge", icon: "Skull", name: "Dodge", description: "Evade incoming attacks completely", abilityClass: ["physical", "support"] },
  
  // HERBALIST
  "healing_potion": { id: "healing_potion", icon: "Heart", name: "Healing Potion", description: "Restore health to an ally", abilityClass: ["healing", "consumable"], opensHealingWindow: true },
  "craft_healing_potion": { id: "craft_healing_potion", icon: "Beaker", name: "Craft Potion", description: "Create healing potions for future use", abilityClass: ["consumable", "support"] },
  "craft_shield_potion": { id: "craft_shield_potion", icon: "FlaskRound", name: "Craft Shield", description: "Brew protective shield potions", abilityClass: ["consumable", "support"] },
  "shield_potion": { id: "shield_potion", icon: "ShieldCheck", name: "Shield Potion", description: "Grant temporary shield to an ally", abilityClass: ["consumable", "support"], requiresTarget: true },
  "potion_diffuser": { id: "potion_diffuser", icon: "Leaf", name: "Diffuser", description: "Apply potion effects to entire party", abilityClass: ["consumable", "support"] },
  
  // WARLOCK
  "hex": { id: "hex", icon: "Ghost", name: "Hex", description: "Curse an enemy to reduce their power", abilityClass: ["spell", "support"], requiresTarget: true },
  "siphon": { id: "siphon", icon: "LifeBuoy", name: "Siphon", description: "Drain enemy health to restore your own", abilityClass: ["spell", "healing"] },
  "pact_surge": { id: "pact_surge", icon: "TrendingUp", name: "Pact Surge", description: "Channel dark power for increased magic attack", abilityClass: ["spell", "support"] },
  "abyssal_drain": { id: "abyssal_drain", icon: "Waves", name: "Abyssal Drain", description: "Unleash void energy to drain all enemies", abilityClass: ["spell", "healing"] },
  
  // PRIEST
  "mend": { id: "mend", icon: "Sparkles", name: "Mend", description: "Heal an ally with holy magic", abilityClass: ["healing", "spell"], opensHealingWindow: true },
  "purify": { id: "purify", icon: "Wind", name: "Purify", description: "Remove negative effects from an ally", abilityClass: ["spell", "support"], requiresTarget: true },
  "bless": { id: "bless", icon: "Sun", name: "Bless", description: "Grant divine protection to an ally", abilityClass: ["spell", "support"], requiresTarget: true },
  "holy_light": { id: "holy_light", icon: "Star", name: "Holy Light", description: "Radiate healing light to all allies", abilityClass: ["healing", "spell"] },
  
  // PALADIN
  "healing_guard": { id: "healing_guard", icon: "HeartPulse", name: "Healing Guard", description: "Block damage while healing allies", abilityClass: ["healing", "spell", "physical"], opensHealingWindow: true },
  "lay_on_hands": { id: "lay_on_hands", icon: "Hand", name: "Lay on Hands", description: "Powerful healing touch that restores an ally", abilityClass: ["healing", "spell"], requiresTarget: true },
  "aegis": { id: "aegis", icon: "ShieldCheck", name: "Aegis", description: "Grant divine shield to protect an ally", abilityClass: ["spell", "support"], requiresTarget: true },
  "sacred_strike": { id: "sacred_strike", icon: "Sword", name: "Sacred Strike", description: "Holy attack that deals damage and heals", abilityClass: ["physical", "spell", "healing"] },
  
  // DARK KNIGHT
  "ruin_strike": { id: "ruin_strike", icon: "Axe", name: "Ruin Strike", description: "Devastating attack using dark power", abilityClass: ["physical", "spell"] },
  "blood_sword": { id: "blood_sword", icon: "Droplet", name: "Blood Sword", description: "Sacrifice health for increased damage", abilityClass: ["physical", "spell"] },
  "blood_price": { id: "blood_price", icon: "UserX", name: "Blood Price", description: "Convert health into powerful strikes", abilityClass: ["physical", "spell"] },
  "dread_aura": { id: "dread_aura", icon: "Cloud", name: "Dread Aura", description: "Emit dark energy that weakens enemies", abilityClass: ["spell", "support"] },
  
  // BLOOD KNIGHT
  "crimson_slash": { id: "crimson_slash", icon: "Syringe", name: "Crimson Slash", description: "Vampiric attack that steals enemy health", abilityClass: ["physical", "healing"] },
  "dark_vigor": { id: "dark_vigor", icon: "Activity", name: "Dark Vigor", description: "Gain strength from bloodshed", abilityClass: ["physical", "support"], isPassive: true },
  "hemorrhage": { id: "hemorrhage", icon: "Dna", name: "Hemorrhage", description: "Inflict bleeding wounds on enemies", abilityClass: ["physical", "support"] },
  "vampiric_guard": { id: "vampiric_guard", icon: "CloudRain", name: "Vampiric Guard", description: "Heal when blocking attacks", abilityClass: ["physical", "healing", "support"], isPassive: true },
  
  // MONK
  "fortify": { id: "fortify", icon: "Shield", name: "Fortify", description: "Channel inner strength to boost defense", abilityClass: ["physical", "support"], isToggle: true },
  "flurry": { id: "flurry", icon: "Zap", name: "Flurry", description: "Unleash rapid strikes on enemies", abilityClass: ["physical"] },
  "deflect": { id: "deflect", icon: "ShieldHalf", name: "Deflect", description: "Redirect incoming attacks", abilityClass: ["physical", "support"], isToggle: true },
  "focused_palm": { id: "focused_palm", icon: "Target", name: "Focused Palm", description: "Precise strike that deals critical damage", abilityClass: ["physical"] },
  "inner_peace": { id: "inner_peace", icon: "Star", name: "Inner Peace", description: "Find balance to restore health and mana", abilityClass: ["healing", "support"] },
  
  // RANGER
  "prey": { id: "prey", icon: "Locate", name: "Prey", description: "Mark an enemy as prey - they take 200% damage from all sources", abilityClass: ["physical", "support"], requiresTarget: true },
  "twin_shot": { id: "twin_shot", icon: "ArrowUpDown", name: "Twin Shot", description: "Fire two arrows dealing massive damage", abilityClass: ["physical"] },
  "disengage": { id: "disengage", icon: "Footprints", name: "Disengage", description: "Drop all aggro and gain a combo point", abilityClass: ["physical", "support"] },
  "hunters_volley": { id: "hunters_volley", icon: "Target", name: "Hunter's Volley", description: "Unleash 5 waves of arrows at all enemies", abilityClass: ["physical"] },
  "arrowstorm": { id: "arrowstorm", icon: "CloudHail", name: "Arrowstorm", description: "Ultimate barrage - rain arrows on all enemies", abilityClass: ["physical", "ultimate"] },
  
  // ULTIMATE/CROSS-CLASS ABILITIES (Level 15)
  "unbreakable": { id: "unbreakable", icon: "Shield", name: "Unbreakable", description: "Ultimate defensive stance - become invincible for a turn", abilityClass: ["physical", "support", "ultimate"] },
  "manabomb": { id: "manabomb", icon: "Bomb", name: "Manabomb", description: "Ultimate spell - massive explosion dealing devastating damage", abilityClass: ["spell", "ultimate"] },
  "killshot": { id: "killshot", icon: "Crosshair", name: "Killshot", description: "Ultimate precision - guaranteed critical hit with massive damage", abilityClass: ["physical", "ultimate"] },
  "life_potion": { id: "life_potion", icon: "Heart", name: "Life Potion", description: "Ultimate healing - fully restore an ally's health", abilityClass: ["healing", "consumable", "ultimate"] },
  "soul_echo": { id: "soul_echo", icon: "Ghost", name: "Soul Echo", description: "Ultimate curse - enemies take damage over time", abilityClass: ["spell", "support", "ultimate"], isPassive: true },
  "divine_grace": { id: "divine_grace", icon: "Star", name: "Divine Grace", description: "Ultimate blessing - restore all allies to full health", abilityClass: ["healing", "spell", "ultimate"] },
  "holy_judgment": { id: "holy_judgment", icon: "Sword", name: "Holy Judgment", description: "Ultimate holy strike - massive damage that heals the party", abilityClass: ["physical", "spell", "healing", "ultimate"] },
  "shadow_requiem": { id: "shadow_requiem", icon: "Cloud", name: "Shadow Requiem", description: "Ultimate darkness - drain life from all enemies", abilityClass: ["spell", "healing", "ultimate"] },
  "raining_blood": { id: "raining_blood", icon: "CloudRain", name: "Raining Blood", description: "Ultimate blood magic - sacrifice health for overwhelming power", abilityClass: ["physical", "spell", "ultimate"] },
  
  // CROSS-CLASS UNLOCK ABILITIES (Level 8)
  "block_crossclass": { id: "block_crossclass", icon: "Shield", name: "Block", description: "Absorb incoming damage for an ally", abilityClass: ["physical", "support", "cross_class"], requiresTarget: true },
  "fireball_crossclass": { id: "fireball_crossclass", icon: "Flame", name: "Fireball", description: "Charge up powerful fire attacks", abilityClass: ["spell", "cross_class"], isToggle: true },
  "headshot_crossclass": { id: "headshot_crossclass", icon: "Target", name: "Headshot", description: "Precise shot that deals critical damage", abilityClass: ["physical", "cross_class"] },
  "healing_potion_crossclass": { id: "healing_potion_crossclass", icon: "Beaker", name: "Healing Potion", description: "Restore health to an ally", abilityClass: ["healing", "consumable", "cross_class"], opensHealingWindow: true },
  "hex_crossclass": { id: "hex_crossclass", icon: "Skull", name: "Hex", description: "Curse an enemy to reduce their power", abilityClass: ["spell", "support", "cross_class"], requiresTarget: true },
  "mend_crossclass": { id: "mend_crossclass", icon: "Plus", name: "Mend", description: "Heal an ally with holy magic", abilityClass: ["healing", "spell", "cross_class"], opensHealingWindow: true },
  "healing_guard_ally_crossclass": { id: "healing_guard_ally_crossclass", icon: "ShieldCheck", name: "Healing Guard", description: "Block damage while healing allies", abilityClass: ["healing", "spell", "physical", "cross_class"], requiresTarget: true, opensHealingWindow: true },
  "ruin_strike_crossclass": { id: "ruin_strike_crossclass", icon: "Zap", name: "Ruin Strike", description: "Devastating attack using dark power", abilityClass: ["physical", "spell", "cross_class"] },
  "crimson_slash_crossclass": { id: "crimson_slash_crossclass", icon: "Swords", name: "Crimson Slash", description: "Vampiric attack that steals enemy health", abilityClass: ["physical", "healing", "cross_class"] },
  "fortify_crossclass": { id: "fortify_crossclass", icon: "Shield", name: "Fortify", description: "Channel inner strength to boost defense", abilityClass: ["physical", "support", "cross_class"], isToggle: true },
  "prey_crossclass": { id: "prey_crossclass", icon: "Locate", name: "Prey", description: "Mark an enemy as prey - they take 200% damage from all sources", abilityClass: ["physical", "support", "cross_class"], requiresTarget: true },
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
  ranger: {
    level1: "prey",
    level4: "twin_shot",
    level10: "disengage",
    level12: "hunters_volley",
    level15: "arrowstorm",
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
