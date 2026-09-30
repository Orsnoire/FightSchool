import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const origin = (process.env.STAGING_ORIGIN || "https://questacademy.bookwyrminteractive.studio").replace(/\/$/, "");
const suffix = Date.now().toString(36) + randomUUID().slice(0, 6);
const password = `Acceptance-${randomUUID()}!`;
const sockets = [], fights = [], checks = [];
let teacher;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(path, { method = "GET", cookie, body, status = 200 } = {}) {
  const response = await fetch(origin + path, {
    method, signal: AbortSignal.timeout(30000),
    headers: { Origin: origin, Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  assert.ok([status].flat().includes(response.status), `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return { payload, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function check(name, fn) {
  try { await fn(); checks.push({ name, passed: true }); console.log(`PASS: ${name}`); }
  catch (error) { checks.push({ name, passed: false }); console.error(`FAIL: ${name}: ${error.message}`); }
}
class Actor {
  constructor(cookie, room) {
    this.messages = [];
    this.socket = new WebSocket(origin.replace(/^http/, "ws") + `/ws?sessionId=${room}`, { headers: { Cookie: cookie }, origin });
    sockets.push(this.socket);
    this.socket.on("message", data => this.messages.push(JSON.parse(data.toString())));
    this.socket.on("error", error => { this.error = error.message; });
  }
  open() { return new Promise((resolve, reject) => { this.socket.once("open", resolve); this.socket.once("error", reject); }); }
  send(type, fields = {}) { const commandId = randomUUID(); this.socket.send(JSON.stringify({ type, commandId, ...fields })); return commandId; }
  async wait(predicate, timeout = 45000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = this.messages.find(predicate);
      if (found) return found;
      if (this.error) throw new Error(this.error);
      await sleep(50);
    }
    throw new Error(`Timed out; event types: ${this.messages.slice(-5).map(m => m.type)}`);
  }
  state(phase) { return this.wait(m => m.type === "combat_state" && m.state.currentPhase === phase); }
  async ack(type, fields = {}) {
    const start = Date.now(), id = this.send(type, fields);
    const result = await this.wait(m => m.commandId === id && ["command_ack", "protocol_error"].includes(m.type));
    assert.equal(result.type, "command_ack", result.message);
    return Date.now() - start;
  }
}
async function fight(title) {
  const created = await api("/api/fights", { method: "POST", cookie: teacher.cookie, status: 201, body: {
    teacherId: teacher.payload.id, title: `${title} ${suffix}`, baseXP: 10, baseEnemyDamage: 1,
    questions: [{ id: "q1", type: "short_answer", question: "What is 2+2?", correctAnswer: "4", timeLimit: 120 }],
    enemies: [{ id: "e1", name: "Acceptance slime", image: "/favicon.png", difficultyMultiplier: 1 }],
    enemyDisplayMode: "consecutive", lootTable: [], randomizeQuestions: false, shuffleOptions: false,
  } });
  fights.push(created.payload.id);
  const room = await api(`/api/fights/${created.payload.id}/sessions`, { method: "POST", cookie: teacher.cookie, status: 201 });
  const host = new Actor(teacher.cookie, room.payload.sessionId);
  await host.open(); host.send("host"); await host.wait(m => m.type === "session_created");
  return { fight: created.payload, room: room.payload.sessionId, host };
}
try {
  teacher = await api("/api/teacher/signup", { method: "POST", status: 201, body: {
    firstName: "Acceptance", lastName: "Operations", email: `qa-ops-${suffix}@example.invalid`, password,
    billingAddress: "Acceptance fixture", schoolDistrict: "Acceptance", school: "Acceptance", subject: "Math", gradeLevel: "5",
  } });
  const upload = await api("/api/objects/upload", { method: "POST", cookie: teacher.cookie });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6BkoAAAAASUVORK5CYII=", "base64");
  const objectUrl = origin + upload.payload.objectPath;
  await check("R2 upload, checksum, type, cache, immutable upload, and authorization", async () => {
    const put = await fetch(objectUrl, { method: "PUT", headers: { Origin: origin, Cookie: teacher.cookie, "Content-Type": "image/png" }, body: png });
    assert.equal(put.status, 201);
    const read = await fetch(objectUrl);
    assert.equal(read.status, 200); assert.equal(read.headers.get("content-type"), "image/png");
    assert.match(read.headers.get("cache-control"), /immutable/);
    assert.equal(read.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(Buffer.from(await read.arrayBuffer()), png);
    assert.equal((await fetch(objectUrl, { method: "PUT", headers: { Origin: origin, Cookie: teacher.cookie, "Content-Type": "image/png" }, body: png })).status, 409);
    assert.equal((await fetch(objectUrl, { method: "PUT", headers: { Origin: origin, "Content-Type": "image/png" }, body: png })).status, 401);
    assert.equal((await fetch(objectUrl, { method: "PUT", headers: { Origin: "https://untrusted.example", Cookie: teacher.cookie, "Content-Type": "image/png" }, body: png })).status, 403);
  });
  await check("R2 byte ranges and metadata", async () => {
    const ranged = await fetch(objectUrl, { headers: { Range: "bytes=0-7" } });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("content-range"), `bytes 0-7/${png.length}`);
    assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), png.subarray(0, 8));
    const head = await fetch(objectUrl, { method: "HEAD" });
    assert.equal(head.status, 200); assert.equal(Number(head.headers.get("content-length")), png.length);
  });
  const students = [];
  for (let i = 0; i < 31; i++) {
    const student = await api("/api/student/login", { method: "POST", body: { nickname: `qa-ops-${suffix}-${i}`, password } });
    await api(`/api/student/${student.payload.id}/character`, { method: "PATCH", cookie: student.cookie, body: { characterClass: "warrior", gender: "A" } });
    students.push(student);
  }
  const main = await fight("Acceptance 30-player room"), isolated = await fight("Acceptance isolated room");
  const players = [];
  for (const student of students.slice(0, 30)) {
    const player = new Actor(student.cookie, main.room); await player.open(); player.send("join");
    await player.wait(m => m.type === "combat_state" && !!m.state.players[student.payload.id]); players.push(player);
  }
  const separate = new Actor(students[30].cookie, isolated.room);
  await separate.open(); separate.send("join"); await separate.state("waiting");
  await check("30 participants, host refresh reuses room, and concurrent room isolation", async () => {
    const state = await main.host.wait(m => m.type === "combat_state" && Object.keys(m.state.players).length === 30);
    assert.equal(state.state.players[students[30].payload.id], undefined);
    const other = await separate.state("waiting");
    assert.deepEqual(Object.keys(other.state.players), [students[30].payload.id]);
    const reused = await api(`/api/fights/${main.fight.id}/sessions`, { method: "POST", cookie: teacher.cookie });
    assert.equal(reused.payload.sessionId, main.room);
  });
  await check("30 simultaneous answers and reconnect preserve shared state", async () => {
    main.host.send("start_fight"); const opened = await players[0].state("question");
    await sleep(Math.max(0, opened.state.questionStartTime - Date.now()) + 100);
    const times = await Promise.all(players.map(player => player.ack("answer", { round: 1, questionId: "q1", answer: "4" })));
    times.sort((a, b) => a - b);
    console.log(`Answer acknowledgement ms: p50=${times[14]}, p95=${times[28]}, max=${times[29]}`);
    assert.ok(times[29] < 15000, "Classroom answer burst should finish within 15 seconds");
    players[0].socket.close();
    const restored = new Actor(students[0].cookie, main.room); await restored.open(); restored.send("join");
    const state = await restored.state("question");
    assert.equal(state.state.phaseDeadline, opened.state.phaseDeadline);
    assert.equal(Object.keys(state.state.players).length, 30);
    players[0] = restored;
    assert.equal(separate.messages.filter(m => m.type === "combat_state").at(-1).state.currentPhase, "waiting");
  });
  await check("30-player completion persists results exactly once", async () => {
    // Answers enter the totals when the round resolves, not on receipt. Finish
    // both choice phases before the teacher ends this controlled load fixture.
    await Promise.all(players.map(player => player.ack("ready", { round: 1 })));
    await players[0].state("abilities");
    await Promise.all(players.map(player => player.ack("ready", { round: 1 })));
    const resolved = await players[0].state("question_resolution");
    for (const student of students.slice(0, 30))
      assert.equal(resolved.state.players[student.payload.id].totals.questionsAnswered, 1, "The classroom round must resolve before completion");
    main.host.send("end_fight");
    const completed = await players[0].wait(m => m.type === "game_over", 60000);
    assert.equal(completed.results.length, 30, "Completion must include all classroom results");
    main.host.send("end_fight");
    for (const student of students.slice(0, 30)) {
      const stats = await api(`/api/combat-stats/student/${student.payload.id}`, { cookie: student.cookie });
      assert.equal(stats.payload.length, 1, "Each student must have exactly one result");
      assert.equal(stats.payload[0].questionsAnswered, 1, "The saved result must contain the resolved answer");
    }
  });
  await check("logout revokes an already-open student socket", async () => {
    const closed = new Promise(resolve => separate.socket.once("close", code => resolve(code)));
    await api("/api/student/logout", { method: "POST", cookie: students[30].cookie });
    separate.send("join");
    assert.equal(await Promise.race([closed, sleep(10000).then(() => "timeout")]), 1008);
  });
  if (checks.some(x => !x.passed)) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  for (const socket of sockets) socket.terminate();
  if (teacher) for (const id of fights) {
    try { await api(`/api/fights/${id}`, { method: "DELETE", cookie: teacher.cookie }); }
    catch { console.error(`Unable to archive acceptance fight ${id}`); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ origin, checks }));
}
