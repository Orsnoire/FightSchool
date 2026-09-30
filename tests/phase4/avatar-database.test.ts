import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as s from "../../worker/db/schema.ts";
import { createStudentAvatar, getStudentAvatar, saveStudentAvatarColors } from "../../worker/db/avatar-repository.ts";

const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("attached_assets/characters/human/v1/manifest.json", root), "utf8"));
const journal = JSON.parse(readFileSync(new URL("migrations/cloudflare/meta/_journal.json", root), "utf8"));

test("avatar database preserves students, binds colors correctly and reserves equipment by body part", async (t) => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema: s });
  const repositoryDb = db as any;
  const existingId = randomUUID();
  try {
    for (const migration of journal.entries) {
      if (migration.tag === "0006_avatar_foundation") {
        await db.insert(s.students).values({
          id: existingId, nickname: "Existing", nicknameNormalized: "existing",
          passwordHash: "never-a-valid-password", characterClass: "wizard", gender: "B",
          gold: 123, inventory: ["basic_staff"], weapon: "basic_staff",
        });
      }
      await pg.exec(readFileSync(new URL(`migrations/cloudflare/${migration.tag}.sql`, root), "utf8"));
    }

    await t.test("seed matches the four approved originals and eight colors per channel", async () => {
      const [student] = await db.select().from(s.students).where(eq(s.students.id, existingId));
      assert.equal(student.gold, 123);
      assert.deepEqual(student.inventory, ["basic_staff"]);
      assert.equal(student.weapon, "basic_staff");
      assert.equal(student.passwordHash, "never-a-valid-password");
      assert.equal(student.gender, "B");
      assert.equal(await getStudentAvatar(repositoryDb, existingId), null);
      assert.equal((await db.select().from(s.avatarModels)).length, 2);
      assert.equal((await db.select().from(s.avatarModelViews)).length, 4);
      assert.equal((await db.select().from(s.avatarEquipmentSlots)).length, 18);
      assert.equal((await db.select().from(s.avatarModelSlots)).length, 36);
      assert.deepEqual(await db.select().from(s.avatarEquippedItems), []);
      for (const [paletteId, expected] of Object.entries(catalog.palettes)) {
        const colors = await db.select({ id: s.avatarColors.id, label: s.avatarColors.label, hex: s.avatarColors.hex })
          .from(s.avatarColors).where(eq(s.avatarColors.paletteId, paletteId)).orderBy(s.avatarColors.sortOrder);
        assert.equal(colors.length, 8);
        assert.deepEqual(colors, expected);
      }
      for (const view of await db.select().from(s.avatarModelViews)) {
        const bytes = readFileSync(new URL(view.sourcePath, root));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), view.sourceSha256);
        assert.equal(bytes.readUInt32BE(16), view.width);
        assert.equal(bytes.readUInt32BE(20), view.height);
        assert.equal(bytes[25], 6, "PNG must retain RGBA color type");
        assert.equal(view.recolorReady, false);
        assert.equal(view.rigReady, false);
        assert.equal(view.hairMaskPath, null);
        assert.equal(view.rigPath, null);
      }
    });

    await t.test("initial colors use independent rolls, then survive retries and explicit changes", async () => {
      const rolls = [0, 0.51, 0.99999];
      const avatar = await createStudentAvatar(repositoryDb, existingId, "human-female-v1", {}, () => rolls.shift()!);
      assert.equal(rolls.length, 0);
      assert.equal(avatar.hairColorId, "black");
      assert.equal(avatar.eyeColorId, "hazel");
      assert.equal(avatar.skinColorId, "very-deep-brown");
      const retry = await createStudentAvatar(repositoryDb, existingId, "human-male-v1", {}, () => { throw new Error("must not reroll"); });
      assert.deepEqual(retry, avatar, "retries must not alter saved model or colors");
      const selection = { hairColorId: "golden-blond", eyeColorId: "blue", skinColorId: "fair-cool" };
      const changed = await saveStudentAvatarColors(repositoryDb, existingId, selection);
      assert.equal(changed?.id, avatar.id);
      assert.equal(changed?.modelId, "human-female-v1");
      assert.equal(changed?.eyeColorId, "blue");
      assert.equal((await getStudentAvatar(repositoryDb, existingId))?.hairColorId, "golden-blond");
      await assert.rejects(() => saveStudentAvatarColors(repositoryDb, existingId, { ...selection, hairColorId: "blue" }));
      await assert.rejects(() => db.update(s.studentAvatars).set({ hairPaletteId: "human-eyes-v1", hairColorId: "blue" }).where(eq(s.studentAvatars.id, avatar.id)));
      assert.equal((await getStudentAvatar(repositoryDb, existingId))?.hairColorId, "golden-blond");
    });

    await t.test("explicit overrides and concurrent creation preserve a single avatar", async () => {
      const id = randomUUID();
      await db.insert(s.students).values({ id, nickname: "New", nicknameNormalized: "new", passwordHash: "never-valid" });
      const colors = { hairColorId: "copper", eyeColorId: "green", skinColorId: "medium-brown" };
      await assert.rejects(() => createStudentAvatar(repositoryDb, id, "human-male-v1", { hairColorId: "blue" }));
      assert.equal(await getStudentAvatar(repositoryDb, id), null);
      const create = () => createStudentAvatar(repositoryDb, id, "human-male-v1", colors, () => { throw new Error("explicit selections need no roll"); });
      const [a, b] = await Promise.all([create(), create()]);
      assert.equal(a.id, b.id);
      assert.equal(a.hairColorId, "copper");
      assert.equal((await db.select().from(s.studentAvatars).where(eq(s.studentAvatars.studentId, id))).length, 1);
      await db.delete(s.students).where(eq(s.students.id, id));
      assert.equal(await getStudentAvatar(repositoryDb, id), null);
    });

    await t.test("database rejects channel mix-ups and unprepared assets marked ready", async () => {
      await assert.rejects(() => db.update(s.avatarModels).set({ hairPaletteId: "human-eyes-v1" }).where(eq(s.avatarModels.id, "human-male-v1")));
      await assert.rejects(() => db.update(s.avatarModelViews).set({ recolorReady: true }));
      await assert.rejects(() => db.update(s.avatarModelViews).set({ rigReady: true }));
      await assert.rejects(() => db.insert(s.avatarColors).values({ paletteId: "human-hair-v1", id: "bad", label: "Bad", hex: "red", sortOrder: 99 }));
    });

    await t.test("gloves and weapons coexist; wrong body slots, models and views are rejected", async () => {
      const avatar = (await getStudentAvatar(repositoryDb, existingId))!;
      await db.insert(s.avatarEquipment).values([{ id: "test-sword", name: "Test sword" }, { id: "test-glove", name: "Test glove" }]);
      await db.insert(s.avatarEquipmentFits).values([
        { equipmentId: "test-sword", modelId: avatar.modelId, slotId: "right-grip" },
        { equipmentId: "test-glove", modelId: avatar.modelId, slotId: "right-hand" },
      ]);
      await db.insert(s.avatarEquippedItems).values([
        { avatarId: avatar.id, modelId: avatar.modelId, slotId: "right-grip", equipmentId: "test-sword" },
        { avatarId: avatar.id, modelId: avatar.modelId, slotId: "right-hand", equipmentId: "test-glove" },
      ]);
      assert.equal((await db.select().from(s.avatarEquippedItems)).length, 2);
      await assert.rejects(() => db.insert(s.avatarEquippedItems).values({ avatarId: avatar.id, modelId: avatar.modelId, slotId: "head", equipmentId: "test-sword" }));
      await assert.rejects(() => db.insert(s.avatarEquippedItems).values({ avatarId: avatar.id, modelId: "human-male-v1", slotId: "right-grip", equipmentId: "test-sword" }));
      await assert.rejects(() => db.insert(s.avatarEquippedItems).values({ avatarId: avatar.id, modelId: avatar.modelId, slotId: "right-grip", equipmentId: "test-sword" }));
      await assert.rejects(() => db.update(s.studentAvatars).set({ modelId: "human-male-v1" }).where(eq(s.studentAvatars.id, avatar.id)), "model switches must resolve equipped parts first");
      const visual = { equipmentId: "test-sword", modelId: avatar.modelId, slotId: "right-grip", assetPath: "test-only/sword.png" };
      await assert.rejects(() => db.insert(s.avatarEquipmentVisuals).values({ ...visual, viewKey: "missing" }));
      await assert.rejects(() => db.insert(s.avatarEquipmentVisuals).values({ ...visual, viewKey: "front", ready: true }));
      await db.insert(s.avatarEquipmentVisuals).values({ ...visual, viewKey: "front" });
      await db.delete(s.students).where(eq(s.students.id, existingId));
      assert.deepEqual(await db.select().from(s.avatarEquippedItems), []);
    });
  } finally {
    await pg.close();
  }
});
