import assert from "node:assert/strict";
import { test } from "node:test";
import { addStudent, initialCombatState, scaleEncounter, startQuestion } from "../../worker/combat/engine.ts";
import { CombatSessionObject, publicSnapshot } from "../../worker/combat/session-object.ts";
import type { CombatSnapshot } from "../../shared/combat/model.ts";
import type { FightRecord } from "../../worker/db/schema.ts";
import { fight, student } from "./fixtures.ts";

const swarm: FightRecord = {
  ...fight,
  encounterTier: 1,
  questions: Array.from({ length: 10 }, (_, i) => ({ ...fight.questions[0], id: `q${i}` })),
  enemies: [{ ...fight.enemies[0], name: "Goblin", enemyType: "goblin", species: "goblin", role: "trash", quantity: 25, difficultyMultiplier: 5 }],
};
const hp = (s: CombatSnapshot) => s.enemies.map(e => [e.id, e.health, e.maxHealth]);

test("waiting HP matches Start Fight for legacy fights and 25-goblin swarms without mutating room state", () => {
  for (const template of [fight, swarm]) {
    for (const count of [1, 2, 4, 30]) {
      let s = initialCombatState("ABC234", template);
      for (let i = 0; i < count; i++) s = addStudent(s, student(i % 2 ? "wizard" : "warrior", `p${i}`), { levels: { warrior: 2, wizard: 2 } });
      const before = structuredClone(s);
      const preview = publicSnapshot(s, template);
      const started = startQuestion(scaleEncounter(s, template));
      assert.deepEqual(hp(preview), hp(started), `${count} players, ${template === swarm ? "swarm" : "legacy"}`);
      assert.deepEqual(s, before, "projection cannot start, scale or otherwise mutate the stored room");
      assert.equal(preview.currentPhase, "waiting");
      assert.equal(preview.encounterAttendance, undefined);
      assert.equal(preview.entryPerformance, undefined);
      assert.equal(preview.encounterXpFraction, undefined);
      assert.equal(preview.enemies[0].ai, undefined);
      assert.equal(preview.seed, 0);
      assert.notDeepEqual(hp(preview), hp(before), "preview must replace placeholder values");
    }
  }
});

test("empty rooms and combat already in progress are not rescaled by public projection", () => {
  const empty = initialCombatState("ABC234", swarm);
  assert.deepEqual(hp(publicSnapshot(empty, swarm)), hp(empty));
  const s = startQuestion(scaleEncounter(addStudent(empty, student()), swarm));
  s.enemies[0].health = 0;
  s.enemies[1].health /= 2;
  const before = structuredClone(s);
  assert.deepEqual(hp(publicSnapshot(s, swarm)), hp(s));
  assert.deepEqual(s, before);
});

function harness() {
  let room: any = { fight: swarm, snapshot: initialCombatState("ABC234", swarm), receipts: [] };
  const sockets: any[] = [];
  const socket = (actorId: string, role = "student") => {
    const messages: any[] = [];
    const ws = { messages, send: (raw: string) => messages.push(JSON.parse(raw)), close: () => {}, serializeAttachment: () => {}, deserializeAttachment: () => ({ actorId, role, sessionId: "ABC234", tokenHash: actorId }) };
    sockets.push(ws);
    return ws;
  };
  const state = { storage: { get: async () => structuredClone(room), put: async (_: string, value: unknown) => { room = structuredClone(value); }, setAlarm: async () => {}, deleteAlarm: async () => {} }, getWebSockets: () => sockets };
  const create = () => {
    const object = new CombatSessionObject(state as any, { DATABASE_URL: "unused" });
    object.setRepository({
      findActiveSession: async (id: string) => ({ actorId: id, actorType: id === fight.teacherId ? "teacher" : "student" }),
      findLiveCombatSession: async () => ({ teacherId: fight.teacherId, status: "waiting" }),
      findStudentById: async (id: string) => student("warrior", id),
      getCombatProfile: async () => ({ levels: { warrior: 2 } }),
      updateLiveCombatSessionStatus: async () => {},
    } as any);
    return object;
  };
  let object = create(), seq = 0;
  return { socket, room: () => room, restore: () => { object = create(); }, send: (ws: any, type: string) => object.webSocketMessage(ws, JSON.stringify({ type, commandId: `preview-command-${++seq}` })) };
}

test("host/student broadcasts, departures and restored-host snapshots preview the exact eventual starting HP", async () => {
  const h = harness();
  const host = h.socket(fight.teacherId, "teacher");
  const learners = Array.from({ length: 4 }, (_, i) => h.socket(`p${i}`));
  const latest = (ws: any) => ws.messages.filter((m: any) => m.type === "combat_state").at(-1).state as CombatSnapshot;
  for (const learner of learners) {
    await h.send(learner, "join");
    assert.deepEqual(hp(latest(host)), hp(scaleEncounter(h.room().snapshot, swarm)));
    assert.deepEqual(hp(latest(learner)), hp(latest(host)));
    assert.equal(h.room().snapshot.enemies[0].maxHealth, 50, "preview must not persist scaled HP");
    assert.equal(h.room().snapshot.encounterAttendance, undefined);
  }
  const four = hp(latest(host));
  await h.send(learners[3], "leave_fight");
  assert.notDeepEqual(hp(latest(host)), four);
  assert.deepEqual(hp(latest(host)), hp(scaleEncounter(h.room().snapshot, swarm)));
  h.restore();
  await h.send(host, "host");
  const recovered = host.messages.filter((m: any) => m.type === "session_created").at(-1).state;
  assert.deepEqual(hp(recovered), hp(latest(host)), "initial/reconnected host snapshot must use the same preview");
  const preview = hp(latest(host));
  await h.send(host, "start_fight");
  assert.equal(h.room().snapshot.currentPhase, "question");
  assert.deepEqual(hp(h.room().snapshot), preview);
  assert.deepEqual(hp(latest(host)), preview);
});
