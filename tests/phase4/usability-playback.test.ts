import { recordAttempt } from "../../shared/combat/attempts";
import { reportingSignature } from "../../worker/db/session-reporting";
import assert from "node:assert/strict";
import { test } from "node:test";
import { roomFixture } from "../support/room-costs";
import { advancePhase, applyAnswer } from "../../worker/combat/engine";
import {
  abilityEffect,
  displayedHealth,
  playbackCues,
  playbackDuration,
} from "../../shared/combat/presentation";
import {
  recolorPixels,
  equipmentVisualSchema,
  validVisualSlot,
} from "../../shared/avatar/visuals";
import { publicSnapshot } from "../../worker/combat/public-snapshot";
import { fight, started, student } from "./fixtures";
const command = (type: string, payload = {}) =>
  JSON.stringify({ type, commandId: crypto.randomUUID(), ...payload });
test("resolution batches preserve deterministic rules and input clocks with impact HP and rapid order", () => {
  let state = applyAnswer(started(), student().id, "4", fight.questions[0]);
  state = advancePhase(state, fight, 100);
  assert.equal(state.currentPhase, "answer_feedback");
  assert.equal(state.phaseDeadline, 4100);
  state = advancePhase(state, fight, 500);
  assert.equal(state.phaseDeadline, 20500);
  state = advancePhase(state, fight, 600);
  assert.equal(state.phaseDeadline, 20600);
  const before = structuredClone(state),
    resolved = advancePhase(state, fight, 700);
  assert.deepEqual(
    resolved,
    advancePhase(JSON.parse(JSON.stringify(state)), fight, 700),
  );
  assert.deepEqual(state, before);
  assert.equal(resolved.phaseDeadline, null);
  assert.ok(resolved.playback);
  const cues = playbackCues(resolved.playback!, resolved.events);
  assert.ok(cues.length);
  const hit = cues.find((c) => c.event.type === "damage")!;
  assert.ok(hit);
  assert.equal(
    displayedHealth(resolved.playback!, resolved.events, hit.impactMs - 1)[
      hit.event.targetId
    ],
    hit.event.healthBefore,
  );
  assert.equal(
    displayedHealth(resolved.playback!, resolved.events, hit.impactMs)[
      hit.event.targetId
    ],
    hit.event.healthAfter,
  );
  assert.equal(publicSnapshot(resolved).playback?.id, resolved.playback!.id);
  assert.equal(abilityEffect("webbing"), "web");
  assert.equal(abilityEffect("freezing_touch"), "ice");
  assert.equal(abilityEffect("vampiric_bite"), "bite");
  assert.equal(
    abilityEffect("attack", { characterClass: "warrior", weaponKind: "bow" }),
    "arrow",
  );
});
for (const count of [30, 60])
  test(`${count} participants automatically complete each batch; stale reports do not advance`, async () => {
    const f = roomFixture(count),
      room = f.saved();
    room.fight.enemies[0].difficultyMultiplier = 100;
    room.snapshot.enemies.forEach((e: any) => {
      e.health = e.maxHealth = 10000;
    });
    room.snapshot.currentPhase = "abilities";
    room.snapshot.phaseDeadline = Date.now() + 20000;
    for (const p of Object.values(room.snapshot.players) as any[]) {
      p.hasAnswered = true;
      p.lastAnswerCorrect = true;
      p.ready = true;
      p.questionAction = {
        ability: p.characterClass === "priest" ? "first_aid" : "attack",
        targetId:
          p.characterClass === "priest"
            ? p.studentId
            : room.snapshot.enemies[0].id,
      };
    }
    room.snapshot.players[f.students[0].id].ready = false;
    f.save(room);
    await f.obj.webSocketMessage(f.players[0], command("ready", { round: 1 }));
    const resolved = f.saved(),
      batch = resolved.snapshot.playback;
    assert.ok(batch);
    assert.equal(resolved.snapshot.currentPhase, "question_resolution");
    assert.equal(resolved.snapshot.phaseDeadline, null);
    assert.ok(
      playbackDuration(batch, resolved.snapshot.events) <= count * 150 + 700,
    );
    const obj = f.object();
    await obj.webSocketMessage(
      f.host,
      command("playback_complete", { round: 1, batchId: "old-batch" }),
    );
    assert.equal(f.saved().snapshot.playback.id, batch.id);
    for (const socket of f.players)
      await obj.webSocketMessage(
        socket,
        command("playback_complete", { round: 1, batchId: batch.id }),
      );
    assert.equal(
      f.saved().snapshot.currentPhase,
      "question_resolution",
      "host renderer remains",
    );
    await obj.webSocketMessage(
      f.host,
      command("playback_complete", { round: 1, batchId: batch.id }),
    );
    assert.equal(f.saved().snapshot.currentPhase, "enemy_ai");
    const enemyBatch = f.saved().snapshot.playback;
    await obj.webSocketMessage(
      f.host,
      command("playback_complete", { round: 1, batchId: batch.id }),
    );
    assert.equal(f.saved().snapshot.playback.id, enemyBatch.id);
    for (const socket of [...f.players, f.host])
      await obj.webSocketMessage(
        socket,
        command("playback_complete", { round: 1, batchId: enemyBatch.id }),
      );
    assert.equal(f.saved().snapshot.currentPhase, "question");
    assert.equal(f.saved().snapshot.round, 2);
    assert.ok(f.saved().snapshot.phaseDeadline > Date.now());
  });
test("disconnected renderer and recovery watchdog release a saved playback gate", async () => {
  const f = roomFixture(1),
    room = f.saved();
  room.snapshot.currentPhase = "abilities";
  room.snapshot.players[f.students[0].id].hasAnswered = true;
  room.snapshot.players[f.students[0].id].lastAnswerCorrect = true;
  room.snapshot.players[f.students[0].id].questionAction = {
    ability: "attack",
    targetId: room.snapshot.enemies[0].id,
  };
  f.save(room);
  await f.obj.webSocketMessage(f.players[0], command("ready", { round: 1 }));
  const batch = f.saved().snapshot.playback;
  await f.obj.webSocketMessage(
    f.host,
    command("playback_complete", { round: 1, batchId: batch.id }),
  );
  f.players[0].readyState = 3;
  await f.obj.webSocketClose(f.players[0]);
  assert.notEqual(f.saved().snapshot.playback?.id, batch.id);
  const waiting = f.saved();
  if (waiting.playbackGate) {
    waiting.playbackGate.recoveryAt = Date.now() - 1;
    f.save(waiting);
    await f.object().alarm();
    assert.notEqual(
      f.saved().snapshot.playback?.id,
      waiting.snapshot.playback?.id,
    );
  }
});
test("classroom answer burst checkpoints evidence and projects once when the question closes", async () => {
  const f = roomFixture(30, false), room = f.saved();
  room.reportingSignature = reportingSignature(room.snapshot);
  f.save(room);
  const projected: any[] = [];
  let acknowledged = false;
  const send = f.players[0].send;
  f.players[0].send = (raw: string) => {
    if (JSON.parse(raw).type === "command_ack") {
      assert.equal(f.saved().snapshot.pendingAttempts.length, 1);
      acknowledged = true;
    }
    send(raw);
  };
  f.repository.recordSessionReporting = async (state: any) => projected.push(structuredClone(state));
  const answer = () => command("answer", { round: 1, questionId: room.fight.questions[0].id, answer: "4" });
  await f.obj.webSocketMessage(f.players[0], answer());
  assert.equal(projected.length, 0, "Do not run reporting SQL on each individual answer");
  assert.equal(f.saved().snapshot.pendingAttempts.length, 1, "Acknowledged evidence remains durably checkpointed");
  assert.ok(acknowledged, "Acknowledgement follows the durable checkpoint");
  const restored = f.object();
  await Promise.all(f.players.slice(1).map(socket => restored.webSocketMessage(socket, answer())));
  assert.equal(f.saved().snapshot.currentPhase, "answer_feedback");
  assert.equal(projected.length, 1);
  assert.equal(projected[0].pendingAttempts.length, 30, "The single projection includes the pre-restart answer");
  assert.deepEqual(f.saved().snapshot.pendingAttempts, []);
  assert.equal(f.costs.auth, 30, "Every answer still rechecks session revocation");
});
test("reporting outbox survives SQL failure and object restoration before clearing confirmed attempts", async () => {
  const f = roomFixture(1);
  let fail = true,
    calls = 0;
  f.repository.recordSessionReporting = async (s: any) => {
    calls++;
    assert.ok(s.pendingAttempts.length);
    if (fail) throw Error("fixture database unavailable");
  };
  const obj = f.object();
  await obj.webSocketMessage(
    f.players[0],
    command("answer", {
      round: 1,
      questionId: f.room.fight.questions[0].id,
      answer: "4",
    }),
  );
  assert.ok(f.saved().reportingPending);
  assert.equal(f.saved().snapshot.pendingAttempts.length, 1);
  fail = false;
  await f.object().alarm();
  assert.equal(f.saved().reportingPending, false);
  assert.deepEqual(f.saved().snapshot.pendingAttempts, []);
  assert.ok(calls >= 2);
});
test("palette validation and pixel recoloring preserve alpha, ink, highlights and reserved skin", () => {
  const pixels = new Uint8ClampedArray([
    90, 120, 200, 255, 10, 10, 10, 255, 250, 250, 250, 255, 180, 0, 180, 255,
    100, 100, 100, 0,
  ]);
  const before = pixels.slice();
  recolorPixels(pixels, { primary: "#ff0000" }, true);
  assert.notDeepEqual(pixels.slice(0, 3), before.slice(0, 3));
  assert.equal(pixels[3], 255);
  assert.deepEqual(pixels.slice(4), before.slice(4));
  assert.equal(
    equipmentVisualSchema.safeParse({
      baseItemId: "not-a-sprite",
      palette: { primary: "#ff0000" },
    }).success,
    false,
  );
  const visual = equipmentVisualSchema.parse({
    baseItemId: "basic_armor",
    palette: { primary: "#ff0000" },
  });
  assert.ok(validVisualSlot(visual, "armor"));
  assert.ok(!validVisualSlot(visual, "weapon"));
});

test("a full classroom timeout references rich questions without duplicating HTML in the outbox", () => {
  const f = roomFixture(60),
    state = f.saved().snapshot;
  const rich = {
    ...fight.questions[0],
    question: "<p>Detailed question content.</p>".repeat(500),
  };
  for (const p of Object.values(state.players))
    recordAttempt(state, p as any, rich, false);
  assert.equal(state.pendingAttempts.length, 60);
  assert.ok(JSON.stringify(state.pendingAttempts).length < 25000);
  assert.equal(
    JSON.stringify(state.pendingAttempts).includes("Detailed question content"),
    false,
  );
});
