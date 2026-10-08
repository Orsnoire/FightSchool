import { JOB_TREE, getCrossClassAbilities } from "../jobSystem";
import type { CharacterClass } from "../schema";
import type { CombatPlayer } from "./model";
export const ULTIMATES = new Set([
  "unbreakable",
  "manabomb",
  "killshot",
  "life_potion",
  "divine_grace",
  "holy_judgment",
  "shadow_requiem",
  "raining_blood",
  "inner_peace",
  "arrowstorm",
  "crescendo",
]);
export const SUPPORT = new Set([
  "warrior_block",
  "shield_bash",
  "provoke",
  "unbreakable",
  "frostbolt",
  "manashield",
  "manabomb",
  "dodge",
  "killshot",
  "shield_potion",
  "potion_diffuser",
  "life_potion",
  "purify",
  "bless",
  "divine_grace",
  "healing_guard",
  "lay_on_hands",
  "aegis",
  "holy_judgment",
  "blood_sword",
  "dread_aura",
  "shadow_requiem",
  "vampiric_guard",
  "raining_blood",
  "fortify",
  "deflect",
  "inner_peace",
  "disengage",
  "arrowstorm",
  "inspire",
  "cleansing_chorus",
  "battle_hymn",
  "crescendo",
]);
export const ALLIES = new Set([
  "first_aid",
  "warrior_block",
  "shield_bash",
  "healing_potion",
  "shield_potion",
  "mend",
  "purify",
  "bless",
  "healing_guard",
  "lay_on_hands",
  "aegis",
  "deflect",
  "manashield",
]);
export const COSTS: Record<string, number> = {
  fireball: 1,
  frostbolt: 1,
  mend: 1,
  purify: 1,
  holy_light: 5,
  divine_grace: 5,
  ruin_strike: 1,
  blood_sword: 1,
  dread_aura: 3,
  crimson_slash: 1,
  hemorrhage: 1,
  abyssal_drain: 2,
  inspire: 4,
  finale: 10,
  battle_hymn: 8,
  crescendo: 10,
};
export const COMBOS: Record<string, number> = {
  headshot: 3,
  aim: 1,
  mark: 2,
  flurry: 4,
  focused_palm: 5,
  prey: 2,
  twin_shot: 2,
  hunters_volley: 5,
};
export const COOLDOWNS: Record<string, number> = {
  shield_bash: 2,
  provoke: 2,
  manashield: 3,
  dodge: 3,
  lay_on_hands: 5,
  sacred_strike: 5,
};
export function canonicalAbility(id: string) {
  return (
    (
      {
        block_crossclass: "warrior_block",
        fireball_crossclass: "fireball",
        headshot_crossclass: "headshot",
        healing_potion_crossclass: "healing_potion",
        hex_crossclass: "hex",
        mend_crossclass: "mend",
        healing_guard_ally_crossclass: "healing_guard",
        ruin_strike_crossclass: "ruin_strike",
        crimson_slash_crossclass: "crimson_slash",
        fortify_crossclass: "fortify",
        prey_crossclass: "prey",
        inspire_crossclass: "inspire",
      } as Record<string, string>
    )[id] || id
  );
}
export function availableAbilities(
  job: CharacterClass,
  levels: Partial<Record<CharacterClass, number>>,
  equipped: string[] = [],
): string[] {
  const result = [defaultQuestionAbility(job)];
  for (const [level, reward] of Object.entries(JOB_TREE[job].levelRewards))
    if (+level <= (levels[job] || 1))
      for (const ability of reward.abilities || [])
        if (
          !ability.id.endsWith("_crossclass") &&
          ability.id !== "dark_vigor" &&
          ability.id !== "soul_echo"
        )
          result.push(canonicalAbility(ability.id));
  const cross = getCrossClassAbilities(
    job,
    levels as Record<CharacterClass, number>,
  );
  for (const id of equipped)
    if (cross.some((a) => a.id === id)) result.push(canonicalAbility(id));
  // The healing/crafting pair is available from the first potion, including cross-class use.
  if (result.includes("healing_potion")) result.push("craft_healing_potion");
  return [...new Set(result)];
}
export function abilityProblem(p: CombatPlayer, id: string): string | null {
  if (p.characterClass === "priest" && id === "attack")
    return "Priests use First Aid instead of Attack";
  if (!p.availableAbilities.includes(id))
    return "Ability is not unlocked or equipped";
  if ((p.cooldowns[id] || 0) > 0) return "Ability is cooling down";
  if (ULTIMATES.has(id) && p.ultimatesUsed.includes(id))
    return "Ultimate already used";
  if (p.mp < (COSTS[id] || 0)) return "Not enough MP";
  if (p.comboPoints < (COMBOS[id] || 0)) return "Not enough combo points";
  if (id === "fireblast" && p.mp < 1) return "Not enough MP";
  if (["healing_potion", "potion_diffuser"].includes(id) && p.healingPotions < 1)
    return "No healing potions";
  if (id === "craft_healing_potion" && p.healingPotions >= 5) return "Healing potions full";
  if (id === "craft_shield_potion" && p.shieldPotions >= 3) return "Shield potions full";
  if (id === "shield_potion" && p.shieldPotions < 1) return "No shield potions";
  if (id === "frostbolt" && p.questionAction?.ability === "fireball")
    return "Frostbolt cannot follow Fireball";
  return null;
}

export function defaultQuestionAbility(job: CharacterClass): string {
  return job === "priest" ? "first_aid" : "attack";
}

// Damage-capable actions, including support-phase attacks and equipped cross-class skills.
// Healing, crafting and buffs alone cannot defeat an enemy.
const OFFENSIVE = new Set([
  "attack", "shield_bash", "crushing_blow", "fireball", "frostbolt", "fireblast",
  "manabomb", "headshot", "killshot", "hex", "siphon", "abyssal_drain",
  "sacred_strike", "holy_judgment", "ruin_strike", "blood_price", "shadow_requiem",
  "crimson_slash", "hemorrhage", "raining_blood", "flurry", "focused_palm",
  "twin_shot", "hunters_volley", "arrowstorm", "finale", "crescendo",
]);
export function hasOffensiveAbility(abilities: readonly string[]): boolean {
  return abilities.some(id => OFFENSIVE.has(canonicalAbility(id)));
}

export function firstAidHealing(mendHealing: number): number {
  return Math.max(1, Math.floor(mendHealing / 3));
}

// Selection reserves resources; only the authoritative resolution spends them.
export function actionCost(p: CombatPlayer, id: string) {
  return {
    mp: id === "fireblast" ? p.mp : COSTS[id] || 0,
    combo: COMBOS[id] || 0,
    healing: ["healing_potion", "potion_diffuser"].includes(id) ? 1 : 0,
    shield: id === "shield_potion" ? 1 : 0,
  };
}

export function selectionProblem(p: CombatPlayer, id: string): string | null {
  const problem = abilityProblem(p, id);
  if (problem) return problem;
  if (!SUPPORT.has(id)) return null; // Replaces, rather than adds to, the question action.
  if (p.supportActions.some((a) => a.ability === id)) return "Already selected";
  if (p.supportActions.length >= 3) return "Maximum three support actions";
  const actions = [...p.supportActions, { ability: id }];
  if (p.questionAction && p.lastAnswerCorrect !== false) actions.push(p.questionAction);
  const total = actions.reduce((sum, action) => {
    const cost = actionCost(p, action.ability);
    return { mp: sum.mp + cost.mp, combo: sum.combo + cost.combo,
      healing: sum.healing + cost.healing, shield: sum.shield + cost.shield };
  }, { mp: 0, combo: 0, healing: 0, shield: 0 });
  if (total.mp > p.mp) return "MP reserved for selected actions";
  if (total.combo > p.comboPoints) return "Combo points reserved for selected actions";
  if (total.healing > p.healingPotions) return "Healing potions reserved for selected actions";
  if (total.shield > p.shieldPotions) return "Shield potions reserved for selected actions";
  return null;
}
