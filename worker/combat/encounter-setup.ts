import { type FightRecord } from "../db/schema.ts";
import { type CombatEnemy, type CombatSnapshot } from "../../shared/combat/model.ts";
import {
  expandEnemies, encounterBudgetFromEntries, allocateHP, encounterEntry,
  encounterHpWeight, effectivePlayerCount, encounterHpPool, ROLE_SHARES,
} from "../../shared/combat/encounters";
import { inferEnemyType, enemyAISchema, resolveEnemyType } from "../../shared/combat/enemy-ai";
import { CombatRuleError } from "../../shared/combat/errors";
import { tierMagicDefense } from "../../shared/combat/damage-types";
import { currentHP, maximumHP } from "../../shared/combat/hp";
import { encounterTierForLevels } from "../../shared/encounter-tiers";

function initialEnemies(fight: FightRecord, players = 0): CombatEnemy[] {
  return expandEnemies(fight.enemies, fight.enemyDisplayMode === 'consecutive', players, fight.encounterTier || 1).map((e) => ({
      ...e,
      enemyType: e.enemyType || (e.species === "goblin" ? "goblin" : inferEnemyType(e.image)),
      ai: enemyAISchema.parse(e.ai || {}),
      aiState: { readyRounds: {}, buffs: [] },
      attackPower: (e.enemyType || inferEnemyType(e.image)) === "samhain" ? fight.encounterTier || 1 : 1,
      defense: (e.enemyType || inferEnemyType(e.image)) === "samhain" ? fight.encounterTier || 1 : 0,
      magicDefense: tierMagicDefense(fight.encounterTier),
      health: Math.max(1, maximumHP(10 * e.difficultyMultiplier)),
      maxHealth: Math.max(1, maximumHP(10 * e.difficultyMultiplier)),
      effects: [],
    }));
}

export function initialCombatState(
  sessionId: string,
  fight: FightRecord,
  now = Date.now(),
): CombatSnapshot {
  let seed = 2166136261;
  for (const c of sessionId)
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  return {
    battleEnvironment: fight.campaignContext?.environment ?? "grassland",
    enemyDisplayMode: fight.enemyDisplayMode as "simultaneous" | "consecutive",
    schemaVersion: 2,
    revision: 0,
    sessionId,
    fightId: fight.id,
    currentQuestionIndex: 0,
    round: 1,
    currentPhase: "waiting",
    players: {},
    pendingPlayers: {},
    departedPlayers: {},
    completedRounds: 0,
    damageLeaderId: null,
    ...(fight.enemies.some(e=>e.quantity!==undefined || e.swarm || resolveEnemyType(e) === "goblin")?{encounterRules:2 as const,activeWave:Math.min(...fight.enemies.map((e,i)=>fight.enemyDisplayMode==='consecutive'?(e.wave||i+1):1))}:{}),
    enemies: initialEnemies(fight),
    questionStartTime: null,
    phaseStartTime: now,
    phaseDeadline: null,
    threatLeaderId: null,
    events: [],
    victory: null,
    endReason: null,
    seed,
  };
}

// Attendance and equipment are frozen at start; each quiz has one total HP budget.
export function scaleEncounter(state: CombatSnapshot, fight: FightRecord, solo = false): CombatSnapshot {
  if (state.currentPhase !== "waiting") return state;
  const normalizedPlayers = Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, {
    ...p, maxHealth: maximumHP(p.maxHealth), health: currentHP(p.health, p.maxHealth),
  }]));
  const players = Object.values(normalizedPlayers);
  const questions = Math.max(1, fight.questions.length);
  const encounterTier = fight.campaignContext?.fixedTier ?? encounterTierForLevels(players.map(p => p.jobLevels[p.characterClass] || 1), fight.encounterTier || 1);
  const tieredFight = { ...fight, encounterTier };
  if (state.encounterRules === 2) {
    const entryPerformance = Object.fromEntries(players.map(p => [p.studentId, encounterEntry(p, questions)]));
    const budget = encounterBudgetFromEntries(Object.values(entryPerformance), encounterTier, questions, true);
    const individuals = fight.enemies.some(e => e.swarm) ? initialEnemies(tieredFight, players.length) : state.enemies;
    const enemies = allocateHP(individuals, budget.hp).map(e => ({
      ...e, magicDefense: tierMagicDefense(encounterTier),
      ...(e.enemyType === "samhain" ? { attackPower: encounterTier, defense: encounterTier } : {}),
    }));
    const present = new Set(enemies.map(e => e.role || "normal"));
    return {
      ...state, players: normalizedPlayers, enemies, entryPerformance, autoAdvanceWaves: solo, encounterTier,
      encounterAttendance: players.length, referenceDamage: budget.damage,
      enemyRoundBudget: budget.rawPressure,
      encounterXpFraction: [...present].reduce((n, r) => n + ROLE_SHARES[r], 0),
      encounterHpPool: budget.hp,
    };
  }
  const playerWeight = effectivePlayerCount(players.map(p => encounterHpWeight(p.characterClass)));
  const budget = encounterHpPool(playerWeight, encounterTier, questions);
  let soloEnemyDamageCap: number | undefined;
  if (solo && players.length === 1) {
    const p = players[0];
    soloEnemyDamageCap = Math.max(1, Math.floor(p.maxHealth / questions));
  }
  const weight = state.enemies.reduce((sum, e) => sum + e.difficultyMultiplier, 0) || 1;
  const enemies = state.enemies.map((e) => {
    const health = Math.max(1, maximumHP(budget * e.difficultyMultiplier / weight));
    return { ...e, health, maxHealth: health, magicDefense: tierMagicDefense(encounterTier),
      ...(e.enemyType === "samhain" ? { attackPower: encounterTier, defense: encounterTier } : {}) };
  });
  return { ...state, players: normalizedPlayers, soloEnemyDamageCap, enemies, encounterHpPool: budget, encounterTier };
}

export function startQuestion(
  state: CombatSnapshot,
  now = Date.now(),
  timeLimit = 30,
): CombatSnapshot {
  if (state.currentPhase !== "waiting") return state;
  if (!Object.keys(state.players).length)
    throw new CombatRuleError("At least one student must join");
  return {
    ...state,
    currentPhase: "question",
    questionStartTime: now + 3000,
    phaseStartTime: now,
    phaseDeadline: now + 3000 + timeLimit * 1000,
  };
}
