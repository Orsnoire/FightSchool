import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(new URL(path, `file://${repoRoot}/`), "utf8");
const fixture = JSON.parse(read("tests/phase0/fixtures/milestone-one-answer-flow.json"));

const routes = read("server/routes.ts");
const hostFight = read("client/src/pages/HostFight.tsx");
const lobby = read("client/src/pages/Lobby.tsx");
const combat = read("client/src/pages/Combat.tsx");

test("the selected slice is a real synchronized gameplay action", () => {
  assert.equal(fixture.selectedAction, "answer");
  assert.equal(fixture.isMeaningfulGameplayAction, true);
  assert.deepEqual(fixture.expectedMutation, {
    currentAnswer: fixture.command.answer,
    hasAnswered: true,
  });
  assert.deepEqual(fixture.expectedBroadcast.visibleTo.sort(), ["student", "teacher"]);
});

test("legacy HTTP entry points remain characterized", () => {
  assert.match(routes, /app\.post\("\/api\/teacher\/login"/);
  assert.match(routes, /app\.post\("\/api\/student\/login"/);
  assert.match(routes, /app\.get\("\/api\/sessions\/:sessionId"/);
  assert.match(lobby, /fetch\(`\/api\/sessions\/\$\{sessionCode\.trim\(\)\.toUpperCase\(\)\}`\)/);
});

test("legacy WebSocket sequence remains characterized", () => {
  assert.match(hostFight, /new WebSocket\(wsUrl\)/);
  assert.match(hostFight, /type: "host"/);
  assert.match(hostFight, /type: "start_fight"/);
  assert.match(combat, /type: "join", studentId, sessionId/);
  assert.match(combat, /type: "answer"/);
  assert.match(routes, /message\.type === "host"/);
  assert.match(routes, /message\.type === "join"/);
  assert.match(routes, /message\.type === "answer"/);
});

test("answer mutates authoritative player state and is broadcast", () => {
  assert.match(
    routes,
    /updatePlayerState\(ws\.sessionId, ws\.studentId, \{[\s\S]*?currentAnswer: message\.answer,[\s\S]*?hasAnswered: true,[\s\S]*?\}\)/,
  );
  assert.match(
    routes,
    /broadcastToCombat\(ws\.sessionId, \{ type: "combat_state", state: updatedSession \}\)/,
  );
  assert.match(hostFight, /message\.type === "combat_state"/);
  assert.match(combat, /message\.type === "combat_state"/);
});

test("the migration boundary rejects client-authoritative identity", () => {
  assert.equal(fixture.target.appBasePath, "/");
  assert.equal(fixture.target.apiPrefix, "/api");
  assert.equal(fixture.target.webSocketPath, "/ws");
  assert.equal(fixture.target.identity.clientSuppliedIdentityIsAuthoritative, false);
  assert.equal(fixture.target.identity.teacher, "server-verifiable session");
  assert.equal(fixture.target.identity.student, "server-verifiable session");
  assert.equal(fixture.target.requiresSessionIsolation, true);
  assert.equal(fixture.target.requiresIdempotentCommands, true);
});

test("object storage is explicitly non-blocking for the text-only slice", () => {
  assert.equal(fixture.objectStorage.requiredForSelectedAction, false);
  assert.equal(fixture.objectStorage.fixtureUsesTextOnlyQuestion, true);
  assert.match(fixture.objectStorage.decision, /defer R2/);
});
