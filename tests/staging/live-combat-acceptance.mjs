import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const origin = (process.env.STAGING_ORIGIN || "https://questacademy-staging.coxsonator.workers.dev").replace(/\/$/, "");
const websocketOrigin = origin.replace(/^http/, "ws");
const runId = process.env.GITHUB_RUN_ID || Date.now().toString();
const suffix = runId.slice(-10);
const password = `Agentic-${randomUUID()}!`;

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie");
  assert.ok(raw, "response must issue a session cookie");
  return raw.split(";", 1)[0];
}

async function api(path, { method = "GET", cookie, body, expected = [200] } = {}) {
  const headers = { Accept: "application/json" };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Origin = origin;
  }
  const response = await fetch(origin + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  assert.ok(
    expected.includes(response.status),
    `${method} ${path}: expected ${expected.join("/")} but received ${response.status}: ${text}`,
  );
  return { response, payload };
}

class SocketActor {
  constructor(name, cookie, sessionId, originOverride = origin) {
    this.name = name;
    this.messages = [];
    this.waiters = [];
    this.socket = new WebSocket(
      `${websocketOrigin}/ws?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: { Cookie: cookie }, origin: originOverride },
    );
    this.socket.on("message", data => {
      const message = JSON.parse(data.toString());
      this.messages.push(message);
      for (const waiter of [...this.waiters]) {
        if (waiter.predicate(message)) {
          clearTimeout(waiter.timer);
          this.waiters.splice(this.waiters.indexOf(waiter), 1);
          waiter.resolve(message);
        }
      }
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.once("open", resolve);
      this.socket.once("error", reject);
      this.socket.once("unexpected-response", (_request, response) => {
        reject(new Error(`${this.name} upgrade rejected with ${response.statusCode}`));
      });
    });
  }

  send(type, fields = {}, commandId = randomUUID()) {
    this.socket.send(JSON.stringify({ type, commandId, ...fields }));
    return commandId;
  }

  waitFor(predicate, timeoutMs = 12_000) {
    const existing = this.messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        reject(new Error(`${this.name} timed out waiting for message; received ${JSON.stringify(this.messages)}`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

async function expectUpgradeStatus(cookie, sessionId, status) {
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `${websocketOrigin}/ws?sessionId=${encodeURIComponent(sessionId)}`,
      { headers: { Cookie: cookie }, origin: "https://invalid.example" },
    );
    socket.once("open", () => reject(new Error("cross-origin WebSocket unexpectedly opened")));
    socket.once("error", () => {});
    socket.once("unexpected-response", (_request, response) => {
      try {
        assert.equal(response.statusCode, status);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        socket.terminate();
      }
    });
    setTimeout(() => reject(new Error("cross-origin WebSocket rejection timed out")), 8_000);
  });
}

function fightPayload(teacherId, title, secondQuestionSeconds = 8) {
  return {
    teacherId,
    title,
    guildCode: null,
    questions: [
      {
        id: "q1",
        type: "short_answer",
        question: "What is 2 + 2?",
        correctAnswer: "4",
        timeLimit: 30,
      },
      {
        id: "q2",
        type: "true_false",
        question: "Five is prime.",
        options: ["true", "false"],
        correctAnswer: "true",
        timeLimit: secondQuestionSeconds,
      },
    ],
    enemies: [{ id: "dummy", name: "Practice Dummy", image: "", difficultyMultiplier: 1 }],
    baseXP: 10,
    baseEnemyDamage: 1,
    enemyDisplayMode: "consecutive",
    lootTable: [],
    randomizeQuestions: false,
    shuffleOptions: false,
  };
}

const sockets = [];
let teacherCookie;
let fightOneId;
let fightTwoId;

try {
  const ready = await api("/api/health/ready");
  assert.equal(ready.payload.status, "ready");

  const teacherSignup = await api("/api/teacher/signup", {
    method: "POST",
    expected: [201],
    body: {
      firstName: "Agentic",
      lastName: "Acceptance",
      email: `agentic-teacher-${suffix}@example.invalid`,
      password,
      billingAddress: "Staging only",
      schoolDistrict: "Agentic Test District",
      school: "Agentic Test School",
      subject: "System acceptance",
      gradeLevel: "Test",
    },
  });
  teacherCookie = cookieFrom(teacherSignup.response);
  const teacher = teacherSignup.payload;

  const studentLogin = await api("/api/student/login", {
    method: "POST",
    body: { nickname: `agentic-student-${suffix}`, password },
  });
  const studentCookie = cookieFrom(studentLogin.response);
  const student = studentLogin.payload;
  await api(`/api/student/${student.id}/character`, {
    method: "PATCH",
    cookie: studentCookie,
    body: { characterClass: "wizard", gender: "A" },
  });

  const fightOne = await api("/api/fights", {
    method: "POST",
    cookie: teacherCookie,
    expected: [201],
    body: fightPayload(teacher.id, `[agentic ${suffix}] room one`),
  });
  fightOneId = fightOne.payload.id;
  const fightTwo = await api("/api/fights", {
    method: "POST",
    cookie: teacherCookie,
    expected: [201],
    body: fightPayload(teacher.id, `[agentic ${suffix}] room two`, 30),
  });
  fightTwoId = fightTwo.payload.id;

  const roomOne = await api(`/api/fights/${fightOneId}/sessions`, {
    method: "POST",
    cookie: teacherCookie,
    expected: [200, 201],
    body: {},
  });
  const roomTwo = await api(`/api/fights/${fightTwoId}/sessions`, {
    method: "POST",
    cookie: teacherCookie,
    expected: [200, 201],
    body: {},
  });

  await expectUpgradeStatus(teacherCookie, roomOne.payload.sessionId, 403);

  const hostOne = new SocketActor("host-one", teacherCookie, roomOne.payload.sessionId);
  const hostTwo = new SocketActor("host-two", teacherCookie, roomTwo.payload.sessionId);
  sockets.push(hostOne, hostTwo);
  await Promise.all([hostOne.open(), hostTwo.open()]);
  hostOne.send("host");
  hostTwo.send("host");
  const createdOne = await hostOne.waitFor(message => message.type === "session_created");
  const createdTwo = await hostTwo.waitFor(message => message.type === "session_created");
  assert.equal(createdOne.state.currentPhase, "waiting");
  assert.equal(createdTwo.state.currentPhase, "waiting");

  const lookup = await api(`/api/sessions/${roomOne.payload.sessionId}`, { cookie: studentCookie });
  assert.equal(lookup.payload.fightId, fightOneId);

  const studentOne = new SocketActor("student-one", studentCookie, roomOne.payload.sessionId);
  sockets.push(studentOne);
  await studentOne.open();
  studentOne.send("join", { studentId: "00000000-0000-4000-8000-ffffffffffff" });
  const joined = await hostOne.waitFor(
    message => message.type === "combat_state" && message.state.players[student.id],
  );
  assert.deepEqual(Object.keys(joined.state.players), [student.id], "server session must select student identity");
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(
    hostTwo.messages.some(message => message.type === "combat_state"),
    false,
    "room-two host must not receive room-one broadcasts",
  );

  hostOne.send("start_fight");
  const questionOne = await studentOne.waitFor(message => message.type === "question" && message.question.id === "q1");
  assert.equal("correctAnswer" in questionOne.question, false, "correct answer must not reach clients");

  const answerCommandId = randomUUID();
  studentOne.send("answer", { answer: "4" }, answerCommandId);
  studentOne.send("answer", { answer: "different" }, answerCommandId);
  const answered = await hostOne.waitFor(
    message => message.type === "combat_state" && message.state.players[student.id]?.hasAnswered === true,
  );
  assert.equal(answered.state.players[student.id].currentAnswer, null, "submitted answer must not be broadcast");
  const questionTwo = await studentOne.waitFor(message => message.type === "question" && message.question.id === "q2");
  assert.equal(questionTwo.question.correctAnswer, undefined);

  hostOne.close();
  studentOne.close();
  const rejoinedHost = new SocketActor("rejoined-host", teacherCookie, roomOne.payload.sessionId);
  const rejoinedStudent = new SocketActor("rejoined-student", studentCookie, roomOne.payload.sessionId);
  sockets.push(rejoinedHost, rejoinedStudent);
  await Promise.all([rejoinedHost.open(), rejoinedStudent.open()]);
  rejoinedHost.send("host");
  const restored = await rejoinedHost.waitFor(message => message.type === "session_created");
  assert.equal(restored.state.currentQuestionIndex, 1);
  assert.equal(restored.state.players[student.id].threat, 1, "duplicate answer must not apply twice");
  rejoinedStudent.send("join");
  await rejoinedStudent.waitFor(message => message.type === "question" && message.question.id === "q2");

  await rejoinedHost.waitFor(message => message.type === "game_over" && message.victory === true, 15_000);
  await api(`/api/sessions/${roomOne.payload.sessionId}`, {
    cookie: studentCookie,
    expected: [404],
  });

  hostTwo.send("end_fight");
  await hostTwo.waitFor(message => message.type === "game_over" && message.victory === false);
  await api(`/api/sessions/${roomTwo.payload.sessionId}`, {
    cookie: studentCookie,
    expected: [404],
  });

  console.log(JSON.stringify({
    result: "pass",
    origin,
    assertions: [
      "readiness",
      "teacher and student identity",
      "same-origin WebSocket rejection",
      "server-derived student identity",
      "room isolation",
      "answer secrecy",
      "command idempotency",
      "host and student reconnect",
      "alarm-driven completion",
      "closed-room rejection",
    ],
  }, null, 2));
} finally {
  for (const socket of sockets) socket.close();
  if (teacherCookie && fightOneId) {
    await api(`/api/fights/${fightOneId}`, { method: "DELETE", cookie: teacherCookie, body: {}, expected: [200, 404] })
      .catch(error => console.warn("fight-one cleanup failed:", error.message));
  }
  if (teacherCookie && fightTwoId) {
    await api(`/api/fights/${fightTwoId}`, { method: "DELETE", cookie: teacherCookie, body: {}, expected: [200, 404] })
      .catch(error => console.warn("fight-two cleanup failed:", error.message));
  }
}
