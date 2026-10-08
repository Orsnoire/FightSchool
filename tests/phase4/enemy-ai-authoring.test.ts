import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { issueSession } from "../../worker/auth/session";
import { handleFights } from "../../worker/routes/fights";
import { ENEMY_TYPES, DEFAULT_ENEMY_RULES, ENEMY_MOVES, enemyAISchema, ruleFor } from "../../shared/combat/enemy-ai";
import { ENEMY_CATALOG } from "../../shared/combat/enemy-catalog";
import { initialCombatState } from "../../worker/combat/engine";
import { expandEnemies } from "../../shared/combat/encounters";
import { fight } from "./fixtures";

test("every selectable enemy has a complete moveset, valid default AI, and a registered sprite", () => {
  assert.deepEqual(new Set(ENEMY_TYPES), new Set(["zombie", "ghost", "spider", "vampire", "slime", "samhain", "goblin"]));
  assert.deepEqual(new Set(Object.keys(ENEMY_CATALOG)), new Set(ENEMY_TYPES));
  for (const type of ENEMY_TYPES) {
    assert.ok(ENEMY_CATALOG[type].image.startsWith("/enemies/"));
    const rules = DEFAULT_ENEMY_RULES[type];
    assert.ok(rules.length > 0, `${type} needs default AI`);
    for (const r of rules) assert.ok(ENEMY_MOVES[r.move], `${type}: undefined move ${r.move}`);
    if (type === "goblin") assert.deepEqual(rules.map(r => r.move), ["attack"]);
    else assert.equal(rules.length, 4, `${type} needs its complete four-move set`);
  }
});
for (const type of ENEMY_TYPES) test(`${type} artwork is present, decodable and actually transparent`, () => {
  const image = PNG.sync.read(readFileSync(`client/public${ENEMY_CATALOG[type].image}`));
  assert.ok(image.width >= 256 && image.height >= 256);
  let transparent = 0, visible = 0;
  for (let i = 3; i < image.data.length; i += 4) {
    if (image.data[i] === 0) transparent++;
    if (image.data[i] > 200) visible++;
  }
  assert.ok(transparent > image.width * image.height * 0.1, "Sprite needs transparent background");
  assert.ok(visible > image.width * image.height * 0.05, "Sprite cannot be empty");
});

test("fight API preserves custom AI through save/read and rejects undefined types and undersized goblin groups", async () => {
  const sessions = new Map(); let saved: any;
  const config = { cookieName: "session", secret: "test-only-012345678901234567890123456789", ttlSeconds: 300 };
  const repo: any = { createSession: async (s: any) => sessions.set(s.tokenHash, s), findActiveSession: async (k: string) => sessions.get(k),
    createFight: async (f: any) => saved = { ...f, id: fight.id, createdAt: new Date(), updatedAt: new Date() }, findFightById: async () => saved };
  const cookie = (await issueSession(repo, config, "teacher", fight.teacherId)).split(";")[0];
  const request = async (method: string, body?: unknown) => {
    const url = new URL(`https://qa.example/api/fights${method === "GET" ? `/${fight.id}` : ""}`);
    return handleFights(new Request(url, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), url, repo, config);
  };
  const ai = enemyAISchema.parse({ mode: "custom", rules: [ruleFor("vampiric_bite", { condition: "self_hp_below", value: 40, priority: 80, cooldown: 7 })] });
  const body = { ...fight, enemies: [{ ...fight.enemies[0], enemyType: "vampire", ai }] };
  assert.equal((await request("POST", body))?.status, 201);
  assert.deepEqual((await (await request("GET"))!.json() as any).enemies[0].ai, ai);
  for (const enemy of [
    { ...fight.enemies[0], enemyType: "dragon" },
    { ...fight.enemies[0] },
    { ...fight.enemies[0], enemyType: "goblin", quantity: 1 },
    { ...fight.enemies[0], enemyType: "goblin", quantity: 4 },
    { ...fight.enemies[0], enemyType: "goblin" },
    { ...fight.enemies[0], enemyType: "goblin", quantity: 5, ai },
    { ...fight.enemies[0], enemyType: "goblin", quantity: 5, ai: { mode: "custom", rules: [ruleFor("attack", { target: "healer" })] } },
  ]) assert.equal((await request("POST", { ...fight, enemies: [enemy] }))?.status, 400);
  assert.equal((await request("POST", { ...fight, enemies: [{ ...fight.enemies[0], enemyType: "goblin", quantity: 5 }] }))?.status, 201);
  const snapshot = initialCombatState("FIVE", saved);
  assert.equal(snapshot.enemies.length, 5);
  assert.equal(new Set(snapshot.enemies.map(e => e.id)).size, 5);
  assert.ok(snapshot.enemies.every(e => e.enemyType === "goblin" && e.species === "goblin"));
});

test("explicit species wins over a legacy portrait for AI, expansion and replacement art", () => {
  const enemies = expandEnemies([{ ...fight.enemies[0], image: "/generated_images/Goblin_horde.png", enemyType: "zombie" }], false);
  assert.equal(enemies.length, 1);
  assert.equal(enemies[0].enemyType, "zombie");
  assert.equal(enemies[0].image, "/enemies/zombie-v2.png");
  assert.equal(enemies[0].species, undefined);
});
