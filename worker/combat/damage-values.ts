import { type CombatPlayer } from "../../shared/combat/model.ts";
import { calculatePlayerBaseDamage } from "../../shared/schema.ts";
import { hasOffensiveAbility, availableAbilities } from "../../shared/combat/abilities.ts";

export function baseDamage(p: CombatPlayer): number {
  return calculatePlayerBaseDamage(p.stats, p.characterClass);
}

export function encounterDamageEstimate(p: CombatPlayer): number {
  return hasOffensiveAbility(p.availableAbilities) ? Math.max(1, baseDamage(p)) : 0;
}
