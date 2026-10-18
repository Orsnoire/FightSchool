import { type FightRecord } from "../db/schema.ts";
import { type CombatEnemy, type CombatSnapshot } from "../../shared/combat/model.ts";
import { expandEnemies, encounterBudget, allocateHP, performance, ROLE_SHARES } from "../../shared/combat/encounters";
import { inferEnemyType, enemyAISchema, resolveEnemyType } from "../../shared/combat/enemy-ai";
import { encounterDamageEstimate } from "./damage-values";
import { enemyTuning } from "../../shared/encounter-tiers";
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
  if(state.encounterRules===2){
    const budget=encounterBudget(players,fight.encounterTier||1,fight.questions.length);
    const individuals = fight.enemies.some(e => e.swarm) ? initialEnemies(fight, players.length) : state.enemies;
    const enemies=allocateHP(individuals,budget.hp);
    const present=new Set(enemies.map(e=>e.role||'normal'));
    return {...state,enemies,entryPerformance:Object.fromEntries(players.map(p=>[p.studentId,performance(p,Math.max(1,fight.questions.length))])),autoAdvanceWaves:solo,encounterAttendance:players.length,referenceDamage:budget.damage,enemyRoundBudget:budget.rawPressure,encounterXpFraction:[...present].reduce((n,r)=>n+ROLE_SHARES[r],0)};
  }
  const damage = players.reduce((sum, p) => sum + encounterDamageEstimate(p), 0);
  const questions = Math.max(1, fight.questions.length);
  let budget = Math.max(1, Math.ceil(damage * questions * 0.9));
  if(fight.encounterTier)budget=Math.max(1,Math.ceil(budget*fight.enemies.reduce((n,e)=>n+enemyTuning(fight.encounterTier!,e.role||"normal").hpMultiplier,0)/Math.max(1,fight.enemies.length)));
  let soloEnemyDamageCap: number | undefined;
  if (solo && players.length === 1) {
    const p = players[0];
    soloEnemyDamageCap = Math.max(1, Math.floor(p.maxHealth / questions));
    // A perfect basic-attack run must finish before unavoidable counterattacks KO a solo player.
    const rounds = Math.ceil(p.health / soloEnemyDamageCap);
    budget = Math.min(budget, Math.max(1, encounterDamageEstimate(p)) * rounds);
  }
  const weight = state.enemies.reduce((sum, e) => sum + e.difficultyMultiplier, 0) || 1;
  let enemies = state.enemies.map((e) => {
    const health = Math.max(1, Math.ceil(budget * e.difficultyMultiplier / weight));
    return { ...e, health, maxHealth: health };
  });
  if (solo && players.length === 1) {
    // Whole basic attacks are the useful unit: rounding each enemy up in HP
    // can otherwise require extra fatal counterattack rounds in a multi-enemy fight.
    const attack = Math.max(1, encounterDamageEstimate(players[0]));
    const rounds = Math.max(enemies.length, Math.floor(budget / attack));
    const allocated = enemies.map(() => 1);
    for (let remaining = rounds - enemies.length; remaining > 0; remaining--) {
      const next = enemies.reduce((best, e, i) =>
        e.difficultyMultiplier / (allocated[i] + 1) > enemies[best].difficultyMultiplier / (allocated[best] + 1) ? i : best, 0);
      allocated[next]++;
    }
    enemies = enemies.map((e, i) => ({ ...e, health: allocated[i] * attack, maxHealth: allocated[i] * attack }));
  }
  return { ...state, soloEnemyDamageCap, enemies };
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
