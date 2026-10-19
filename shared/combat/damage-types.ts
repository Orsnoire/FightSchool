import type { CharacterClass } from "../schema";
import { canonicalAbility } from "./abilities";

export type DamageType = "physical" | "magic";

// Damage type follows the class/move's attack, not whether its formula uses INT
// or spends MP. The documented melee Dark Knight strikes remain physical;
// curse, healing/holy damage, Wizard spells and Bard spell songs use MDF.
const MAGIC_BASIC_JOBS = new Set<CharacterClass>([
  "wizard", "herbalist", "warlock", "priest", "paladin", "blood_knight",
]);
const MAGIC_ABILITIES = new Set([
  "fireball", "frostbolt", "fireblast", "manabomb", "hex", "siphon",
  "abyssal_drain", "sacred_strike", "holy_judgment", "raining_blood",
  "finale", "crescendo",
]);

export function abilityDamageType(job: CharacterClass, ability: string): DamageType {
  const id = canonicalAbility(ability);
  return (id === "attack" ? MAGIC_BASIC_JOBS.has(job) : MAGIC_ABILITIES.has(id))
    ? "magic" : "physical";
}

export function tierMagicDefense(tier: number | null | undefined = 1): number {
  return 2 * Math.max(0, Math.floor(tier ?? 1) - 1);
}
