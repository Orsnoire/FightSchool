import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
const read = (p: string) =>
  readFileSync(new URL("../../" + p, import.meta.url), "utf8");
test("migration adds progression and results without deleting live students or rooms", () => {
  for (const path of [
    "migrations/cloudflare/0003_progression_guilds_results.sql",
    "migrations/cloudflare/0004_quest_seed_uniqueness.sql",
  ])
    assert.doesNotMatch(read(path), /DROP TABLE|TRUNCATE|DELETE FROM/i);
  assert.match(
    read("migrations/cloudflare/0003_progression_guilds_results.sql"),
    /combat_results_session_student_unique/,
  );
});
test("agent source-of-truth path is real and active architecture has one database schema", () => {
  assert.match(read("AGENTS.md"), /docs\/Source_of_Truth.md/);
  assert.ok(
    existsSync(new URL("../../docs/Source_of_Truth.md", import.meta.url)),
  );
  assert.doesNotMatch(read("shared/schema.ts"), /pgTable\(/);
});
