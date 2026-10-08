import { activeEnemies, goblinTargets, ROLE_SHARES } from "../../shared/combat/encounters";
import type { FightRecord } from "../db/schema";
import type { CombatEnemy, CombatPlayer, CombatSnapshot, CombatStatus, StatusType } from "../../shared/combat/model";
import { chooseEnemyRule, enemyTargets, ENEMY_MOVES, livingPlayers, BIOME_ATTACKS } from "../../shared/combat/enemy-ai";
import { addStatus, effectiveDefense, isHypnosis, releaseInvalidStatuses, STATUS_LABELS } from "../../shared/combat/status-effects";

export interface EnemyTurnPorts {
  random: () => number;
  damage: (id: string, raw: number, source: string, ignoreDefense: boolean, limit: number, fractional?: boolean) => number;
  say: (actor: string, target: string, message: string, amount?: number) => void;
  possess: (enemy: CombatEnemy, copied: CombatPlayer, target: CombatPlayer, damage: (id: string, raw: number) => number) => boolean;
}

/** All moves share mitigation, saved randomness and one aggregate solo damage budget. */
export function resolveEnemyTurn(s: CombatSnapshot, fight: FightRecord, ports: EnemyTurnPorts): void {
  releaseInvalidStatuses(s);
  if (!s.enemies.some(e => e.health > 0)) return;
  let remaining = s.soloEnemyDamageCap ?? Infinity;
  const taken: Record<string, number> = {};
  const modern = s.encounterRules === 2;
  const damage = (id: string, raw: number, source: string, ignoreDefense = false, swarmBonus = 0) => {
    const p = s.players[id];
    if (!p || p.isDead || remaining <= 0 || (raw <= 0 && !swarmBonus)) return 0;
    let amount = raw;
    if (modern && !ignoreDefense) amount = Math.max(0, raw - effectiveDefense(p) - (p.buffs.vampiric_guard ? 0 : Math.floor(p.stats.vit / 2))) + swarmBonus;
    const limit = Math.min(remaining, modern ? Math.max(0, p.maxHealth * 0.35 - (taken[id] || 0)) : Infinity);
    if (amount <= 0 || limit <= 0) return 0;
    const dealt = ports.damage(id, amount, source, modern || ignoreDefense, limit, modern);
    taken[id] = (taken[id] || 0) + dealt;
    remaining -= dealt;
    return dealt;
  };
  // DOT starts on the following round. Fractional ticks accumulate without being rounded up each turn.
  for (const p of livingPlayers(s)) for (const status of p.statuses || []) {
    if (status.appliedRound >= s.round || !["poison", "bleed", "suffocate"].includes(status.type)) continue;
    const total = (status.amount || 0) + (status.carry || 0);
    const tick = Math.floor(total + 1e-9);
    status.carry = total - tick;
    damage(p.studentId, tick, status.sourceId, status.type !== "suffocate");
  }
  const enemies = activeEnemies(s);
  const goblins = enemies.filter(e => e.enemyType === "goblin" || e.species === "goblin");
  const assigned = goblinTargets(s, goblins.length, ports.random);
  const goblinAssignments = new Map(goblins.map((e, i) => [e.id, assigned[i]]));
  const swarmHits: Record<string, number> = {};
  for (const enemy of enemies) {
    if (enemy.health <= 0 || !livingPlayers(s).length) continue;
    const ai = enemy.aiState ||= { readyRounds: {}, buffs: [] };
    ai.buffs = ai.buffs.filter(b => b.throughRound >= s.round);
    if (livingPlayers(s).some(p => p.statuses?.some(x => isHypnosis(x) && x.sourceId === enemy.id))) {
      ports.say(enemy.id, enemy.id, `${enemy.name} maintains hypnosis and cannot act`);
      continue;
    }
    const rule = chooseEnemyRule(s, enemy, ports.random);
    const move = ENEMY_MOVES[rule.move];
    let targets = enemyTargets(s, rule.target);
    if (rule.condition === "target_hp_below") targets = targets.filter(p => 100 * p.health / p.maxHealth < rule.value);
    if (rule.condition === "target_unafflicted") targets = targets.filter(p => !p.statuses?.some(x => x.type === move.effect));
    if (rule.target === "random" && targets.length) targets = [targets[Math.floor(ports.random() * targets.length)]];
    const target = targets[0];
    const reduction = livingPlayers(s).reduce((sum, p) => sum + (p.buffs.dread_aura?.amount || 0), 0);
    const role = enemy.role || "normal";
    const roleCount = s.enemies.filter(e => (e.role || "normal") === role).length;
    const raw = Math.max(0, (modern ? (s.enemyRoundBudget || 0) * ROLE_SHARES[role] / Math.max(1, roleCount)
      : Math.ceil(fight.baseEnemyDamage * Math.sqrt(enemy.difficultyMultiplier / 10))) - reduction);
    if (goblinAssignments.has(enemy.id)) {
      const assignedPlayer = s.players[goblinAssignments.get(enemy.id)!];
      const victim = assignedPlayer && !assignedPlayer.isDead ? assignedPlayer : enemyTargets(s, "threat")[0];
      if (victim) {
        swarmHits[victim.studentId] = (swarmHits[victim.studentId] || 0) + 1;
        damage(victim.studentId, raw, enemy.id, false, swarmHits[victim.studentId] % 3 === 0 ? 1 : 0);
      }
      continue;
    }
    const attack = (enemy.attackPower || 1) * (ai.buffs.some(b => b.type === "attack") ? 2 : 1);
    const strike = (p = target, amount = raw, ignoreDefense = false) => p && enemy.health > 0 ? damage(p.studentId, amount, enemy.id, ignoreDefense) : 0;
    const status = (type: StatusType, chance: number, rounds?: number, amount?: number, p = target) => {
      if (!p || enemy.health <= 0 || ports.random() >= chance) return false;
      const effect: CombatStatus = { type, sourceId: enemy.id, appliedRound: s.round,
        ...(rounds === undefined ? {} : { throughRound: s.round + rounds }),
        ...(amount === undefined ? {} : { amount }),
        ...(type === "paralysis" ? { chance: enemy.ai?.paralysisSkipChance ?? 0.3 } : {}),
        ...(type === "hypnosis" || type === "stare" ? { correctAnswers: 0 } : {}),
      };
      if (!addStatus(s, p, effect)) return false;
      ports.say(enemy.id, p.studentId, `${p.nickname}: ${STATUS_LABELS[type]}`);
      return true;
    };
    const healEnemy = (amount: number) => {
      if (enemy.health <= 0) return;
      const actual = Math.min(enemy.maxHealth - enemy.health, Math.max(0, Math.floor(amount)));
      enemy.health += actual;
      ports.say(enemy.id, enemy.id, `${enemy.name} restored ${actual} HP`, actual);
    };
    ai.lastMove = rule.move;
    // Cooldown N means N full future rounds without this move.
    ai.readyRounds[rule.move] = s.round + Math.max(move.cooldown, rule.cooldown) + 1;
    if (rule.move !== "flatten") ports.say(enemy.id, target?.studentId || enemy.id, `${enemy.name} used ${move.name}`);
    switch (rule.move) {
      case "attack": case "leg_strike": strike(); break;
      case "paralyze_claws": if (strike() > 0) status("paralysis", 0.3); break;
      case "freezing_touch": if (strike() > 0) status("stun", 1, 1); break;
      case "bite": {
        if (strike() > 0 && target && ports.random() < 0.05) strike(target, target.health, true);
        break;
      }
      case "double_attack": strike(); strike(); break;
      case "fade_out": ai.buffs.push({ type: "fade", throughRound: s.round + 1 }); break;
      case "possess": {
        const candidates = [...livingPlayers(s)].sort((a, b) => b.totals.damageDealt - a.totals.damageDealt || a.studentId.localeCompare(b.studentId));
        const copied = candidates.find(p => p.availableAbilities.some(a => !["first_aid", "mend", "healing_potion", "craft_healing_potion"].includes(a)));
        if (!copied || !target || !ports.possess(enemy, copied, target, (id, n) => damage(id, n, enemy.id))) strike();
        break;
      }
      case "telekinesis": {
        const biome = BIOME_ATTACKS[enemy.ai?.biome || "grasslands"];
        ports.say(enemy.id, target?.studentId || "", `${enemy.name} throws a ${biome.object}`);
        if (strike(target, raw * biome.damageMultiplier) > 0) status("stun", biome.stunChance, 1);
        break;
      }
      case "hypnosis": for (const p of targets) status("hypnosis", 1, undefined, undefined, p); break;
      case "webbing": for (const p of targets) status("web", 0.75, undefined, undefined, p); break;
      case "fangs": if (strike() > 0) status("poison", 0.6, undefined, raw * 2 / 3); break;
      case "mandible_strike": if (strike() > 0) status("bleed", 0.3, 3, raw / 4); break;
      case "hypnotic_stare": status("stare", 1); break;
      case "vampiric_bite": {
        const actual = strike();
        if (target) healEnemy(actual / target.maxHealth * enemy.maxHealth);
        break;
      }
      case "wolf_charge": if (strike() > 0) status("stun", 0.3, 1); break;
      case "bat_strafe": status("fear", 0.8, 1); break;
      case "corrode": if (strike() > 0) status("corrosion", 0.3, 5); break;
      case "suffocate": if (strike() > 0) status("suffocate", 0.3, 1, raw); break;
      case "trip": status("trip", 0.8); break;
      case "flatten": ai.buffs.push({ type: "flatten", throughRound: s.round + 1 }); break;
      case "slash": strike(target, raw * attack); break;
      case "hunker_down":
        ai.buffs.filter(b => b.type === "defense").forEach(b => { b.throughRound = s.round + 2; });
        ai.buffs.push({ type: "defense", throughRound: s.round + 2 });
        break;
      case "cobble_hollow": ai.buffs.push({ type: "attack", throughRound: s.round + 3 }); break;
      case "blood_strike": {
        enemy.health -= Math.ceil(enemy.maxHealth * 0.1);
        healEnemy(strike(target, raw * attack) * 0.05);
        break;
      }
    }
    releaseInvalidStatuses(s);
  }
}
