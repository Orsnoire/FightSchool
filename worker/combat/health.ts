/** Damage/healing primitives mutate the phase-owned working snapshot and append ordered events. */
import { type CombatSnapshot, type CombatPlayer } from "../../shared/combat/model.ts";
import { event } from "./state-events";
import { roundHP, activeEnemies } from "../../shared/combat/encounters";
import { effectiveDefense, isHypnosis, releaseInvalidStatuses } from "../../shared/combat/status-effects";
import type { DamageType } from "../../shared/combat/damage-types";
import { currentHP } from "../../shared/combat/hp";

/** Saved pre-balance encounters keep fractional HP until that fight ends. */
export const resolvedHP = (s: CombatSnapshot, value: number, maximum: number) =>
  s.encounterHpPool === undefined ? roundHP(value) : currentHP(value, maximum);

export const integer = (n: number) => Math.max(0, Math.floor(n));

export function heal(
  s: CombatSnapshot,
  p: CombatPlayer,
  id: string,
  amount: number,
  revive = false,
) {
  const t = s.players[id];
  if (!t || (t.isDead && !revive)) return 0;
  const before = t.health;
  const healing = Math.min(t.maxHealth - t.health, integer(amount) + (p.equipmentEffects?.healingBonus || 0));
  t.health = s.encounterHpPool === undefined ? t.health + healing : currentHP(t.health + healing, t.maxHealth);
  const actual = s.encounterHpPool === undefined ? healing : t.health - before;
  t.isDead = t.health <= 0;
  p.totals.healingDone += actual;
  p.threat += actual;
  event(
    s,
    "heal",
    p.studentId,
    id,
    actual,
    `${p.nickname} healed ${t.nickname} for ${actual}`,
    {healthBefore:t.health-actual,healthAfter:t.health},
  );
  return actual;
}

export function damagePlayer(
  s: CombatSnapshot,
  id: string,
  raw: number,
  source: string,
  ignoreDefense = false,
  limit = Infinity,
  fractional = false,
) {
  const p = s.players[id];
  if (!p || p.isDead) return 0;
  let damage = ignoreDefense
    ? (fractional ? roundHP(raw) : integer(raw))
    : Math.max(
        1,
        Math.ceil(integer(raw) - effectiveDefense(p) -
          (p.buffs.vampiric_guard ? 0 : integer(p.stats.vit / 2))),
      );
  if (p.buffs.immunity || (p.buffs.dodge && source === "wrong_answer")) {
    event(s, "block", id, id, damage, `${p.nickname} avoided ${damage}`);
    p.totals.damageBlocked += damage;
    return 0;
  }
  const guards = Object.values(s.players).filter(
    (x) => !x.isDead && x.buffs[`guard:${id}`],
  );
  for (const guard of guards) {
    const blocked = Math.min(
      damage,
      Math.ceil(guard.buffs[`guard:${id}`].amount),
    );
    damage -= blocked;
    guard.totals.damageBlocked += blocked;
    guard.threat += blocked;
    event(
      s,
      "block",
      guard.studentId,
      id,
      blocked,
      `${guard.nickname} blocked ${blocked} for ${p.nickname}`,
    );
    if (guard.buffs.shield_bash)
      hit(
        s,
        guard,
        activeEnemies(s)[0]?.id || "",
        guard.stats.vit / 4,
      );
  }
  for (const key of ["shield", "manaShield"])
    if (p.buffs[key]) {
      const prevented = Math.min(damage, p.buffs[key].amount);
      damage -= prevented;
      p.totals.damageBlocked += prevented;
      delete p.buffs[key];
      event(
        s,
        "block",
        id,
        id,
        prevented,
        `${p.nickname}'s shield prevented ${prevented}`,
      );
    }
  const before = p.health;
  const requested = Math.min(p.health, damage, limit);
  p.health = resolvedHP(s, p.health - requested, p.maxHealth);
  const actual = s.encounterHpPool === undefined ? requested : before - p.health;
  p.totals.damageTaken += actual;
  if (p.characterClass === "monk" && actual)
    p.comboPoints = Math.min(p.maxComboPoints, p.comboPoints + 1);
  if (p.buffs.deflect && actual)
    hit(s, p, activeEnemies(s)[0]?.id || "", actual);
  if (p.buffs.vampiric_guard) {
    p.mp = Math.min(p.maxMp, p.mp + actual + 5);
    delete p.buffs.vampiric_guard;
  }
  if (p.health === 0) {
    p.isDead = true;
    p.totals.deaths++;
  }
  event(
    s,
    "enemy_attack",
    source,
    id,
    actual,
    `${p.nickname} took ${actual} damage`,
    {healthBefore:roundHP(p.health+actual),healthAfter:p.health,
      ...(source === "wrong_answer" && p.statuses?.some(isHypnosis)
        ? { effect: "curse", abilityId: "hypnosis" } : {}),
    },
  );
  return actual;
}

export function hit(
  s: CombatSnapshot,
  p: CombatPlayer,
  id: string,
  raw: number,
  bonus = false,
  damageType: DamageType = "physical",
) {
  const e = s.enemies.find((e) => e.id === id);
  if (!e || e.health <= 0 || (s.encounterRules===2&&!activeEnemies(s).some(x=>x.id===id))) return 0;
  const protection = (e.aiState?.buffs || []).filter(b => b.throughRound >= s.round);
  if (protection.some(b => b.type === "fade" || b.type === "flatten")) {
    event(s, "block", e.id, p.studentId, 0, protection.some(b => b.type === "flatten")
      ? `${e.name} reveals Flatten: the attack misses` : `${e.name} has faded out and is immune`);
    return 0;
  }
  let amount = integer(raw);
  if (e.effects.some((x) => ["mark", "prey"].includes(x.type))) amount *= 2;
  if (p.buffs.doubleDamage) amount *= 2;
  // Older running rooms have no MDF field and retain their saved defense rule.
  // Physical defense buffs do not increase MDF; never subtract both defenses.
  const defense = damageType === "magic" && e.magicDefense !== undefined
    ? e.magicDefense
    : (e.defense || 0) * (1 + 0.5 * protection.filter(b => b.type === "defense").length);
  amount = Math.max(0, Math.ceil(amount - defense));
  const before = e.health;
  const requested = Math.min(e.health, amount);
  e.health = resolvedHP(s, e.health - requested, e.maxHealth);
  const actual = s.encounterHpPool === undefined ? requested : before - e.health;
  if (e.health <= 0) releaseInvalidStatuses(s);
  p.totals.damageDealt += actual;
  if (bonus) p.totals.bonusDamage += actual;
  p.threat += Math.max(0, actual - p.stats.agi);
  event(
    s,
    "damage",
    p.studentId,
    id,
    actual,
    `${p.nickname} dealt ${actual} to ${e.name}`,
    {healthBefore:roundHP(e.health+actual),healthAfter:e.health},
  );
  return actual;
}
