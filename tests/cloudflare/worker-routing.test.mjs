import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import worker from "../../worker/index.mjs";

const baseUrl = "https://BookwyrmInteractive.studio";

function createEnv(assetHandler) {
  const assetRequests = [];
  return {
    env: {
      APP_BASE_PATH: "/QuestAcademy",
      ENVIRONMENT: "test",
      ASSETS: {
        async fetch(request) {
          assetRequests.push(new URL(request.url));
          if (assetHandler) {
            return assetHandler(request);
          }
          return new Response(`<html data-path="${new URL(request.url).pathname}"></html>`, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
      },
    },
    assetRequests,
  };
}

const request = (path, init) => new Request(`${baseUrl}${path}`, init);

test("redirects the bare application path exactly once", async () => {
  const { env } = createEnv();
  const response = await worker.fetch(request("/QuestAcademy?source=test"), env);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), `${baseUrl.toLowerCase()}/QuestAcademy/?source=test`);
});

test("strips the public base path before static asset lookup", async () => {
  const { env, assetRequests } = createEnv();
  const response = await worker.fetch(request("/QuestAcademy/assets/app.js?v=1"), env);
  assert.equal(response.status, 200);
  assert.equal(assetRequests.length, 1);
  assert.equal(assetRequests[0].pathname, "/assets/app.js");
  assert.equal(assetRequests[0].search, "?v=1");
});

test("delegates nested client routes to the SPA asset binding", async () => {
  const { env, assetRequests } = createEnv();
  const response = await worker.fetch(
    request("/QuestAcademy/student/lobby", {
      headers: { "sec-fetch-mode": "navigate" },
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(assetRequests[0].pathname, "/student/lobby");
});

test("preserves asset errors instead of returning the SPA shell", async () => {
  const { env } = createEnv(() => new Response("Missing asset", { status: 404 }));
  const response = await worker.fetch(request("/QuestAcademy/assets/missing.js"), env);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Missing asset");
});

test("handles API and WebSocket routes before SPA fallback", async () => {
  const { env, assetRequests } = createEnv();
  const health = await worker.fetch(request("/QuestAcademy/api/_shell/health"), env);
  const api = await worker.fetch(request("/QuestAcademy/api/fights"), env);
  const wsHttp = await worker.fetch(request("/QuestAcademy/ws"), env);
  const wsUpgrade = await worker.fetch(
    request("/QuestAcademy/ws", { headers: { upgrade: "websocket" } }),
    env,
  );

  assert.deepEqual(await health.json(), { status: "ok", environment: "test" });
  assert.equal(api.status, 501);
  assert.match(api.headers.get("content-type"), /application\/json/);
  assert.equal(wsHttp.status, 426);
  assert.equal(wsUpgrade.status, 501);
  assert.equal(assetRequests.length, 0);
});

test("does not capture unrelated or similarly prefixed paths", async () => {
  const { env, assetRequests } = createEnv();
  for (const path of ["/", "/api/fights", "/QuestAcademy-old", "/QuestAcademyExtra", "/questacademy/"]) {
    const response = await worker.fetch(request(path), env);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("x-questacademy-scope"), "outside", path);
  }
  assert.equal(assetRequests.length, 0);
});

test("does not serve the SPA shell for non-navigation methods", async () => {
  const { env, assetRequests } = createEnv();
  const response = await worker.fetch(
    request("/QuestAcademy/student/lobby", { method: "POST" }),
    env,
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
  assert.equal(assetRequests.length, 0);
});

test("Wrangler routes only application paths through the Worker first", () => {
  const config = JSON.parse(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.main, "worker/index.mjs");
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.assets.directory, "./dist/public");
  assert.equal(config.assets.not_found_handling, "single-page-application");
  assert.deepEqual(config.assets.run_worker_first, ["/QuestAcademy", "/QuestAcademy/*"]);
  assert.equal("routes" in config, false);
});

test("frontend configuration keeps routing beneath the canonical base", () => {
  const vite = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../../client/src/App.tsx", import.meta.url), "utf8");
  const urls = readFileSync(new URL("../../client/src/lib/appUrls.ts", import.meta.url), "utf8");
  assert.match(vite, /base:\s*appBasePath/);
  assert.match(app, /<WouterRouter base=\{APP_BASE_PATH \|\| undefined\}>/);
  assert.match(urls, /APP_BASE_PATH/);
  assert.match(urls, /webSocketUrl/);
});
