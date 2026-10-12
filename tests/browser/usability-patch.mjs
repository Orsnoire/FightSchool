import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { fight, started, student } from "../phase4/fixtures.ts";
import { EFFECTS } from "../../shared/combat/presentation.ts";

const origin = process.env.UI_ORIGIN || "http://127.0.0.1:4173";
const output = "artifacts/combat-ui";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const errors = [];
async function page(options = {}) {
  const p = await browser.newPage({
    viewport: { width: 1366, height: 900 },
    ...options,
  });
  p.on("pageerror", (error) => errors.push(error.message));
  return p;
}
try {
  // Real editor state, network boundary mocked with a saved/reloaded authored fight.
  const editor = await page();
  let savedFight = {
    ...fight,
    encounterTier: 1,
    enemies: [
      {
        ...fight.enemies[0],
        image: "/enemies/slime-v2.png",
        species: "slime",
        enemyType: "slime",
        role: "trash",
        wave: 1,
        quantity: 1,
      },
    ],
  };
  let saves = 0;
  await editor.addInitScript(
    (id) => localStorage.setItem("teacherId", id),
    fight.teacherId,
  );
  await editor.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("check-session"))
      return route.fulfill({
        json: {
          id: fight.teacherId,
          email: "fixture@example.test",
          guildCode: "TEST",
        },
      });
    if (path.includes("equipment-items") || path.endsWith("hosted-sessions"))
      return route.fulfill({ json: [] });
    if (path === `/api/teacher/${fight.teacherId}/fights`)
      return route.fulfill({ json: [savedFight] });
    if (route.request().method() === "PATCH") {
      savedFight = { ...savedFight, ...route.request().postDataJSON() };
      saves++;
    }
    return route.fulfill({ json: savedFight });
  });
  await editor.goto(`${origin}/teacher/edit/${fight.id}`);
  await editor.getByTestId("tab-questions").click();
  await editor
    .getByRole("button", { name: "Edit question 1", exact: true })
    .click();
  assert.equal(
    await editor.getByTestId("textarea-question").inputValue(),
    "2+2",
  );
  await editor.getByTestId("textarea-question").fill("<p>What is 3 + 3?</p>");
  await editor.getByTestId("input-correct-answer").fill("6");
  await editor.getByTestId("button-save-question").click();
  await editor.getByTestId("button-create-fight-submit").click();
  await editor.waitForURL("**/teacher");
  assert.equal(saves, 1);
  assert.equal(savedFight.questions.length, 1);
  assert.equal(savedFight.questions[0].id, "q1");
  assert.equal(savedFight.questions[0].correctAnswer, "6");
  await editor.goto(`${origin}/teacher/edit/${fight.id}`);
  await editor.getByTestId("tab-questions").click();
  await editor
    .getByRole("button", { name: "Edit question 1", exact: true })
    .click();
  assert.equal(
    await editor.getByTestId("textarea-question").inputValue(),
    "<p>What is 3 + 3?</p>",
  );
  await editor.getByTestId("textarea-question").fill("Discard me");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await editor
    .getByRole("button", { name: "Edit question 1", exact: true })
    .click();
  assert.equal(
    await editor.getByTestId("input-correct-answer").inputValue(),
    "6",
  );
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await editor.getByTestId("tab-enemies").click();
  await editor.getByTestId("button-edit-enemy-0").click();
  await editor.getByRole("checkbox", { name: "Primary", exact: true }).check();
  await editor.getByLabel("primary color", { exact: true }).fill("#cc3344");
  await editor
    .getByRole("img", { name: "Enemy color preview", exact: true })
    .waitFor();
  await editor.screenshot({
    path: `${output}/usability-enemy-colors.png`,
    fullPage: true,
  });
  await editor.getByTestId("button-update-enemy").click();
  await editor.getByTestId("button-create-fight-submit").click();
  await editor.waitForURL("**/teacher");
  assert.equal(savedFight.enemies[0].palette.primary, "#cc3344");
  await editor.close();

  const items = await page();
  const armor = {
    id: "00000000-0000-4000-8000-000000000010",
    teacherId: fight.teacherId,
    name: "Blue armor",
    itemType: "armor",
    slot: "armor",
    quality: "common",
    tier: 1,
    armorCategory: "heavy_armor",
    stats: { def: 2 },
    shopPrice: 100,
    isPurchasable: true,
    visual: { baseItemId: "basic_armor", palette: { primary: "#2255ee" } },
  };
  const itemWrites = [];
  await items.addInitScript(
    (id) => localStorage.setItem("teacherId", id),
    fight.teacherId,
  );
  await items.route("**/api/**", (route) => {
    if (route.request().url().endsWith("check-session"))
      return route.fulfill({
        json: {
          id: fight.teacherId,
          email: "fixture@example.test",
          guildCode: "TEST",
        },
      });
    if (route.request().method() === "POST") {
      itemWrites.push(route.request().postDataJSON());
      return route.fulfill({
        json: { ...itemWrites.at(-1), id: "new-variant" },
        status: 201,
      });
    }
    return route.fulfill({ json: [armor] });
  });
  await items.goto(`${origin}/teacher/items?edit=${armor.id}`);
  await items.getByLabel("Base sprite", { exact: true }).waitFor();
  assert.equal(
    await items.getByLabel("Base sprite", { exact: true }).inputValue(),
    "basic_armor",
  );
  await items.getByLabel("primary color", { exact: true }).fill("#55cc44");
  await items
    .getByRole("img", { name: "Equipment color preview", exact: true })
    .waitFor();
  await items.screenshot({ path: `${output}/usability-equipment-colors.png` });
  await items
    .getByRole("button", { name: "Create as new variant", exact: true })
    .click();
  await items.getByTestId("button-save-item").click();
  await items.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(itemWrites.length, 1);
  assert.equal(itemWrites[0].name, "Blue armor variant");
  assert.equal(itemWrites[0].visual.palette.primary, "#55cc44");
  await items.close();

  const stats = await page();
  const queries = [];
  await stats.route("**/api/combat-stats/report?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(Object.fromEntries(params));
    return route.fulfill({
      json: {
        total: 1,
        page: 1,
        pageSize: 25,
        summary: {
          sessions: 1,
          players: 1,
          correct: 3,
          attempts: 4,
          recordedAttempts: 4,
          historicalParticipants: 0,
        },
        facets: {
          guilds: [
            { id: "00000000-0000-4000-8000-000000000020", name: "Math guild" },
          ],
          quizzes: [{ id: fight.id, name: "Review" }],
        },
        rows: [
          {
            sessionId: "ABC234",
            quizTitle: "Review",
            guildName: "Math guild",
            players: 1,
            startedAt: Date.now(),
            status: "active",
            correct: 3,
            incorrect: 1,
            unanswered: 0,
            attempts: 4,
            recordedAttempts: 4,
            damage: 20,
            healing: 3,
            blocked: 4,
            deaths: 0,
            xp: 0,
            gold: 0,
            ...(params.get("view") === "players"
              ? { studentId: student().id, nickname: "Warrior", job: "warrior" }
              : {}),
          },
        ],
      },
    });
  });
  await stats.goto(`${origin}/teacher/stats`);
  await stats
    .getByRole("button", { name: "View players", exact: true })
    .click();
  await stats
    .getByRole("button", { name: "View attempts", exact: true })
    .waitFor();
  assert.equal(queries.at(-1).sessionId, "ABC234");
  await stats.getByLabel("Job", { exact: true }).selectOption("warrior");
  await stats
    .getByLabel("Guild", { exact: true })
    .selectOption("00000000-0000-4000-8000-000000000020");
  await stats.getByLabel("Quiz", { exact: true }).selectOption(fight.id);
  await stats.getByLabel("Search statistics", { exact: true }).fill("Review");
  await stats.waitForResponse(
    (res) => new URL(res.url()).searchParams.get("search") === "Review",
  );
  assert.equal(queries.at(-1).job, "warrior");
  assert.equal(queries.at(-1).guildId, "00000000-0000-4000-8000-000000000020");
  await stats.screenshot({
    path: `${output}/usability-statistics.png`,
    fullPage: true,
  });
  await stats.close();

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const combat = await page({ viewport });
    await combat.addInitScript((id) => {
      localStorage.setItem("studentId", id);
      localStorage.setItem("sessionId", "ABC234");
      window.usability = { sockets: [], sent: [] };
      window.WebSocket = class {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          window.usability.sockets.push(this);
          setTimeout(() => this.onopen?.(), 0);
        }
        send(data) {
          window.usability.sent.push(JSON.parse(data));
        }
        close() {}
      };
    }, student().id);
    await combat.route("**/api/**", (route) =>
      route.fulfill({
        json: route.request().url().endsWith("stamina")
          ? {
              completedCombats: 0,
              xpMultiplier: 1,
              resetsAt: Date.now() + 100000,
            }
          : route.request().url().endsWith("job-levels")
            ? []
            : student(),
      }),
    );
    await combat.goto(`${origin}/student/combat`);
    await combat.waitForFunction(() =>
      window.usability.sockets.some((s) => typeof s.onmessage === "function"),
    );
    let sequence = 0;
    async function resolve(effects, count = effects.length) {
      const state = started();
      state.currentPhase = "question_resolution";
      state.phaseDeadline = null;
      state.revision = ++sequence;
      state.enemies[0].image = "/enemies/slime-v2.png";
      state.enemies[0].health = 100 - count;
      state.enemies[0].maxHealth = 100;
      for (let i = 1; i < count; i++)
        state.players[`ally${i}`] = {
          ...structuredClone(state.players[student().id]),
          studentId: `ally${i}`,
          nickname: `Ally ${i}`,
        };
      state.events = Object.keys(state.players).map((actorId, i) => ({
        id: `${sequence}:${i}`,
        round: state.round,
        phase: "question_resolution",
        type: "damage",
        actorId,
        targetId: "e1",
        amount: 1,
        message: "Hit for 1",
        effect: effects[i % effects.length],
        healthBefore: 100 - i,
        healthAfter: 99 - i,
      }));
      state.playback = {
        id: `batch-${sequence}`,
        round: state.round,
        phase: state.currentPhase,
        eventIds: state.events.map((e) => e.id),
        initialHealth: { e1: 100 },
      };
      await combat.evaluate(
        (state) =>
          window.usability.sockets
            .at(-1)
            .onmessage({
              data: JSON.stringify({
                type: "combat_state",
                state,
                serverTime: Date.now(),
              }),
            }),
        state,
      );
      return state.playback.id;
    }
    const pausedBatch = await resolve(["sword"]);
    await combat.getByTestId("combat-effect").waitFor();
    await combat.evaluate(() => {
      window.paused = document
        .getAnimations()
        .filter((a) =>
          a.effect?.target.closest?.('[data-testid="combat-effect"]'),
        );
      window.paused.forEach((a) => a.pause());
    });
    await combat.waitForTimeout(1100);
    assert.equal(
      await combat.evaluate(
        (id) =>
          window.usability.sent.some(
            (m) => m.type === "playback_complete" && m.batchId === id,
          ),
        pausedBatch,
      ),
      false,
      "resolution waits for actual animation completion, not a phase timer",
    );
    await combat.evaluate(() => window.paused.forEach((a) => a.play()));
    await combat.waitForFunction(
      (id) =>
        window.usability.sent.some(
          (m) => m.type === "playback_complete" && m.batchId === id,
        ),
      pausedBatch,
    );
    for (const effect of EFFECTS) {
      const batch = await resolve([effect]);
      await combat.locator(`[data-effect="${effect}"]`).waitFor();
      await combat.waitForTimeout(210);
      await combat.screenshot({
        path: `${output}/usability-${viewport.width}-${effect}.png`,
      });
      await combat.waitForFunction(
        (id) =>
          window.usability.sent.some(
            (m) => m.type === "playback_complete" && m.batchId === id,
          ),
        batch,
      );
      assert.equal(await combat.getByTestId("combat-effect").count(), 0);
    }
    assert.equal(await combat.getByRole("dialog").count(), 0);
    assert.equal(
      await combat.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    if (viewport.width > 600)
      for (const count of [30, 60]) {
        const batch = await resolve(EFFECTS, count);
        await combat.waitForFunction(
          (id) =>
            window.usability.sent.some(
              (m) => m.type === "playback_complete" && m.batchId === id,
            ),
          batch,
          { timeout: 15000 },
        );
        assert.equal(await combat.getByTestId("combat-effect").count(), 0);
      }
    await combat.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await resolve(["fire"]);
    await combat.waitForFunction(
      (id) =>
        window.usability.sent.some(
          (m) => m.type === "playback_complete" && m.batchId === id,
        ),
      reduced,
    );
    assert.equal(await combat.getByTestId("combat-effect").count(), 0);
    await combat.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "Usability patch browser acceptance passed: editing, variants, filters, animation completion, reduced motion, 30/60 players.",
  );
} finally {
  await browser.close();
}
