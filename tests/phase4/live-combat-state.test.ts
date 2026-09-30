import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CombatSessionObject,
  publicSnapshot,
} from "../../worker/combat/session-object.ts";
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
  assert.equal(restored.data.get("room").snapshot.currentPhase, "abilities");
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
