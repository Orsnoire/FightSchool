import { ENEMY_CATALOG } from "./enemy-catalog";
import { inferEnemyType, resolveEnemyType, type EnemyAI, type EnemyType } from "./enemy-ai";
import type { CombatEnemy, CombatPlayer, CombatSnapshot } from "./model";
import type { EnemyRole } from "../encounter-tiers";
import {
  calculateCharacterStats,
  calculateLoadoutEquipmentStats,
  getStartingEquipment,
  calculatePlayerBaseDamage,
  TANK_CLASSES,
  HEALER_CLASSES,
  type CharacterClass,
  type EquipmentStats,
} from "../schema";
import { getTotalPassiveBonuses, getTotalMechanicUpgrades } from "../jobSystem";
import { TIER_ONE_EQUIPMENT } from "../tier-one-equipment";
import {
  availableAbilities,
  SUPPORT,
  COSTS,
  COMBOS,
  COOLDOWNS,
  ULTIMATES,
} from "./abilities";
import { abilityDamage, abilityHealing } from "./abilityValues";
import { swarmCounts, type EnemySwarm } from "./swarm";
import { maximumHP } from "./hp";

export const ROLE_SHARES: Record<EnemyRole, number> = {
  boss: 0.5,
  leader: 0.25,
  normal: 0.15,
  trash: 0.1,
};
export const GOBLIN_IMAGE = "/enemies/goblin-v1.png";
export const roundHP = (n: number) => Math.round(n * 1000) / 1000;
export const hpLabel = (n: number) =>
  n === 0 ? "0" : n < 1 ? n.toFixed(2) : Number(n.toFixed(1)).toString();
export function enemyImage(e: { image: string; species?: string; enemyType?: EnemyType }) {
  const inferred = inferEnemyType(e.image);
  const type = resolveEnemyType(e);
  // Replace retired built-in portraits, while preserving teacher-uploaded art.
  return type !== "basic" && (inferred !== "basic" || !e.image) ? ENEMY_CATALOG[type].image : e.image;
}
export function activeEnemies(s: CombatSnapshot): CombatEnemy[] {
  const alive = s.enemies.filter((e) => e.health > 0);
  if (s.enemyDisplayMode === "simultaneous") return alive;
  if (s.encounterRules === 2)
    return alive.filter((e) => (e.wave || 1) === (s.activeWave || 1));
  return alive.slice(0, 1);
}
export function canAdvanceWave(s: CombatSnapshot): boolean {
  return s.encounterRules === 2 && s.enemyDisplayMode === "consecutive" &&
    !["waiting", "game_over"].includes(s.currentPhase) &&
    (s.currentPhase === "wave_break" || s.enemies.some(e => e.health > 0 && (e.wave || 1) > (s.activeWave || 1)));
}
export function bounceTarget(s: CombatSnapshot, id: string): string {
  const alive = activeEnemies(s);
  if (alive.some((e) => e.id === id)) return id;
  const index = s.enemies.findIndex((e) => e.id === id);
  return (
    alive.find((e) => s.enemies.indexOf(e) > index)?.id || alive[0]?.id || ""
  );
}
export function expandEnemies(
  enemies: Array<{
    id: string;
    name: string;
    image: string;
    difficultyMultiplier: number;
    role?: EnemyRole;
    quantity?: number;
    swarm?: EnemySwarm;
    wave?: number;
    species?: "goblin" | "other";
    enemyType?: EnemyType;
    ai?: EnemyAI;
  }>,
  consecutive: boolean,
  players = 0,
): CombatEnemy[] {
  const modern = enemies.some((e) => e.quantity !== undefined || e.swarm || resolveEnemyType(e) === "goblin");
  const counts = swarmCounts(enemies.map(e => ({ ...e,
    quantity: resolveEnemyType(e) === "goblin" ? Math.max(5, e.quantity || 5) : e.quantity || 1,
  })), players);
  return enemies.flatMap((e, i) =>
    Array.from({ length: counts[i] }, (_, j) => ({
      ...e,
      enemyType: resolveEnemyType(e),
      ...(modern
        ? {
            id: `${e.id}:${j + 1}`,
            templateId: e.id,
            role: e.role || "normal",
            wave: consecutive ? e.wave || i + 1 : 1,
            species:
              ((resolveEnemyType(e) === "goblin" ? "goblin" : "other") as
                | "goblin"
                | "other"),
          }
        : {}),
      name: counts[i] > 1 ? `${e.name} ${j + 1}` : e.name,
      image: enemyImage(e),
      health: Math.max(1, maximumHP(10 * e.difficultyMultiplier)),
      maxHealth: Math.max(1, maximumHP(10 * e.difficultyMultiplier)),
      effects: [],
    })),
  );
}
/** One bounded, conservative rotation, not a search or a guarantee of success. */
export function performance(player: CombatPlayer, questions: number, historical = false) {
  const p = structuredClone(player);
  const cost = (id: string) => historical && id === "fireball" ? 1 : COSTS[id] || 0;
  let damage = 0,
    healing = 0;
  for (let turn = 1; turn <= questions; turn++) {
    p.consecutiveCorrectAnswers = turn;
    const usable = p.availableAbilities.filter(
      (id) =>
        !SUPPORT.has(id) &&
        !ULTIMATES.has(id) &&
        cost(id) <= p.mp &&
        (historical || id !== "fireblast" || p.mp >= 1) &&
        (COMBOS[id] || 0) <= p.comboPoints &&
        !(p.cooldowns[id] > 0) &&
        !(id === "healing_potion" && p.healingPotions <= 0),
    );
    const attacks = usable
      .map((id) => ({ id, value: Math.floor(abilityDamage(p, id, turn) || 0) }))
      .sort((a, b) => b.value - a.value);
    const heals = usable
      .map((id) => ({ id, value: abilityHealing(p, id) || 0 }))
      .sort((a, b) => b.value - a.value);
    const healer = ["herbalist", "priest"].includes(p.characterClass);
    const healingTurn =
      healer && !!heals[0]?.value && (!attacks[0]?.value || turn % 2 === 1);
    const choice = healingTurn ? heals[0] : attacks[0];
    if (choice) {
      if (healingTurn) healing += choice.value;
      else damage += choice.value;
      p.mp -= cost(choice.id);
      // Fireblast spends all MP in combat; it must not repeat at full power in
      // the reference rotation. Historical active-room budgets retain their rule.
      if (!historical && choice.id === "fireblast") p.mp = 0;
      p.comboPoints -= COMBOS[choice.id] || 0;
      if (choice.id === "healing_potion") p.healingPotions--;
      if (choice.id === "headshot") p.comboPoints += 2;
      if (!healingTurn && choice.value > 0) p.comboPoints++;
      p.comboPoints = Math.min(p.maxComboPoints, p.comboPoints);
      if (COOLDOWNS[choice.id])
        p.cooldowns[choice.id] = COOLDOWNS[choice.id] + 1;
    }
    for (const id of Object.keys(p.cooldowns))
      p.cooldowns[id] = Math.max(0, p.cooldowns[id] - 1);
  }
  return {
    damage,
    healing,
    health: player.maxHealth,
    mitigation: player.stats.def + Math.floor(player.stats.vit / 2),
  };
}
/** Use the previous tier's full gear: real starters for tier 1, then tier 1 sets
 * extrapolated for unshipped tiers. Character levels remain at the encounter midpoint. */
export function referenceParty(tier: number, historical = false): CombatPlayer[] {
  const level = [2, 6, 9, 13][tier - 1] || 2;
  const gearTier = Math.max(0, tier - 1);
  return (["warrior", "priest", "wizard", "scout"] as CharacterClass[]).map(
    (job) => {
      const family =
        job === "warrior"
          ? "fighter"
          : job === "priest"
            ? "healer"
            : job === "wizard"
              ? "caster"
              : "forester";
      const weapon =
        job === "warrior"
          ? "fighter_sword"
          : job === "priest"
            ? "healer_ankh"
            : job === "wizard"
              ? "caster_staff"
              : "forester_bow";
      const ids = ["headgear", "armor", "arms", "hands", "legs", "feet"].map(
        (slot) => `t1_${family}_${slot}`,
      );
      ids.push(`t1_${weapon}`);
      if (job === "warrior") ids.push("t1_fighter_shield");
      if (job === "scout") ids.push("t1_forester_quiver");
      const gear = gearTier === 0 ? calculateLoadoutEquipmentStats(getStartingEquipment(job)) : {
        str: 0,
        int: 0,
        agi: 0,
        mnd: 0,
        vit: 0,
        atk: 0,
        mat: 0,
        rtk: 0,
        def: 0,
      } as EquipmentStats;
      if (gearTier > 0) for (const id of ids)
        for (const [k, v] of Object.entries(TIER_ONE_EQUIPMENT[id].stats))
          gear[k as keyof EquipmentStats] += (v || 0) * gearTier;
      const levels = { [job]: level } as Record<CharacterClass, number>;
      const stats = calculateCharacterStats(
        job,
        gear,
        getTotalPassiveBonuses(levels),
        getTotalMechanicUpgrades(levels),
      );
      return {
        characterClass: job,
        stats,
        jobLevels: levels,
        availableAbilities: availableAbilities(job, levels, []),
        mp: historical && job === "wizard" ? Math.floor(stats.maxMp / 2) : stats.maxMp,
        maxHealth: stats.maxHp,
        health: stats.maxHp,
        comboPoints: 0,
        maxComboPoints: stats.maxComboPoints,
        healingPotions: 5,
        shieldPotions: 0,
        cooldowns: {},
        equipmentEffects: {
          healingBonus: job === "priest" ? gearTier : 0,
          potionAttackBonus: 0,
        },
      } as CombatPlayer;
    },
  );
}
/** Enemy HP contribution only; combat roles, damage and swarm attendance stay unchanged. */
export function encounterHpWeight(job: CharacterClass): number {
  if (job === "priest") return 0;
  if (job === "blood_knight" || job === "dark_knight") return 1;
  // Paladin belongs to both lists: its healer contribution takes precedence.
  if (HEALER_CLASSES.includes(job)) return 0.25;
  if (TANK_CLASSES.includes(job)) return 0.33;
  return 1;
}

export function encounterEntry(player: CombatPlayer, questions: number) {
  return { ...performance(player, questions), hpWeight: encounterHpWeight(player.characterClass) };
}

type EncounterEntry = NonNullable<CombatSnapshot["entryPerformance"]>[string];

export function effectivePlayerCount(weights: number[]): number {
  return weights.reduce((sum, weight) => sum + Math.round(weight * 100), 0) / 100;
}

/** Average raw output per question of the tier's idealized four-player party. */
export function referenceOutput(tier: number, questions: number): number {
  const q = Math.max(1, questions);
  return referenceParty(tier).reduce((sum, player) => sum + performance(player, q).damage, 0) / q;
}

/** The question coefficient is reference average output / 2. Attendance is
 * additive. Tier is already in the reference party; never multiply it again. */
export function encounterHpPool(playerWeight: number, tier: number, questions: number): number {
  const q = Math.max(1, questions);
  // Sum whole rotation damage directly to avoid a divide/multiply round-trip
  // turning an exact integer just below itself before the final floor.
  const output = referenceParty(tier).reduce((sum, player) => sum + performance(player, q).damage, 0);
  return maximumHP(playerWeight + output / 2);
}

/** Missing weights retain the calculation for rooms started before role scaling. */
export function encounterBudgetFromEntries(
  entries: EncounterEntry[],
  tier: number,
  questions: number,
  roleWeighted = entries.some(p => p.hpWeight !== undefined),
) {
  const q = Math.max(1, questions);
  const reference = entries.length > 2 ? referenceParty(tier, !roleWeighted).map(p => performance(p, q, !roleWeighted)) : [];
  const damage = entries.length <= 2
    ? entries.reduce((n, p) => n + p.damage, 0)
    : reference.reduce((n, p) => n + p.damage, 0) * (entries.length / 4);
  const samples = entries.length <= 2 ? entries : reference;
  const factor = entries.length <= 2 ? 1 : entries.length / 4;
  const rawPressure =
    samples.reduce(
      (n, p) =>
        n +
        (p.healing / q) * 0.8 +
        (p.health / (q * 1.1)) * 0.55 +
        p.mitigation,
      0,
    ) * factor;
  const hp = roleWeighted
    ? encounterHpPool(effectivePlayerCount(entries.map(p => p.hpWeight ?? 1)), tier, q)
    : damage * 1.1;
  return { hp: roleWeighted ? hp : Math.max(0.001, hp), rawPressure, damage };
}

export function encounterBudget(players: CombatPlayer[], tier: number, questions: number) {
  return encounterBudgetFromEntries(players.map(p => encounterEntry(p, Math.max(1, questions))), tier, questions, true);
}
export function allocateHP(enemies: CombatEnemy[], fullBudget: number, historical = false) {
  const counts = Object.fromEntries(
    Object.keys(ROLE_SHARES).map((role) => [
      role,
      enemies.filter((e) => (e.role || "normal") === role).length,
    ]),
  );
  const swarm = enemies.filter(
    (e) => e.species === "goblin" && e.role === "trash",
  ).length;
  return enemies.map((e) => {
    const role = e.role || "normal";
    if (!historical) {
      // One share per role across the WHOLE fight, irrespective of wave or
      // population. The owner-approved 1 HP minimum is the only budget exception.
      const health = Math.max(1, maximumHP(maximumHP(fullBudget * ROLE_SHARES[role]) / counts[role]));
      return { ...e, health, maxHealth: health };
    }
    const bonus =
      e.species === "goblin" && role === "trash"
        ? 1 + Math.floor(swarm / 3) * 0.01
        : 1;
    const health = Math.max(
      0.001,
      roundHP(((fullBudget * ROLE_SHARES[role]) / counts[role]) * bonus),
    );
    return { ...e, health, maxHealth: health };
  });
}
/** Repeatable targeting quotas: T,T,H,D. Healer counts persist, random tie breaks share remainders fairly. */
export function goblinTargets(
  s: CombatSnapshot,
  count: number,
  random: () => number,
): string[] {
  const living = Object.values(s.players).filter((p) => !p.isDead);
  if (!living.length) return [];
  const threat =
    living.find((p) => p.studentId === s.threatLeaderId) || living[0];
  const damage = [...living].sort(
    (a, b) => b.totals.damageDealt - a.totals.damageDealt,
  )[0];
  const healers = living.filter(
    (p) =>
      ["herbalist", "priest"].includes(p.characterClass) ||
      p.availableAbilities.some((a) => ["first_aid", "mend", "healing_potion"].includes(a)),
  );
  s.healerAttackCounts ||= {};
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const slot = (s.goblinAttackCursor || 0) % 4;
    s.goblinAttackCursor = (s.goblinAttackCursor || 0) + 1;
    let target = slot === 3 ? damage : threat;
    if (slot === 2 && healers.length) {
      const min = Math.min(
        ...healers.map((p) => s.healerAttackCounts![p.studentId] || 0),
      );
      const tied = healers.filter(
        (p) => (s.healerAttackCounts![p.studentId] || 0) === min,
      );
      target = tied[Math.floor(random() * tied.length)];
      s.healerAttackCounts[target.studentId] =
        (s.healerAttackCounts[target.studentId] || 0) + 1;
    }
    result.push(target.studentId);
  }
  return result;
}
