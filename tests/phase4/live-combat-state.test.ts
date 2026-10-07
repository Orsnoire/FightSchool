import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CombatSessionObject,
  publicSnapshot,
} from "../../worker/combat/session-object.ts";
import { applyAnswer } from "../../worker/combat/engine.ts";
import { started, fight, student } from "./fixtures.ts";
function harness(initial?: unknown) {
  const data = new Map<string, any>();
  if (initial) data.set("room", structuredClone(initial));
  let alarm: number | null = null;
  const messages: any[] = [];
  const closes: number[] = [];
  const socket = {
    send: (body: string) => messages.push(JSON.parse(body)),
    deserializeAttachment: () => ({
      actorId: student().id,
      role: "student",
      sessionId: "ABC234",
      tokenHash: "test-session-hash",
    }),
    close: (code: number) => closes.push(code),
    serializeAttachment: () => {},
  };
  const state = {
    storage: {
      get: async (k: string) => structuredClone(data.get(k)),
      put: async (k: string, v: any) => {
        data.set(k, structuredClone(v));
      },
      setAlarm: async (n: number) => {
        alarm = n;
      },
      deleteAlarm: async () => {
        alarm = null;
      },
    },
    getWebSockets: () => [socket],
    acceptWebSocket: () => {},
  };
  const object = new CombatSessionObject(state as any, {
    DATABASE_URL: "unused",
  });
  object.setRepository({
    findActiveSession: async () => ({ actorId: student().id, actorType: "student", expiresAt: new Date(Date.now() + 100000) }),
    findStudentById: async () => student(),
    findLiveCombatSession: async () => ({
      teacherId: fight.teacherId,
      status: "active",
    }),
    updateLiveCombatSessionStatus: async () => {},
    persistResults: async () => [],
  } as any);
  return { object, data, messages, socket, closes, alarm: () => alarm };
}
test("revoked sessions cannot continue sending combat commands over an open socket", async () => {
  const h = harness({ fight, snapshot: started(), receipts: [] });
  h.object.setRepository({ findActiveSession: async () => null } as any);
  await h.object.webSocketMessage(h.socket as any, JSON.stringify({ type: "answer", commandId: "revoked-command-1", round: 1, questionId: "q1", answer: "4" }));
  assert.deepEqual(h.closes, [1008]);
  assert.equal(h.data.get("room").snapshot.players[student().id].hasAnswered, false);
});
test("public questions conceal answer correctness until resolution", () => {
  const s = started();
  s.players[student().id].currentAnswer = "4";
  s.players[student().id].lastAnswerCorrect = true;
  const safe = publicSnapshot(s);
  assert.equal(safe.players[student().id].currentAnswer, null);
  assert.equal(safe.players[student().id].lastAnswerCorrect, undefined);
});
test("simultaneous retries are serialized and a rejected command does not consume its id", async () => {
  const s = started();
  s.phaseDeadline = Date.now() + 100000;
  const h = harness({ fight, snapshot: s, receipts: [] });
  const command = {
    type: "answer",
    commandId: "answer-command-001",
    round: 1,
    questionId: "q1",
    answer: "4",
  };
  await Promise.all([
    h.object.webSocketMessage(h.socket as any, JSON.stringify(command)),
    h.object.webSocketMessage(h.socket as any, JSON.stringify(command)),
  ]);
  const room = h.data.get("room");
  assert.equal(room.receipts.length, 1);
  assert.equal(room.snapshot.players[student().id].currentAnswer, "4");
  assert.ok(h.messages.filter((m) => m.type === "command_ack").length === 2);
  await h.object.webSocketMessage(
    h.socket as any,
    JSON.stringify({
      type: "ready",
      commandId: "ready-command-001",
      round: 99,
    }),
  );
  assert.ok(
    !h.data.get("room").receipts.includes(student().id + ":ready-command-001"),
  );
});
test("early alarm is harmless and expired alarm resumes one phase after a new object", async () => {
  const s = started();
  s.phaseDeadline = Date.now() + 100000;
  const h = harness({ fight, snapshot: s, receipts: [] });
  await h.object.alarm();
  assert.equal(h.data.get("room").snapshot.currentPhase, "question");
  s.phaseDeadline = Date.now() - 1;
  const restored = harness({
    fight,
    snapshot: JSON.parse(JSON.stringify(s)),
    receipts: [],
  });
  await restored.object.alarm();
  assert.equal(restored.data.get("room").snapshot.currentPhase, "actions");
  assert.ok(restored.alarm()! > Date.now());
});
test("database failure retries completion without announcing unsaved rewards", async () => {
  const s = started();
  s.currentPhase = "game_over";
  s.victory = true;
  s.phaseDeadline = null;
  const h = harness({ fight, snapshot: s, receipts: [] });
  let attempts = 0;
  h.object.setRepository({
    persistResults: async () => {
      attempts++;
      if (attempts === 1) throw new Error("database outage");
      return [{ studentId: student().id, xpEarned: 10 }];
    },
  } as any);
  await h.object.alarm();
  assert.equal(h.data.get("room").resultsPersisted, undefined);
  assert.ok(h.alarm());
  assert.equal(h.messages.at(-1).type, "result_pending");
  await h.object.alarm();
  assert.equal(h.data.get("room").resultsPersisted, true);
  await h.object.alarm();
  assert.equal(attempts, 2);
});

test("confirming an action and readiness is atomic, including rejection and retry", async () => {
  const s = started("wizard");
  s.phaseDeadline = Date.now() + 100000;
  s.players[student().id].hasAnswered = true;
  // Keep another student pending so the confirmed choice remains in question phase.
  s.players.other = { ...structuredClone(s.players[student().id]), studentId: "other", hasAnswered: false };
  s.players[student().id].mp = 0;
  const h = harness({ fight, snapshot: s, receipts: [] });
  const command = { type: "action", commandId: "confirm-command-001", round: 1, ability: "fireball", targetId: "e1", ready: true };
  await h.object.webSocketMessage(h.socket as any, JSON.stringify(command));
  assert.equal(h.data.get("room").snapshot.players[student().id].ready, false);
  assert.equal(h.data.get("room").receipts.length, 0);
  command.ability = "attack";
  await h.object.webSocketMessage(h.socket as any, JSON.stringify(command));
  await h.object.webSocketMessage(h.socket as any, JSON.stringify(command));
  const room = h.data.get("room");
  assert.equal(room.snapshot.players[student().id].ready, true);
  assert.equal(room.snapshot.players[student().id].questionAction.ability, "attack");
  assert.equal(room.receipts.length, 1);
});

test("question expiry gives a fresh action clock, survives reconnect, then opens a separate support clock", async () => {
  const s = started("wizard");
  s.phaseDeadline = Date.now() - 1;
  const h = harness({ fight, snapshot: s, receipts: [] });
  await h.object.alarm();
  const actions = h.data.get("room").snapshot;
  assert.equal(actions.currentPhase, "actions");
  assert.equal(actions.phaseDeadline - actions.phaseStartTime, 20000);
  assert.equal(actions.players[student().id].lastAnswerCorrect, false);
  assert.equal(publicSnapshot(actions).players[student().id].lastAnswerCorrect, undefined);
  assert.throws(() => applyAnswer(actions, student().id, "4", fight.questions[0]), /unavailable/);
  const restored = harness(h.data.get("room"));
  await restored.object.alarm();
  assert.equal(restored.data.get("room").snapshot.phaseDeadline, actions.phaseDeadline);
  const late = harness({ fight, snapshot: { ...actions, phaseDeadline: Date.now() - 1 }, receipts: [] });
  await late.object.alarm();
  const support = late.data.get("room").snapshot;
  assert.equal(support.currentPhase, "abilities");
  assert.equal(support.phaseDeadline - support.phaseStartTime, 20000);
});

test("an answer at the question deadline leaves twenty seconds to confirm an action", async () => {
  const s = started("wizard");
  s.phaseDeadline = Date.now() + 1000;
  const h = harness({ fight, snapshot: s, receipts: [] });
  await h.object.webSocketMessage(h.socket as any, JSON.stringify({ type: "answer", commandId: "late-answer-001", round: 1, questionId: "q1", answer: "4" }));
  const room = h.data.get("room");
  assert.equal(room.snapshot.currentPhase, "actions");
  assert.ok(room.snapshot.phaseDeadline > s.phaseDeadline + 18000);
  await h.object.webSocketMessage(h.socket as any, JSON.stringify({ type: "action", commandId: "late-choice-001", round: 1, ability: "fireball", targetId: "e1", ready: true }));
  assert.equal(h.data.get("room").snapshot.currentPhase, "abilities");
  assert.equal(h.data.get("room").snapshot.players[student().id].questionAction.ability, "fireball");
  assert.equal(h.data.get("room").snapshot.phaseDeadline - h.data.get("room").snapshot.phaseStartTime, 20000);
});

test("only the room host can resurrect; retries restore exactly one HP without resetting resources or deadlines", async () => {
  const s = started("wizard");
  s.phaseDeadline = Date.now() + 100000;
  s.players[student().id].health = 0;
  s.players[student().id].isDead = true;
  s.players[student().id].mp = 1;
  s.players[student().id].totals.deaths = 2;
  for (const [role, actorId, permitted] of [["student", student().id, false], ["teacher", "other-teacher", false], ["teacher", fight.teacherId, true]] as const) {
    const h = harness({ fight, snapshot: s, receipts: [] });
    const teacherSocket = { ...h.socket, deserializeAttachment: () => ({ actorId, role, sessionId: "ABC234", tokenHash: "test-session-hash" }) };
    h.object.setRepository({
      findActiveSession: async () => ({ actorId, actorType: role }),
      findLiveCombatSession: async () => ({ teacherId: fight.teacherId, status: "active" }),
    } as any);
    const command = JSON.stringify({ type: "resurrect", commandId: "host-revive-001", round: 1, targetId: student().id });
    await h.object.webSocketMessage(teacherSocket as any, command);
    await h.object.webSocketMessage(teacherSocket as any, command);
    const room = h.data.get("room");
    assert.equal(room.snapshot.players[student().id].health, permitted ? 1 : 0);
    assert.equal(room.snapshot.players[student().id].isDead, !permitted);
    assert.equal(room.snapshot.players[student().id].mp, 1);
    assert.equal(room.snapshot.players[student().id].totals.deaths, 2);
    assert.equal(room.snapshot.phaseDeadline, s.phaseDeadline);
    assert.equal(room.receipts.length, permitted ? 1 : 0);
    assert.equal(room.snapshot.events.filter((e: any) => e.actorId === "host").length, permitted ? 1 : 0);
    if (permitted) {
      const restored = harness(room);
      await restored.object.alarm();
      assert.equal(restored.data.get("room").snapshot.players[student().id].health, 1);
    } else assert.match(h.messages.at(-1).error, /Teacher role required|Only the host/);
  }
});

test("student leave removes only the authenticated player and unblocks each input phase; retries survive recovery", async () => {
  for (const phase of ["question", "actions", "abilities"] as const) {
    const s = started();
    s.currentPhase = phase;
    s.phaseDeadline = Date.now() + 100000;
    s.players.other = { ...structuredClone(s.players[student().id]), studentId: "other", nickname: "Remaining", hasAnswered: true, ready: true };
    const h = harness({ fight, snapshot: s, receipts: [] });
    const command = JSON.stringify({ type: "leave_fight", commandId: "leave-command-001", round: 999, targetId: "other" });
    await h.object.webSocketMessage(h.socket as any, command);
    const room = h.data.get("room");
    assert.equal(room.snapshot.players[student().id], undefined);
    assert.ok(room.snapshot.players.other, "payload cannot remove another student");
    assert.equal(room.snapshot.currentPhase, phase === "question" ? "actions" : phase === "actions" ? "abilities" : "question_resolution");
    assert.equal(room.receipts.length, 1);
    assert.ok(h.messages.some(m => m.type === "fight_left"));
    const restored = harness(room);
    await restored.object.webSocketMessage(restored.socket as any, command);
    assert.equal(restored.data.get("room").snapshot.currentPhase, room.snapshot.currentPhase);
    assert.equal(restored.messages.at(-1).type, "fight_left");
    await restored.object.webSocketMessage(restored.socket as any, JSON.stringify({ type: "join", commandId: "rejoin-command-1" }));
    assert.ok(restored.data.get("room").snapshot.pendingPlayers[student().id], "re-entry waits for the next question");
  }
});

test("leave preserves completed rewards, ends an empty active fight, and leaves an empty waiting lobby open", async () => {
  for (const phase of ["waiting", "question", "game_over"] as const) {
    const s = started();
    s.currentPhase = phase;
    s.phaseDeadline = phase === "question" ? Date.now() + 100000 : null;
    const h = harness({ fight, snapshot: s, receipts: [], ...(phase === "game_over" ? { resultsPersisted: true, results: [{ studentId: student().id, xpEarned: 10 }] } : {}) });
    await h.object.webSocketMessage(h.socket as any, JSON.stringify({ type: "leave_fight", commandId: "leave-final-001" }));
    const room = h.data.get("room");
    assert.equal(room.snapshot.currentPhase, phase === "waiting" ? "waiting" : "game_over");
    assert.equal(h.alarm(), null);
    if (phase === "game_over") {
      assert.equal(room.results[0].xpEarned, 10);
      assert.ok(room.snapshot.players[student().id]);
    } else assert.equal(Object.keys(room.snapshot.players).length, 0);
    if (phase === "question") assert.equal(room.resultsPersisted, true);
  }
});

test("a teacher cannot issue a student departure", async () => {
  const h = harness({ fight, snapshot: started(), receipts: [] });
  const socket = { ...h.socket, deserializeAttachment: () => ({ actorId: fight.teacherId, role: "teacher", sessionId: "ABC234", tokenHash: "test-session-hash" }) };
  h.object.setRepository({ findActiveSession: async () => ({ actorId: fight.teacherId, actorType: "teacher" }) } as any);
  await h.object.webSocketMessage(socket as any, JSON.stringify({ type: "leave_fight", commandId: "teacher-leave-001" }));
  assert.match(h.messages.at(-1).error, /Student role required/);
  assert.ok(h.data.get("room").snapshot.players[student().id]);
});
