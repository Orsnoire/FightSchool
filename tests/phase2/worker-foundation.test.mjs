import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(new URL(path, "file://" + repoRoot + "/"), "utf8");
const config = JSON.parse(read("wrangler.jsonc"));
const worker = read("worker/index.ts");
const deployWorkflow = read(".github/workflows/deploy-cloudflare-staging.yml");
const stagingSmoke = read("tests/phase2/staging-smoke.mjs");

test("Wrangler config deploys only to the staging workers.dev hostname", () => {
  assert.equal(config.name, "questacademy-staging");
  assert.equal(config.workers_dev, true);
  assert.equal(config.vars.ENVIRONMENT, "staging");
  assert.equal(config.vars.PUBLIC_ORIGIN, "https://questacademy-staging.coxsonator.workers.dev");
  assert.equal("routes" in config, false);
});

test("Static Assets owns the SPA while dynamic boundaries run Worker-first", () => {
  assert.equal(config.assets.directory, "./dist/public");
  assert.equal(config.assets.not_found_handling, "single-page-application");
  assert.equal(config.assets.binding, "ASSETS");
  assert.deepEqual(config.assets.run_worker_first, [
    "/api",
    "/api/*",
    "/ws",
    "/objects",
    "/objects/*",
  ]);
  assert.match(worker, /return env\.ASSETS\.fetch\(request\)/);
});

test("Durable Object lifecycle uses a SQLite export and stable binding", () => {
  assert.deepEqual(config.durable_objects.bindings, [{
    name: "COMBAT_SESSIONS",
    class_name: "CombatSession",
  }]);
  assert.deepEqual(config.exports.CombatSession, {
    type: "durable-object",
    storage: "sqlite",
  });
  assert.match(worker, /this\.state\.acceptWebSocket\(server\)/);
  assert.match(worker, /serializeAttachment\(attachment\)/);
  assert.match(worker, /webSocketMessage\(/);
});

test("dynamic routes fail closed before SPA fallback", () => {
  assert.match(worker, /WebSocket upgrade required/);
  assert.match(worker, /Unauthorized/);
  assert.match(worker, /API route not found/);
  assert.match(worker, /Object storage is not enabled/);
  assert.match(worker, /constantTimeEqual/);
});

test("staging deployment requires approval-scoped secrets and never configures production", () => {
  assert.match(deployWorkflow, /environment: cloudflare-staging/);
  assert.match(deployWorkflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(deployWorkflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(deployWorkflow, /workflow_dispatch/);
  assert.doesNotMatch(deployWorkflow, /questacademy\.bookwyrminteractive\.studio/);
  assert.doesNotMatch(deployWorkflow, /push:/);
  assert.match(stagingSmoke, /fetchUntilReady\("\/api\/health\/live", 200\)/);
  assert.match(stagingSmoke, /attempts = 20/);
  assert.match(stagingSmoke, /pingWebSocketAfterRollout/);
  assert.match(stagingSmoke, /Unexpected server response: \(401\|404\|429\|5\\d\\d\)/);
  assert.match(stagingSmoke, /Waiting for WebSocket rollout/);
});
