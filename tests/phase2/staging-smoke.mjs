import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const origin = process.env.STAGING_ORIGIN;
const token = process.env.STAGING_AUTH_TOKEN;
if (!origin || !token) {
  throw new Error("STAGING_ORIGIN and STAGING_AUTH_TOKEN are required");
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchUntilReady(path, expectedStatus, attempts = 20) {
  let lastStatus = "no response";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(origin + path);
      lastStatus = response.status;
      if (response.status === expectedStatus) return response;
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      console.log(
        "Waiting for staging propagation: attempt "
          + attempt
          + "/"
          + attempts
          + " returned "
          + lastStatus,
      );
      await sleep(3_000);
    }
  }

  throw new Error(
    "Staging did not return "
      + expectedStatus
      + " for "
      + path
      + " after "
      + attempts
      + " attempts; last result: "
      + lastStatus,
  );
}

const live = await fetchUntilReady("/api/health/live", 200);
assert.equal((await live.json()).status, "ok");

const ready = await fetch(origin + "/api/health/ready");
assert.equal(ready.status, 200);
assert.equal((await ready.json()).status, "ready");

const missingApi = await fetch(origin + "/api/not-a-route");
assert.equal(missingApi.status, 404);
assert.match(missingApi.headers.get("content-type") || "", /application\/json/);

const objects = await fetch(origin + "/objects/not-enabled");
assert.equal(objects.status, 501);

const nestedRoute = await fetch(origin + "/teacher");
assert.equal(nestedRoute.status, 200);
assert.match(nestedRoute.headers.get("content-type") || "", /text\/html/);

const socketUrl = origin.replace(/^http/, "ws") + "/ws?sessionId=staging-smoke";
const socket = new WebSocket(socketUrl, { headers: { Authorization: "Bearer " + token } });
const commandId = randomUUID();

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("WebSocket smoke timed out")), 10_000);
  socket.once("open", () => {
    socket.send(JSON.stringify({ type: "ping", commandId }));
  });
  socket.once("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      assert.deepEqual(message, { type: "pong", commandId, role: "staging-smoke" });
      clearTimeout(timeout);
      socket.close();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
  socket.once("error", reject);
});

console.log("Cloudflare staging smoke checks passed.");
