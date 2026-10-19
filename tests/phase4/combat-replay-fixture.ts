import { createHash } from 'node:crypto';
import * as engine from '../../worker/combat/engine.ts';
import { publicSnapshot } from '../../worker/combat/public-snapshot.ts';
import { ALL_CHARACTER_CLASSES } from '../../shared/schema.ts';
import { ALLIES, SUPPORT, availableAbilities } from '../../shared/combat/abilities.ts';
import { activeEnemies } from '../../shared/combat/encounters.ts';
import type { CombatSnapshot } from '../../shared/combat/model.ts';
import { fight, student } from './fixtures.ts';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Frozen inputs, clocks and output hashes captured from pre-C10 main. No production data. */
export function combatReplayTraces(recover = false, historicalScaling?: Record<string, Partial<CombatSnapshot>>) {
  const traces: { scenario: string; steps: unknown[] }[] = [];
  const levels = Object.fromEntries(ALL_CHARACTER_CLASSES.map(job => [job, 15]));
  for (const job of ALL_CHARACTER_CLASSES) for (const ability of availableAbilities(job, levels)) {
    const steps: unknown[] = [];
    const record = (s: CombatSnapshot) => {
      steps.push({ phase: s.currentPhase, seed: s.seed, persisted: digest(s), public: digest(publicSnapshot(s, fight)) });
      return recover ? json(s) : s;
    };
    const initial = engine.initialCombatState('C10-abilities', fight, 1000);
    if (historicalScaling) for (const e of initial.enemies) delete e.magicDefense;
    let s = engine.startQuestion(engine.addStudent(initial, student(job), { levels }), 2000);
    const p = s.players[student().id];
    p.mp = p.maxMp = 100; p.comboPoints = p.maxComboPoints = 50;
    p.shieldPotions = 2; p.healingPotions = 4; p.health = 5;
    s.enemies[0].health = s.enemies[0].maxHealth = 10000;
    s = record(engine.applyAnswer(s, p.studentId, '4', fight.questions[0]));
    while (s.currentPhase !== (SUPPORT.has(ability) ? 'abilities' : 'actions')) s = record(engine.advancePhase(s, fight, 6000 + steps.length * 1000));
    s = record(engine.selectAction(s, p.studentId, ability, ALLIES.has(ability) ? p.studentId : 'e1'));
    while (s.currentPhase !== 'question' && s.currentPhase !== 'game_over') s = record(engine.advancePhase(s, fight, 6000 + steps.length * 1000));
    traces.push({ scenario: `${job}:${ability}`, steps });
  }
  for (const count of [1, 7, 30]) for (const seed of ['C10-a', 'C10-b', 'C10-c']) {
    const authored = { ...fight, randomizeQuestions: true, encounterTier: 2, questions: [...fight.questions, { ...fight.questions[0], id: 'q2', correctAnswer: '5' }],
      enemies: ['zombie', 'ghost', 'spider', 'vampire', 'slime', 'samhain', 'goblin'].map((enemyType, i) => ({ id: `e${i}`, name: enemyType, image: '', enemyType, difficultyMultiplier: 1, quantity: enemyType === 'goblin' ? 5 : 1, wave: i + 1, role: 'normal' })) } as typeof fight;
    const steps: unknown[] = [];
    const record = (s: CombatSnapshot) => {
      steps.push({ phase: s.currentPhase, round: s.round, seed: s.seed, persisted: digest(s), public: digest(publicSnapshot(s, authored)) });
      return recover ? json(s) : s;
    };
    let s = engine.initialCombatState(seed, authored, 1000);
    for (let i = 0; i < count; i++) s = engine.addStudent(s, student(ALL_CHARACTER_CLASSES[i % ALL_CHARACTER_CLASSES.length], `p${i}`), { levels });
    s = engine.scaleEncounter(s, authored, count === 1);
    if (historicalScaling) {
      // Captured from main before the owner changed HP balance. These represent
      // already-started rooms, whose budgets must survive the new release.
      Object.assign(s, structuredClone(historicalScaling[String(count)]));
      delete s.encounterHpPool;
      for (const e of s.enemies) delete e.magicDefense;
      // Recreate the saved MP of participants who already started before the
      // full-MP change. Reconnection never refills those participants.
      for (const p of Object.values(s.players))
        if (p.characterClass === "wizard") p.mp = Math.floor(p.maxMp / 2);
    }
    s = record(engine.startQuestion(s, 2000));
    for (let turn = 0; turn < 12 && s.currentPhase !== 'game_over'; turn++) {
      if (s.currentPhase === 'wave_break') s = record(engine.advancePhase(s, authored, 10000 + steps.length * 1000));
      if (turn === 1) s = record(engine.addStudent(s, student('priest', 'late'), { levels }));
      if (turn === 3 && count > 1) s = record(engine.removeStudent(s, 'p1'));
      if (turn === 4 && count > 1) s = record(engine.addStudent(s, student('wizard', 'p1'), { levels }));
      const question = authored.questions[s.currentQuestionIndex];
      for (const [i, p] of Object.values(s.players).entries()) if (!p.isDead && (i + turn) % 5 !== 0) s = record(engine.applyAnswer(s, p.studentId, (i + turn) % 3 ? question.correctAnswer : 'wrong', question));
      // Include the complete answer-feedback, recovery, support, damage, AI and round cleanup sequence.
      do { s = record(engine.advancePhase(s, authored, 10000 + steps.length * 1000)); }
      while (!['question', 'wave_break', 'game_over'].includes(s.currentPhase));
      if (turn === 5 && s.currentPhase !== 'game_over') {
        const target = activeEnemies(s)[0];
        if (target) s = record(engine.eliminateEnemy(s, target.id));
      }
    }
    traces.push({ scenario: `${seed}:${count}`, steps });
  }
  return traces.map(({ scenario, steps }) => ({ scenario, steps: steps.length, sha256: digest(steps) }));
}
