import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { student, fight } from "./fixtures.ts";

test("Fight Library loads the real loadout, warns pure healers before creating a solo room, and links to existing group entry", async () => {
  const guildId = "00000000-0000-4000-8000-000000000004";
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: `https://qa.example/student/guilds/${guildId}/fights`, pretendToBeVisual: true });
  const keys = ["window", "document", "addEventListener", "removeEventListener", "dispatchEvent", "location", "history", "localStorage", "navigator", "MutationObserver", "HTMLElement", "HTMLInputElement", "Node", "NodeFilter", "CustomEvent", "Event", "getComputedStyle", "fetch", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const posts: string[] = [];
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
    value: key === "fetch" ? async (url: string, options?: RequestInit) => { if (options?.method === "POST") { posts.push(url); return Response.json({sessionId: "ABC234"}); } return Response.json({completedCombats: 0, xpMultiplier: 1, resetsAt: Date.now() + 100000}); }
      : key === "IS_REACT_ACT_ENVIRONMENT" ? true
      : ["addEventListener", "removeEventListener", "dispatchEvent", "getComputedStyle"].includes(key) ? (dom.window as any)[key].bind(dom.window) : (dom.window as any)[key] });
  const dir = await mkdtemp(join(process.cwd(), ".priest-solo-test-"));
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  let pending = true;
  let resolveStudent: (value: unknown) => void;
  let resolveLevels: (value: unknown) => void;
  const cache = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity, staleTime: Infinity, queryFn: async ({queryKey}) => {
    if (!pending) return cache.getQueryData(queryKey);
    if (queryKey[0] === `/api/student/${student().id}`) return new Promise(resolve => { resolveStudent = resolve; });
    if (queryKey[0] === `/api/student/${student().id}/job-levels`) return new Promise(resolve => { resolveLevels = resolve; });
    return new Promise(() => {});
  }}}});
  const root = createRoot(document.getElementById("root")!);
  localStorage.setItem("studentId", student().id);
  cache.setQueryData([`/api/guilds/${guildId}`], {id: guildId, name: "Test guild"});
  cache.setQueryData([`/api/guilds/${guildId}/fights`], [{...fight, soloModeEnabled: true}]);
  try {
    const outfile = join(dir, "guild.mjs");
    await build({entryPoints: ["client/src/pages/GuildFights.tsx"], outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external"});
    const {default: GuildFights} = await import(pathToFileURL(outfile).href);
    await act(async () => root.render(createElement(QueryClientProvider, {client: cache}, createElement(GuildFights))));
    const solo = () => document.querySelector(`[data-testid="button-host-solo-${fight.id}"]`) as HTMLButtonElement;
    const button = (text: string) => [...document.querySelectorAll("button")].find(b => b.textContent === text) as HTMLButtonElement;
    assert.equal(solo().disabled, true, "do not bypass warning before the loadout arrives");
    const profileKey = [`/api/student/${student().id}`];
    const levelsKey = [`/api/student/${student().id}/job-levels`];
    await act(async () => {
      pending = false;
      resolveStudent!(student("priest"));
      resolveLevels!([{jobClass: "priest", level: 1}]);
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.equal(solo().disabled, false);
    await act(async () => solo().click());
    assert.equal(posts.length, 0);
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /cannot damage enemies or win this fight alone/);
    assert.ok(button("Change loadout"));
    assert.ok(button("Join a group fight"));
    assert.equal(document.querySelector('a[href="/student"]')?.textContent, "Join a teacher-hosted fight with its session code");
    await act(async () => button("Join a group fight").click());
    assert.equal(location.pathname, "/student");
    assert.equal(posts.length, 0, "group entry does not create a private solo room");
    await act(async () => { history.pushState({}, "", `/student/guilds/${guildId}/fights`); dispatchEvent(new dom.window.Event("popstate")); });
    await act(async () => solo().click());
    await act(async () => button("Continue solo anyway").click());
    assert.deepEqual(posts, [`/api/fights/${fight.id}/solo-sessions`]);
    assert.equal(localStorage.getItem("sessionId"), "ABC234");
    assert.equal(location.pathname, "/student/combat");
    // A genuine equipped offensive unlock permits solo; a merely supplied locked ID does not.
    await act(async () => {
      history.pushState({}, "", `/student/guilds/${guildId}/fights`); dispatchEvent(new dom.window.Event("popstate"));
      cache.setQueryData(profileKey, {...student("priest"), crossClassAbility1: "fireball_crossclass"});
      cache.setQueryData(levelsKey, [{jobClass: "priest", level: 1}, {jobClass: "wizard", level: 8}]);
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    // Remount to represent returning from combat and clear the in-flight button state.
    await act(async () => root.render(createElement(QueryClientProvider, {client: cache}, createElement(GuildFights, {key: "offensive"}))));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    await act(async () => solo().click());
    assert.equal(posts.length, 2);
    assert.equal(document.querySelector('[role="dialog"]'), null);
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    await rm(dir, {recursive: true, force: true});
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
