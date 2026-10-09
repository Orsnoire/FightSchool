import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { started, student } from "./fixtures";
import { enemySchema } from "../../shared/schema";

test("teacher editor offers only seven defined species, enforces goblin minimum, edits priorities and restores defaults; recovery UI explains counters", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://qa.example/teacher" });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  for (const k of keys) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: k === "IS_REACT_ACT_ENVIRONMENT" ? true : (dom.window as any)[k] });
  const { act, createElement, useState } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const directory = await mkdtemp(join(process.cwd(), ".enemy-ui-test-"));
  const root = createRoot(document.getElementById("root")!);
  try {
    const outfile = join(directory, "ui.mjs");
    await build({ stdin: { contents: 'export { EnemyAIEditor } from "./client/src/components/EnemyAIEditor"; export { CombatResources } from "./client/src/components/CombatResources";', resolveDir: process.cwd(), loader: "tsx" }, outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external" });
    const { EnemyAIEditor, CombatResources } = await import(pathToFileURL(outfile).href);
    let enemy: any;
    function Harness() {
      const [value, update] = useState({ id: "e1", name: "Custom enemy", image: "/enemies/zombie-v2.png", quantity: 1, difficultyMultiplier: 10 });
      enemy = value;
      return createElement(EnemyAIEditor, { enemy: value, onChange: update });
    }
    await act(async () => root.render(createElement(Harness)));
    const select = async (label: string, value: string) => {
      const el = document.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement;
      assert.ok(el, label);
      await act(async () => { el.value = value; el.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
    };
    assert.equal(document.querySelectorAll('[aria-label="Enemy AI type"] option').length, 7);
    assert.ok(!document.body.textContent?.includes("Dragon"));
    await select("Enemy AI type", "goblin");
    assert.equal(enemy.quantity, 5); assert.equal(enemy.species, "goblin");
    assert.match(document.body.textContent || "", /Minimum five goblins/);
    assert.equal(document.querySelector('[aria-label="Enemy AI preset"]'), null);
    await select("Enemy AI type", "vampire");
    await select("Enemy AI preset", "custom");
    await select("vampiric_bite condition", "after_round");
    await select("vampiric_bite target", "lowest_hp");
    assert.equal(enemy.ai.rules.find((r: any) => r.move === "vampiric_bite").target, "lowest_hp");
    assert.equal(enemy.ai.rules.find((r: any) => r.move === "vampiric_bite").condition, "after_round");
    const roundTrip = enemySchema.parse(JSON.parse(JSON.stringify(enemy)));
    assert.deepEqual(roundTrip.ai, enemy.ai);
    assert.match(document.querySelector('[aria-label="Enemy priority preview"]')!.textContent || "", /Before required round/);
    const reset = [...document.querySelectorAll("button")].find(b => b.textContent === "Restore species defaults")!;
    await act(async () => reset.click()); assert.equal(enemy.ai.mode, "default");
    const player = started().players[student().id];
    player.statuses = [{ type: "paralysis", sourceId: "e1", appliedRound: 0 }, { type: "hypnosis", sourceId: "e2", appliedRound: 0, correctAnswers: 2 }];
    player.recoveryCorrectAnswers = 1;
    await act(async () => root.render(createElement(CombatResources, { player })));
    assert.match(document.body.textContent || "", /Recovery: 1\/2/);
    assert.match(document.body.textContent || "", /Recovery: 2\/3/);
    assert.match(document.body.textContent || "", /do not need to be consecutive/);
  } finally {
    await act(async () => root.unmount()); dom.window.close(); await rm(directory, { recursive: true, force: true });
    for (const [key, descriptor] of saved) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key];
  }
});
