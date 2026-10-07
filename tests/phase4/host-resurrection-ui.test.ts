import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { started, student } from "./fixtures.ts";

test("only host boards expose clickable and keyboard-accessible resurrection on knocked-out players", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : (dom.window as any)[key] });
  const dir = await mkdtemp(join(process.cwd(), ".host-ui-test-"));
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  try {
    const outfile = join(dir, "board.mjs");
    await build({ entryPoints: ["client/src/components/CombatBoard.tsx"], outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external", alias: { "@assets": join(process.cwd(), "attached_assets") }, loader: { ".png": "empty" } });
    const { CombatBoard } = await import(pathToFileURL(outfile).href);
    const state = started();
    state.players[student().id].isDead = true;
    state.players[student().id].health = 0;
    const chosen: string[] = [];
    const onResurrect = (id: string) => chosen.push(id);
    await act(async () => root.render(createElement(CombatBoard, { state, onResurrect })));
    const card = document.querySelector('button[aria-label^="Resurrect"]') as HTMLElement;
    assert.equal(card.getAttribute("aria-label"), "Resurrect warrior with 1 HP");
    assert.equal(card.tabIndex, 0);
    await act(async () => card.click());
    assert.equal(card.tagName, "BUTTON", "native button provides keyboard activation");
    assert.deepEqual(chosen, [student().id]);
    await act(async () => root.render(createElement(CombatBoard, { state })));
    assert.equal(document.querySelector('button[aria-label^="Resurrect"]'), null, "student view has no resurrection control");
    state.players[student().id].isDead = false;
    state.players[student().id].health = 1;
    await act(async () => root.render(createElement(CombatBoard, { state, onResurrect })));
    assert.equal(document.querySelector('button[aria-label^="Resurrect"]'), null, "living players cannot be resurrected again");
  } finally {
    await act(async () => root.unmount());
    await rm(dir, { recursive: true, force: true });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
