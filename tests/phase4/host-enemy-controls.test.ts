import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, advancePhase, eliminateEnemy, initialCombatState, nextWave, scaleEncounter, startQuestion } from "../../worker/combat/engine";
import { CombatSessionObject } from "../../worker/combat/session-object";
import { activeEnemies, canAdvanceWave } from "../../shared/combat/encounters";
import { fight, student } from "./fixtures";
import type { FightRecord } from "../../worker/db/schema";

const template: FightRecord = { ...fight, encounterTier: 1, enemies: [
  { ...fight.enemies[0], enemyType: "ghost", quantity: 2, wave: 1, role: "normal" },
  { ...fight.enemies[0], id: "boss", enemyType: "samhain", quantity: 1, wave: 2, role: "boss" },
] };
function setup() { return startQuestion(scaleEncounter(addStudent(initialCombatState("ABC234", template), student()), template)); }

test("elimination releases hypnosis, retains player credit and reaches victory only after all waves", () => {
  const state = setup(), id = student().id;
  state.players[id].statuses = [{ type: "hypnosis", sourceId: "e1:1", appliedRound: 1 }];
  const before = structuredClone(state);
  const first = eliminateEnemy(state, "e1:1");
  assert.deepEqual(state, before);
  assert.equal(first.enemies[0].health, 0);
  assert.equal(first.players[id].statuses?.length || 0, 0);
  assert.deepEqual(first.players[id].totals, before.players[id].totals);
  assert.equal(first.phaseDeadline, before.phaseDeadline);
  assert.equal(first.victory, null);
  assert.throws(() => eliminateEnemy(first, "e1:1"), /living enemy/);
  assert.throws(() => eliminateEnemy(first, "boss:1"), /active wave/);
  const cleared = eliminateEnemy(first, "e1:2");
  assert.equal(activeEnemies(cleared).length, 0);
  const between = advancePhase({ ...cleared, currentPhase: "enemy_ai" }, template);
  assert.equal(between.currentPhase, "wave_break");
  assert.equal(between.activeWave, 2);
  const won = eliminateEnemy(between, "boss:1");
  assert.equal(won.currentPhase, "game_over");
  assert.equal(won.victory, true);
  assert.equal(won.phaseDeadline, null);
  assert.deepEqual(won.players[id].totals, before.players[id].totals);
  assert.throws(() => eliminateEnemy({ ...state, currentPhase: "waiting" }, "e1:1"), /not active/);
});

test("Next wave clears only the current wave, preserves future HP and starts one new round without fabricated participation", () => {
  const state = setup(), before = structuredClone(state);
  const next = nextWave(state, template, 5000);
  assert.deepEqual(state, before);
  assert.equal(next.enemies[0].health, 0);
  assert.equal(next.enemies[1].health, 0);
  assert.deepEqual(next.enemies[2], before.enemies[2]);
  assert.equal(next.activeWave, 2);
  assert.equal(next.currentPhase, "question");
  assert.equal(next.round, state.round + 1);
  assert.equal(next.questionStartTime, 8000);
  assert.equal(next.completedRounds, state.completedRounds);
  assert.deepEqual(next.players[student().id].totals, state.players[student().id].totals);
  assert.equal(next.players[student().id].roundsParticipated, 0);
  assert.equal(canAdvanceWave(next), false);
  assert.throws(() => nextWave(next, template), /No next wave/);
  assert.equal(canAdvanceWave({ ...state, enemyDisplayMode: "simultaneous" }), false);
  assert.equal(canAdvanceWave({ ...state, currentPhase: "waiting" }), false);
  const between = { ...next, currentPhase: "wave_break" as const, phaseDeadline: null };
  const opened = nextWave(between, template, 10000);
  assert.equal(opened.round, between.round);
  assert.equal(opened.enemies[2].health, before.enemies[2].health);
  assert.equal(opened.currentPhase, "question");
});

function harness() {
  let room: any = { fight: template, snapshot: setup(), receipts: [] }, saves = 0;
  let revoked = false;
  const sockets: any[] = [];
  const socket = (actorId: string, role = "student") => {
    const messages: any[] = [];
    const ws = { messages, closed: false, send: (raw: string) => messages.push(JSON.parse(raw)), close: () => { ws.closed = true; }, serializeAttachment: () => {}, deserializeAttachment: () => ({ actorId, role, sessionId: "ABC234", tokenHash: actorId }) };
    sockets.push(ws); return ws;
  };
  const durable = { storage: { get: async () => structuredClone(room), put: async (_: string, value: any) => { room = structuredClone(value); }, setAlarm: async () => {}, deleteAlarm: async () => {} }, getWebSockets: () => sockets };
  const create = () => {
    const object = new CombatSessionObject(durable as any, { DATABASE_URL: "unused" });
    object.setRepository({ findActiveSession: async (id: string) => revoked ? null : ({ actorId: id, actorType: [fight.teacherId, "imposter"].includes(id) ? "teacher" : "student" }),
      findLiveCombatSession: async () => ({ teacherId: fight.teacherId, status: "active" }), persistResults: async () => { saves++; return []; } } as any);
    return object;
  };
  let object = create(), seq = 0;
  return { socket, room: () => room, saves: () => saves, revoke: () => { revoked = true; }, restore: () => { object = create(); },
    send: (ws: any, type: string, payload = {}, commandId = `host-control-${++seq}`) => object.webSocketMessage(ws, JSON.stringify({ type, commandId, round: room.snapshot.round, phase: room.snapshot.currentPhase, ...payload })) };
}

test("host controls reject students, other teachers, stale commands and revoked sessions; retries survive restoration", async () => {
  const h = harness(), host = h.socket(fight.teacherId, "teacher"), learner = h.socket(student().id), imposter = h.socket("imposter", "teacher");
  const before = structuredClone(h.room().snapshot);
  for (const type of ["eliminate_enemy", "next_wave"]) for (const ws of [learner, imposter]) {
    await h.send(ws, type, { targetId: "e1:1" });
    assert.equal(ws.messages.at(-1).type, "protocol_error");
    assert.deepEqual(h.room().snapshot, before);
  }
  await h.send(host, "eliminate_enemy", { targetId: "e1:1", round: 99 });
  assert.equal(host.messages.at(-1).type, "protocol_error");
  await h.send(host, "next_wave", { phase: "wave_break" });
  assert.equal(host.messages.at(-1).type, "protocol_error");
  assert.deepEqual(h.room().snapshot, before);
  await h.send(host, "next_wave", {}, "next-wave-once");
  assert.equal(h.room().snapshot.activeWave, 2);
  const next = structuredClone(h.room().snapshot);
  h.restore();
  await h.send(host, "next_wave", { round: 1 }, "next-wave-once");
  assert.deepEqual(h.room().snapshot, next);
  await h.send(host, "eliminate_enemy", { targetId: "boss:1", round: 1 });
  assert.equal(host.messages.at(-1).type, "protocol_error");
  assert.deepEqual(h.room().snapshot, next);
  h.revoke();
  await h.send(host, "eliminate_enemy", { targetId: "boss:1" });
  assert.equal(host.closed, true);
  assert.deepEqual(h.room().snapshot, next);
});

test("host elimination broadcasts defeat, saves victory once and preserves the result through reconnect/retry", async () => {
  const h = harness(), host = h.socket(fight.teacherId, "teacher"), learner = h.socket(student().id);
  await h.send(host, "eliminate_enemy", { targetId: "e1:1" }, "kill-enemy-once");
  const defeated = structuredClone(h.room().snapshot);
  assert.equal(learner.messages.filter((m: any) => m.type === "combat_state").at(-1).state.enemies[0].health, 0);
  h.restore();
  await h.send(host, "eliminate_enemy", { targetId: "e1:1" }, "kill-enemy-once");
  assert.deepEqual(h.room().snapshot, defeated);
  await h.send(host, "next_wave");
  await h.send(host, "eliminate_enemy", { targetId: "boss:1" }, "kill-final-once");
  assert.equal(h.room().snapshot.victory, true);
  assert.equal(h.saves(), 1);
  assert.equal(learner.messages.at(-1).type, "game_over");
  const won = structuredClone(h.room().snapshot);
  h.restore();
  await h.send(host, "eliminate_enemy", { targetId: "boss:1" }, "kill-final-once");
  assert.deepEqual(h.room().snapshot, won);
  assert.equal(h.saves(), 1);
});
