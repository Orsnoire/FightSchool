import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

test("loot cards load earned IDs, display signed stats and icons, handle missing details and retry without blind claiming", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ["window", "document", "navigator", "fetch", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let calls = 0;
  const item = {id: "earned", name: "Scholar’s <Staff>", slot: "weapon", quality: "rare", tier: 2, stats: {int: 3, atk: -1, def: 0}, iconUrl: "/api/objects/staff.png"};
  for (const key of keys) Object.defineProperty(globalThis, key, {configurable: true, writable: true,
    value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : key === "fetch" ? async (url: string) => {
      assert.equal(url, "/api/equipment-items?ids=earned,missing");
      calls++;
      return calls === 1 ? new Response("unavailable", {status: 503}) : Response.json([item, { ...item, id: "unearned", name: "Not a reward" }]);
    } : (dom.window as any)[key]});
  const dir = await mkdtemp(join(process.cwd(), ".loot-ui-test-"));
  const {act, createElement} = await import("react");
  const {createRoot} = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const choices: (string | undefined)[] = [];
  try {
    const outfile = join(dir, "loot.mjs");
    await build({entryPoints: ["client/src/components/LootRewardChoices.tsx"], outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external"});
    const {LootRewardChoices} = await import(pathToFileURL(outfile).href);
    const props = {lootTable: [{itemId: "earned"}, {itemId: "missing"}, {itemId: "earned"}], goldReward: 12, claiming: false, onClaim: (id?: string) => choices.push(id)};
    const button = (name: string) => [...document.querySelectorAll("button")].find(b => b.textContent === name)!;
    await act(async () => root.render(createElement(LootRewardChoices, props)));
    assert.match(document.body.textContent!, /Equipment details could not load/);
    assert.equal(document.querySelectorAll("article").length, 0);
    assert.equal(button("Claim 12 gold").disabled, false);
    await act(async () => button("Retry equipment details").click());
    assert.equal(document.querySelectorAll("article").length, 1, "unearned and duplicate IDs never become choices");
    assert.match(document.body.textContent!, /Scholar’s <Staff>/);
    assert.equal(document.querySelector("staff"), null, "names are text, not HTML");
    assert.match(document.body.textContent!, /INT\+3/);
    assert.match(document.body.textContent!, /ATK-1/);
    assert.doesNotMatch(document.body.textContent!, /DEF/);
    assert.match(document.body.textContent!, /rare · Tier 2 · Weapon/);
    assert.match(document.body.textContent!, /Some equipment details are unavailable/);
    assert.equal(document.querySelector("img")?.getAttribute("src"), item.iconUrl);
    await act(async () => document.querySelector("img")!.dispatchEvent(new dom.window.Event("error")));
    assert.equal(document.querySelector("img"), null);
    assert.ok(document.querySelector("article svg"), "broken icon has a fallback");
    await act(async () => button("Claim Scholar’s <Staff>").click());
    await act(async () => button("Claim 12 gold").click());
    assert.deepEqual(choices, ["earned", undefined]);
    await act(async () => root.render(createElement(LootRewardChoices, {...props, claiming: true})));
    assert.ok([...document.querySelectorAll("button")].every(b => b.disabled));
    assert.match(document.body.textContent!, /Saving your reward/);
  } finally {
    await act(async () => root.unmount());
    await rm(dir, {recursive: true, force: true});
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
