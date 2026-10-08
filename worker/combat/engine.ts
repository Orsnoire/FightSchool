import { abilityDamage, abilityHealing } from "../../shared/combat/abilityValues.ts";
import type { AvatarAppearance } from "../../shared/avatar/appearance.ts";
import type {
  FightQuestion,
  FightRecord,
  StudentRecord,
} from "../db/schema.ts";
import { answersMatch } from "../../shared/combat/phaseRules.ts";
import {
  calculatePlayerBaseDamage,
  calculateCharacterStats,
  calculateEquipmentStats,
  getStartingEquipment,
  type CharacterClass,
  type EquipmentStats,
} from "../../shared/schema.ts";
import {
  getTotalPassiveBonuses,
  getTotalMechanicUpgrades,
} from "../../shared/jobSystem.ts";
import {
  availableAbilities,
  abilityProblem,
  selectionProblem,
  SUPPORT,
  ALLIES,
  COSTS,
  COMBOS,
  COOLDOWNS,
  ULTIMATES,
  defaultQuestionAbility,
  hasOffensiveAbility,
} from "../../shared/combat/abilities.ts";
import type {
  CombatSnapshot,
  CombatPlayer,
  CombatEvent,
} from "../../shared/combat/model.ts";
export type {
  CombatSnapshot,
  CombatPlayer,
  CombatEnemy,
  CombatPhase,
} from "../../shared/combat/model.ts";
export interface CombatProfile {
  appearance?: AvatarAppearance | null;
  levels: Partial<Record<CharacterClass, number>>;
  equipment?: EquipmentStats;
  crossClass?: string[];
}
const integer = (n: number) => Math.max(0, Math.floor(n));
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
    enemies: fight.enemies.map((e) => ({
      ...e,
      health: Math.max(1, Math.ceil(10 * e.difficultyMultiplier)),
      maxHealth: Math.max(1, Math.ceil(10 * e.difficultyMultiplier)),
      effects: [],
    })),
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
export function addStudent(
  state: CombatSnapshot,
  student: StudentRecord,
  profile: CombatProfile = { levels: {} },
): CombatSnapshot {
  if (state.players[student.id]) return state;
  if (state.pendingPlayers?.[student.id]) return state;
  if (state.currentPhase === "game_over") throw new Error("Fight has ended");
  const returning = state.departedPlayers?.[student.id];
  if (returning) return admitStudent(state, structuredClone(returning));
  const job = (student.characterClass || "warrior") as CharacterClass;
  const levels = { ...profile.levels, [job]: profile.levels[job] || 1 };
  const starting = getStartingEquipment(job);
  const stats = calculateCharacterStats(
    job,
    profile.equipment ||
      calculateEquipmentStats(
        starting.weapon,
        starting.headgear,
        starting.armor,
      ),
    getTotalPassiveBonuses(levels as Record<CharacterClass, number>),
    getTotalMechanicUpgrades(levels as Record<CharacterClass, number>),
  );
  const p: CombatPlayer = {
    roundsParticipated: 0,
    studentId: student.id,
    nickname: student.nickname,
    characterClass: job,
    gender: student.gender === "B" ? "B" : "A",
    appearance: profile.appearance ? { ...profile.appearance } : null,
    health: stats.maxHp,
    maxHealth: stats.maxHp,
    mp: job === "wizard" ? Math.floor(stats.maxMp / 2) : stats.maxMp,
    maxMp: stats.maxMp,
    comboPoints: 0,
    consecutiveCorrectAnswers: 0,
    maxComboPoints: stats.maxComboPoints,
    threat: 0,
    isDead: false,
    hasAnswered: false,
    currentAnswer: null,
    stats,
    jobLevels: levels,
    availableAbilities: availableAbilities(job, levels, profile.crossClass),
    questionAction: null,
    supportActions: [],
    ready: false,
    cooldowns: {},
    ultimatesUsed: [],
    healingPotions: 5,
    shieldPotions: 0,
    buffs: {},
    totals: {
      questionsAnswered: 0,
      questionsCorrect: 0,
      questionsIncorrect: 0,
      damageDealt: 0,
      damageBlocked: 0,
      healingDone: 0,
      bonusDamage: 0,
      damageTaken: 0,
      deaths: 0,
    },
  };
  return admitStudent(state, p);
}
/** New/returning participants enter only at a question boundary. */
function admitStudent(state: CombatSnapshot, player: CombatPlayer): CombatSnapshot {
  const next = structuredClone(state);
  delete next.departedPlayers?.[player.studentId];
  player.hasAnswered = false;
  player.currentAnswer = null;
  delete player.lastAnswerCorrect;
  player.questionAction = null;
  player.supportActions = [];
  player.ready = false;
  // Block links refer to participation in one turn, not a reusable resource.
  for (const key of Object.keys(player.buffs)) if (key.startsWith("guard:")) delete player.buffs[key];
  if (state.currentPhase === "waiting") next.players[player.studentId] = player;
  else (next.pendingPlayers ||= {})[player.studentId] = player;
  next.revision++;
  leader(next);
  return next;
}

export function completedRounds(state: CombatSnapshot): number {
  return Math.max(state.completedRounds || 0, state.round - 1,
    ...Object.values({ ...state.departedPlayers, ...state.pendingPlayers, ...state.players })
      .map(p => Math.max(p.totals.questionsAnswered, p.totals.questionsCorrect + p.totals.questionsIncorrect)));
}
export function participatedRounds(state: CombatSnapshot, player: CombatPlayer): number {
  return Math.min(completedRounds(state), Math.max(player.roundsParticipated ?? completedRounds(state), player.totals.questionsAnswered, player.totals.questionsCorrect + player.totals.questionsIncorrect));
}

// Attendance and equipment are frozen at start; each quiz has one total HP budget.
export function scaleEncounter(state: CombatSnapshot, fight: FightRecord, solo = false): CombatSnapshot {
  if (state.currentPhase !== "waiting") return state;
  const players = Object.values(state.players);
  const damage = players.reduce((sum, p) => sum + encounterDamageEstimate(p), 0);
  const questions = Math.max(1, fight.questions.length);
  let budget = Math.max(1, Math.ceil(damage * questions * 0.9));
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
    throw new Error("At least one student must join");
  return {
    ...state,
    currentPhase: "question",
    questionStartTime: now + 3000,
    phaseStartTime: now,
    phaseDeadline: now + 3000 + timeLimit * 1000,
  };
}
export function applyAnswer(
  state: CombatSnapshot,
  id: string,
  answer: string,
  q: FightQuestion,
): CombatSnapshot {
  const p = state.players[id];
  if (state.currentPhase !== "question" || !p || p.isDead || p.hasAnswered)
    throw new Error("Answer is unavailable in this round");
  const next = structuredClone(state);
  const player = next.players[id];
  player.hasAnswered = true;
  player.currentAnswer = answer;
  player.lastAnswerCorrect = answersMatch(answer, q.correctAnswer, "trimmed");
  player.questionAction ||= defaultQuestionAction(player, next);
  return next;
}
export function allLivingPlayersAnswered(state: CombatSnapshot): boolean {
  const p = Object.values(state.players).filter((p) => !p.isDead);
  return p.length > 0 && p.every((p) => p.hasAnswered && (state.currentPhase === "question" || p.ready));
}
/** An intentional departure removes participation; a dropped socket never does. */
export function removeStudent(state: CombatSnapshot, id: string): CombatSnapshot {
  if ((!state.players[id] && !state.pendingPlayers?.[id]) || state.currentPhase === "game_over") return state;
  const next = structuredClone(state);
  const player = next.players[id] || next.pendingPlayers![id];
  player.roundsParticipated = participatedRounds(state, player);
  (next.departedPlayers ||= {})[id] = player;
  delete next.pendingPlayers?.[id];
  delete next.players[id];
  for (const player of Object.values(next.players)) {
    if (player.questionAction?.targetId === id) player.questionAction = null;
    player.supportActions = player.supportActions.filter(action => action.targetId !== id);
    delete player.buffs[`guard:${id}`];
  }
  leader(next);
  if (next.currentPhase !== "waiting" && !Object.keys(next.players).length && !Object.keys(next.pendingPlayers || {}).length) {
    next.currentPhase = "game_over";
    next.victory = false;
    next.endReason = "All players left the fight";
    next.phaseDeadline = null;
  }
  return next;
}
export function selectAction(
  state: CombatSnapshot,
  id: string,
  ability: string,
  targetId: string,
): CombatSnapshot {
  const p = state.players[id];
  if (!p || p.isDead || !p.hasAnswered)
    throw new Error("Submit an answer first");
  const support = state.currentPhase === "abilities";
  // Accept early selections from clients opened before the independent action phase shipped.
  if (!support && !["question", "actions"].includes(state.currentPhase))
    throw new Error("Actions are closed");
  if (SUPPORT.has(ability) !== support)
    throw new Error("Ability belongs to another phase");
  const error = selectionProblem(p, ability);
  if (error) throw new Error(error);
  if (ALLIES.has(ability)) {
    if (!state.players[targetId] || state.players[targetId].isDead)
      throw new Error("Choose a living ally");
  } else if (
    !SUPPORT.has(ability) &&
    !["craft_healing_potion", "craft_shield_potion", "pact_surge"].includes(
      ability,
    ) &&
    !state.enemies.some((e) => e.id === targetId && e.health > 0)
  )
    throw new Error("Choose a living enemy");
  if (
    state.enemyDisplayMode === "consecutive" &&
    state.enemies.some((e) => e.id === targetId) &&
    targetId !== state.enemies.find((e) => e.health > 0)?.id
  )
    throw new Error("That enemy is not active yet");
  const next = structuredClone(state);
  const player = next.players[id];
  if (support) {
    if (player.supportActions.some((a) => a.ability === ability))
      throw new Error("Ability already selected");
    if (player.supportActions.length >= 3)
      throw new Error("Maximum three support actions");
    player.supportActions.push({ ability, targetId });
  } else player.questionAction = { ability, targetId };
  player.ready = false;
  return next;
}
export function setReady(state: CombatSnapshot, id: string): CombatSnapshot {
  const p = state.players[id];
  if (
    !p ||
    p.isDead ||
    !p.hasAnswered ||
    !["question", "actions", "abilities"].includes(state.currentPhase)
  )
    throw new Error("Cannot finish actions now");
  return {
    ...state,
    players: { ...state.players, [id]: { ...p, ready: true } },
  };
}
export function resurrectPlayer(state: CombatSnapshot, id: string): CombatSnapshot {
  if (["waiting", "game_over"].includes(state.currentPhase))
    throw new Error("Fight is not active");
  const player = state.players[id];
  if (!player) throw new Error("Player is not in this fight");
  if (!player.isDead) throw new Error("Player is already alive");
  const next = structuredClone(state);
  const revived = next.players[id];
  revived.health = 1;
  revived.isDead = false;
  // Death can leave an unanswered player behind after the question has closed.
  if (next.currentPhase !== "question" && !revived.hasAnswered) {
    revived.hasAnswered = true;
    revived.currentAnswer = "";
    revived.lastAnswerCorrect = false;
    revived.questionAction = defaultQuestionAction(revived, next);
  }
  event(next, "heal", "host", id, 1, `Host resurrected ${revived.nickname} with 1 HP`);
  leader(next);
  return next;
}
function event(
  s: CombatSnapshot,
  type: CombatEvent["type"],
  actorId: string,
  targetId: string,
  amount: number,
  message: string,
) {
  s.events.push({
    id: `${s.round}:${s.events.length}`,
    round: s.round,
    phase: s.currentPhase === "enemy_ai" ? "enemy_ai" : "question_resolution",
    type,
    actorId,
    targetId,
    amount,
    message,
  });
}
function leader(s: CombatSnapshot) {
  const top = Object.values(s.players).filter(p => p.totals.damageDealt > 0)
    .sort((a, b) => b.totals.damageDealt - a.totals.damageDealt ||
      (a.studentId === s.damageLeaderId ? -1 : b.studentId === s.damageLeaderId ? 1 : a.studentId.localeCompare(b.studentId)))[0];
  s.damageLeaderId = top?.studentId || null;
  s.threatLeaderId =
    Object.values(s.players)
      .filter((p) => !p.isDead)
      .sort(
        (a, b) => b.threat - a.threat || a.studentId.localeCompare(b.studentId),
      )[0]?.studentId || null;
}
function rng(s: CombatSnapshot) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function heal(
  s: CombatSnapshot,
  p: CombatPlayer,
  id: string,
  amount: number,
  revive = false,
) {
  const t = s.players[id];
  if (!t || (t.isDead && !revive)) return 0;
  const actual = Math.min(t.maxHealth - t.health, integer(amount));
  t.health += actual;
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
  );
  return actual;
}
function damagePlayer(
  s: CombatSnapshot,
  id: string,
  raw: number,
  source: string,
  ignoreDefense = false,
) {
  const p = s.players[id];
  if (!p || p.isDead) return 0;
  let damage = ignoreDefense
    ? integer(raw)
    : Math.max(
        1,
        integer(raw) -
          p.stats.def -
          (p.buffs.vampiric_guard ? 0 : integer(p.stats.vit / 2)),
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
        s.enemies.find((e) => e.health > 0)?.id || "",
        guard.stats.vit / 2,
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
  const actual = Math.min(p.health, damage);
  p.health -= actual;
  p.totals.damageTaken += actual;
  if (p.characterClass === "monk" && actual)
    p.comboPoints = Math.min(p.maxComboPoints, p.comboPoints + 1);
  if (p.buffs.deflect && actual)
    hit(s, p, s.enemies.find((e) => e.health > 0)?.id || "", actual);
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
  );
  return actual;
}
function hit(
  s: CombatSnapshot,
  p: CombatPlayer,
  id: string,
  raw: number,
  bonus = false,
) {
  const e = s.enemies.find((e) => e.id === id);
  if (!e || e.health <= 0) return 0;
  let amount = integer(raw);
  if (e.effects.some((x) => ["mark", "prey"].includes(x.type))) amount *= 2;
  if (p.buffs.doubleDamage) amount *= 2;
  const actual = Math.min(e.health, amount);
  e.health -= actual;
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
  );
  return actual;
}
export function baseDamage(p: CombatPlayer): number {
  return calculatePlayerBaseDamage(p.stats, p.characterClass);
}

export function encounterDamageEstimate(p: CombatPlayer): number {
  return hasOffensiveAbility(p.availableAbilities) ? Math.max(1, baseDamage(p)) : 0;
}

function defaultQuestionAction(p: CombatPlayer, state: CombatSnapshot) {
  return { ability: defaultQuestionAbility(p.characterClass),
    targetId: p.characterClass === "priest" ? p.studentId : state.enemies.find(e => e.health > 0)?.id || "" };
}

/** Upgrade saved Priest loadouts and obsolete default choices without resetting combat. */
export function upgradePriestActions(state: CombatSnapshot): CombatSnapshot {
  if (state.currentPhase === "game_over") return state;
  const players = [...Object.values(state.players), ...Object.values(state.pendingPlayers || {}), ...Object.values(state.departedPlayers || {})];
  if (!players.some(p => p.characterClass === "priest" && (
    p.availableAbilities.includes("attack") || !p.availableAbilities.includes("first_aid") || p.questionAction?.ability === "attack"
  ))) return state;
  const next = structuredClone(state);
  for (const p of [...Object.values(next.players), ...Object.values(next.pendingPlayers || {}), ...Object.values(next.departedPlayers || {})]) {
    if (p.characterClass !== "priest") continue;
    p.availableAbilities = [...new Set(["first_aid", ...p.availableAbilities.filter(id => id !== "attack")])];
    if (p.questionAction?.ability === "attack") p.questionAction = defaultQuestionAction(p, next);
  }
  next.revision++;
  return next;
}

function applyAbility(
  s: CombatSnapshot,
  p: CombatPlayer,
  id: string,
  targetId: string,
) {
  const st = p.stats;
  const { atk, mat, rtk, str, int, agi, mnd, vit } = st;
  const all = () => s.enemies.filter((e) => e.health > 0);
  const party = () => Object.values(s.players);
  const buff = (name: string, rounds: number, amount = 0) => {
    p.buffs[name] = { rounds, amount };
  };
  const groupHeal = (n: number, revive = false) =>
    party().forEach((t) => heal(s, p, t.studentId, n, revive));
  let damage = 0;
  const damageValue = abilityDamage(p, id) ?? 0;
  const healingValue = abilityHealing(p, id) ?? 0;
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
        const duration =
          2 +
          (getTotalMechanicUpgrades(
            p.jobLevels as Record<CharacterClass, number>,
          ).hexDuration || 0);
        e.effects = e.effects.filter(
          (x) => !(x.type === id && x.ownerId === p.studentId),
        );
        e.effects.push({
          ownerId: p.studentId,
          type: id,
          rounds: duration,
          damage: id === "hex" ? Math.max(0, int - 1) : atk / 2,
        });
        if (id === "hemorrhage") damage = damageValue;
        if (id === "hex" && (p.jobLevels.warlock || 0) >= 15)
          damage = (Math.max(0, int - 1) * duration) / 2;
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
      if (s.players[targetId]) delete s.players[targetId].buffs.poison;
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
          t.maxHealth += n;
          t.health += n;
          t.maxMp += n;
          t.mp += n;
          t.buffs.inspire = { rounds: 3, amount: n };
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
      party().forEach((t) => delete t.buffs.poison);
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
      party().forEach((t) => delete t.buffs.poison);
      buff("doubleDamage", 1);
      break;
    default:
      throw new Error(`Ability has no rule: ${id}`);
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
export function advancePhase(
  state: CombatSnapshot,
  fight: FightRecord,
  now = Date.now(),
): CombatSnapshot {
  const s = structuredClone(state);
  s.revision++;
  s.phaseStartTime = now;
  if (s.currentPhase === "question") {
    for (const p of Object.values(s.players))
      if (!p.isDead) {
        if (!p.hasAnswered) {
          p.hasAnswered = true;
          p.lastAnswerCorrect = false;
          p.currentAnswer = "";
        }
        p.questionAction ||= defaultQuestionAction(p, s);
      }
    s.currentPhase = "actions";
    s.phaseDeadline = now + 20000;
    return s;
  }
  if (s.currentPhase === "actions") {
    for (const p of Object.values(s.players)) p.ready = false;
    s.currentPhase = "abilities";
    s.phaseDeadline = now + 20000;
    return s;
  }
  if (s.currentPhase === "abilities") {
    const completed = completedRounds(s);
    for (const p of Object.values(s.players)) p.roundsParticipated = participatedRounds(s, p) + 1;
    s.completedRounds = completed + 1;
    s.events = [];
    // Support resolves before answer damage so blocks protect wrong answers, as specified.
    const ordered = Object.values(s.players).sort(
      (a, b) =>
        [
          "warrior",
          "wizard",
          "scout",
          "herbalist",
          "warlock",
          "priest",
          "paladin",
          "dark_knight",
          "blood_knight",
          "monk",
          "ranger",
          "bard",
        ].indexOf(a.characterClass) -
          [
            "warrior",
            "wizard",
            "scout",
            "herbalist",
            "warlock",
            "priest",
            "paladin",
            "dark_knight",
            "blood_knight",
            "monk",
            "ranger",
            "bard",
          ].indexOf(b.characterClass) || a.studentId.localeCompare(b.studentId),
    );
    for (const p of ordered.filter((p) => !p.isDead))
      for (const a of p.supportActions)
        applyAbility(s, p, a.ability, a.targetId);
    for (const p of ordered.filter((p) => !p.isDead)) {
      p.totals.questionsAnswered++;
      const before = p.totals.damageDealt;
      if (
        p.questionAction?.ability === "sacred_strike" &&
        !abilityProblem(p, "sacred_strike")
      )
        p.buffs.immunity = { rounds: 1, amount: 0 };
      if (p.lastAnswerCorrect) {
        p.totals.questionsCorrect++;
        p.consecutiveCorrectAnswers = (p.consecutiveCorrectAnswers || 0) + 1;
        const a = p.questionAction;
        // Departure can cancel a saved ally-targeted action before resolution.
        if (a) applyAbility(s, p, a.ability, a.targetId);
        if (a && p.buffs.abyssal_drain) {
          const amount = baseDamage(p);
          s.enemies
            .filter((e) => e.health > 0 && e.id !== a.targetId)
            .forEach((e) => hit(s, p, e.id, amount));
          heal(s, p, p.studentId, p.totals.damageDealt - before);
        }
      } else {
        p.totals.questionsIncorrect++;
        p.consecutiveCorrectAnswers = 0;
        if (p.availableAbilities.includes("headshot"))
          p.comboPoints = Math.max(0, p.comboPoints - 1);
        const provoke = ordered.find((x) => !x.isDead && x.buffs.provoke);
        damagePlayer(
          s,
          provoke?.studentId || p.studentId,
          fight.baseEnemyDamage,
          "wrong_answer",
        );
      }
      const dealt = p.totals.damageDealt - before;
      if (dealt > 0) {
        p.comboPoints = Math.min(p.maxComboPoints, p.comboPoints + 1);
        if (p.buffs.blood_sword) heal(s, p, p.studentId, dealt);
        if (
          p.characterClass === "blood_knight" &&
          (p.jobLevels.blood_knight || 0) >= 4
        )
          heal(s, p, p.studentId, dealt / 4);
      }
    }
    for (const e of s.enemies)
      for (const effect of e.effects)
        if (effect.damage > 0 && s.players[effect.ownerId])
          hit(s, s.players[effect.ownerId], e.id, effect.damage, true);
    // Transfer once per blocker/target after this round's damage has generated threat.
    // Self-blocks never manufacture threat; Block + Shield Bash cannot transfer twice.
    for (const p of ordered.filter((p) => !p.isDead)) {
      const guarded = new Set(p.supportActions.filter((a) =>
        ["warrior_block", "shield_bash"].includes(a.ability)).map((a) => a.targetId));
      for (const id of guarded) {
        const target = s.players[id];
        if (!target || target === p || !p.buffs[`guard:${id}`]) continue;
        const transferred = Math.floor(target.threat / 2);
        target.threat -= transferred;
        p.threat += transferred;
        event(s, "ability", p.studentId, id, transferred,
          `${p.nickname} took ${transferred} threat from ${target.nickname} with Block`);
      }
    }
    leader(s);
    s.currentPhase = "question_resolution";
    s.phaseDeadline =
      now + Math.max(2000, Math.min(14000, s.events.length * 2000));
    return s;
  }
  if (s.currentPhase === "question_resolution") {
    s.currentPhase = "enemy_ai";
    leader(s);
    let soloDamageRemaining = s.soloEnemyDamageCap ?? Infinity;
    for (const enemy of s.enemies
      .filter((e) => e.health > 0)
      .slice(0, fight.enemyDisplayMode === "simultaneous" ? undefined : 1)) {
      const reduction = Object.values(s.players).reduce(
        (n, p) => n + (p.buffs.dread_aura?.amount || 0),
        0,
      );
      if (s.threatLeaderId && soloDamageRemaining > 0) {
        const target = s.players[s.threatLeaderId];
        // Difficulty 10 is the baseline; square-root scaling keeps +1 survivable.
        const raw = Math.max(0, Math.ceil(fight.baseEnemyDamage * Math.sqrt(enemy.difficultyMultiplier / 10)) - reduction);
        // Cap total counterattack damage for solo encounters, including simultaneous enemies.
        const capped = Math.min(raw, soloDamageRemaining + target.stats.def + integer(target.stats.vit / 2));
        const taken = damagePlayer(
          s,
          s.threatLeaderId,
          capped,
          enemy.id,
        );
        soloDamageRemaining -= taken;
      }
      leader(s);
    }
    s.phaseDeadline = now + 3000;
    return s;
  }
  if (s.currentPhase === "enemy_ai") {
    const victory = s.enemies.every((e) => e.health <= 0);
    const defeat = Object.values({ ...s.pendingPlayers, ...s.players }).every((p) => p.isDead);
    if (victory || defeat) {
      s.currentPhase = "game_over";
      s.victory = victory;
      s.endReason = victory ? "All enemies defeated" : "Party defeated";
      s.phaseDeadline = null;
      return s;
    }
    for (const p of Object.values(s.players)) {
      p.hasAnswered = false;
      p.currentAnswer = null;
      delete p.lastAnswerCorrect;
      p.questionAction = null;
      p.supportActions = [];
      p.ready = false;
      for (const k of Object.keys(p.cooldowns))
        p.cooldowns[k] = Math.max(0, p.cooldowns[k] - 1);
      for (const [k, b] of Object.entries(p.buffs))
        if (--b.rounds <= 0) {
          if (k.startsWith("stat:")) p.stats[k.slice(5) as "str"] -= b.amount;
          if (k === "inspire") {
            p.maxHealth -= b.amount;
            p.health = Math.min(p.health, p.maxHealth);
            p.maxMp -= b.amount;
            p.mp = Math.min(p.mp, p.maxMp);
          }
          delete p.buffs[k];
        }
    }
    s.enemies.forEach(
      (e) =>
        (e.effects = e.effects
          .map((x) => ({ ...x, rounds: x.rounds - 1 }))
          .filter((x) => x.rounds > 0)),
    );
    for (const [id, player] of Object.entries(s.pendingPlayers || {})) s.players[id] = player;
    s.pendingPlayers = {};
    leader(s);
    s.round++;
    s.currentQuestionIndex =
      (s.currentQuestionIndex + 1) % fight.questions.length;
    s.currentPhase = "question";
    s.questionStartTime = now + 3000;
    s.phaseDeadline =
      now + 3000 + fight.questions[s.currentQuestionIndex].timeLimit * 1000;
    return s;
  }
  return s;
}
export function advanceAfterQuestion(
  state: CombatSnapshot,
  questions: FightQuestion[],
  now = Date.now(),
) {
  return advancePhase(
    state,
    {
      questions,
      baseEnemyDamage: 1,
      enemyDisplayMode: "consecutive",
    } as FightRecord,
    now,
  );
}

export function deterministicShuffle<T>(values: T[], salt: string): T[] {
  const result = [...values];
  let seed = 2166136261;
  for (const c of salt)
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
