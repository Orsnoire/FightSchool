import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { startFixtureRun, acceptancePlayers, fixtureFetch as fetch } from "./fixture-run.mjs";

const fixtures = await startFixtureRun("operations");
const origin = fixtures.manifest.origin;
const participantCount = acceptancePlayers(process.env, fixtures.manifest);
assert.ok(!process.env.ACCEPTANCE_PROFILE || process.env.ACCEPTANCE_PROFILE === 'representative', 'Unknown acceptance profile');
const profile = process.env.ACCEPTANCE_PROFILE ? await import('./representative-profile.mjs') : null;
const suffix = fixtures.suffix;
const password = `Acceptance-${randomUUID()}!`;
const sockets = [], fights = [], checks = [];
let teacher, representative, performanceGuild;
let nextActorId = 0, tearingDown = false;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(path, { method = "GET", cookie, body, status = 200 } = {}) {
  const requestId = fixtures.begin(path, method, body);
  const response = await fetch(origin + path, {
    method, signal: AbortSignal.timeout(30000),
    headers: { Origin: origin, Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  fixtures.record(path, method, body, payload, response.status, requestId);
  assert.ok([status].flat().includes(response.status), `${method} ${path}: ${response.status} unexpected response`);
  return { payload, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function check(name, fn) {
  try { await fn(); checks.push({ name, passed: true }); console.log(`PASS: ${name}`); }
  catch (error) { checks.push({ name, passed: false }); console.error(`FAIL: ${name}: ${error.message}`); }
}
class Actor {
  constructor(cookie, room) {
    this.messages = [];
    this.actorId = ++nextActorId;
    this.room = room;
    this.createdAt = Date.now();
    this.socket = new WebSocket(origin.replace(/^http/, "ws") + `/ws?sessionId=${room}`, { headers: { Cookie: cookie }, origin });
    sockets.push(this.socket);
    this.socket.on("message", data => { this.lastMessageAt = Date.now(); this.messages.push(JSON.parse(data.toString())); });
    this.socket.on("error", error => { this.error = error.message; });
    this.socket.on("close", (code, reason) => {
      this.closed = { code, reason: reason.toString(), ageMs: Date.now() - this.createdAt };
      if (!tearingDown) console.log("Socket closed:", JSON.stringify(this.connection()));
    });
  }
  connection() { return { actor: this.actorId, room: this.room, socketState: this.socket.readyState,
    ageMs: Date.now() - this.createdAt, lastMessageAgeMs: this.lastMessageAt ? Date.now() - this.lastMessageAt : null,
    closed: this.closed, last: this.messages.at(-1)?.type, phase: this.messages.at(-1)?.state?.currentPhase }; }
  open() { return new Promise((resolve, reject) => { this.socket.once("open", resolve); this.socket.once("error", reject); }); }
  send(type, fields = {}) { assert.equal(this.socket.readyState, WebSocket.OPEN, `${type}: ${JSON.stringify(this.connection())}`); const commandId = randomUUID(); this.socket.send(JSON.stringify({ type, commandId, ...fields })); return commandId; }
  async wait(predicate, timeout = 45000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = this.messages.find(predicate);
      if (found) return found;
      if (this.error) throw new Error(this.error);
      if (this.closed) throw new Error(`Socket closed: ${JSON.stringify(this.connection())}`);
      await sleep(50);
    }
    const recent = this.messages.slice(-5).map(m => ({ type: m.type, error: m.error, phase: m.state?.currentPhase, round: m.state?.round }));
    throw new Error(`Timed out; connection: ${JSON.stringify(this.connection())}; recent protocol state: ${JSON.stringify(recent)}`);
  }
  state(phase) { return this.wait(m => m.type === "combat_state" && m.state.currentPhase === phase).catch(error => { throw new Error(`Waiting for ${phase}: ${error.message}`); }); }
  async ack(type, fields = {}) {
    const start = Date.now(), id = this.send(type, fields);
    const result = await this.wait(m => m.commandId === id && ["command_ack", "protocol_error"].includes(m.type));
    assert.equal(result.type, "command_ack", `${type}: ${result.error || result.message || "Command rejected"}`);
    return Date.now() - start;
  }
}
async function fight(title, questionCount = 1, representativeRoom = false) {
  const created = await api("/api/fights", { method: "POST", cookie: teacher.cookie, status: 201, body: {
    teacherId: teacher.payload.id, title: `${title} ${suffix}`, baseXP: 10, baseEnemyDamage: 1,
    questions: Array.from({length:questionCount}, (_,i) => ({ id: `q${i+1}`, type: "short_answer", question: "What is 2+2?", correctAnswer: "4", timeLimit: 120 })),
    enemies: representativeRoom
      ? [{id:'goblins',name:'Acceptance goblins',image:'/enemies/goblin-v1.png',enemyType:'goblin',ai:{mode:'basic'},difficultyMultiplier:1,quantity:5,swarm:{enemiesPerFourPlayers:2}}]
      : [{ id: "e1", name: "Acceptance slime", image: "/enemies/slime-v2.png", enemyType: "slime", ai: { mode: "basic" }, difficultyMultiplier: 1 }],
    enemyDisplayMode: representativeRoom ? 'simultaneous' : "consecutive", lootTable: [], randomizeQuestions: false, shuffleOptions: false,
  } });
  fights.push(created.payload.id);
  if (representativeRoom) await api(`/api/guilds/${performanceGuild.payload.id}/fights`, { method:'POST',cookie:teacher.cookie,body:{fightId:created.payload.id},status:[200,201] });
  const room = await api(`/api/fights/${created.payload.id}/sessions`, { method: "POST", cookie: teacher.cookie, status: 201 });
  const host = new Actor(teacher.cookie, room.payload.sessionId);
  await host.open(); host.send("host"); await host.wait(m => m.type === "session_created");
  return { fight: created.payload, room: room.payload.sessionId, host };
}
try {
  // Check the DB target and connection before creating any accounts.
  if (profile) representative = await profile.prepareRepresentative(fixtures);
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
  for (let i = 0; i < participantCount + 1; i++) {
    const student = await api("/api/student/login", { method: "POST", body: { nickname: `qa-ops-${suffix}-${i}`, password } });
    const character = profile?.classroomCharacter(i);
    await api(`/api/student/${student.payload.id}/character`, { method: "PATCH", cookie: student.cookie, body: { characterClass: character?.job || "warrior", gender: character?.appearance.modelId === 'human-female-v1' ? 'B' : 'A' } });
    if (character) await api(`/api/student/${student.payload.id}/avatar`, {method:'POST',cookie:student.cookie,body:character.appearance});
    students.push(student);
  }
  if (profile) {
    performanceGuild = await api('/api/guilds', {method:'POST',cookie:teacher.cookie,status:201,body:{name:`Performance ${suffix}`}});
    for (const student of students.slice(0,participantCount)) await api(`/api/guilds/${performanceGuild.payload.id}/members`, {method:'POST',cookie:student.cookie,body:{studentId:student.payload.id}});
  }
  const main = await fight(`Acceptance ${participantCount}-player room`, profile ? 20 : 1, !!profile), isolated = await fight("Acceptance isolated room");
  if (profile) {
    await representative.seed({teacher,students:students.slice(0,participantCount),fight:main.fight,guild:performanceGuild});
    const times = await Promise.all(students.slice(0,participantCount).map(async student => {
      const start = performance.now();
      const response = await api(`/api/guilds/${performanceGuild.payload.id}/quests`, {cookie:student.cookie});
      assert.ok(Array.isArray(response.payload) && response.payload.length > 0, 'Seeded quests must be visible');
      return performance.now()-start;
    }));
    fixtures.recordMetric('guildQuests', times);
  }
  const players = [];
  for (const student of students.slice(0, participantCount)) {
    const player = new Actor(student.cookie, main.room); await player.open(); player.send("join");
    await player.wait(m => m.type === "combat_state" && !!m.state.players[student.payload.id]); players.push(player);
  }
  const separate = new Actor(students[participantCount].cookie, isolated.room);
  await separate.open(); separate.send("join"); await separate.state("waiting");
  await check(`${participantCount} participants, host refresh reuses room, and concurrent room isolation`, async () => {
    const state = await main.host.wait(m => m.type === "combat_state" && Object.keys(m.state.players).length === participantCount);
    assert.equal(state.state.players[students[participantCount].payload.id], undefined);
    const other = await separate.state("waiting");
    assert.deepEqual(Object.keys(other.state.players), [students[participantCount].payload.id]);
    const reused = await api(`/api/fights/${main.fight.id}/sessions`, { method: "POST", cookie: teacher.cookie });
    assert.equal(reused.payload.sessionId, main.room);
  });
  await check(`${participantCount} simultaneous answers and reconnect preserve shared state`, async () => {
    console.log("Classroom connections before start:", JSON.stringify([main.host, ...players].map(actor => actor.connection())));
    await main.host.ack("start_fight"); const opened = await players[0].state("question");
    await sleep(Math.max(0, opened.state.questionStartTime - Date.now()) + 100);
    const times = await Promise.all(players.map(player => player.ack("answer", { round: 1, questionId: "q1", answer: "4" })));
    times.sort((a, b) => a - b);
    fixtures.recordAnswerTimes(times);
    console.log(`Answer acknowledgement ms: ${JSON.stringify(fixtures.manifest.answerAckMs)}`);
    assert.ok(times.at(-1) < 15000, "Classroom answer burst should finish within 15 seconds");
    const actions = await players[0].state("actions");
    assert.notEqual(actions.state.phaseDeadline, opened.state.phaseDeadline, "Action selection must have its own deadline");
    assert.ok(actions.state.phaseDeadline > Date.now(), "Action selection must still be open after the answer burst");
    const reconnectStart = performance.now();
    players[0].socket.close();
    const restored = new Actor(students[0].cookie, main.room); await restored.open(); restored.send("join");
    const state = await restored.state("actions");
    assert.equal(state.state.phaseDeadline, actions.state.phaseDeadline);
    assert.equal(Object.keys(state.state.players).length, participantCount);
    players[0] = restored;
    if (profile) fixtures.recordMetric('reconnect', [performance.now()-reconnectStart]);
    assert.equal(separate.messages.filter(m => m.type === "combat_state").at(-1).state.currentPhase, "waiting");
  });
  await check(`${participantCount}-player completion persists results exactly once`, async () => {
    // Answers enter the totals when the round resolves, not on receipt. Finish
    // both choice phases before the teacher ends this controlled load fixture.
    const rounds=profile?2:1;
    const phase=(round,name)=>players[0].wait(m=>m.type==='combat_state' && m.state.round===round && m.state.currentPhase===name);
    for(let round=1;round<=rounds;round++) {
      if(round>1) {
        const opened=await phase(round,'question');
        await sleep(Math.max(0,opened.state.questionStartTime-Date.now())+100);
        fixtures.recordMetric('followupAnswers',await Promise.all(players.map(player=>player.ack('answer',{round,questionId:`q${round}`,answer:'4'}))));
      }
      if (profile) await profile.exerciseClassActions(players,students,(await phase(round,'actions')).state,fixtures);
      else await Promise.all(players.map(player => player.ack("ready", { round })));
      await phase(round,"abilities");
      if (profile) await profile.exerciseClassSupport(players,students,fixtures,round);
      else await Promise.all(players.map(player => player.ack("ready", { round })));
      const resolved=await phase(round,'question_resolution');
      for (const student of students.slice(0, participantCount))
        assert.equal(resolved.state.players[student.payload.id].totals.questionsAnswered, round, "The classroom round must resolve before completion");
      if(round<rounds) {
        const playback=async state=>{
          assert.ok(state.playback?.id); assert.equal(state.phaseDeadline,null);
          await Promise.all([main.host,...players].map(actor=>actor.ack('playback_complete',{round,batchId:state.playback.id})));
        };
        await playback(resolved.state);
        await playback((await phase(round,'enemy_ai')).state);
      }
    }
    const completionStart = performance.now();
    main.host.send("end_fight");
    const completed = await players[0].wait(m => m.type === "game_over", 60000);
    assert.equal(completed.results.length, participantCount, "Completion must include all classroom results");
    if (profile) fixtures.recordMetric('completion', [performance.now()-completionStart]);
    await main.host.ack("end_fight");
    for (const student of students.slice(0, participantCount)) {
      const stats = await api(`/api/combat-stats/student/${student.payload.id}`, { cookie: student.cookie });
      const expected = (fixtures.manifest.history?.perStudent || 0) + 1;
      assert.equal(stats.payload.length, Math.min(50,expected), 'History page stays bounded');
      if (profile) {
        const summary = await api(`/api/combat-stats/student/${student.payload.id}/summary`, {cookie:student.cookie});
        assert.equal(summary.payload.totalFights, expected, 'Exactly one new result beyond seeded history');
      }
      const saved = stats.payload.filter(r => r.sessionId === main.room);
      assert.equal(saved.length, 1, 'Exactly one result belongs to this room');
      assert.equal(saved[0].questionsAnswered, rounds, "The saved result must contain every resolved answer");
    }
  });
  await check("dashboard discovery, explicit end, concurrent launch and stale end isolation", async () => {
    const fixture = await fight("Acceptance host session controls");
    const path = `/api/fights/${fixture.fight.id}/sessions`;
    const discover = () => api("/api/fights/hosted-sessions", {cookie:teacher.cookie});
    assert.ok((await discover()).payload.some(r => r.sessionId === fixture.room));
    assert.equal((await api(path, {cookie:teacher.cookie})).payload.sessionId, fixture.room);
    await api(`/api/combat/${fixture.room}/end`, {method:"POST",cookie:students[0].cookie,status:401});
    await api(`/api/combat/${fixture.room}/end`, {method:"POST",cookie:teacher.cookie});
    await fixture.host.wait(m => m.type === "game_over");
    assert.equal((await api(path, {cookie:teacher.cookie})).payload, null);
    assert.equal((await api(`${path}?sessionId=${fixture.room}`, {cookie:teacher.cookie})).payload.status,"completed");
    assert.ok(!(await discover()).payload.some(r => r.sessionId === fixture.room));
    const launches = await Promise.all(Array.from({length:5}, () => api(path, {method:"POST",cookie:teacher.cookie,status:[200,201]})));
    const next = launches[0].payload.sessionId;
    assert.equal(new Set(launches.map(r => r.payload.sessionId)).size,1);
    assert.notEqual(next,fixture.room);
    await api(`/api/combat/${fixture.room}/end`, {method:"POST",cookie:teacher.cookie});
    assert.equal((await api(path, {cookie:teacher.cookie})).payload.sessionId,next);
    // The replacement has no host socket: an unopened lobby must end too.
    await api(`/api/combat/${next}/end`, {method:"POST",cookie:teacher.cookie});
    assert.equal((await api(path, {cookie:teacher.cookie})).payload,null);
  });
  await check("late entry, moderated rejoin, blocked requests and fractional host-end rewards", async () => {
    const room = await fight("Acceptance battlefield participation", 4);
    const open = async (index) => { const actor = new Actor(students[index].cookie, room.room); await actor.open(); actor.send("join"); return actor; };
    let a = await open(0), b = await open(1);
    const aId = students[0].payload.id, bId = students[1].payload.id, lateId = students[2].payload.id;
    await room.host.wait(m => m.type === "combat_state" && Object.keys(m.state.players).length === 2);
    await room.host.ack("start_fight");
    const resolve = async (actors, round) => {
      const opening = await actors[0].wait(m => m.type === "combat_state" && m.state.round === round && m.state.currentPhase === "question");
      await sleep(Math.max(0, opening.state.questionStartTime - Date.now()) + 100);
      await Promise.all(actors.map(actor => actor.ack("answer", {round, questionId:`q${round}`, answer:"4"})));
      await actors[0].wait(m => m.type === "combat_state" && m.state.round === round && m.state.currentPhase === "actions");
      await Promise.all(actors.map(actor => actor.ack("ready", {round})));
      await actors[0].wait(m => m.type === "combat_state" && m.state.round === round && m.state.currentPhase === "abilities");
      await Promise.all(actors.map(actor => actor.ack("ready", {round})));
      return (await actors[0].wait(m => m.type === "combat_state" && m.state.round === round && m.state.currentPhase === "question_resolution")).state;
    };
    const first = await resolve([a,b], 1);
    await room.host.ack("remove_player", {targetId:aId});
    await a.wait(m => m.type === "fight_removed");
    a = await open(0); await a.wait(m => m.type === "join_status" && m.status === "pending");
    const refreshed = new Actor(teacher.cookie, room.room); await refreshed.open(); refreshed.send("host");
    await refreshed.wait(m => m.type === "combat_state" && m.rejoinRequests?.some(r => r.studentId === aId));
    await refreshed.ack("review_rejoin", {targetId:aId, decision:"allow"});
    const returned = await a.wait(m => m.type === "combat_state" && m.state.pendingPlayers?.[aId]);
    assert.equal(returned.state.pendingPlayers[aId].health, first.players[aId].health);
    assert.equal(returned.state.pendingPlayers[aId].totals.damageDealt, first.players[aId].totals.damageDealt);
    const late = await open(2); await late.wait(m => m.type === "combat_state" && m.state.pendingPlayers?.[lateId]);
    // These legacy headless clients do not acknowledge playback: the recovery
    // watchdog opens round two. The combat fixture tests explicit completion.
    const second = await resolve([a,b,late], 2);
    assert.equal(second.players[lateId].roundsParticipated, 1);
    assert.equal(second.players[aId].roundsParticipated, 2);
    assert.equal(second.enemies[0].maxHealth, first.enemies[0].maxHealth);
    await refreshed.ack("remove_player", {targetId:bId});
    b = await open(1); await b.wait(m => m.type === "join_status" && m.status === "pending");
    await refreshed.ack("review_rejoin", {targetId:bId,decision:"block"});
    await b.wait(m => m.type === "join_status" && m.status === "blocked");
    const blocked = await open(1); await blocked.wait(m => m.type === "join_status" && m.status === "blocked");
    await refreshed.ack("end_fight");
    const done = await late.wait(m => m.type === "game_over" && m.results?.length, 60000);
    const result = done.results.find(r => r.studentId === lateId), totals = second.players[lateId].totals;
    const progress = 1 - second.enemies.reduce((sum,e) => sum+e.health,0) / second.enemies.reduce((sum,e) => sum+e.maxHealth,0);
    const expected = Math.max(0, 10*progress*.5 + totals.questionsCorrect + totals.damageBlocked + totals.healingDone + totals.bonusDamage - totals.questionsIncorrect);
    assert.ok(Math.abs(result.baseXp-expected) < 1e-8);
    assert.equal(result.goldReward,0);
    assert.equal(done.results.some(r => r.studentId === bId),false);
  });
  await check("logout revokes an already-open student socket", async () => {
    const closed = new Promise(resolve => separate.socket.once("close", code => resolve(code)));
    await api("/api/student/logout", { method: "POST", cookie: students[participantCount].cookie });
    separate.send("join");
    assert.equal(await Promise.race([closed, sleep(10000).then(() => "timeout")]), 1008);
  });
  if (checks.some(x => !x.passed)) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  tearingDown = true;
  for (const socket of sockets) socket.terminate();
  if (teacher) for (const id of fights) {
    try { await api(`/api/fights/${id}`, { method: "DELETE", cookie: teacher.cookie }); }
    catch { console.error(`Unable to archive acceptance fight ${id}`); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ origin, checks }));
  fixtures.finish(process.exitCode ? "failed" : "passed");
  if (representative) await representative.close();
}
