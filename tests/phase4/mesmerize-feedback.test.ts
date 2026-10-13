import assert from "node:assert/strict";
import { test } from "node:test";
import { advancePhase, allLivingPlayersAnswered, applyAnswer, selectAction, setReady } from "../../worker/combat/engine";
import { combatActionBlock, prepareStatusActions } from "../../shared/combat/status-effects";
import { publicSnapshot } from "../../worker/combat/public-snapshot";
import { playbackCues } from "../../shared/combat/presentation";
import { enemyAISchema, ruleFor } from "../../shared/combat/enemy-ai";
import { ANSWER_FEEDBACK_MS } from "../../shared/combat/answer-feedback";
import { roomFixture } from "../support/room-costs";
import { advanceTo, fight, started, student } from "./fixtures";

const id = student().id;
const status = (type: "stun" | "hypnosis" | "stare") => ({ type, sourceId: "e1", appliedRound: 0, throughRound: 10 });
const command = (type: string, payload = {}) => JSON.stringify({type, commandId: crypto.randomUUID(), round: 1, ...payload});

test("disabled choices reject actions and support, count as ready, and preserve answers and resources", () => {
  for (const type of ["stun", "hypnosis", "stare"] as const) {
    let s = started("wizard");
    s.players[id].statuses = [status(type)];
    s.players[id].availableAbilities.push("manashield");
    const mp = s.players[id].mp;
    s = advanceTo(applyAnswer(s, id, "4", fight.questions[0]), "actions");
    assert.equal(combatActionBlock(s, s.players[id])?.reason, type);
    assert.throws(() => selectAction(s, id, "fireball", "e1"), /cannot use/);
    assert.equal(allLivingPlayersAnswered(s), true);
    s = advancePhase(s, fight);
    assert.equal(s.currentPhase, "abilities");
    assert.throws(() => selectAction(s, id, "manashield", id), /cannot use/);
    s = advancePhase(s, fight);
    assert.equal(s.players[id].mp, mp);
    assert.equal(s.players[id].totals.questionsCorrect, 1);
    assert.equal(s.players[id].totals.damageDealt, 0);
    assert.equal(s.players[id].statuses?.find(x => x.type === type)?.correctAnswers || s.players[id].recoveryCorrectAnswers, 1);
  }
});

test("final recovery answer opens choices immediately and is counted once across JSON restoration", () => {
  for (const type of ["stun", "hypnosis", "stare"] as const) {
    let s = started("wizard");
    s.players[id].statuses = [{ ...status(type), correctAnswers: 2 }];
    s.players[id].recoveryCorrectAnswers = 1;
    s = advanceTo(applyAnswer(s, id, "4", fight.questions[0]), "actions");
    assert.equal(combatActionBlock(s, s.players[id]), undefined);
    s = selectAction(s, id, "fireball", "e1");
    const mp = s.players[id].mp;
    s = advanceTo(JSON.parse(JSON.stringify(s)), "question_resolution");
    assert.equal(s.players[id].mp, mp - 1);
    assert.equal(s.players[id].statuses?.length, 0);
  }
  let s = started();
  s.players[id].statuses = [status("hypnosis")];
  s = advanceTo(applyAnswer(s, id, "4", fight.questions[0]), "actions");
  const seed = s.seed;
  s = advanceTo(JSON.parse(JSON.stringify(s)), "question_resolution");
  assert.equal(s.players[id].statuses![0].correctAnswers, 1);
  assert.equal(s.seed, seed);
  assert.equal("statusPreparedRound" in publicSnapshot(s).players[id], false);
});

function hypnotizedEncounter() {
  const s = started();
  s.enemyDisplayMode = "simultaneous";
  s.currentPhase = "question_resolution";
  s.players[id].health = s.players[id].maxHealth = 100;
  s.players[id].stats.def = s.players[id].stats.vit = 0;
  s.players[id].statuses = [status("hypnosis")];
  s.enemies.push({ ...structuredClone(s.enemies[0]), id: "e2", name: "Second enemy", difficultyMultiplier: 10,
    ai: enemyAISchema.parse({mode: "basic"}) });
  prepareStatusActions(s, () => 0);
  return s;
}
test("another enemy's direct damage breaks either hypnosis type and retains unrelated action locks", () => {
  for (const type of ["hypnosis", "stare"] as const) {
    const s = hypnotizedEncounter();
    s.players[id].statuses![0].type = type;
    s.players[id].statuses!.push({...status("stun"), sourceId: "e2"});
    const next = advancePhase(s, fight);
    assert.ok(next.players[id].health < 100);
    assert.equal(next.players[id].statuses?.some(x => x.type === type), false);
    assert.equal(next.players[id].actionBlocked?.reason, "stun");
    assert.ok(next.events.some(e => e.message.includes("broke hypnosis")));
    assert.ok(next.players[id].controlImmuneThroughRound! >= next.round + 1);
  }
});
test("wrong answers use purple magic, preserve hypnosis and still respect dodge", () => {
  for (const type of ["hypnosis", "stare"] as const) {
    let s = started();
    s.players[id].statuses = [status(type)];
    s = advanceTo(applyAnswer(s, id, "wrong", fight.questions[0]), "question_resolution");
    const penalty = s.events.find(e => e.actorId === "wrong_answer")!;
    assert.equal(penalty.effect, "curse");
    assert.ok(playbackCues(s.playback!, s.events).some(c => c.event.id === penalty.id && c.effect === "curse"));
    assert.equal(s.players[id].statuses![0].type, type);
    let dodged = started();
    dodged.players[id].statuses = [status(type)];
    dodged.players[id].buffs.dodge = {rounds: 1, amount: 1};
    dodged = advanceTo(applyAnswer(dodged, id, "wrong", fight.questions[0]), "question_resolution");
    assert.equal(dodged.players[id].totals.damageTaken, 0);
    assert.equal(dodged.players[id].statuses![0].type, type);
  }
});
test("blocked hits and periodic damage do not release hypnosis; a source resumes after its last victim wakes", () => {
  let s = hypnotizedEncounter();
  s.players[id].buffs.shield = {rounds: 1, amount: 999};
  assert.equal(advancePhase(s, fight).players[id].statuses![0].type, "hypnosis");
  s = hypnotizedEncounter();
  s.players[id].statuses!.push({type: "poison", sourceId: "e2", appliedRound: 0, amount: 2});
  // The second enemy only buffs itself, so the only incoming damage is periodic.
  s.enemies[1].enemyType = "samhain";
  s.enemies[1].ai = enemyAISchema.parse({mode: "custom", rules: [ruleFor("hunker_down")]});
  const dot = advancePhase(s, fight);
  assert.equal(dot.players[id].health, 98);
  assert.ok(dot.players[id].statuses?.some(x => x.type === "hypnosis"));
  s = hypnotizedEncounter();
  s.enemies.reverse(); // The hit releases the source before its turn.
  const woken = advancePhase(s, fight);
  assert.ok(woken.events.some(e => e.type === "enemy_attack" && e.actorId === "e1"));
});

test("feedback is timed, persists the same deadline and rejects answers/actions until choices", async () => {
  const f = roomFixture(2);
  await f.obj.webSocketMessage(f.players[0], command("answer", {questionId: "q1", answer: "4"}));
  for (const ws of [f.host, ...f.players]) {
    const message = ws.messages.filter((m: any) => m.type === "combat_state").at(-1);
    assert.equal(message.question.correctAnswer, undefined);
    assert.equal(message.state.players[f.students[0].id].answerOutcome, undefined);
  }
  await f.obj.webSocketMessage(f.players[1], command("answer", {questionId: "q1", answer: "wrong"}));
  const feedback = f.saved();
  assert.equal(feedback.snapshot.currentPhase, "answer_feedback");
  assert.equal(feedback.snapshot.phaseDeadline - feedback.snapshot.phaseStartTime, ANSWER_FEEDBACK_MS);
  for (const ws of [f.host, ...f.players]) {
    const message = ws.messages.filter((m: any) => m.type === "combat_state").at(-1);
    assert.equal(message.question.correctAnswer, "4");
    assert.equal(message.state.players[f.students[0].id].answerOutcome, "correct");
    assert.equal(message.state.players[f.students[1].id].answerOutcome, "incorrect");
    assert.equal(message.state.players[f.students[1].id].currentAnswer, null);
  }
  assert.throws(() => applyAnswer(feedback.snapshot, f.students[0].id, "4", feedback.fight.questions[0]), /unavailable/);
  assert.throws(() => selectAction(feedback.snapshot, f.students[0].id, "attack", feedback.snapshot.enemies[0].id), /closed/);
  assert.throws(() => setReady(feedback.snapshot, f.students[0].id), /Cannot finish/);
  await f.object().alarm();
  assert.equal(f.saved().snapshot.phaseDeadline, feedback.snapshot.phaseDeadline);
  feedback.snapshot.phaseDeadline = Date.now() - 1;
  f.save(JSON.parse(JSON.stringify(feedback)));
  await f.object().alarm();
  assert.equal(f.saved().snapshot.currentPhase, "actions");
  assert.equal(f.saved().snapshot.phaseDeadline - f.saved().snapshot.phaseStartTime, 20000);
});

test("an unanswered disabled solo player still sees feedback, then skips both empty choice phases", async () => {
  const f = roomFixture(1), room = f.saved(), pid = f.students[0].id;
  room.snapshot.players[pid].statuses = [{...status("hypnosis"), sourceId: room.snapshot.enemies[0].id}];
  room.snapshot.phaseDeadline = Date.now() - 1;
  f.save(room);
  await f.obj.alarm();
  const feedback = f.saved();
  assert.equal(feedback.snapshot.currentPhase, "answer_feedback");
  assert.equal(publicSnapshot(feedback.snapshot).players[pid].answerOutcome, "unanswered");
  feedback.snapshot.phaseDeadline = Date.now() - 1;
  f.save(feedback);
  await f.object().alarm();
  assert.equal(f.saved().snapshot.currentPhase, "question_resolution");
  assert.equal(f.saved().snapshot.phaseDeadline, null);
});
