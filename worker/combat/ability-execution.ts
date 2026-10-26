/** Ability effects mutate only the working snapshot owned by phase resolution.
 * No storage, transport, wall-clock reads or independent random sources. */
import { type CombatSnapshot, type CombatPlayer } from "../../shared/combat/model.ts";
import { hasOffensiveAbility, abilityProblem, COSTS, COMBOS, COOLDOWNS, ULTIMATES } from "../../shared/combat/abilities.ts";
import { abilityDamage, abilityDot, baseAbilityHealing } from "../../shared/combat/abilityValues.ts";
import { event } from "./state-events";
import { abilityEffect } from "../../shared/combat/presentation";
import { activeEnemies, bounceTarget } from "../../shared/combat/encounters";
import { heal, hit as resolveHit, integer, damagePlayer, resolvedHP } from "./health";
import { abilityDamageType } from "../../shared/combat/damage-types";
import { rng } from "./random";
import { getTotalMechanicUpgrades } from "../../shared/jobSystem.ts";
import { type CharacterClass } from "../../shared/schema.ts";
import { cleansePlayer } from "../../shared/combat/status-effects";
import { CombatRuleError } from "../../shared/combat/errors";

export function applyAbility(s: CombatSnapshot, p: CombatPlayer, id: string, targetId: string) {
  const lock = p.actionBlocked?.round === s.round ? p.actionBlocked : undefined;
  if (lock && (!lock.attacksOnly || hasOffensiveAbility([id]) || abilityDamage(p, id) !== undefined)) {
    event(s, "ability", p.studentId, targetId, 0, `${p.nickname} cannot use ${id.replaceAll("_", " ")}: ${lock.reason}`);
    return;
  }
  const bleedPenalty = p.statuses?.some(x => x.type === "bleed") ? Math.min(1, p.stats.atk) : 0;
  p.stats.atk -= bleedPenalty;
  const start=s.events.length;
  try { executeAbility(s, p, id, targetId); }
  finally {
    p.stats.atk += bleedPenalty;
    for(const e of s.events.slice(start)) {
      e.actionId=`${s.round}:player:${start}`;e.abilityId=id;
      e.effect=e.type==='heal'?'heal':e.type==='block'?'block':abilityEffect(id,p);
    }
  }
}

function executeAbility(
  s: CombatSnapshot,
  p: CombatPlayer,
  id: string,
  targetId: string,
) {
  const st = p.stats;
  const damageType = abilityDamageType(p.characterClass, id);
  const hit = (snapshot: CombatSnapshot, attacker: CombatPlayer, enemyId: string, raw: number, bonus = false) =>
    resolveHit(snapshot, attacker, enemyId, raw, bonus, damageType);
  const { atk, mat, rtk, str, int, agi, mnd, vit } = st;
  const all = () => activeEnemies(s);
  if(s.encounterRules===2&&s.enemies.some(e=>e.id===targetId)){
    targetId=bounceTarget(s,targetId);
    if(!targetId)return;
  }
  const party = () => Object.values(s.players);
  const buff = (name: string, rounds: number, amount = 0) => {
    p.buffs[name] = { rounds, amount };
  };
  const potionBuff = (target: CombatPlayer) => {
    const amount = p.equipmentEffects?.potionAttackBonus || 0;
    if (!amount || target.isDead) return;
    const previous = target.buffs['stat:atk']?.amount || 0;
    target.stats.atk += amount - previous;
    target.buffs['stat:atk'] = {rounds:3,amount};
    event(s,'ability',p.studentId,target.studentId,amount,'Potion: +1 ATK for 3 rounds');
  };
  const groupHeal = (n: number, revive = false) =>
    party().forEach((t) => heal(s, p, t.studentId, n, revive));
  let damage = 0;
  const damageValue = abilityDamage(p, id) ?? 0;
  const healingValue = baseAbilityHealing(p, id) ?? 0;
  const problem = abilityProblem(p, id);
  if (problem) {
    event(s, "ability", p.studentId, targetId, 0, `${id}: ${problem}`);
    return;
  }
  p.mp -= COSTS[id] || 0;
  p.comboPoints -= COMBOS[id] || 0;
  if (COOLDOWNS[id]) p.cooldowns[id] = COOLDOWNS[id] + 1;
  if (ULTIMATES.has(id)) p.ultimatesUsed.push(id);
  switch (id) {
    case "attack":
      damage = damageValue * (rng(s) < agi / 200 ? 2 : 1);
      break;
    case "warrior_block":
    case "shield_bash":
      buff(`guard:${targetId}`, 1, vit / 2);
      if (id === "shield_bash") buff("shield_bash", 1);
      break;
    case "provoke":
      p.threat = Math.max(...party().map((x) => x.threat)) + 1;
      buff("provoke", 1);
      break;
    case "crushing_blow":
      damage = damageValue;
      p.threat++;
      break;
    case "unbreakable":
      buff("immunity", 1);
      break;
    case "fireball":
      damage = damageValue;
      break;
    case "frostbolt":
      damage = damageValue;
      break;
    case "manashield":
      (s.players[targetId] || p).buffs.manaShield = { rounds: 2, amount: int };
      break;
    case "fireblast":
      damage = damageValue;
      p.mp = 0;
      break;
    case "manabomb":
      all().forEach((e) => hit(s, p, e.id, damageValue, true));
      break;
    case "headshot":
      damage = damageValue;
      break;
    case "aim":
      damage = damageValue;
      break;
    case "mark":
    case "prey": {
      const e = s.enemies.find((e) => e.id === targetId);
      if (e) {
        e.effects = e.effects.filter((x) => x.type !== id);
        e.effects.push({
          ownerId: p.studentId,
          type: id,
          rounds: id === "prey" ? 999 : 1,
          damage: 0,
        });
      }
      break;
    }
    case "dodge":
      buff("dodge", 1);
      break;
    case "killshot": {
      const e = s.enemies.find((e) => e.id === targetId);
      damage = damageValue;
      if (
        e &&
        rng(s) <
          Math.max(0, Math.floor((45 - (e.health / e.maxHealth) * 100) / 5)) *
            0.1
      )
        damage = e.health;
      break;
    }
    case "healing_potion":
      heal(s, p, targetId, healingValue);
      if (s.players[targetId]) potionBuff(s.players[targetId]);
      p.healingPotions--;
      break;
    case "craft_healing_potion":
      p.healingPotions = Math.min(
        5,
        p.healingPotions === 0 ? 1 : p.healingPotions + 1 +
          (getTotalMechanicUpgrades(
            p.jobLevels as Record<CharacterClass, number>,
          ).potionCraftBonus || 0),
      );
      break;
    case "craft_shield_potion":
      p.shieldPotions = Math.min(3, p.shieldPotions + 1);
      break;
    case "shield_potion":
      if (s.players[targetId])
        s.players[targetId].buffs.shield = { rounds: 999, amount: mnd };
      p.shieldPotions--;
      break;
    case "potion_diffuser":
      if (p.healingPotions > 0) {
        groupHeal(healingValue);
        party().forEach(potionBuff);
        p.healingPotions--;
      }
      break;
    case "life_potion":
      party()
        .filter((x) => x.isDead)
        .forEach((x) => heal(s, p, x.studentId, healingValue, true));
      break;
    case "hex":
    case "hemorrhage": {
      const e = s.enemies.find((e) => e.id === targetId);
      if (e) {
        const dot = abilityDot(p, id)!;
        e.effects = e.effects.filter(
          (x) => !(x.type === id && x.ownerId === p.studentId),
        );
        e.effects.push({
          ownerId: p.studentId,
          type: id,
          rounds: dot.rounds,
          damage: dot.damage,
          appliedRound: s.round,
        });
        damage = damageValue;
      }
      break;
    }
    case "siphon":
      damage = damageValue;
      break;
    case "pact_surge": {
      const n = integer(p.health / 4);
      damagePlayer(s, p.studentId, n, p.studentId, true);
      p.stats.atk += n;
      break;
    }
    case "abyssal_drain":
      buff("abyssal_drain", 2);
      break;
    case "mend":
      heal(s, p, targetId, healingValue);
      break;
    case "first_aid":
      heal(s, p, targetId, healingValue);
      break;
    case "purify":
      if (s.players[targetId]) cleansePlayer(s, s.players[targetId]);
      break;
    case "bless":
      if (s.players[targetId])
        for (const stat of ["str", "int", "agi"] as const) {
          s.players[targetId].stats[stat] += integer(mnd / 3);
          s.players[targetId].buffs[`stat:${stat}`] = {
            rounds: Math.max(1, integer(mnd / 2)),
            amount: integer(mnd / 3),
          };
        }
      break;
    case "holy_light":
      groupHeal(healingValue);
      break;
    case "divine_grace":
      groupHeal(1e9, true);
      break;
    case "healing_guard":
      heal(s, p, targetId, healingValue);
      buff(`guard:${targetId}`, 1, vit / 2);
      break;
    case "lay_on_hands":
      heal(s, p, targetId, healingValue);
      break;
    case "aegis":
      buff(`guard:${targetId}`, 1, vit / 2);
      p.threat = Math.max(...party().map((x) => x.threat)) + 1;
      break;
    case "sacred_strike":
      damage = damageValue;
      buff("immunity", 1);
      break;
    case "holy_judgment":
      groupHeal(healingValue);
      all().forEach((e) => hit(s, p, e.id, damageValue, true));
      break;
    case "ruin_strike":
      damage = damageValue;
      break;
    case "blood_sword":
      buff("blood_sword", 1);
      break;
    case "dread_aura":
      buff("dread_aura", 3, Math.ceil(int / 3));
      break;
    case "blood_price":
      damage = damageValue;
      damagePlayer(s, p.studentId, atk, p.studentId, true);
      break;
    case "shadow_requiem": {
      const dealt = all().reduce(
        (n, e) => n + hit(s, p, e.id, damageValue, true),
        0,
      );
      heal(s, p, p.studentId, dealt);
      break;
    }
    case "crimson_slash":
      damage = damageValue;
      break;
    case "vampiric_guard":
      buff("vampiric_guard", 1);
      break;
    case "raining_blood": {
      const dealt = all().reduce(
        (n, e) => n + hit(s, p, e.id, damageValue, true),
        0,
      );
      groupHeal(dealt / 2);
      break;
    }
    case "fortify":
      if (!p.buffs.fortify) {
        st.vit *= 2;
        buff("fortify", 999, vit);
      }
      break;
    case "flurry":
      damage = damageValue;
      break;
    case "deflect":
      buff(`guard:${targetId}`, 1, vit / 2);
      buff("deflect", 1);
      break;
    case "focused_palm":
      damage = damageValue;
      break;
    case "inner_peace":
      p.threat = Math.max(...party().map((x) => x.threat)) + 1;
      heal(s, p, p.studentId, healingValue);
      buff("immunity", 1);
      break;
    case "twin_shot":
      damage = damageValue;
      {
        const prey = s.enemies.find((e) =>
          e.effects.some((x) => x.type === "prey"),
        );
        if (prey) hit(s, p, prey.id, damage, true);
      }
      break;
    case "disengage":
      p.threat = 0;
      p.comboPoints = Math.min(p.maxComboPoints, p.comboPoints + 1);
      break;
    case "hunters_volley":
    case "arrowstorm":
      all().forEach((e) => {
        for (let i = 0; i < (id === "arrowstorm" ? 10 : 5); i++)
          hit(s, p, e.id, damageValue, true);
      });
      if (id === "arrowstorm") {
        const prey = s.enemies.find((e) =>
          e.effects.some((x) => x.type === "prey"),
        );
        if (prey) hit(s, p, prey.id, damageValue, true);
      }
      break;
    case "inspire":
    case "battle_hymn": {
      const n = Math.min(str, int, agi, mnd);
      for (const t of party()) {
        if (id === "inspire") {
          const hpAmount = s.encounterHpPool === undefined ? n : Math.floor(n);
          t.maxHealth += hpAmount;
          t.health = s.encounterHpPool === undefined ? t.health + n : resolvedHP(s, t.health + n, t.maxHealth);
          t.maxMp += n;
          t.mp += n;
          t.buffs.inspire = { rounds: 3, amount: n, ...(s.encounterHpPool !== undefined ? { hpAmount } : {}) };
        } else
          for (const stat of ["str", "int", "agi", "mnd"] as const) {
            t.stats[stat] += n;
            t.buffs[`stat:${stat}`] = { rounds: 3, amount: n };
          }
      }
      break;
    }
    case "cleansing_chorus":
      groupHeal(healingValue);
      party().forEach((t) => cleansePlayer(s, t));
      break;
    case "finale":
      all().forEach((e) => hit(s, p, e.id, damageValue, true));
      break;
    case "crescendo":
      party()
        .filter((t) => t.isDead)
        .forEach((t) => heal(s, p, t.studentId, 1, true));
      all().forEach((e) => hit(s, p, e.id, damageValue, true));
      groupHeal(healingValue);
      party().forEach((t) => cleansePlayer(s, t));
      buff("doubleDamage", 1);
      break;
    default:
      throw new CombatRuleError(`Ability has no rule: ${id}`);
  }
  if (damage > 0) {
    const dealt = hit(s, p, targetId, damage, id !== "attack");
    // The normal damaging-answer reward adds the second CP below: two total.
    if (id === "headshot" && dealt > 0)
      p.comboPoints = Math.min(p.maxComboPoints, p.comboPoints + 1);
    if (id === "siphon")
      heal(
        s,
        p,
        p.studentId,
        Math.ceil(dealt / 2) +
          (getTotalMechanicUpgrades(
            p.jobLevels as Record<CharacterClass, number>,
          ).siphonHealBonus || 0),
      );
    if (id === "crimson_slash") heal(s, p, p.studentId, dealt / 2);
  }
  event(
    s,
    "ability",
    p.studentId,
    targetId,
    0,
    `${p.nickname} used ${id.replaceAll("_", " ")}`,
  );
}
