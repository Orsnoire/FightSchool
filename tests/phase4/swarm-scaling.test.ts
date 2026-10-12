import assert from "node:assert/strict";
import { test } from "node:test";
import { enemySchema } from "../../shared/schema";
import { addStudent, advancePhase, initialCombatState, removeStudent, scaleEncounter, startQuestion } from "../../worker/combat/engine";
import { publicSnapshot } from "../../worker/combat/session-object";
import { issueSession } from "../../worker/auth/session";
import { handleFights } from "../../worker/routes/fights";
import type { FightRecord } from "../../worker/db/schema";
import { fight, student } from "./fixtures";

const swarm = { enemiesPerFourPlayers: 5 };
const template: FightRecord = {
  ...fight, encounterTier: 1,
  enemies: [{ ...fight.enemies[0], enemyType: "goblin", species: "goblin", role: "trash", quantity: 5, wave: 1, swarm }],
};
function waiting(count: number, f = template) {
  let s = initialCombatState("SWARM2", f);
  for (let i = 0; i < count; i++) s = addStudent(s, student("warrior", `p${i}`));
  return s;
}
const roster = (s: ReturnType<typeof initialCombatState>) => s.enemies.map(e => [e.id, e.health, e.maxHealth, e.wave]);

test("non-goblin swarms share their HP budget without multiplying it again and initialize every new enemy", () => {
  const scaledTemplate: FightRecord = { ...template, enemies: [{ ...fight.enemies[0], enemyType: "samhain", role: "boss", quantity: 1, swarm: { enemiesPerFourPlayers: 2 } }] };
  const fixedTemplate = { ...scaledTemplate, enemies: [{ ...scaledTemplate.enemies[0], swarm: undefined }] };
  const grown = scaleEncounter(waiting(8, scaledTemplate), scaledTemplate);
  const fixed = scaleEncounter(waiting(8, fixedTemplate), fixedTemplate);
  assert.equal(grown.enemies.length, 3);
  assert.ok(grown.enemies.every(e => e.attackPower === 1 && e.defense === 1 && e.ai && e.aiState));
  assert.ok(Math.abs(grown.enemies.reduce((sum, e) => sum + e.maxHealth, 0) - fixed.enemies[0].maxHealth) < 0.003);
  assert.equal(grown.enemyRoundBudget, fixed.enemyRoundBudget);
  assert.equal(grown.encounterXpFraction, fixed.encounterXpFraction);
  const solo = scaleEncounter(waiting(1, scaledTemplate), scaledTemplate, true);
  assert.equal(solo.enemies.length, 1);
});

test("swarm previews add batches only at 8/12/16 players and match Start Fight without mutating the room", () => {
  for (const [players, count] of [[0,5],[1,5],[4,5],[7,5],[8,10],[11,10],[12,15],[16,20],[30,35],[60,60]]) {
    const s = waiting(players), before = structuredClone(s);
    const preview = publicSnapshot(s, template);
    assert.equal(preview.enemies.length, count, `${players} players`);
    assert.equal(new Set(preview.enemies.map(e => e.id)).size, count);
    assert.deepEqual(s, before, "preview cannot persist expanded counts or HP");
    if (players) {
      const scaled = scaleEncounter(s, template);
      assert.deepEqual(roster(startQuestion(scaled)), roster(preview));
      assert.deepEqual(roster(scaleEncounter(scaled, template)), roster(scaled), "repeated scaling cannot add a second batch");
      assert.ok(scaled.enemies.every(e => e.ai && e.aiState && e.enemyType === "goblin"));
    }
  }
  const eight = waiting(8);
  const seven = removeStudent(eight, "p7");
  assert.equal(publicSnapshot(seven, template).enemies.length, 5);
  const rejoined = addStudent(seven, student("warrior", "p7"));
  assert.deepEqual(roster(publicSnapshot(rejoined, template)), roster(publicSnapshot(eight, template)));
});

test("swarm caps reserve fixed groups and distribute extra individuals deterministically across waves", () => {
  const f: FightRecord = { ...template, enemies: [
    { ...template.enemies[0], id: "a", quantity: 50 },
    { ...template.enemies[0], id: "b", quantity: 50, wave: 2 },
    { ...fight.enemies[0], id: "fixed", enemyType: "samhain", role: "boss", quantity: 5, wave: 3 },
  ] };
  const s = scaleEncounter(waiting(60, f), f);
  assert.deepEqual(["a", "b", "fixed"].map(id => s.enemies.filter(e => e.templateId === id).length), [58,57,5]);
  assert.equal(s.enemies.length, 120);
  assert.equal(new Set(s.enemies.map(e => e.id)).size, 120);
  assert.ok(s.enemies.filter(e => e.templateId === "b").every(e => e.wave === 2));
  const fixed = { ...template, enemies: [{ ...template.enemies[0], swarm: undefined }] };
  assert.equal(scaleEncounter(waiting(60, fixed), fixed).enemies.length, 5);
  const atCapacity = { ...f, enemies: f.enemies.map((e, i) => ({ ...e, quantity: i < 2 ? 55 : 10 })) };
  assert.equal(scaleEncounter(waiting(60, atCapacity), atCapacity).enemies.length, 120);
});

test("late entry and reconnect preserve locked swarm counts and defeated enemies", () => {
  let s = startQuestion(scaleEncounter(waiting(7), template));
  s.currentPhase = "enemy_ai";
  s.enemies[0].health = 0;
  s.enemies[1].health /= 2;
  s = addStudent(s, student("warrior", "late"));
  const next = advancePhase(s, template, 1000);
  assert.equal(next.encounterAttendance, 8);
  assert.equal(next.enemies.length, 5);
  assert.equal(next.enemies[0].health, 0);
  assert.ok(Math.abs(next.enemies[1].health / next.enemies[1].maxHealth - 0.5) < 0.001);
  assert.deepEqual(roster(publicSnapshot(JSON.parse(JSON.stringify(next)), template)), roster(next));
  assert.deepEqual(scaleEncounter(next, template), next);
});

test("swarm settings survive shared and HTTP create/update/read boundaries and invalid increments fail", async () => {
  assert.deepEqual((enemySchema.parse(template.enemies[0]) as any).swarm, swarm);
  const sessions = new Map(); let saved: any;
  const config = { cookieName: "session", secret: "test-only-012345678901234567890123456789", ttlSeconds: 300 };
  const repo: any = {
    createSession: async (s: any) => sessions.set(s.tokenHash, s), findActiveSession: async (k: string) => sessions.get(k),
    createFight: async (f: any) => saved = { ...f, id: fight.id, createdAt: new Date(), updatedAt: new Date() },
    updateFight: async (_: string, teacherId: string, f: any) => teacherId === saved.teacherId ? saved = { ...saved, ...f } : undefined, findFightById: async () => saved,
  };
  const cookie = (await issueSession(repo, config, "teacher", fight.teacherId)).split(";")[0];
  const request = async (method: string, body?: unknown) => {
    const url = new URL(`https://qa.example/api/fights${method === "POST" ? "" : `/${fight.id}`}`);
    return handleFights(new Request(url, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), url, repo, config);
  };
  assert.equal((await request("POST", template))?.status, 201);
  assert.deepEqual((await (await request("GET"))!.json() as any).enemies[0].swarm, swarm);
  const edited = { ...template, enemies: [{ ...template.enemies[0], swarm: { enemiesPerFourPlayers: 2 } }] };
  assert.equal((await request("PATCH", edited))?.status, 200);
  assert.deepEqual((await (await request("GET"))!.json() as any).enemies[0].swarm, edited.enemies[0].swarm);
  for (const bad of [0,-1,1.5,61,"5",null]) {
    const enemy = { ...template.enemies[0], swarm: { enemiesPerFourPlayers: bad } };
    assert.equal(enemySchema.safeParse(enemy).success, false);
    assert.equal((await request("POST", { ...template, enemies: [enemy] }))?.status, 400);
  }
  const disabled = { ...template, enemies: [{ ...template.enemies[0], swarm: undefined }] };
  assert.equal((await request("PATCH", disabled))?.status, 200);
  assert.equal((await (await request("GET"))!.json() as any).enemies[0].swarm, undefined);
});
