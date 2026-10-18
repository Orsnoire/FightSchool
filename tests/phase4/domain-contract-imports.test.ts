import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("domain contracts initialize independently of the compatibility schema", () => {
  // A fresh module graph catches equipment-id -> schema -> fights cycles that
  // a suite which imports schema first can accidentally hide.
  for (const entry of ["equipment", "rewards", "fights"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", `
      import "./shared/contracts/${entry}.ts";
      import assert from "node:assert/strict";
      import { equipmentIdSchema } from "./shared/equipment-id.ts";
      import { EQUIPMENT_ITEMS } from "./shared/equipment-items.ts";
      import { EQUIPMENT_ITEMS as compatibilityItems } from "./shared/schema.ts";
      assert.equal(compatibilityItems, EQUIPMENT_ITEMS);
      for (const id of Object.keys(EQUIPMENT_ITEMS)) assert.equal(equipmentIdSchema.parse(id), id);
      assert.equal(equipmentIdSchema.safeParse("unknown_item").success, false);
      assert.equal(equipmentIdSchema.safeParse("00000000-0000-4000-8000-000000000001").success, true);
    `], { cwd: process.cwd(), encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, `${entry}: ${result.error || result.stderr}`);
  }
});
