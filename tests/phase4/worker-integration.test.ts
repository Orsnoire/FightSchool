import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { neonConfig } from "@neondatabase/serverless";
import { combatProfile, gameDatabase } from "../../worker/db/game-repository.ts";
import worker from "../../worker/index.ts";
import { EQUIPMENT_SLOTS, STARTER_ITEM_IDS } from "../../shared/equipment-catalog.ts";
import { initialAppearance, PALETTES } from "../../shared/avatar/appearance.ts";

// Run the real Worker routes, identity repository, and SQL against a disposable
// database. Only Neon's network boundary and Cloudflare bindings are replaced.
test("Worker integrates migrated auth, guilds, rooms, equipment, uploads, and revocation", async () => {
  const pg = new PGlite();
  const previousFetch = neonConfig.fetchFunction;
  const databaseErrors: string[] = [];
  let subrequests = 0;
  try {
    const journal = JSON.parse(readFileSync(new URL("../../migrations/cloudflare/meta/_journal.json", import.meta.url), "utf8"));
    let legacyLoadout: Record<string, unknown> | undefined;
    const legacyId = '00000000-0000-4000-8000-000000000011';
    for (const { tag } of journal.entries) {
      if (tag === '0011_equipment_arms') {
        await pg.query(`INSERT INTO students (id,nickname,nickname_normalized,password_hash,weapon,armor,headgear,hands,legs,feet,offhand,inventory,gold)
          VALUES ($1,'Legacy','legacy','test','custom-sword','custom-chest','custom-head','custom-hands','custom-pants','custom-feet','custom-shield','["saved-upgrade"]',17)`, [legacyId]);
        legacyLoadout = (await pg.query('SELECT * FROM students WHERE id=$1', [legacyId])).rows[0];
      }
      await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), "utf8"));
    }
    const migrated = (await pg.query<Record<string, unknown>>('SELECT * FROM students WHERE id=$1', [legacyId])).rows[0];
    assert.equal(migrated.arms, null);
    const { arms: _arms, ...preserved } = migrated;
    assert.deepEqual(preserved, legacyLoadout, 'arms migration preserves every existing student field');
    await pg.query('DELETE FROM students WHERE id=$1', [legacyId]);
    neonConfig.fetchFunction = async (_url, init) => {
      if (++subrequests > 50) {
        databaseErrors.push("Worker external subrequest budget exceeded");
        throw new Error("Worker external subrequest budget exceeded");
      }
      const { query, params } = JSON.parse(init!.body as string);
      try {
        const result = await pg.query<any[]>(query, params, { rowMode: "array" });
        const rows = result.rows.map(row => row.map(value =>
          value === null ? null : value instanceof Date ? value.toISOString() :
          typeof value === "object" ? JSON.stringify(value) : String(value)));
        return Response.json({ rows, fields: result.fields, rowCount: result.affectedRows ?? rows.length });
      } catch (error: any) {
        databaseErrors.push(`${error.code}: ${error.message}`);
        return Response.json({ message: error.message, code: error.code }, { status: 400 });
      }
    };
    const objects = new Map<string, { bytes: Uint8Array; type: string }>();
    const env = {
      DATABASE_URL: "postgresql://test:test@local.example/test",
      PASSWORD_PEPPER: "local-only-pepper-012345678901234567890123",
      SESSION_SECRET: "local-only-secret-012345678901234567890123",
      SESSION_COOKIE_NAME: "qa_test_session",
      SESSION_TTL_SECONDS: "3600",
      STAGING_AUTH_TOKEN: "local-only-smoke",
      ENVIRONMENT: "test",
      PUBLIC_ORIGIN: "https://qa.example",
      ASSETS: { fetch: async () => new Response("SPA") },
      COMBAT_SESSIONS: {
        idFromName: (name: string) => name,
        get: () => ({ fetch: async () => Response.json({ status: "ready", allowed: true }) }),
      },
      OBJECTS: {
        head: async (key: string) => {
          const item = objects.get(key);
          return item ? { size: item.bytes.length, httpEtag: '"test-etag"', httpMetadata: { contentType: item.type } } : null;
        },
        get: async (key: string, options?: { range: { offset: number; length: number } }) => {
          const item = objects.get(key);
          const range = options?.range;
          return item ? { body: range ? item.bytes.slice(range.offset, range.offset + range.length) : item.bytes,
            size: item.bytes.length, httpEtag: '"test-etag"', httpMetadata: { contentType: item.type } } : null;
        },
        put: async (key: string, bytes: Uint8Array, options: any) => {
          objects.set(key, { bytes, type: options.httpMetadata.contentType });
        },
      },
    };
    async function api(path: string, method = "GET", cookie?: string, body?: unknown, status = 200) {
      subrequests = 0;
      const response = await worker.fetch(new Request(env.PUBLIC_ORIGIN + path, {
        method, headers: { Origin: env.PUBLIC_ORIGIN, ...(cookie ? { Cookie: cookie } : {}), "Content-Type": "application/json" },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }), env as any);
      const payload = await response.json();
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)} ${databaseErrors.join("; ")}`);
      return { payload, cookie: response.headers.get("set-cookie")?.split(";")[0], response };
    }
    const password = "local-acceptance-password";
    const teacherBody = (email: string) => ({ firstName: "Test", lastName: "Teacher", email, password,
      billingAddress: "Test", schoolDistrict: "Test", school: "Test", subject: "Math", gradeLevel: "10" });
    const teacher = await api("/api/teacher/signup", "POST", undefined, teacherBody("teacher@example.invalid"), 201);
    const other = await api("/api/teacher/signup", "POST", undefined, teacherBody("other@example.invalid"), 201);
    assert.match(teacher.response.headers.get("set-cookie")!, /HttpOnly; Secure; SameSite=Lax/);
    assert.equal(teacher.payload.passwordHash, undefined);
    await api("/api/teacher/login", "POST", undefined, { email: "teacher@example.invalid", password: "wrong" }, 401);
    const student = await api("/api/student/login", "POST", undefined, { nickname: "Test student", password });
    assert.equal(student.payload.passwordHash, undefined);
    await api(`/api/student/${student.payload.id}/character`, "PATCH", student.cookie, { characterClass: "wizard", gender: "A" });
    await api(`/api/student/${student.payload.id}/character`, "PATCH", student.cookie, { characterClass: "paladin", gender: "A" }, 403);
    // Appearance is independently persisted, own-student only, and never rerolled by reads or job changes.
    const avatarPath = `/api/student/${student.payload.id}/avatar`;
    await api(avatarPath, "GET", undefined, undefined, 401);
    await api(avatarPath, "GET", teacher.cookie, undefined, 401);
    await api(`/api/student/00000000-0000-0000-0000-000000000000/avatar`, "GET", student.cookie, undefined, 403);
    assert.equal((await api(avatarPath, "GET", student.cookie)).payload, null);
    const appearance = initialAppearance(null, 'human-male-v1', () => 0.25);
    await api(avatarPath, "PUT", student.cookie, appearance, 409);
    await api(avatarPath, "POST", student.cookie, {...appearance, hairColorId: 'invalid'}, 400);
    const beforeAppearance = (await api(`/api/student/${student.payload.id}`, "GET", student.cookie)).payload;
    assert.deepEqual((await api(avatarPath, "POST", student.cookie, appearance)).payload, appearance);
    assert.deepEqual((await api(avatarPath, "POST", student.cookie, {...appearance, skinColorId: PALETTES.skin[7].id})).payload, appearance);
    const changedAppearance = {...appearance, hairColorId: PALETTES.hair[7].id, eyeColorId: PALETTES.eyes[5].id};
    assert.deepEqual((await api(avatarPath, "PUT", student.cookie, changedAppearance)).payload, changedAppearance);
    await api(avatarPath, "PUT", student.cookie, {...appearance, modelId: 'human-female-v1'}, 409);
    const afterAppearance = (await api(`/api/student/${student.payload.id}`, "GET", student.cookie)).payload;
    for (const key of ['characterClass','gender','weapon','headgear','armor','gold','totalXP']) assert.deepEqual(afterAppearance[key], beforeAppearance[key]);
    await api(`/api/student/${student.payload.id}/character`, "PATCH", student.cookie, { characterClass: "scout", gender: "A" });
    assert.deepEqual((await api(avatarPath, "GET", student.cookie)).payload, changedAppearance);
    await api(`/api/student/${student.payload.id}/character`, "PATCH", student.cookie, { characterClass: "wizard", gender: "A" });
    assert.deepEqual((await api(avatarPath, "GET", student.cookie)).payload, changedAppearance);
    const badOrigin = await worker.fetch(new Request(env.PUBLIC_ORIGIN + avatarPath, {method:'PUT',headers:{Origin:'https://untrusted.invalid',Cookie:student.cookie!,'Content-Type':'application/json'},body:JSON.stringify(appearance)}), env as any);
    assert.equal(badOrigin.status,403);
    const stock = (await api(`/api/student/${student.payload.id}`, 'GET', student.cookie)).payload.inventory;
    assert.ok(STARTER_ITEM_IDS.every(item => stock.includes(item)));
    assert.equal(new Set(stock).size, stock.length);
    const metadata = (await api(`/api/equipment-items?ids=${STARTER_ITEM_IDS.join(',')},plate_armor`, 'GET', student.cookie)).payload;
    for (const id of STARTER_ITEM_IDS) assert.equal(metadata.find((item: any) => item.id === id).tier, 0);
    assert.equal(metadata.find((item: any) => item.id === "plate_armor").tier, 1);
    const equipPath = `/api/student/${student.payload.id}/equipment`;
    await api(equipPath, 'PATCH', student.cookie, {arms:'basic_plate_arms'},400);
    await api(equipPath, 'PATCH', student.cookie, {arms:'basic_cloth_arms'});
    await api(equipPath, 'PATCH', student.cookie, {hands:'basic_cloth_arms'},400);
    await api(equipPath, 'PATCH', student.cookie, {arms:null});
    assert.equal((await api(`/api/student/${student.payload.id}`, 'GET', student.cookie)).payload.arms, null);
    await api(equipPath, 'PATCH', student.cookie, {armor:'basic_armor'},400);
    await api(equipPath, 'PATCH', student.cookie, {hands:'basic_leather_gloves'},400);
    await api(equipPath, 'PATCH', student.cookie, {weapon:'legendary_blade'},400);
    await api(equipPath, 'PATCH', student.cookie, {offhand:'basic_potion'},400);
    await api(equipPath, 'PATCH', student.cookie, {armor:'basic_robe',headgear:'basic_laurel'});
    await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'wizard',gender:'A'});
    assert.equal((await api(`/api/student/${student.payload.id}`, 'GET', student.cookie)).payload.headgear,'basic_laurel');
    const herbalist = await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'herbalist',gender:'A'});
    assert.equal(herbalist.payload.offhand,'basic_potion');
    await api(equipPath, 'PATCH', student.cookie, {weapon:null},400);
    await api(equipPath, 'PATCH', student.cookie, {weapon:null,offhand:null});
    const warrior = await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'warrior',gender:'A'});
    assert.equal(warrior.payload.offhand,'basic_shield');
    assert.equal(warrior.payload.hands,'basic_plate_gloves');
    await api(equipPath, 'PATCH', student.cookie, {armor:'plate_armor'},400); // Nonstarter built-ins are not free.
    const scout = await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'scout',gender:'A'});
    assert.equal(scout.payload.offhand,'basic_quiver');
    await api(equipPath, 'PATCH', student.cookie, {headgear:'basic_helm'},400);
    assert.ok(STARTER_ITEM_IDS.every(item => scout.payload.inventory.includes(item)));
    await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'wizard',gender:'A'});
    // Every registered slot persists and contributes exactly once to combat stats.
    await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'warrior',gender:'A'});
    const customLoadout: Record<string, string> = {};
    for (const [index, slot] of EQUIPMENT_SLOTS.entries()) {
      const created = await api('/api/equipment-items', 'POST', teacher.cookie, {
        name: `Upgrade ${slot}`, slot, itemType: slot === 'weapon' ? 'sword' : slot === 'offhand' ? 'shield' : 'bracers',
        weaponType: slot === 'weapon' ? 'sword' : null, offhandType: slot === 'offhand' ? 'shield' : null,
        armorCategory: slot === 'weapon' || slot === 'offhand' ? null : 'heavy_armor',
        quality:'common', tier:1, stats:{str:index + 1,agi:1},
      }, 201);
      customLoadout[slot] = created.payload.id;
    }
    await api(equipPath, 'PATCH', student.cookie, {arms:customLoadout.arms},400);
    await pg.query('UPDATE students SET inventory = inventory || $1::jsonb WHERE id=$2', [JSON.stringify(Object.values(customLoadout)), student.payload.id]);
    await api(equipPath, 'PATCH', student.cookie, customLoadout);
    const sameJob = (await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'warrior',gender:'A'})).payload;
    for (const slot of EQUIPMENT_SLOTS) assert.equal(sameJob[slot], customLoadout[slot]);
    subrequests = 0;
    const profile = await combatProfile(gameDatabase(env.DATABASE_URL), sameJob);
    assert.equal(profile.equipment?.str, 36);
    assert.equal(profile.equipment?.agi, 8);
    await api('/api/equipment-items', 'POST', teacher.cookie, {name:'Not a starter',slot:'arms',itemType:'bracers',quality:'common',tier:0,stats:{}},400);
    await api(`/api/equipment-items/${customLoadout.arms}`, 'PATCH', teacher.cookie, {tier:2});
    await api(equipPath, 'PATCH', student.cookie, {arms:null});
    await api(equipPath, 'PATCH', student.cookie, {arms:customLoadout.arms},400);
    await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'wizard',gender:'A'});
    await pg.query("UPDATE students SET character_class='blood_knight',offhand=NULL WHERE id=$1", [student.payload.id]);
    const claymoreSave = await api(equipPath, 'PATCH', student.cookie, {weapon:'basic_claymore'});
    assert.equal(claymoreSave.payload.weapon,'basic_claymore');
    assert.equal(claymoreSave.payload.offhand,null);
    await api(`/api/student/${student.payload.id}/character`, 'PATCH', student.cookie, {characterClass:'wizard',gender:'A'});
    const guild = await api("/api/guilds", "POST", teacher.cookie, { name: "Test guild" }, 201);
    await api(`/api/guilds/${guild.payload.id}/members`, "POST", student.cookie, { studentId: student.payload.id });
    await api(`/api/guilds/${guild.payload.id}/members`, "GET", other.cookie, undefined, 403);
    const quests = await api(`/api/guilds/${guild.payload.id}/quests`, "GET", student.cookie);
    assert.ok(quests.payload.length > 0);
    const quest = await api(`/api/guilds/${guild.payload.id}/quests`, "POST", teacher.cookie, {
      title: "Acceptance manual reward", description: "Exactly once", criteria: { type: "custom" }, rewards: { gold: 2 },
    }, 201);
    await api(`/api/guilds/${guild.payload.id}/quests/${quest.payload.id}`, "PATCH", teacher.cookie, { isCompleted: true });
    await api(`/api/guilds/${guild.payload.id}/quests/${quest.payload.id}`, "PATCH", teacher.cookie, { isCompleted: true });
    assert.equal((await api(`/api/student/${student.payload.id}`, "GET", student.cookie)).payload.gold, 2);
    const item = await api("/api/equipment-items", "POST", teacher.cookie, {
      name: "Test wand", itemType: "wand", weaponType: "staff", slot: "weapon", quality: "common", tier: 1, stats: { mat: 1 }, shopPrice: 1,
    }, 201);
    const fight = await api("/api/fights", "POST", teacher.cookie, {
      teacherId: teacher.payload.id, title: "Integration fight",
      questions: [{ id: "q1", type: "short_answer", question: "2+2?", correctAnswer: "4", timeLimit: 30 }],
      enemies: [{ id: "e1", name: "Slime", image: "/slime.png", difficultyMultiplier: 1 }],
      baseXP: 10, baseEnemyDamage: 1, enemyDisplayMode: "consecutive", lootTable: [{ itemId: item.payload.id }],
      randomizeQuestions: false, shuffleOptions: false,
    }, 201);
    await api(`/api/fights/${fight.payload.id}`, "GET", other.cookie, undefined, 403);
    await api(`/api/fights/${fight.payload.id}`, "GET", student.cookie, undefined, 401);
    await api(`/api/guilds/${guild.payload.id}/fights`, "POST", teacher.cookie, { fightId: fight.payload.id });
    const assignment = await api(`/api/guilds/${guild.payload.id}/fights`, "GET", student.cookie);
    assert.equal(assignment.payload[0].questions, undefined);
    const room = await api(`/api/fights/${fight.payload.id}/sessions`, "POST", teacher.cookie, undefined, 201);
    const resumed = await api(`/api/fights/${fight.payload.id}/sessions`, "POST", teacher.cookie);
    assert.equal(resumed.payload.sessionId, room.payload.sessionId);
    await api(`/api/sessions/${room.payload.sessionId}`, "GET", student.cookie);
    await api(`/api/student/${student.payload.id}/award-xp`, "POST", student.cookie, { xp: 100000 }, 403);
    const stamina = await api(`/api/student/${student.payload.id}/stamina`, "GET", student.cookie);
    assert.equal(stamina.payload.xpMultiplier, 1);
    assert.equal(stamina.payload.completedCombats, 0);
    assert.equal(stamina.payload.timeZone, "America/Denver");
    assert.ok(stamina.payload.resetsAt > Date.now());
    await api(`/api/student/${student.payload.id}/stamina`, "GET", undefined, undefined, 401);

    await api("/api/objects/upload", "POST", student.cookie, undefined, 401);
    const upload = await api("/api/objects/upload", "POST", teacher.cookie);
    const image = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const put = (cookie: string, body: Uint8Array, type = "image/png") => worker.fetch(new Request(env.PUBLIC_ORIGIN + upload.payload.uploadURL, {
      method: "PUT", headers: { Origin: env.PUBLIC_ORIGIN, Cookie: cookie, "Content-Type": type }, body,
    }), env as any);
    assert.equal((await put(other.cookie!, image)).status, 403);
    assert.equal((await put(teacher.cookie!, image, "image/svg+xml")).status, 415);
    assert.equal((await put(teacher.cookie!, new Uint8Array([1, 2, 3]))).status, 415);
    assert.equal((await put(teacher.cookie!, image)).status, 201);
    assert.equal((await put(teacher.cookie!, image)).status, 409);
    const read = await worker.fetch(new Request(env.PUBLIC_ORIGIN + upload.payload.objectPath), env as any);
    assert.equal(read.status, 200);
    assert.equal(read.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(new Uint8Array(await read.arrayBuffer()), image);
    const objectRequest = (method: string, headers = {}) => worker.fetch(new Request(env.PUBLIC_ORIGIN + upload.payload.objectPath, { method, headers }), env as any);
    const partial = await objectRequest("GET", { Range: "bytes=0-3" });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), "bytes 0-3/8");
    assert.deepEqual(new Uint8Array(await partial.arrayBuffer()), image.slice(0, 4));
    const suffix = await objectRequest("GET", { Range: "bytes=-2" });
    assert.deepEqual(new Uint8Array(await suffix.arrayBuffer()), image.slice(-2));
    const unsatisfiable = await objectRequest("GET", { Range: "bytes=99-100" });
    assert.equal(unsatisfiable.status, 416);
    assert.equal(unsatisfiable.headers.get("content-range"), "bytes */8");
    assert.equal((await objectRequest("GET", { Range: "bytes=0-3", "If-Range": '"old-etag"' })).status, 200);
    const head = await objectRequest("HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-length"), "8");
    assert.equal(head.headers.get("etag"), '"test-etag"');
    assert.equal(await head.text(), "");
    await api("/api/not-a-route", "GET", undefined, undefined, 404);
    await api("/api/health/ready");
    const crossOrigin = await worker.fetch(new Request(env.PUBLIC_ORIGIN + "/api/guilds", {
      method: "POST", headers: { Origin: "https://wrong.example", Cookie: teacher.cookie! }, body: "{}",
    }), env as any);
    assert.equal(crossOrigin.status, 403);
    await api("/api/teacher/logout", "POST", teacher.cookie);
    await api("/api/teacher/check-session", "GET", teacher.cookie, undefined, 401);
    await api("/api/student/logout", "POST", student.cookie);
    await api(`/api/student/${student.payload.id}`, "GET", student.cookie, undefined, 401);
  } finally {
    neonConfig.fetchFunction = previousFetch;
    await pg.close();
  }
});
