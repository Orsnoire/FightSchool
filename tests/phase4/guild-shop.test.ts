import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as s from "../../worker/db/schema";
import { handleGame } from "../../worker/routes/game";
import { issueSession } from "../../worker/auth/session";
import { EQUIPMENT_ITEMS, calculateTierPrice } from "../../shared/schema";
import { builtinShopItems } from "../../shared/equipment-shop";
import { TIER_ONE_EQUIPMENT } from "../../shared/tier-one-equipment";
import { fight, student } from "./fixtures";

test("default stock includes all 37 defined tier-one items and automatically includes future tiers", () => {
  const defaults = builtinShopItems();
  assert.deepEqual(defaults.map(i => i.id).sort(), Object.keys(TIER_ONE_EQUIPMENT).sort());
  assert.equal(defaults.length, 37);
  assert.ok(defaults.every(i => i.isPurchasable && i.shopPrice === 150));
  for (const tier of [2, 3]) {
    const rows = builtinShopItems({
      ...EQUIPMENT_ITEMS,
      future: { ...TIER_ONE_EQUIPMENT.t1_fighter_armor, id: "future", tier },
    });
    assert.equal(rows.find(i => i.id === "future")?.shopPrice, calculateTierPrice(tier, "common"));
  }
});

test("shop HTTP lists and purchases default gear while enforcing guild tiers, ownership and atomic gold", async () => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema: s });
  const futureIds = ["test_t2_armor", "test_t3_armor"];
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    for (const { tag } of journal.entries) await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    const otherTeacher = crypto.randomUUID();
    for (const [index, id] of [fight.teacherId, otherTeacher].entries()) await db.insert(s.teachers).values({
      id, firstName: "Shop", lastName: "Test", email: `shop${index}@example.invalid`, emailNormalized: `shop${index}@example.invalid`,
      passwordHash: "unused", guildCode: `SHOP0${index}`, billingAddress: "Test", schoolDistrict: "Test", school: "Test", subject: "Math", gradeLevel: "5",
    });
    const [guild] = await db.insert(s.guilds).values({ teacherId: fight.teacherId, name: "Shop test", code: "SHOP01", unlockedTier: 1 }).returning();
    await db.insert(s.students).values({ ...student(), guildId: guild.id, gold: 5000, inventory: [] });
    await db.insert(s.guildMemberships).values({ guildId: guild.id, studentId: student().id });
    const customs = await db.insert(s.equipmentItems).values([
      { teacherId: fight.teacherId, name: "Custom armor", itemType: "heavy_armor", armorCategory: "heavy_armor", slot: "armor", quality: "common", tier: 1, shopPrice: 73 },
      { teacherId: fight.teacherId, name: "Loot only", itemType: "heavy_armor", armorCategory: "heavy_armor", slot: "armor", quality: "common", tier: 1, isPurchasable: false },
      { teacherId: otherTeacher, name: "Other teacher", itemType: "heavy_armor", armorCategory: "heavy_armor", slot: "armor", quality: "common", tier: 1 },
      { teacherId: fight.teacherId, name: "Locked custom", itemType: "heavy_armor", armorCategory: "heavy_armor", slot: "armor", quality: "common", tier: 2 },
    ]).returning();
    for (const [index, id] of futureIds.entries()) EQUIPMENT_ITEMS[id] = { ...TIER_ONE_EQUIPMENT.t1_fighter_armor, id, tier: index + 2 };
    const sessions = new Map();
    const repository: any = { createSession: async (r: any) => sessions.set(r.tokenHash, r), findActiveSession: async (key: string) => sessions.get(key) || null };
    const config = { cookieName: "test_session", secret: "test-only-secret-not-deployed-1234567890", ttlSeconds: 300 };
    const cookie = (await issueSession(repository, config, "student", student().id)).split(";")[0];
    const call = async (path: string, body?: unknown) => {
      const url = new URL("https://qa.example" + path);
      const response = await handleGame(new Request(url, { method: body === undefined ? "GET" : "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), url, repository, config, db as any);
      assert.ok(response);
      return { status: response.status, body: await response.json() as any };
    };
    const list = () => call("/api/equipment-items/shop");
    const buy = (itemId: string) => call(`/api/student/${student().id}/purchase-item`, { itemId, price: 1 });
    const saved = async () => (await db.select().from(s.students).where(eq(s.students.id, student().id)))[0];
    const stock = await list();
    assert.equal(stock.status, 200);
    assert.deepEqual(stock.body.map((i: any) => i.id).sort(), [...Object.keys(TIER_ONE_EQUIPMENT), customs[0].id].sort());
    assert.equal(stock.body.find((i: any) => i.id === customs[0].id).shopPrice, 73);
    for (const itemId of ["basic_armor", "plate_armor", "not_a_registered_item", customs[1].id, customs[2].id, customs[3].id, ...futureIds]) {
      assert.equal((await buy(itemId)).status, 400, `unavailable: ${itemId}`);
    }
    assert.equal((await saved()).gold, 5000);
    assert.equal((await call(`/api/student/${crypto.randomUUID()}/purchase-item`, { itemId: "t1_fighter_armor" })).status, 403);

    // Competing purchases must award and charge once; the client-supplied price is ignored.
    const attempts = await Promise.all([buy("t1_fighter_armor"), buy("t1_fighter_armor")]);
    assert.deepEqual(attempts.map(r => r.status).sort(), [200, 409]);
    assert.equal((await saved()).gold, 4850);
    assert.deepEqual((await saved()).inventory, ["t1_fighter_armor"]);
    assert.equal((await buy(customs[0].id)).status, 200);
    assert.equal((await saved()).gold, 4777);

    for (const [index, id] of futureIds.entries()) {
      await db.update(s.guilds).set({ unlockedTier: index + 2 }).where(eq(s.guilds.id, guild.id));
      assert.ok((await list()).body.some((i: any) => i.id === id));
      if (index === 0) assert.ok(!(await list()).body.some((i: any) => i.id === futureIds[1]));
      assert.equal((await buy(id)).status, 200);
    }
    await db.update(s.students).set({ gold: 149 }).where(eq(s.students.id, student().id));
    assert.equal((await buy("t1_fighter_sword")).status, 409);
    assert.equal((await saved()).gold, 149);
    assert.ok(!(await saved()).inventory.includes("t1_fighter_sword"));
    await db.update(s.students).set({ guildId: null }).where(eq(s.students.id, student().id));
    assert.deepEqual((await list()).body, []);
    assert.equal((await buy("t1_fighter_sword")).status, 400);
  } finally {
    for (const id of futureIds) delete EQUIPMENT_ITEMS[id];
    await pg.close();
  }
});
