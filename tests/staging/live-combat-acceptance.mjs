import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
const origin = (
  process.env.STAGING_ORIGIN ||
  "https://questacademy.bookwyrminteractive.studio"
).replace(/\/$/, "");
const suffix = Date.now().toString(36) + randomUUID().slice(0, 6),
  password = `Acceptance-${randomUUID()}!`;
const sockets = [];
async function api(path, { method = "GET", cookie, body, status = 200 } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Accept: "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  assert.ok(
    [status].flat().includes(response.status),
    `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`,
  );
  return { payload, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
class Actor {
  constructor(cookie, sessionId) {
    this.messages = [];
    this.socket = new WebSocket(
      origin.replace(/^http/, "ws") + `/ws?sessionId=${sessionId}`,
      { headers: { Cookie: cookie }, origin },
    );
    sockets.push(this.socket);
    this.socket.on("message", (b) =>
      this.messages.push(JSON.parse(b.toString())),
    );
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.once("open", resolve);
      this.socket.once("error", reject);
    });
  }
  send(type, fields = {}, commandId = randomUUID()) {
    this.socket.send(JSON.stringify({ type, commandId, ...fields }));
    return commandId;
  }
  async wait(predicate, timeout = 30000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = this.messages.find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(
      `Timed out waiting for combat event; last event types: ${this.messages.slice(-8).map((m) => m.type)}`,
    );
  }
  state(round, phase) {
    return this.wait(
      (m) =>
        m.type === "combat_state" &&
        m.state.round === round &&
        m.state.currentPhase === phase,
    );
  }
}
const teacherBody = (i) => ({
  firstName: "Acceptance",
  lastName: `Test ${i}`,
  email: `qa-${suffix}-${i}@example.invalid`,
  password,
  billingAddress: "Acceptance fixture",
  schoolDistrict: "Acceptance",
  school: "Acceptance",
  subject: "Math",
  gradeLevel: "5",
});
try {
  const teacher = await api("/api/teacher/signup", {
    method: "POST",
    body: teacherBody(1),
    status: [200, 201],
  });
  const other = await api("/api/teacher/signup", {
    method: "POST",
    body: teacherBody(2),
    status: [200, 201],
  });
  const teacherId = teacher.payload.id || teacher.payload.teacher?.id;
  assert.ok(teacherId);
  const student = await api("/api/student/login", {
    method: "POST",
    body: { nickname: `qa-${suffix}-student`, password },
  });
  const studentId = student.payload.id;
  await api(`/api/student/${studentId}/character`, {
    method: "PATCH",
    cookie: student.cookie,
    body: { characterClass: "wizard", gender: "A" },
  });
  const item = await api("/api/equipment-items", {
    method: "POST",
    cookie: teacher.cookie,
    body: {
      name: "Acceptance wand",
      itemType: "wand",
      weaponType: "staff",
      quality: "common",
      slot: "weapon",
      tier: 1,
      stats: { mat: 1 },
      shopPrice: 1,
    },
    status: 201,
  });
  const guild = await api("/api/guilds", {
    method: "POST",
    cookie: teacher.cookie,
    body: {
      name: `Acceptance ${suffix}`,
      description: "Isolated migration acceptance fixture",
    },
    status: 201,
  });
  const guildId = guild.payload.id;
  await api(`/api/guilds/${guildId}/members`, {
    method: "POST",
    cookie: student.cookie,
    body: { studentId },
  });
  await api(`/api/guilds/${guildId}/members`, {
    cookie: other.cookie,
    status: 403,
  });
  const quest = await api(`/api/guilds/${guildId}/quests`, {
    method: "POST",
    cookie: teacher.cookie,
    body: {
      title: "Acceptance manual reward",
      description: "Test exactly once quest award",
      criteria: { type: "custom" },
      rewards: { gold: 2 },
    },
    status: 201,
  });
  await api(`/api/guilds/${guildId}/quests/${quest.payload.id}`, {
    method: "PATCH",
    cookie: teacher.cookie,
    body: { isCompleted: true },
  });
  await api(`/api/guilds/${guildId}/quests/${quest.payload.id}`, {
    method: "PATCH",
    cookie: teacher.cookie,
    body: { isCompleted: true },
  });
  assert.equal(
    (await api(`/api/student/${studentId}`, { cookie: student.cookie })).payload
      .gold,
    2,
  );
  await api(`/api/student/${studentId}/purchase-item`, {
    method: "POST",
    cookie: student.cookie,
    body: { itemId: item.payload.id },
  });
  await api(`/api/student/${studentId}/purchase-item`, {
    method: "POST",
    cookie: student.cookie,
    body: { itemId: item.payload.id },
    status: 409,
  });
  await api(`/api/student/${studentId}/equipment`, {
    method: "PATCH",
    cookie: student.cookie,
    body: { weapon: item.payload.id },
  });
  const fight = await api("/api/fights", {
    method: "POST",
    cookie: teacher.cookie,
    body: {
      teacherId,
      title: `Migration acceptance ${suffix}`,
      questions: [
        {
          id: "q1",
          type: "short_answer",
          question: "What is 2+2?",
          correctAnswer: "4",
          timeLimit: 30,
        },
      ],
      enemies: [
        {
          id: "e1",
          name: "Acceptance slime",
          image: "/favicon.png",
          difficultyMultiplier: 1,
        },
      ],
      baseXP: 10,
      baseEnemyDamage: 1,
      enemyDisplayMode: "consecutive",
      lootTable: [{ itemId: item.payload.id }],
      randomizeQuestions: false,
      shuffleOptions: true,
    },
    status: 201,
  });
  await api(`/api/guilds/${guildId}/fights`, {
    method: "POST",
    cookie: teacher.cookie,
    body: { fightId: fight.payload.id },
  });
  await api(`/api/fights/${fight.payload.id}`, {
    cookie: other.cookie,
    status: 403,
  });
  await api(`/api/fights/${fight.payload.id}`, {
    cookie: student.cookie,
    status: 401,
  });
  const room = await api(`/api/fights/${fight.payload.id}/sessions`, {
    method: "POST",
    cookie: teacher.cookie,
    status: [200, 201],
  });
  const host = new Actor(teacher.cookie, room.payload.sessionId);
  await host.open();
  host.send("host");
  await host.wait((m) => m.type === "session_created");
  const player = new Actor(student.cookie, room.payload.sessionId);
  await player.open();
  player.send("join");
  await player.state(1, "waiting");
  host.send("start_fight");
  const opened = await player.state(1, "question");
  assert.ok(!JSON.stringify(opened).includes("correctAnswer"));
  await new Promise((r) => setTimeout(r, 3100));
  const duplicateId = player.send("answer", {
    round: 1,
    questionId: "q1",
    answer: "wrong",
  });
  player.send(
    "answer",
    { round: 1, questionId: "q1", answer: "wrong" },
    duplicateId,
  );
  await player.wait(
    (m) => m.type === "command_ack" && m.commandId === duplicateId,
  );
  player.send("action", { round: 1, ability: "fireball", targetId: "e1", ready: true });
  await player.state(1, "abilities");
  player.send("ready", { round: 1 });
  const wrong = await player.state(1, "question_resolution");
  assert.equal(wrong.state.players[studentId].mp, opened.state.players[studentId].mp,
    "An incorrect answer must not spend the selected Fireball's MP");
  assert.equal(wrong.state.enemies[0].health, opened.state.enemies[0].maxHealth);
  assert.ok(
    wrong.state.players[studentId].health <
      wrong.state.players[studentId].maxHealth,
  );
  // Accelerate visual feedback phases through the authorized teacher control.
  await api(`/api/combat/${room.payload.sessionId}/force-question`, {
    method: "POST",
    cookie: teacher.cookie,
  });
  await player.state(1, "enemy_ai");
  await api(`/api/combat/${room.payload.sessionId}/force-question`, {
    method: "POST",
    cookie: teacher.cookie,
  });
  const next = await player.state(2, "question");
  assert.equal(next.state.victory, null);
  assert.equal(next.state.currentQuestionIndex, 0);
  player.socket.close();
  const restored = new Actor(student.cookie, room.payload.sessionId);
  await restored.open();
  restored.send("join");
  const restoredState = await restored.state(2, "question");
  assert.equal(restoredState.state.phaseDeadline, next.state.phaseDeadline);
  assert.equal(
    restoredState.state.players[studentId].health,
    next.state.players[studentId].health,
  );
  const stale = restored.send("answer", {
    round: 1,
    questionId: "q1",
    answer: "4",
  });
  await restored.wait(
    (m) => m.type === "protocol_error" && m.commandId === stale,
  );
  for (let round = 2; round <= 10; round++) {
    const before = await restored.state(round, "question");
    await new Promise((r) => setTimeout(r, 3100));
    const answer = restored.send("answer", {
      round,
      questionId: "q1",
      answer: "4",
    });
    await restored.wait(
      (m) => m.type === "command_ack" && m.commandId === answer,
    );
    const action = restored.send("action", {
      round,
      ability: "fireball",
      targetId: "e1",
      ready: true,
    });
    await restored.wait(
      (m) => m.type === "command_ack" && m.commandId === action,
    );
    await restored.state(round, "abilities");
    restored.send("ready", { round });
    const resolved = await restored.state(round, "question_resolution");
    assert.equal(resolved.state.players[studentId].mp, before.state.players[studentId].mp - 1,
      "Each successful Fireball must spend exactly 1 MP");
    await api(`/api/combat/${room.payload.sessionId}/force-question`, {
      method: "POST",
      cookie: teacher.cookie,
    });
    await restored.state(round, "enemy_ai");
    await api(`/api/combat/${room.payload.sessionId}/force-question`, {
      method: "POST",
      cookie: teacher.cookie,
    });
    if (resolved.state.enemies.every(enemy => enemy.health <= 0)) break;
  }
  const victory = await restored.wait(
    (m) => m.type === "game_over" && m.victory === true,
    45000,
  );
  assert.equal(victory.results.length, 1);
  const stats = await api(`/api/combat-stats/student/${studentId}`, {
    cookie: student.cookie,
  });
  assert.equal(stats.payload.length, 1);
  assert.ok(stats.payload[0].questionsAnswered >= 2);
  assert.equal(stats.payload[0].questionsCorrect, stats.payload[0].questionsAnswered - 1);
  assert.equal(stats.payload[0].damageDealt, opened.state.enemies[0].maxHealth);
  const stamina = await api(`/api/student/${studentId}/stamina`, { cookie: student.cookie });
  assert.equal(stamina.payload.completedCombats, 1);
  assert.ok(Math.abs(stamina.payload.xpMultiplier - 0.9) < 1e-10);
  const body = { fightId: fight.payload.id, resultId: stats.payload[0].id };
  await api(`/api/student/${studentId}/claim-gold`, {
    method: "POST",
    cookie: student.cookie,
    body,
  });
  await api(`/api/student/${studentId}/claim-gold`, {
    method: "POST",
    cookie: student.cookie,
    body,
  });
  assert.equal(
    (await api(`/api/student/${studentId}`, { cookie: student.cookie })).payload
      .gold,
    11,
  );
  await api(`/api/student/${studentId}/claim-loot`, {
    method: "POST",
    cookie: student.cookie,
    body: { ...body, itemId: item.payload.id },
    status: 409,
  });
  await api(`/api/student/${studentId}/award-xp`, {
    method: "POST",
    cookie: student.cookie,
    body: { xp: 100 },
    status: 403,
  });
  await api(`/api/guilds/${guildId}/fights/${fight.payload.id}/solo-mode`, {
    method: "PATCH",
    cookie: teacher.cookie,
    body: { enabled: true },
  });
  const solo = await api(`/api/fights/${fight.payload.id}/solo-sessions`, {
    method: "POST",
    cookie: student.cookie,
    body: { guildId },
    status: 201,
  });
  const soloPlayer = new Actor(student.cookie, solo.payload.sessionId);
  await soloPlayer.open();
  soloPlayer.send("join");
  await soloPlayer.state(1, "question");
  await api(`/api/guilds/${guildId}/archive`, {
    method: "POST",
    cookie: teacher.cookie,
  });
  await api(`/api/fights/${fight.payload.id}`, {
    method: "DELETE",
    cookie: teacher.cookie,
  });
  assert.equal(
    (
      await api(`/api/combat-stats/student/${studentId}`, {
        cookie: student.cookie,
      })
    ).payload.length,
    1,
  );
  console.log(
    "PASS: live damage, atomic action/ready, Fireball MP deductions, wrong answers, enemy AI, cycling, reconnect deadlines, stale/retried commands, durable XP, guilds, quests, shop, reward claims, solo hosting, history, and owner isolation",
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.terminate();
}
