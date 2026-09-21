import { spawnSync } from "node:child_process";

const expectedDiagnostics = new Set([
  "client/src/components/AbilityBar.tsx:14:7:TS2740",
  "client/src/components/HealingModal.tsx:108:61:TS2349",
  "client/src/pages/CharacterSelect.tsx:81:62:TS2339",
  "client/src/pages/CharacterSelect.tsx:85:62:TS2339",
  "client/src/pages/CreateFight.tsx:204:7:TS2353",
  "client/src/pages/CreateFight.tsx:223:9:TS2353",
  "client/src/pages/CreateFight.tsx:583:45:TS2345",
  "client/src/pages/CreateFight.tsx:590:19:TS2322",
  "client/src/pages/CreateFight.tsx:603:19:TS2322",
  "client/src/pages/CreateFight.tsx:616:19:TS2322",
  "client/src/pages/CreateFight.tsx:635:19:TS2322",
  "client/src/pages/CreateFight.tsx:654:19:TS2322",
  "client/src/pages/CreateFight.tsx:676:19:TS2322",
  "client/src/pages/CreateFight.tsx:699:19:TS2322",
  "client/src/pages/CreateFight.tsx:1167:39:TS2339",
  "client/src/pages/CreateFight.tsx:1167:59:TS2339",
  "client/src/pages/CreateFight.tsx:1168:39:TS2339",
  "client/src/pages/CreateFight.tsx:1168:63:TS2339",
  "client/src/pages/CreateFight.tsx:1169:39:TS2339",
  "client/src/pages/CreateFight.tsx:1169:64:TS2339",
  "client/src/pages/Lobby.tsx:534:25:TS2739",
  "client/src/pages/Lobby.tsx:691:25:TS2739",
  "client/src/pages/Lobby.tsx:919:25:TS2741",
  "client/src/pages/Lobby.tsx:1093:21:TS2741",
  "client/src/pages/StudentGuildDetail.tsx:306:37:TS2339",
  "client/src/pages/StudentGuildLobby.tsx:422:21:TS2739",
  "client/src/pages/TeacherGuildDetail.tsx:392:46:TS2339",
  "server/routes.ts:3080:15:TS18048",
  "server/routes.ts:3080:49:TS18048",
  "server/routes.ts:3080:106:TS18048",
  "server/storage.ts:740:55:TS2769",
  "server/storage.ts:917:9:TS2769",
  "server/storage.ts:1180:38:TS2769",
  "server/storage.ts:1195:38:TS2769",
  "server/storage.ts:1409:52:TS2769",
  "server/storage.ts:1648:47:TS2769",
]);

const result = spawnSync("node_modules/.bin/tsc", ["--pretty", "false"], {
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "0" },
});

if (result.error) {
  throw result.error;
}

const output = (result.stdout || "") + (result.stderr || "");
const diagnosticPattern = /^(.+)\((\d+),(\d+)\): error (TS\d+):/gm;
const actualDiagnostics = new Set();

for (const match of output.matchAll(diagnosticPattern)) {
  actualDiagnostics.add(
    match[1].replaceAll("\\", "/") + ":" + match[2] + ":" + match[3] + ":" + match[4],
  );
}

const unexpected = [...actualDiagnostics].filter((diagnostic) => !expectedDiagnostics.has(diagnostic));
const resolved = [...expectedDiagnostics].filter((diagnostic) => !actualDiagnostics.has(diagnostic));

if (unexpected.length || resolved.length || result.status === 0) {
  if (unexpected.length) {
    console.error("New TypeScript diagnostics:");
    console.error(unexpected.join("\n"));
  }
  if (resolved.length) {
    console.error("Resolved baseline diagnostics must be removed from the snapshot:");
    console.error(resolved.join("\n"));
  }
  if (result.status === 0) {
    console.error("TypeScript passed; remove the temporary baseline ratchet and run npm run check directly.");
  }
  process.exit(1);
}

console.log("TypeScript baseline unchanged (" + actualDiagnostics.size + " known diagnostics); no new errors.");
