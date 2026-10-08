import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, advancePhase, applyAnswer, initialCombatState, startQuestion, selectAction } from "../../worker/combat/engine";
import { resolveEnemyTurn } from "../../worker/combat/enemy-turn";
import { addStatus, effectiveDefense, prepareStatusActions } from "../../shared/combat/status-effects";
import { chooseEnemyRule, DEFAULT_ENEMY_RULES, ENEMY_MOVES, enemyAISchema, enemyTargets, inferEnemyType, ruleFor, validEnemyAI, type EnemyMove, type EnemyType } from "../../shared/combat/enemy-ai";
import { publicSnapshot } from "../../worker/combat/session-object";
import { enemySchema } from "../../shared/schema";
import type { CombatSnapshot, CombatStatus } from "../../shared/combat/model";
import { fight, student } from "./fixtures";

const id = student().id;
function state(move: EnemyMove = "attack", job: "warrior" | "wizard" | "priest" = "warrior", count = 1) {
  const enemyType = ENEMY_MOVES[move].type;
  const f = { ...fight, baseEnemyDamage: 12, enemies: [{ ...fight.enemies[0], difficultyMultiplier: 10, enemyType,
    ai: enemyAISchema.parse({ mode: "custom", rules: [ruleFor(move)] }) }] };
  let s = initialCombatState("AI01", f, 0);
  for (let i = 0; i < count; i++) s = addStudent(s, student(i === 0 ? job : "priest", i === 0 ? id : `p${i}`), { levels: { [i === 0 ? job : "priest"]: 10 } });
  s = startQuestion(s, 0);
  for (const p of Object.values(s.players)) { p.maxHealth = p.health = 100; p.stats.agi = 0; }
  s.enemies[0].maxHealth = s.enemies[0].health = 1000;
  return { s, f };
}
function turn(s: CombatSnapshot, f = fight, answers: Record<string, string> = { [id]: "4" }) {
  for (const [pid, answer] of Object.entries(answers)) if (!s.players[pid].isDead) s = applyAnswer(s, pid, answer, f.questions[0]);
  return advancePhase(advancePhase(advancePhase(s, f, 10), f, 20), f, 30);
}
function next(s: CombatSnapshot, f = fight) { return advancePhase(advancePhase(s, f, 40), f, 50); }
function effect(type: CombatStatus["type"], extra: Partial<CombatStatus> = {}): CombatStatus {
  return { type, sourceId: "e1", appliedRound: 0, ...extra };
}
function execute(s: CombatSnapshot, f = fight, random = () => 0) {
  const hits: Array<{ id: string; raw: number; dealt: number }> = [];
  const messages: string[] = [];
  resolveEnemyTurn(s, f, { random, say: (_a, _t, message) => messages.push(message), possess: () => false,
    damage: (pid, raw, _source, ignore, limit) => {
      const p = s.players[pid];
      if (p.isDead) return 0;
      const dealt = Math.min(p.health, limit, ignore ? Math.floor(raw) : Math.max(1, Math.ceil(raw - effectiveDefense(p) - Math.floor(p.stats.vit / 2))));
      p.health -= dealt; p.isDead = p.health <= 0; hits.push({ id: pid, raw, dealt }); return dealt;
    } });
  return { hits, messages };
}

test("all six species have legal defaults; asset inference never confuses Vampire Bat or cosmetic names", () => {
  for (const [enemyType, rules] of Object.entries(DEFAULT_ENEMY_RULES)) {
    assert.ok(rules.length);
    assert.ok(validEnemyAI({ enemyType: enemyType as EnemyType, image: "", ai: enemyAISchema.parse({ mode: "custom", rules }) }));
  }
  assert.equal(inferEnemyType("Vampire_bat_RPG_enemy.png"), "basic");
  assert.equal(inferEnemyType("Vampire_RPG_enemy.png"), "vampire");
  assert.equal(inferEnemyType("Ghost_wizard_RPG_enemy.png"), "basic");
  assert.equal(state().s.enemies[0].enemyType, "basic");
});
test("schemas reject scripts, cross-species moves, duplicate rules, illegal targets and out-of-range input", () => {
  const base = { ...fight.enemies[0], enemyType: "zombie" };
  for (const ai of [
    { mode: "custom", script: "alert(1)" },
    { mode: "custom", rules: [ruleFor("hypnosis")] },
    { mode: "custom", rules: [ruleFor("bite"), ruleFor("bite")] },
    { mode: "custom", rules: [ruleFor("bite", { target: "self" })] },
    { mode: "custom", rules: [ruleFor("bite", { priority: 101 })] },
    { paralysisSkipChance: 2 },
  ]) assert.equal(enemySchema.safeParse({ ...base, ai }).success, false);
});
test("conditions, priorities, weights and cooldowns select only eligible moves, with an Attack fallback", () => {
  const { s } = state("vampiric_bite"); const e = s.enemies[0];
  e.ai!.rules = [ruleFor("vampiric_bite", { priority: 30, condition: "self_hp_below", value: 50 }), ruleFor("wolf_charge"), ruleFor("bat_strafe", { weight: 30 })];
  assert.equal(chooseEnemyRule(s, e, () => 0).move, "wolf_charge");
  assert.equal(chooseEnemyRule(s, e, () => 0.9).move, "bat_strafe");
  e.health = 400;
  assert.equal(chooseEnemyRule(s, e, () => 0.9).move, "vampiric_bite");
  e.aiState!.readyRounds.vampiric_bite = 7;
  assert.equal(chooseEnemyRule(s, e, () => 0).move, "wolf_charge");
  e.ai!.rules.forEach(r => { r.enabled = false; });
  assert.equal(chooseEnemyRule(s, e, () => 0).move, "attack");
});
test("web priority targets are distinct, alive, and include the highest-threat healer", () => {
  const { s } = state("webbing", "warrior", 3);
  s.players[id].threat = 100; s.players[id].totals.damageDealt = 100;
  s.players.p1.threat = 40; s.players.p2.threat = 20;
  assert.deepEqual(enemyTargets(s, "priority_roles").map(p => p.studentId), [id, "p1"]);
  s.players.p1.isDead = true;
  assert.deepEqual(enemyTargets(s, "priority_roles").map(p => p.studentId), [id, "p2"]);
});
test("two nonconsecutive correct answers clear stacked stun AND paralysis and execute the second answer's action", () => {
  let { s, f } = state("attack", "wizard"); f.baseEnemyDamage = 1;
  const p = s.players[id];
  p.statuses = [effect("stun", { throughRound: 8 }), effect("paralysis", { chance: 1 })];
  s = selectAction(applyAnswer(s, id, "4", f.questions[0]), id, "fireball", "e1");
  const mp = s.players[id].mp;
  s = advancePhase(advancePhase(advancePhase(s, f), f), f);
  assert.equal(s.players[id].recoveryCorrectAnswers, 1);
  assert.equal(s.players[id].mp, mp);
  assert.equal(s.players[id].totals.questionsCorrect, 1);
  s = next(s, f);
  addStatus(s, s.players[id], effect("stun", { appliedRound: s.round, throughRound: s.round + 1 }));
  assert.equal(s.players[id].recoveryCorrectAnswers, 1);
  s = next(turn(s, f, { [id]: "wrong" }), f);
  assert.equal(s.players[id].recoveryCorrectAnswers, 1);
  s = selectAction(applyAnswer(s, id, "4", f.questions[0]), id, "fireball", "e1");
  s = advancePhase(advancePhase(advancePhase(s, f), f), f);
  assert.equal(s.players[id].statuses!.length, 0);
  assert.equal(s.players[id].mp, mp - 1);
  assert.equal(s.players[id].totals.questionsCorrect, 2);
  assert.equal(s.players[id].totals.questionsIncorrect, 1);
  assert.equal(addStatus(s, s.players[id], effect("stun", { appliedRound: s.round })), false);
});
test("paralysis rolls once per turn without spending blocked resources; stun always blocks", () => {
  const { s } = state(); const p = s.players[id]; p.lastAnswerCorrect = false;
  p.statuses = [effect("paralysis", { chance: 0.3 })];
  prepareStatusActions(s, () => 0.2); assert.equal(p.actionBlocked?.reason, "paralysis");
  prepareStatusActions(s, () => 0.5); assert.equal(p.actionBlocked, undefined);
  p.statuses.push(effect("stun", { throughRound: 2 }));
  prepareStatusActions(s, () => 0.9); assert.equal(p.actionBlocked?.reason, "stun");
});
test("Webbing consumes the correct escape turn, preserves accuracy/streak, and permits action next turn", () => {
  let { s, f } = state(); f.baseEnemyDamage = 1; s.players[id].statuses = [effect("web")];
  s = turn(s, f);
  assert.equal(s.players[id].totals.questionsCorrect, 1);
  assert.equal(s.players[id].consecutiveCorrectAnswers, 1);
  assert.equal(s.players[id].totals.damageDealt, 0);
  assert.equal(s.players[id].statuses!.length, 0);
  s = turn(next(s, f), f);
  assert.ok(s.players[id].totals.damageDealt > 0);
});
test("party Hypnosis tracks each player independently, survives JSON recovery and locks the source until the last player escapes", () => {
  let { s, f } = state("hypnosis", "warrior", 2); f.baseEnemyDamage = 1;
  execute(s, f); s.round++;
  assert.equal(s.players[id].statuses![0].type, "hypnosis");
  assert.equal(s.players.p1.statuses![0].type, "hypnosis");
  s = next(turn(s, f, { [id]: "4", p1: "wrong" }), f);
  s = JSON.parse(JSON.stringify(s));
  s = next(turn(s, f, { [id]: "4", p1: "4" }), f);
  s = turn(s, f, { [id]: "4", p1: "4" });
  assert.equal(s.players[id].statuses!.length, 0);
  assert.equal(s.players.p1.statuses![0].correctAnswers, 2);
  assert.ok(s.players[id].totals.damageDealt > 0);
  const enemyPhase = advancePhase(s, f);
  assert.ok(enemyPhase.events.some(e => e.message.includes("maintains hypnosis")));
  assert.equal(enemyPhase.events.filter(e => e.type === "enemy_attack").length, 0);
  s = advancePhase(enemyPhase, f);
  s = turn(s, f, { [id]: "4", p1: "4" });
  assert.equal(s.players.p1.statuses!.length, 0);
  const unlocked = advancePhase(s, f);
  assert.ok(unlocked.events.some(e => e.type === "enemy_attack"));
});
test("Hypnotic Stare affects only one player, while solo Hypnosis always has an answer-based escape", () => {
  const single = state("hypnotic_stare", "warrior", 2); single.s.players[id].threat = 100;
  execute(single.s, single.f);
  assert.equal(single.s.players[id].statuses!.length, 1);
  assert.equal(single.s.players.p1.statuses?.length || 0, 0);
  let { s, f } = state("hypnosis"); execute(s, f); s.round++;
  for (let i = 0; i < 3; i++) s = i === 2 ? turn(s, f) : next(turn(s, f), f);
  assert.equal(s.players[id].statuses!.length, 0);
  assert.ok(s.players[id].totals.damageDealt > 0);
});
test("killing a hypnotizing source releases its victims immediately", () => {
  let { s, f } = state("hypnosis", "warrior", 2);
  s.players.p1.statuses = [effect("hypnosis")]; s.enemies[0].health = 1;
  s = turn(s, f, { [id]: "4", p1: "4" });
  assert.equal(s.enemies[0].health, 0);
  assert.equal(s.players.p1.statuses!.length, 0);
});
test("Trip fails combat only: academic accuracy, mastery, streak and resources remain correct", () => {
  let { s, f } = state("attack", "wizard"); s.players[id].statuses = [effect("trip")];
  const mp = s.players[id].mp;
  s = selectAction(applyAnswer(s, id, "4", f.questions[0]), id, "fireball", "e1");
  s = advancePhase(advancePhase(advancePhase(s, f), f), f);
  assert.equal(s.players[id].totals.questionsCorrect, 1); assert.equal(s.players[id].totals.questionsIncorrect, 0);
  assert.equal(s.players[id].consecutiveCorrectAnswers, 1); assert.equal(s.players[id].correctQuestionKeys!.length, 1);
  assert.equal(s.players[id].totals.damageDealt, 0); assert.equal(s.players[id].mp, mp);
  assert.ok(s.players[id].health < 100);
});
test("Fear blocks offensive actions but permits healing and preserves answers", () => {
  let a = state("attack", "wizard"); a.s.players[id].statuses = [effect("fear", { throughRound: 1 })];
  assert.equal(turn(a.s, a.f).players[id].totals.damageDealt, 0);
  let { s, f } = state("attack", "priest"); s.players[id].statuses = [effect("fear", { throughRound: 1 })]; s.players[id].health = 50;
  s = turn(s, f); assert.ok(s.players[id].totals.healingDone > 0); assert.equal(s.players[id].totals.questionsCorrect, 1);
});
test("Double Attack resolves two separately mitigated hits and respects the aggregate solo cap", () => {
  let { s, f } = state("double_attack"); s.currentPhase = "question_resolution";
  const p = s.players[id]; p.stats.def = 4; p.stats.vit = 0;
  s = advancePhase(s, f);
  assert.equal(s.players[id].health, 84);
  assert.deepEqual(s.events.filter(e => e.type === "enemy_attack").map(e => e.amount), [8, 8]);
  const solo = state("double_attack"); solo.s.soloEnemyDamageCap = 3; solo.s.currentPhase = "question_resolution";
  const result = advancePhase(solo.s, solo.f); assert.equal(result.players[id].health, 97);
});
test("poison and bleed fractions accumulate; new ailments do not tick on their application round", () => {
  const { s, f } = state("fangs"); f.baseEnemyDamage = 1;
  execute(s, f); const hp = s.players[id].health;
  assert.equal(s.players[id].statuses![0].type, "poison");
  // Use a hypnotized extra player to stop further enemy attacks while poison keeps ticking.
  s.players.other = { ...structuredClone(s.players[id]), studentId: "other", statuses: [effect("hypnosis")] };
  for (let i = 0; i < 3; i++) { s.round++; execute(s, f); }
  assert.equal(s.players[id].health, hp - 2);
  const bleed = state(); bleed.s.players[id].statuses = [effect("bleed", { amount: 0.25, throughRound: 3 })];
  const beforeAtk = bleed.s.players[id].stats.atk;
  const resolved = turn(bleed.s, bleed.f); assert.equal(resolved.players[id].stats.atk, beforeAtk);
});
test("Purify removes poison and paralysis without spending an extra question action", () => {
  let { s, f } = state("attack", "priest", 2); s.players.p1.statuses = [effect("poison", { amount: 20 }), effect("paralysis", { chance: 1 })];
  s = applyAnswer(s, id, "4", f.questions[0]); s = applyAnswer(s, "p1", "4", f.questions[0]);
  s = advancePhase(advancePhase(s, f), f); s = selectAction(s, id, "purify", "p1"); s = advancePhase(s, f);
  assert.equal(s.players.p1.statuses!.length, 0);
});
test("Vampiric Bite heals by actual player HP percentage and cannot overheal; cooldown is five full rounds", () => {
  const { s, f } = state("vampiric_bite"); s.enemies[0].health = 100;
  s.players[id].stats.def = 0; s.players[id].stats.vit = 0;
  const { hits } = execute(s, f);
  assert.equal(s.enemies[0].health, 100 + hits[0].dealt / 100 * 1000);
  assert.equal(s.enemies[0].aiState!.readyRounds.vampiric_bite, 7);
  s.round = 6; assert.equal(chooseEnemyRule(s, s.enemies[0], () => 0).move, "attack");
  s.round = 7; assert.equal(chooseEnemyRule(s, s.enemies[0], () => 0).move, "vampiric_bite");
});
test("corrosion stacks without permanent stat mutation and never makes defense negative", () => {
  const { s } = state(); const p = s.players[id]; p.stats.def = 10;
  for (let i = 0; i < 12; i++) addStatus(s, p, effect("corrosion", { throughRound: 5 }));
  assert.equal(p.statuses!.length, 10); assert.equal(effectiveDefense(p), 0); assert.equal(p.stats.def, 10);
});
test("Fade Out and hidden Flatten prevent next-round damage, expire, and do not leak prepared traps", () => {
  for (const move of ["fade_out", "flatten"] as const) {
    let { s, f } = state(move); execute(s, f); s.round++;
    const publicState = publicSnapshot(s);
    assert.equal(publicState.seed, 0); assert.equal(publicState.enemies[0].ai, undefined);
    if (move === "flatten") assert.ok(!JSON.stringify(publicState).includes("flatten"));
    s = turn(s, f); assert.equal(s.players[id].totals.damageDealt, 0);
    s = turn(next(s, f), f); assert.ok(s.players[id].totals.damageDealt > 0);
  }
});
test("Samhain uses tier ATK, bounded defense stacks and a nonstacking three-round damage buff", () => {
  const { s, f } = state("cobble_hollow"); s.enemies[0].attackPower = 3;
  execute(s, f); assert.equal(s.enemies[0].aiState!.buffs[0].throughRound, 4);
  s.round++; s.enemies[0].ai!.rules = [ruleFor("slash")];
  const hit = execute(s, f).hits[0]; assert.equal(hit.raw, 12 * 3 * 2);
  s.players[id].health = 100; s.players[id].isDead = false;
  s.enemies[0].ai!.rules = [ruleFor("hunker_down")];
  for (let i = 0; i < 4; i++) { execute(s, f); s.round++; }
  assert.ok(s.enemies[0].aiState!.buffs.filter(b => b.type === "defense").length <= 3);
});
test("Blood Strike cannot sacrifice lethal HP and heals five percent of damage rather than max HP", () => {
  const { s, f } = state("blood_strike"); s.enemies[0].health = 500;
  const hit = execute(s, f).hits[0]; assert.equal(s.enemies[0].health, 400 + Math.floor(hit.dealt * 0.05));
  s.enemies[0].health = 100; s.round = 10;
  assert.equal(chooseEnemyRule(s, s.enemies[0], () => 0).move, "attack");
});
test("Possess borrows player offense without spending player MP or crediting player damage", () => {
  const { s, f } = state("possess", "wizard"); s.players[id].availableAbilities = ["fireball"];
  s.players[id].stats.def = 0; s.players[id].stats.vit = 0; s.currentPhase = "question_resolution";
  const result = advancePhase(s, f);
  assert.equal(result.players[id].mp, s.players[id].mp);
  assert.equal(result.players[id].totals.damageDealt, 0);
  assert.equal(result.players[id].health, 100 - s.players[id].stats.int * 3);
  assert.ok(result.events.some(e => e.message.includes("copies")));
});
test("entire AI resolution is deterministic after a persisted snapshot and never mutates input", () => {
  const { s, f } = state("webbing", "warrior", 3); s.currentPhase = "question_resolution";
  const before = structuredClone(s);
  assert.deepEqual(advancePhase(s, f, 123), advancePhase(JSON.parse(JSON.stringify(s)), f, 123));
  assert.deepEqual(s, before);
});
