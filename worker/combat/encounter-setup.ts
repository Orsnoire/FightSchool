import { type FightRecord } from "../db/schema.ts";
import { type CombatEnemy, type CombatSnapshot } from "../../shared/combat/model.ts";
import {
  expandEnemies, encounterBudgetFromEntries, allocateHP, encounterEntry,
  encounterHpWeight, effectivePlayerCount, encounterHpPool, roundHP, ROLE_SHARES,
} from "../../shared/combat/encounters";
import { inferEnemyType, enemyAISchema, resolveEnemyType } from "../../shared/combat/enemy-ai";
import { CombatRuleError } from "../../shared/combat/errors";

function initialEnemies(fight: FightRecord, players = 0): CombatEnemy[] {
  return expandEnemies(fight.enemies, fight.enemyDisplayMode === 'consecutive', players).map((e) => ({
      ...e,
      enemyType: e.enemyType || (e.species === "goblin" ? "goblin" : inferEnemyType(e.image)),
      ai: enemyAISchema.parse(e.ai || {}),
      aiState: { readyRounds: {}, buffs: [] },
      attackPower: (e.enemyType || inferEnemyType(e.image)) === "samhain" ? fight.encounterTier || 1 : 1,
      defense: (e.enemyType || inferEnemyType(e.image)) === "samhain" ? fight.encounterTier || 1 : 0,
      health: Math.max(1, Math.ceil(10 * e.difficultyMultiplier)),
      maxHealth: Math.max(1, Math.ceil(10 * e.difficultyMultiplier)),
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
  const players = Object.values(state.players);
  const questions = Math.max(1, fight.questions.length);
  if (state.encounterRules === 2) {
    const entryPerformance = Object.fromEntries(players.map(p => [p.studentId, encounterEntry(p, questions)]));
    const budget = encounterBudgetFromEntries(Object.values(entryPerformance), fight.encounterTier || 1, questions, true);
    const individuals = fight.enemies.some(e => e.swarm) ? initialEnemies(fight, players.length) : state.enemies;
    const enemies = allocateHP(individuals, budget.hp);
    const present = new Set(enemies.map(e => e.role || "normal"));
    return {
      ...state, enemies, entryPerformance, autoAdvanceWaves: solo,
      encounterAttendance: players.length, referenceDamage: budget.damage,
      enemyRoundBudget: budget.rawPressure,
      encounterXpFraction: [...present].reduce((n, r) => n + ROLE_SHARES[r], 0),
      encounterHpPool: budget.hp,
    };
  }
  const playerWeight = effectivePlayerCount(players.map(p => encounterHpWeight(p.characterClass)));
  const budget = encounterHpPool(playerWeight, fight.encounterTier || 1, questions);
  let soloEnemyDamageCap: number | undefined;
  if (solo && players.length === 1) {
    const p = players[0];
    soloEnemyDamageCap = Math.max(1, Math.floor(p.maxHealth / questions));
  }
  const weight = state.enemies.reduce((sum, e) => sum + e.difficultyMultiplier, 0) || 1;
  const enemies = state.enemies.map((e) => {
    const health = Math.max(0.001, roundHP(budget * e.difficultyMultiplier / weight));
    return { ...e, health, maxHealth: health };
  });
  return { ...state, soloEnemyDamageCap, enemies, encounterHpPool: budget };
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
