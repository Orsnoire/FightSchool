import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, advancePhase, applyAnswer, removeStudent } from "../../worker/combat/engine.ts";
import { CombatSessionObject, publicSnapshot } from "../../worker/combat/session-object.ts";
import { combatReward } from "../../worker/db/game-repository.ts";
import { fight, started, student } from "./fixtures.ts";

const id = student().id;
test("late entrants wait for the next question, never affect the current phase, and do not rescale enemies", () => {
  const current = started();
  const beforeHP = structuredClone(current.enemies);
  const queued = addStudent(current, student("wizard", "late"));
  assert.equal(queued.players.late, undefined);
  assert.equal(queued.pendingPlayers?.late.mp, 3);
  assert.equal(queued.phaseDeadline, current.phaseDeadline);
  assert.throws(() => applyAnswer(queued, "late", "4", fight.questions[0]), /unavailable/);
  let s = applyAnswer(queued, id, "4", fight.questions[0]);
  s = advancePhase(s, fight); s = advancePhase(s, fight); s = advancePhase(s, fight);
  assert.equal(s.players[id].roundsParticipated, 1);
  assert.equal(s.pendingPlayers?.late.roundsParticipated, 0);
  s = advancePhase(s, fight); s = advancePhase(s, fight);
  assert.equal(s.currentPhase, "question");
  assert.equal(s.round, 2);
  assert.ok(s.players.late);
  assert.deepEqual(s.pendingPlayers, {});
  assert.equal(s.enemies[0].maxHealth, beforeHP[0].maxHealth);
});

test("departure archives resources and attendance; re-entry and hibernation preserve them without revealing archived answers", () => {
  const s = started("wizard");
  s.players.other = { ...structuredClone(s.players[id]), studentId: "other" };
  s.round = 5; s.completedRounds = 4;
  Object.assign(s.players[id], { health: 2, mp: 1, healingPotions: 2, threat: 17, roundsParticipated: 3, currentAnswer: "secret", lastAnswerCorrect: true });
  s.players[id].totals.damageDealt = 19;
  const left = removeStudent(s, id);
  assert.equal(left.players[id], undefined);
  assert.equal(publicSnapshot(left).departedPlayers, undefined);
  const back = addStudent(JSON.parse(JSON.stringify(left)), student("warrior"));
  const p = back.pendingPlayers![id];
  assert.equal(p.characterClass, "wizard");
  assert.deepEqual([p.health,p.mp,p.healingPotions,p.threat,p.roundsParticipated,p.totals.damageDealt], [2,1,2,17,3,19]);
  assert.equal(p.currentAnswer, null);
  assert.equal(p.hasAnswered, false);
  assert.equal(back.departedPlayers?.[id], undefined);
  assert.equal(addStudent(back, student()).revision, back.revision, "retry cannot add twice");
});

test("KO attendance counts, damage star uses actual damage with stable ties, and departure moves the star", () => {
  let s = started();
  s.players.other = { ...structuredClone(s.players[id]), studentId: "other", health: 0, isDead: true };
  s.currentPhase = "abilities";
  s.players[id].hasAnswered = true; s.players[id].lastAnswerCorrect = false;
  s.players[id].totals.damageDealt = 10; s.players.other.totals.damageDealt = 10;
  s.damageLeaderId = "other";
  s = advancePhase(s, fight);
  assert.equal(s.players.other.roundsParticipated, 1);
  assert.equal(s.damageLeaderId, "other");
  assert.equal(removeStudent(s, "other").damageLeaderId, id);
  s.players[id].totals.damageDealt = 0; s.players.other.totals.damageDealt = 0;
  assert.equal(removeStudent(s, "other").damageLeaderId, null);
});

test("rewards prorate base XP and victory gold, use combined HP on host end, retain activity and exclude zero-round spectators", () => {
  const s = started();
  s.round = 11; s.completedRounds = 10; s.currentPhase = "game_over"; s.endedByHost = true;
  s.enemies = [{ ...s.enemies[0], maxHealth: 100, health: 0 }, { ...s.enemies[0], id: "e2", maxHealth: 300, health: 120 }];
  const p = s.players[id]; p.roundsParticipated = 5; p.totals.questionsAnswered = 5; p.totals.questionsCorrect = 4; p.totals.questionsIncorrect = 1; p.totals.healingDone = 2;
  let reward = combatReward(s, p, fight);
  assert.equal(reward.participation, .5); assert.equal(reward.progress, .7);
  assert.equal(reward.xp, 8.5); assert.equal(reward.gold, 0);
  s.victory = true; reward = combatReward(s, p, fight);
  assert.equal(reward.xp, 10); assert.equal(reward.gold, 5);
  s.victory = false; s.endedByHost = false;
  assert.equal(combatReward(s, p, fight).xp, 5, "ordinary defeat grants activity only");
  p.roundsParticipated = 0; p.totals.questionsAnswered = 0; p.totals.questionsCorrect = 0; p.totals.questionsIncorrect = 0;
  assert.equal(combatReward(s, p, fight).xp, 0);
});

function moderationHarness() {
  let room: any = { fight, snapshot: started("wizard"), receipts: [] };
  room.snapshot.players.other = { ...structuredClone(room.snapshot.players[id]), studentId: "other" };
  room.snapshot.phaseDeadline = Date.now() + 100000;
  const sockets: any[] = [];
  const makeSocket = (actorId: string, role = "student") => {
    const messages: any[] = [];
    const socket = { messages, closed: false, send: (raw: string) => messages.push(JSON.parse(raw)), close: () => { socket.closed = true; }, serializeAttachment: () => {}, deserializeAttachment: () => ({ actorId, role, sessionId: "ABC234", tokenHash: actorId }) };
    sockets.push(socket); return socket;
  };
  const state = { storage: { get: async () => structuredClone(room), put: async (_: string, value: any) => { room = structuredClone(value); }, setAlarm: async () => {}, deleteAlarm: async () => {} }, getWebSockets: () => sockets.filter(s => !s.closed) };
  const create = () => {
    const object = new CombatSessionObject(state as any, { DATABASE_URL: "unused" });
    object.setRepository({ findActiveSession: async (hash: string) => ({ actorId: hash, actorType: [fight.teacherId, "imposter"].includes(hash) ? "teacher" : "student" }), findStudentById: async (key: string) => student("warrior", key), findLiveCombatSession: async () => ({ teacherId: fight.teacherId, status: "active" }), persistResults: async () => [] } as any);
    return object;
  };
  let object = create(), seq = 0;
  return { room: () => room, makeSocket, restore: () => { object = create(); }, send: (socket: any, type: string, payload = {}, commandId = `test-command-${++seq}`) => object.webSocketMessage(socket, JSON.stringify({ type, commandId, round: room.snapshot.round, ...payload })) };
}

test("only the host can remove/review; removals, one pending request, approval and blocking persist across recovery", async () => {
  const h = moderationHarness(), host = h.makeSocket(fight.teacherId, "teacher"), learner = h.makeSocket(id), imposter = h.makeSocket("imposter", "teacher");
  await h.send(learner, "remove_player", { targetId: "other" });
  assert.ok(h.room().snapshot.players.other);
  await h.send(imposter, "remove_player", { targetId: id });
  assert.ok(h.room().snapshot.players[id]);
  await h.send(host, "remove_player", { targetId: id }, "remove-exactly-once");
  assert.ok(learner.closed); assert.equal(learner.messages.at(-1).type, "fight_removed");
  assert.equal(h.room().snapshot.players[id], undefined);
  h.restore();
  const applicant = h.makeSocket(id);
  await h.send(applicant, "join"); await h.send(applicant, "join");
  assert.equal(applicant.messages.at(-1).status, "pending");
  const requests = host.messages.at(-1).rejoinRequests;
  assert.equal(requests.length, 1);
  assert.equal(applicant.messages.some((m: any) => m.type === "combat_state"), false);
  await h.send(learner, "review_rejoin", { targetId: id, decision: "allow" });
  assert.equal(h.room().snapshot.pendingPlayers?.[id], undefined);
  await h.send(host, "review_rejoin", { targetId: id, decision: "allow" });
  assert.ok(h.room().snapshot.pendingPlayers[id]);
  assert.equal(h.room().snapshot.pendingPlayers[id].characterClass, "wizard");
  await h.send(host, "remove_player", { targetId: id }, "remove-exactly-once");
  assert.ok(h.room().snapshot.pendingPlayers[id], "old removal receipt cannot remove a readmitted player");
  await h.send(host, "remove_player", { targetId: id });
  const again = h.makeSocket(id); await h.send(again, "join");
  await h.send(host, "review_rejoin", { targetId: id, decision: "block" });
  h.restore();
  const blocked = h.makeSocket(id); await h.send(blocked, "join");
  assert.equal(blocked.messages.at(-1).status, "blocked");
  assert.equal(h.room().snapshot.pendingPlayers?.[id], undefined);
  assert.equal(h.room().removals[id].requestedAt, undefined);
});


test("pending applicants may withdraw, and host completion releases remaining approval waiters", async () => {
  const h = moderationHarness(), host = h.makeSocket(fight.teacherId, "teacher");
  await h.send(host, "remove_player", {targetId:id});
  const withdrawn = h.makeSocket(id); await h.send(withdrawn,"join");
  await h.send(withdrawn,"leave_fight");
  assert.equal(h.room().removals[id].requestedAt, undefined);
  assert.equal(withdrawn.messages.at(-1).type,"fight_left");
  const waiting = h.makeSocket(id); await h.send(waiting,"join");
  await h.send(host,"end_fight");
  assert.equal(waiting.messages.at(-1).status,"ended");
  assert.equal(h.room().snapshot.endedByHost,true);
  assert.ok(host.messages.some((m:any)=>m.type === "game_over"));
});


test("removing a selected ally before resolution cancels the action without charging resources or losing the correct answer", () => {
  const s = started("herbalist");
  s.players.other = {...structuredClone(s.players[id]),studentId:"other"};
  s.currentPhase="abilities";
  Object.assign(s.players[id], {hasAnswered:true,lastAnswerCorrect:true,questionAction:{ability:"healing_potion",targetId:"other"}});
  const before=s.players[id].healingPotions;
  const removed=removeStudent(s,"other");
  assert.equal(removed.players[id].questionAction,null);
  const resolved=advancePhase(removed,fight);
  assert.equal(resolved.currentPhase,"question_resolution");
  assert.equal(resolved.players[id].healingPotions,before);
  assert.equal(resolved.players[id].totals.questionsCorrect,1);
});
