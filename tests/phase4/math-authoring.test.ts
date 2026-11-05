import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultMathPreset, previewMathTemplate } from "../../shared/math/templates/exponents";
import { mathTemplateRepository } from "../../worker/db/math-template-repository";
import { gameDatabase } from "../../worker/db/database";
import { mathAuthoringFixture } from "./math-authoring-fixture";

test("math authoring persists isolated versioned work through the real Worker and migrated PostgreSQL", async t => {
  const f = await mathAuthoringFixture();
  const base = "/api/math/templates";
  let saved: any;
  const preset = { ...defaultMathPreset(), title: "Math 3 products" };
  const create = { mutationId: crypto.randomUUID(), expectedRevision: 0, preset, preview: { seed: 7, count: 5 } };
  const unchanged = await f.snapshot();
  try {
    await t.test("catalog/preview authorize teachers, bound input, and make no content or room writes", async () => {
      const start = f.queries.length;
      await f.api(`${base}/catalog`, "GET", undefined, undefined, 401);
      await f.api(`${base}/catalog`, "GET", f.student.cookie, undefined, 401);
      assert.equal((await f.api(`${base}/catalog`, "GET", f.teacher.cookie)).data.length, 3);
      const input = { preset, seed: 7, count: 5 };
      const preview = (await f.api(`${base}/preview`, "POST", f.teacher.cookie, input)).data;
      assert.deepEqual(preview, await previewMathTemplate(input));
      await f.api(`${base}/preview`, "POST", f.student.cookie, input, 401);
      for (const bad of [{ ...input, count: 11 }, { ...input, preset: { ...preset, generatorVersion: 2 } }, { ...input, correctAnswer: "999" },
        { ...input, preset: { ...preset, resultSign: "negative" } }]) await f.api(`${base}/preview`, "POST", f.teacher.cookie, bad, 400);
      await f.api(`${base}/preview`, "POST", f.teacher.cookie, { ...input, text: "x".repeat(20_000) }, 413);
      assert.equal((await f.send(`${base}/preview`, "POST", f.teacher.cookie, input, "https://evil.invalid")).status, 403);
      assert.ok(f.queries.slice(start).every(q => /^select\b/i.test(q)), "preview only reads authentication");
      assert.deepEqual(await f.snapshot(), unchanged); assert.equal(f.roomCalls(), 0);
    });
    await t.test("create, retry and reopen preserve the full reviewed snapshot", async () => {
      saved = (await f.api(base, "POST", f.teacher.cookie, create, 201)).data;
      assert.equal(saved.latestRevision, 1); assert.equal(saved.latestApprovedRevision, null); assert.equal(saved.revision.state, "draft");
      assert.deepEqual(saved.revision.preset, preset);
      assert.deepEqual((await f.api(base, "POST", f.teacher.cookie, create, 201)).data, saved);
      assert.deepEqual((await f.api(`${base}/${saved.id}`, "GET", f.teacher.cookie)).data, saved);
      await f.api(base, "POST", f.teacher.cookie, { ...create, preset: { ...preset, title: "Reused key" } }, 409);
      assert.equal((await f.pg.query("SELECT * FROM math_templates")).rows.length, 1);
      assert.equal((await f.pg.query("SELECT * FROM math_template_revisions")).rows.length, 1);
    });
    await t.test("owner isolation applies to detail, history, listing, saves and approvals", async () => {
      const url = `${base}/${saved.id}`;
      for (const suffix of ["", "/revisions"]) await f.api(url + suffix, "GET", f.other.cookie, undefined, 404);
      await f.api(url + "/revisions", "POST", f.other.cookie, { ...create, expectedRevision: 1 }, 404);
      await f.api(url + "/approve", "POST", f.other.cookie, {}, 404);
      await f.api(url, "GET", f.student.cookie, undefined, 401);
      await f.api(base, "POST", f.student.cookie, create, 401);
      assert.deepEqual((await f.api(base, "GET", f.other.cookie)).data.items, []);
      assert.equal((await f.api(base + "?q=products&rule=product&state=draft", "GET", f.teacher.cookie)).data.items.length, 1);
      assert.equal((await f.api(base + "?q=%25", "GET", f.teacher.cookie)).data.items.length, 0, "search escapes wildcard input");
      await f.api(base + "?offset=-1", "GET", f.teacher.cookie, undefined, 400);
    });
    await t.test("approval binds reviewed content, assumptions, preview seed and versions, with exact retry receipts", async () => {
      const request = { mutationId: crypto.randomUUID(), expectedRevision: 1, confirmed: true,
        contentHash: saved.revision.contentHash, previewHash: saved.revision.preview.previewHash, preview: create.preview };
      await f.api(`${base}/${saved.id}/approve`, "POST", f.teacher.cookie, { ...request, previewHash: "0".repeat(64) }, 409);
      await f.api(`${base}/${saved.id}/approve`, "POST", f.teacher.cookie, { ...request, preview: { seed: 8, count: 5 } }, 409);
      await f.api(`${base}/${saved.id}/approve`, "POST", f.teacher.cookie, { ...request, confirmed: false }, 400);
      const original = structuredClone(saved.revision);
      saved = (await f.api(`${base}/${saved.id}/approve`, "POST", f.teacher.cookie, request, 201)).data;
      assert.equal(saved.latestRevision, 2); assert.equal(saved.latestApprovedRevision, 2);
      assert.equal(saved.revision.approvedBy, f.teacher.data.id); assert.ok(saved.revision.approvedAt);
      assert.deepEqual(saved.revision.preview, original.preview);
      assert.deepEqual((await f.api(`${base}/${saved.id}/approve`, "POST", f.teacher.cookie, request, 201)).data, saved);
      assert.deepEqual((await f.api(`${base}/${saved.id}?revision=1`, "GET", f.teacher.cookie)).data.revision, original);
    });
    await t.test("editing creates a fresh draft and stale/concurrent saves never overwrite approved work", async () => {
      const approved = structuredClone(saved.revision);
      const input = { ...create, mutationId: crypto.randomUUID(), expectedRevision: 2, preset: { ...preset, note: "New classroom settings" } };
      const other = { ...input, mutationId: crypto.randomUUID(), preset: { ...preset, note: "Conflicting tab" } };
      const responses = await Promise.all([f.send(`${base}/${saved.id}/revisions`, "POST", f.teacher.cookie, input), f.send(`${base}/${saved.id}/revisions`, "POST", f.teacher.cookie, other)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
      saved = await responses.find(r => r.status === 201)!.json();
      assert.equal(saved.latestRevision, 3); assert.equal(saved.latestApprovedRevision, 2); assert.equal(saved.revision.state, "draft");
      assert.equal(saved.revision.approvedAt, null);
      assert.deepEqual((await f.api(`${base}/${saved.id}?revision=2`, "GET", f.teacher.cookie)).data.revision, approved);
      await f.api(`${base}/${saved.id}/revisions`, "POST", f.teacher.cookie, { ...input, mutationId: crypto.randomUUID() }, 409);
      const history = (await f.api(`${base}/${saved.id}/revisions`, "GET", f.teacher.cookie)).data;
      assert.deepEqual(history.map((v: any) => [v.revision, v.state]), [[3, "draft"], [2, "approved"], [1, "draft"]]);
      assert.deepEqual((await f.api(`${base}/${saved.id}/revisions?before=2`, "GET", f.teacher.cookie)).data.map((v: any) => v.revision), [1]);
    });
    await t.test("a failed revision insert rolls back its head update atomically", async () => {
      const repo = mathTemplateRepository(gameDatabase(f.env.DATABASE_URL));
      await assert.rejects(repo.append(f.teacher.data.id, saved.id, 3, { mutationId: crypto.randomUUID(), requestHash: "invalid-hash", preset,
        preview: await previewMathTemplate({ preset, ...create.preview }), state: "draft" }));
      assert.deepEqual(await repo.get(f.teacher.data.id, saved.id), saved);
      assert.equal((await f.pg.query("SELECT * FROM math_template_revisions")).rows.length, 3);
    });
    await t.test("unknown stored generator versions reopen read-only and cannot be reapproved", async () => {
      await f.pg.query("UPDATE math_template_revisions SET preset=jsonb_set(preset,'{generatorVersion}','99') WHERE template_id=$1 AND revision=3", [saved.id]);
      const read = (await f.api(`${base}/${saved.id}`, "GET", f.teacher.cookie)).data;
      assert.equal(read.supported, false); assert.deepEqual(read.revision.preview, saved.revision.preview);
      await f.api(`${base}/${saved.id}/approve`, "POST", f.teacher.cookie, { mutationId: crypto.randomUUID(), expectedRevision: 3,
        confirmed: true, contentHash: read.revision.contentHash, previewHash: read.revision.preview.previewHash, preview: create.preview }, 409);
      await f.pg.query("UPDATE math_template_revisions SET preset=$2::jsonb WHERE template_id=$1 AND revision=3", [saved.id, JSON.stringify(saved.revision.preset)]);
    });
    await t.test("no existing saved data, fight contract, attempts, rewards or rooms change", async () => {
      assert.deepEqual(await f.snapshot(), unchanged);
      assert.equal(f.roomCalls(), 0);
      const fixed = (await f.api(`/api/fights/${f.fight.data.id}`, "GET", f.teacher.cookie)).data;
      assert.deepEqual(fixed.questions, f.fight.data.questions);
      assert.equal(fixed.questions[0].correctAnswer, "1/2");
    });
  } finally { await f.close(); }
});
