/** Clones the caller snapshot once, then orchestrates deterministic rules in the existing order.
 * The caller owns timers, durable checkpoints and publication. */
import { type CombatSnapshot } from "../../shared/combat/model.ts";
import { type FightRecord, type FightQuestion } from "../db/schema.ts";
import { recordAttempt } from "../../shared/combat/attempts";
import { defaultQuestionAction } from "./choices";
import { ANSWER_FEEDBACK_MS } from "../../shared/combat/answer-feedback";
import { prepareStatusActions, releaseInvalidStatuses } from "../../shared/combat/status-effects";
import { rng } from "./random";
import { completedRounds, participatedRounds } from "./participants";
import { applyAbility } from "./ability-execution";
import { abilityProblem, ULTIMATES } from "../../shared/combat/abilities.ts";
import { questionKey } from "../progression/question-key";
import { event, leader } from "./state-events";
import { damagePlayer, hit, heal, resolvedHP } from "./health";
import { currentHP } from "../../shared/combat/hp";
import { baseDamage } from "./damage-values";
import { activeEnemies, performance, encounterEntry, encounterBudgetFromEntries, allocateHP, roundHP } from "../../shared/combat/encounters";
import { makePlayback, abilityEffect } from "../../shared/combat/presentation";
import { resolveEnemyTurn } from "./enemy-turn";
import { abilityDamage } from "../../shared/combat/abilityValues.ts";
import { ENCOUNTER_TIERS } from "../../shared/encounter-tiers";
import { preserveCombo } from '../../shared/aa';

export function advancePhase(
  state: CombatSnapshot,
  fight: FightRecord,
  now = Date.now(),
): CombatSnapshot {
  const s = structuredClone(state);
  // Use the saved tier for all later waves and admissions; never re-average an active fight.
  if (s.encounterTier && s.encounterTier > (fight.encounterTier || 1)) {
    fight = { ...fight, encounterTier: s.encounterTier,
      baseEnemyDamage: Math.max(fight.baseEnemyDamage, ENCOUNTER_TIERS[s.encounterTier - 1]?.damage || 1) };
  }
  s.revision++;
  s.phaseStartTime = now;
  delete s.playback;
  if(s.currentPhase==='wave_break'){
    s.currentPhase='question';s.questionStartTime=now+3000;
    s.phaseDeadline=now+3000+fight.questions[s.currentQuestionIndex].timeLimit*1000;return s;
  }
  if (s.currentPhase === "question") {
    for (const p of Object.values(s.players))
      if (!p.isDead) {
        if (!p.hasAnswered) {
          recordAttempt(s, p, fight.questions[s.currentQuestionIndex], false);
          p.hasAnswered = true;
          p.lastAnswerCorrect = false;
          p.currentAnswer = "";
        }
        p.questionAction ||= defaultQuestionAction(p, s);
      }
    s.currentPhase = "answer_feedback";
    s.phaseDeadline = now + ANSWER_FEEDBACK_MS;
    return s;
  }
  if (s.currentPhase === "answer_feedback") {
    s.currentPhase = "actions";
    for (const p of Object.values(s.players)) p.ready = false;
    prepareStatusActions(s, () => rng(s));
    s.phaseDeadline = now + 20000;
    return s;
  }
  if (s.currentPhase === "actions") {
    prepareStatusActions(s, () => rng(s));
    for (const p of Object.values(s.players)) p.ready = false;
    s.currentPhase = "abilities";
    s.phaseDeadline = now + 20000;
    return s;
  }
  if (s.currentPhase === "abilities") {
    // Capture already-due ticks before recasts refresh their saved effects.
    // Refreshing duration must not cancel the tick earned this round.
    const dueTicks = activeEnemies(s).flatMap(enemy => enemy.effects
      .filter(effect => effect.damage > 0 && (effect.appliedRound === undefined || effect.appliedRound < s.round))
      .map(effect => ({ enemyId: enemy.id, effect: { ...effect } })));
    const completed = completedRounds(s);
    for (const p of Object.values(s.players)) p.roundsParticipated = participatedRounds(s, p) + 1;
    s.completedRounds = completed + 1;
    s.events = [];
    prepareStatusActions(s, () => rng(s));
    // Support resolves before answer damage so blocks protect wrong answers, as specified.
    const legacyOrdered = Object.values(s.players).sort(
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
    const joined=Object.values(s.players).sort((a,b)=>(a.joinOrder||0)-(b.joinOrder||0));
    const offset=(s.round-1)%Math.max(1,joined.length);
    const ordered=s.encounterRules===2?[...joined.slice(offset),...joined.slice(0,offset)]:legacyOrdered;
    for (const p of ordered.filter((p) => !p.isDead))
      for (const a of p.supportActions)
        applyAbility(s, p, a.ability, a.targetId);
    for (const p of ordered.filter((p) => !p.isDead)) {
      p.totals.questionsAnswered++;
      const before = p.totals.damageDealt;
      if (
        p.questionAction?.ability === "sacred_strike" &&
        !abilityProblem(p, "sacred_strike") && !p.actionBlocked
      )
        p.buffs.immunity = { rounds: 1, amount: 0 };
      if (p.lastAnswerCorrect) {
        p.totals.questionsCorrect++;
        p.correctQuestionKeys = [...new Set([...(p.correctQuestionKeys || []), questionKey(fight.questions[s.currentQuestionIndex])])];
        p.consecutiveCorrectAnswers = (p.consecutiveCorrectAnswers || 0) + 1;
        const a = p.questionAction;
        // Departure can cancel a saved ally-targeted action before resolution.
        const tripped = p.statuses?.some(x => x.type === "trip");
        if (tripped) {
          p.statuses = p.statuses?.filter(x => x.type !== "trip");
          event(s, "ability", p.studentId, p.studentId, 0, `${p.nickname} tripped: answer credit preserved, combat action failed`);
          const provoke = ordered.find(x => !x.isDead && x.buffs.provoke);
          damagePlayer(s, provoke?.studentId || p.studentId, fight.baseEnemyDamage, "trip");
        } else if (a) applyAbility(s, p, a.ability, a.targetId);
        if (a && !tripped && !p.actionBlocked && p.buffs.abyssal_drain) {
          const amount = baseDamage(p);
          activeEnemies(s)
            .filter((e) => e.health > 0 && e.id !== a.targetId)
            .forEach((e) => hit(s, p, e.id, amount, false, "magic"));
          heal(s, p, p.studentId, p.totals.damageDealt - before);
        }
      } else {
        p.totals.questionsIncorrect++;
        p.consecutiveCorrectAnswers = 0;
        p.comboPoints = preserveCombo(p.comboPoints, p.advancement?.comboFloor || 0);
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
        if (p.lastAnswerCorrect) p.comboPoints = Math.min(p.maxComboPoints, p.comboPoints + 1);
        if (p.buffs.blood_sword) heal(s, p, p.studentId, dealt);
        if (
          p.characterClass === "blood_knight" &&
          (p.jobLevels.blood_knight || 0) >= 4
        )
          heal(s, p, p.studentId, dealt / 4);
      }
    }
    for (const { enemyId, effect } of dueTicks) {
      if (s.players[effect.ownerId]) {
        const start = s.events.length;
        hit(s, s.players[effect.ownerId], enemyId, effect.damage, true,
          effect.type === "hex" ? "magic" : "physical");
        for (const event of s.events.slice(start)) {
          event.actionId = `${s.round}:dot:${start}`;
          event.abilityId = effect.type;
          event.effect = abilityEffect(effect.type, s.players[effect.ownerId]);
          event.message = `${effect.type === "hex" ? "Hex" : effect.type} tick: ${event.message}`;
        }
      }
    }
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
    s.phaseDeadline = null;
    s.playback = makePlayback(state,s);
    return s;
  }
  if (s.currentPhase === "question_resolution") {
    s.currentPhase = "enemy_ai";
    leader(s);
    resolveEnemyTurn(s, fight, {
      random: () => rng(s),
      damage: (id, raw, source, ignoreDefense, limit, fractional, cause) => damagePlayer(s, id, raw, source, ignoreDefense, limit, fractional, cause),
      say: (actor, target, message, amount = 0, healing = false) => {
        const enemy=s.enemies.find(e=>e.id===target);
        event(s, healing?"heal":"ability", actor, target, amount, message,
          healing&&enemy?{healthBefore:enemy.health-amount,healthAfter:enemy.health}:{});
      },
      possess: (enemy, copied, target, damage) => {
        const abilities = copied.availableAbilities.filter(id =>
          (abilityDamage(copied, id) || 0) > 0 && !ULTIMATES.has(id) && !abilityProblem(copied, id));
        if (!abilities.length) return false;
        const ability = abilities[Math.floor(rng(s) * abilities.length)];
        // Resolve the borrowed attack on isolated targets through the same player rules.
        // Only its damage is mirrored back; real player resources, totals and loadouts are untouched.
        const borrowed = structuredClone(copied);
        borrowed.statuses = []; delete borrowed.actionBlocked;
        const projection: CombatSnapshot = { ...structuredClone(s), encounterRules: undefined, enemyDisplayMode: "simultaneous", events: [], players: { [borrowed.studentId]: borrowed },
          enemies: Object.values(s.players).filter(p => !p.isDead).map(p => ({ id: p.studentId, name: p.nickname,
            image: "", difficultyMultiplier: 1, health: 1e9, maxHealth: 1e9, effects: [] })) };
        applyAbility(projection, borrowed, ability, target.studentId);
        s.seed = projection.seed;
        event(s, "ability", enemy.id, copied.studentId, 0, `${enemy.name} copies ${copied.nickname}'s ${ability.replaceAll("_", " ")}`);
        for (const attack of projection.events.filter(e => e.type === "damage")) damage(attack.targetId, attack.amount);
        return true;
      },
    });
    leader(s);
    s.phaseDeadline = null;
    s.playback = makePlayback(state,s);
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
            p.maxHealth -= b.hpAmount ?? b.amount;
            p.health = s.encounterHpPool === undefined ? Math.min(p.health, p.maxHealth) : resolvedHP(s, Math.min(p.health, p.maxHealth), p.maxHealth);
            p.maxMp -= b.amount;
            p.mp = Math.min(p.mp, p.maxMp);
          }
          delete p.buffs[k];
        }
    }
    s.enemies.forEach(
      (e) =>
        (e.effects = e.effects
          .map((x) => ({ ...x, rounds: x.rounds - (x.appliedRound === undefined || x.appliedRound < s.round ? 1 : 0) }))
          .filter((x) => x.rounds > 0)),
    );
    if(s.encounterRules===2 && Object.keys(s.pendingPlayers||{}).length){
      const q=Math.max(1,fight.questions.length);
      s.entryPerformance||={};
      const roleWeighted = Object.values(s.entryPerformance).some(p => p.hpWeight !== undefined);
      for(const [id,p]of Object.entries(s.pendingPlayers||{}))s.entryPerformance[id] ||= roleWeighted ? encounterEntry(p,q) : performance(p,q);
      const count=Object.keys(s.entryPerformance).length;
      if(count>(s.encounterAttendance||0)){
        const entries=Object.values(s.entryPerformance);
        const budget=encounterBudgetFromEntries(entries,s.encounterTier||fight.encounterTier||1,q,roleWeighted,s.encounterTier===undefined?0.5:1);
        const hp=roleWeighted?Math.max(s.encounterHpPool||0,budget.hp):budget.hp;
        if(!roleWeighted || hp!==s.encounterHpPool){
          const nextAllocation=allocateHP(s.enemies,hp,!roleWeighted);
          s.enemies=s.enemies.map((e,i)=>{
            const maxHealth=nextAllocation[i].maxHealth;
            const health=maxHealth*e.health/e.maxHealth;
            return {...e,maxHealth,health:e.health>0?(roleWeighted?currentHP(health,maxHealth):Math.max(.001,roundHP(health))):0};
          });
        }
        if(roleWeighted)s.encounterHpPool=hp;
        s.referenceDamage=budget.damage;s.enemyRoundBudget=budget.rawPressure;s.encounterAttendance=count;
      }
    }
    for (const [id, player] of Object.entries(s.pendingPlayers || {})) s.players[id] = player;
    s.pendingPlayers = {};
    leader(s);
    s.round++;
    releaseInvalidStatuses(s);
    let waveChanged=false;
    if(s.encounterRules===2){
      if(!activeEnemies(s).length && s.enemyDisplayMode==='consecutive'){
        s.activeWave=Math.min(...s.enemies.filter(e=>e.health>0).map(e=>e.wave||1));
        waveChanged=true;
      }
      s.questionOrder ||= fight.questions.map((_,i)=>i);
      s.questionCursor=(s.questionCursor||0)+1;
      if(s.questionCursor>=s.questionOrder.length){
        s.questionCursor=0;
        if(fight.randomizeQuestions){
          for(let i=s.questionOrder.length-1;i>0;i--){const j=Math.floor(rng(s)*(i+1));[s.questionOrder[i],s.questionOrder[j]]=[s.questionOrder[j],s.questionOrder[i]];}
          if(s.questionOrder.length>1&&s.questionOrder[0]===s.currentQuestionIndex)[s.questionOrder[0],s.questionOrder[1]]=[s.questionOrder[1],s.questionOrder[0]];
        }
      }
      s.currentQuestionIndex=s.questionOrder[s.questionCursor];
    }else s.currentQuestionIndex=(s.currentQuestionIndex+1)%fight.questions.length;
    s.currentPhase = waveChanged ? "wave_break" : "question";
    s.questionStartTime = now + 3000;
    s.phaseDeadline =
      now + 3000 + fight.questions[s.currentQuestionIndex].timeLimit * 1000;
    if(waveChanged)s.phaseDeadline=s.autoAdvanceWaves?now+3000:null;
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
