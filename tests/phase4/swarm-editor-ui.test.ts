import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { fight } from "./fixtures";

test("fight editor enables, edits, saves, reloads and disables swarm settings", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: `https://qa.example/teacher/edit/${fight.id}`, pretendToBeVisual: true });
  const keys = ["window", "document", "navigator", "location", "localStorage", "HTMLElement", "HTMLInputElement", "Element", "Node", "Document", "DocumentFragment", "MutationObserver", "CustomEvent", "ResizeObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "addEventListener", "removeEventListener", "fetch", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let persisted: any = { ...fight, encounterTier: 1, enemies: [{ ...fight.enemies[0], enemyType: "goblin", species: "goblin", role: "trash", quantity: 5, wave: 1 }] };
  const writes: any[] = [];
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
    value: key === "ResizeObserver" ? class { observe() {} unobserve() {} disconnect() {} } : key === "IS_REACT_ACT_ENVIRONMENT" ? true : key === "fetch" ? async (url: string, init?: RequestInit) => {
      if (url.endsWith("check-session")) return Response.json({ id: fight.teacherId, email: "fixture@example.test", guildCode: "TEST" });
      if (init?.body) { writes.push({ url, method: init.method, body: JSON.parse(String(init.body)) }); persisted = { ...persisted, ...writes.at(-1).body }; }
      return Response.json(persisted);
    } : ["addEventListener", "removeEventListener", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? (dom.window as any)[key].bind(dom.window) : (dom.window as any)[key] });
  localStorage.setItem("teacherId", fight.teacherId);
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const cache = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 }, queries: { retry: false, gcTime: 0, queryFn: async ({ queryKey }) => String(queryKey[0]).includes("equipment-items") ? [] : persisted } } });
  const dir = await mkdtemp(join(process.cwd(), ".swarm-editor-test-"));
  const root = createRoot(document.getElementById("root")!);
  try {
    const outfile = join(dir, "editor.mjs");
    await build({ entryPoints: ["client/src/pages/CreateFight.tsx"], outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external", loader: { ".css": "empty", ".png": "empty" },
      plugins: [{ name: "styles", setup(build) {
        build.onResolve({ filter: /\.css$/ }, () => ({ path: "styles", namespace: "test" }));
        build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export {}", loader: "js" }));
      } }] });
    const { default: CreateFight } = await import(pathToFileURL(outfile).href);
    let mount = 0;
    const render = async () => {
      await act(async () => root.render(createElement(QueryClientProvider, { client: cache }, createElement(CreateFight, { key: ++mount }))));
      for (let i = 0; i < 20 && !document.querySelector('[data-testid="tab-enemies"]'); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
      const tab = document.querySelector('[data-testid="tab-enemies"]')!;
      await act(async () => tab.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, button: 0 })));
    };
    const click = async (selector: string) => {
      const el = document.querySelector(selector) as HTMLElement;
      assert.ok(el, selector); await act(async () => el.click());
    };
    const increment = async (value: string) => {
      const input = document.querySelector('[aria-label="Extra swarm enemies"]')!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
    };
    await render();
    await click('[data-testid="button-edit-enemy-0"]');
    assert.equal((document.querySelector('[aria-label="Swarm"]') as HTMLInputElement).checked, false);
    await click('[aria-label="Swarm"]');
    await increment("3");
    assert.match(document.querySelector('[aria-label="Swarm count examples"]')!.textContent!, /4 players: 5 enemies · 8 players: 8 enemies · 12 players: 11 enemies · 16 players: 14 enemies/);
    await click('[data-testid="button-update-enemy"]');
    await click('[data-testid="button-create-fight-submit"]');
    assert.equal(writes.at(-1)?.method, "PATCH");
    assert.deepEqual(writes.at(-1).body.enemies[0].swarm, { enemiesPerFourPlayers: 3 });

    dom.reconfigure({ url: `https://qa.example/teacher/edit/${fight.id}` });
    cache.clear();
    await render();
    await click('[data-testid="button-edit-enemy-0"]');
    assert.equal((document.querySelector('[aria-label="Swarm"]') as HTMLInputElement).checked, true);
    assert.equal((document.querySelector('[aria-label="Extra swarm enemies"]') as HTMLInputElement).value, "3");
    await click('[aria-label="Swarm"]');
    assert.equal(document.querySelector('[aria-label="Extra swarm enemies"]'), null);
    await click('[data-testid="button-update-enemy"]');
    await click('[data-testid="button-create-fight-submit"]');
    assert.equal(writes.at(-1).body.enemies[0].swarm, undefined);
  } finally {
    await act(async () => root.unmount()); cache.clear(); dom.window.close();
    await rm(dir, { recursive: true, force: true });
    for (const [key, descriptor] of saved) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
