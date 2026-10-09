import { calculatePlayerBaseDamage, type CharacterClass } from "../schema";
import { getTotalMechanicUpgrades } from "../jobSystem";
import { canonicalAbility, firstAidHealing } from "./abilities";
import type { CombatPlayer } from "./model";

export type AbilityContext = Pick<CombatPlayer, "stats" | "characterClass" | "jobLevels" | "mp" | "health" | "maxHealth" | "healingPotions" | "shieldPotions" | "consecutiveCorrectAnswers" | "equipmentEffects">;
const whole = (n: number) => Math.max(0, Math.floor(n));

/** Raw magnitudes before hit/heal rounding, target modifiers and missing-HP caps. */
export function abilityDamage(p: AbilityContext, ability: string, streak = p.consecutiveCorrectAnswers || 0): number | undefined {
  const { atk, rtk, str, int, agi, mnd, vit } = p.stats;
  switch (canonicalAbility(ability)) {
    case "attack": return calculatePlayerBaseDamage(p.stats, p.characterClass);
    case "crushing_blow": return atk + str;
    case "fireball": return int * 3;
    case "frostbolt": case "siphon": return int;
    case "fireblast": return int * p.mp * 3;
    case "manabomb": return int * 2;
    case "headshot": return Math.floor(2 * (rtk + agi) + 0.5 * streak);
    case "aim": return (rtk + agi) * 2;
    case "killshot": return rtk * agi * 2;
    case "hemorrhage": return atk;
    case "sacred_strike": return atk * (str + mnd + vit / 2);
    case "holy_judgment": return (str + vit / 2 + mnd) / 3;
    case "ruin_strike": case "shadow_requiem": case "raining_blood": return atk * (str + vit / 2 + int);
    case "blood_price": return atk * (str + vit / 2 + int) * 2;
    case "crimson_slash": return (atk * (vit / 2 + str)) / 2;
    case "flurry": return calculatePlayerBaseDamage(p.stats, p.characterClass) * 3;
    case "focused_palm": return atk + 4 * str + 4 * agi;
    case "twin_shot": return (rtk + agi) * 4;
    case "hunters_volley": return (rtk + agi) * 2;
    case "arrowstorm": return rtk + agi;
    case "finale": case "crescendo": return (int + mnd) * str;
    default: return undefined;
  }
}

export function baseAbilityHealing(p: AbilityContext, ability: string): number | undefined {
  const { mnd, vit } = p.stats;
  switch (canonicalAbility(ability)) {
    case "first_aid": return firstAidHealing(mnd);
    case "mend": case "healing_guard": case "life_potion": return mnd;
    case "healing_potion": case "potion_diffuser": return mnd + 1;
    case "holy_light": return mnd / 2;
    case "lay_on_hands": return (vit + mnd) / 2;
    case "holy_judgment": return vit + mnd;
    case "inner_peace": return p.maxHealth;
    case "cleansing_chorus": return Math.max(1, whole((p.jobLevels.bard || 1) / 2));
    case "crescendo": return (p.jobLevels.bard || 1) / 2;
    default: return undefined;
  }
}

export function abilityHealing(p: AbilityContext, ability: string): number | undefined {
  const base = baseAbilityHealing(p, ability);
  return base === undefined ? undefined : Math.floor(base) + (p.equipmentEffects?.healingBonus || 0);
}

/** Public-state-only previews. Question damage assumes this answer succeeds. */
export function abilityPreview(p: AbilityContext, ability: string, upcomingAnswer = false): string {
  const id = canonicalAbility(ability);
  const damage = abilityDamage(p, id, (p.consecutiveCorrectAnswers || 0) + (upcomingAnswer ? 1 : 0));
  const healing = abilityHealing(p, id);
  const { int, vit, mnd, str, agi, atk } = p.stats;
  const base = damage === undefined ? "" : `Base damage: ${whole(damage)}`;
  const heal = healing === undefined ? "" : `Heals up to ${whole(healing)} HP`;
  switch (id) {
    case "attack": return `${base}; critical hit: ${whole((damage || 0) * 2)}`;
    case "headshot": return `${base} on a correct answer (streak ${(p.consecutiveCorrectAnswers || 0) + (upcomingAnswer ? 1 : 0)})`;
    case "killshot": return `${base}; execute chance depends on target HP`;
    case "fireblast": return `${base} to one enemy using all ${p.mp} MP`;
    case "manabomb": case "finale": return `${base} per enemy`;
    case "twin_shot": return `${base}; also hits the Prey target`;
    case "hunters_volley": return `${base} per hit × 5 per enemy`;
    case "arrowstorm": return `${base} per hit × 10 per enemy; extra hit on Prey`;
    case "holy_judgment": return `${base} per enemy; ${heal.toLowerCase()} per ally`;
    case "crescendo": return `${base} per enemy; ${heal.toLowerCase()} per ally; revives at 1 HP`;
    case "shadow_requiem": return `${base} per enemy; self-healing equals total damage dealt`;
    case "raining_blood": return `${base} per enemy; party healing is half total damage dealt`;
    case "siphon": return `${base}; self-healing is half damage dealt, rounded up, +${getTotalMechanicUpgrades(p.jobLevels as Record<CharacterClass, number>).siphonHealBonus || 0} HP`;
    case "crimson_slash": return `${base}; self-healing is half damage dealt, rounded down`;
    case "blood_price": return `${base}; costs ${whole(atk)} HP`;
    case "life_potion": return `Revives each knocked-out ally with up to ${whole(healing || 0)} HP`;
    case "holy_light": return `${heal} per living ally`;
    case "cleansing_chorus": return `${heal} per living ally; removes poison and paralysis`;
    case "divine_grace": return "Fully heals and revives the party";
    case "inner_peace": return "Fully heals you and grants immunity this round";
    case "warrior_block": case "aegis": case "deflect": return `Blocks up to ${Math.ceil(vit / 2)} damage per hit`;
    case "shield_bash": return `Blocks up to ${Math.ceil(vit / 2)} per hit; retaliates for ${whole(vit / 4)} base damage per guarded hit`;
    case "healing_guard": return `${heal}; blocks up to ${Math.ceil(vit / 2)} damage per hit`;
    case "manashield": return `Absorbs up to ${whole(int)} damage`;
    case "healing_potion": case "potion_diffuser": return `${heal}${id === "potion_diffuser" ? " per living ally" : ""}${p.equipmentEffects?.potionAttackBonus ? '; +1 ATK for 3 rounds (refreshes, does not stack)' : ''}`;
    case "shield_potion": return `Grants a ${whole(mnd)} HP shield`;
    case "craft_healing_potion": {
      const bonus = getTotalMechanicUpgrades(p.jobLevels as Record<CharacterClass, number>).potionCraftBonus || 0;
      const count = Math.max(0, Math.min(5 - p.healingPotions, p.healingPotions === 0 ? 1 : 1 + bonus));
      return `Creates ${count} healing potion${count === 1 ? "" : "s"}; inventory ${p.healingPotions} → ${p.healingPotions + count}/5`;
    }
    case "craft_shield_potion": return `Creates ${p.shieldPotions < 3 ? 1 : 0} shield potion; inventory ${p.shieldPotions} → ${Math.min(3, p.shieldPotions + 1)}/3`;
    case "hex": case "hemorrhage": {
      const rounds = 2 + (getTotalMechanicUpgrades(p.jobLevels as Record<CharacterClass, number>).hexDuration || 0);
      const dot = id === "hex" ? Math.max(0, int - 1) : atk / 2;
      const immediate = id === "hemorrhage" ? base : (p.jobLevels.warlock || 0) >= 15 ? `Base damage: ${whole(dot * rounds / 2)}` : "";
      return `${immediate ? immediate + "; " : ""}${whole(dot)} base damage per round × ${rounds}`;
    }
    case "purify": return "Removes poison and paralysis from one ally";
    case "bless": return `+${whole(mnd / 3)} STR, INT and AGI for ${Math.max(1, whole(mnd / 2))} rounds`;
    case "dread_aura": return `Reduces raw enemy damage by ${Math.ceil(int / 3)} for 3 rounds`;
    case "pact_surge": return `Sacrifices ${whole(p.health / 4)} HP for +${whole(p.health / 4)} ATK`;
    case "inspire": return `+${Math.min(str, int, agi, mnd)} HP and MP to each ally for 3 rounds`;
    case "battle_hymn": return `+${Math.min(str, int, agi, mnd)} STR, INT, AGI and MND to each ally for 3 rounds`;
    case "mark": case "prey": return "Target takes 2× damage";
    case "fortify": return "Doubles your VIT while active";
    case "disengage": return "Threat → 0; gains 1 combo point up to your cap";
    default: return [base, heal].filter(Boolean).join("; ");
  }
}
