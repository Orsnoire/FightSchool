import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

test("student leaderboard requests the API contract and distinguishes failure from empty results", async (t) => {
  const guildId = "00000000-0000-4000-8000-000000000010";
  const guildUrl = `/api/guilds/${guildId}`;
  const leaderboardUrl = `${guildUrl}/leaderboard?metric=damageDealt`;
  const dom = new JSDOM('<div id="root"></div>', { url: `https://qa.example/student/guilds/${guildId}/leaderboard` });
  const keys = ["window", "document", "navigator", "location", "history", "localStorage", "addEventListener", "removeEventListener", "dispatchEvent", "fetch", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of keys) Object.defineProperty(globalThis, key, {
    configurable: true, writable: true,
    value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : ["addEventListener", "removeEventListener", "dispatchEvent"].includes(key)
      ? (dom.window as any)[key].bind(dom.window) : (dom.window as any)[key],
  });
  const dir = await mkdtemp(join(process.cwd(), ".leaderboard-ui-test-"));
  try {
    const outfile = join(dir, "ui.mjs");
    // Bundle the real page and default query function; do not replace its query contract.
    await build({ stdin: { contents: 'export { default as GuildLeaderboard } from "./client/src/pages/GuildLeaderboard"; export { getQueryFn } from "./client/src/lib/queryClient";', resolveDir: process.cwd(), loader: "tsx" },
      outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external" });
    const { GuildLeaderboard, getQueryFn } = await import(pathToFileURL(outfile).href);
    const { act, createElement } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const entry = { studentId: "student", nickname: "Scholar", characterClass: "warrior", totalDamageDealt: 1234, fightsCompleted: 2 };
    localStorage.setItem("studentId", entry.studentId);
    const page = async (respond: (url: string) => Response, check: (context: any) => Promise<void>) => {
      const requests: string[] = [];
      globalThis.fetch = async (input, init) => {
        assert.equal(init?.credentials, "include");
        const url = String(input);
        requests.push(url);
        return respond(url);
      };
      const cache = new QueryClient({ defaultOptions: { queries: {
        queryFn: getQueryFn({ on401: "throw" }), retry: false, gcTime: Infinity, staleTime: Infinity,
      } } });
      const otherMetric = [`${guildUrl}/leaderboard`, "accuracy"];
      const otherGuild = ["/api/guilds/another/leaderboard", "damageDealt"];
      cache.setQueryData(otherMetric, ["different metric"]);
      cache.setQueryData(otherGuild, ["different guild"]);
      const root = createRoot(document.getElementById("root")!);
      const settle = async () => {
        for (let i = 0; i < 100; i++) {
          await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
          if (!cache.isFetching()) return;
        }
        assert.fail("leaderboard queries did not settle");
      };
      try {
        await act(async () => root.render(createElement(QueryClientProvider, { client: cache }, createElement(GuildLeaderboard))));
        await settle();
        await check({ requests, cache, settle, act });
        assert.deepEqual(cache.getQueryData(otherMetric), ["different metric"]);
        assert.deepEqual(cache.getQueryData(otherGuild), ["different guild"]);
      } finally {
        await act(async () => root.unmount());
        cache.clear();
      }
    };
    const guild = () => Response.json({ id: guildId, name: "Our guild" });
    const row = () => document.querySelector('[data-testid="leaderboard-entry-0"]');
    const retry = () => [...document.querySelectorAll("button")].find(button => button.textContent === "Retry");

    await t.test("the real query uses the metric parameter and renders the returned ranking", async () => {
      await page(url => url === guildUrl ? guild() : url === leaderboardUrl ? Response.json([entry]) : Response.json({ error: "Not found" }, { status: 404 }), async ({ requests }) => {
        assert.deepEqual(requests, [guildUrl, leaderboardUrl]);
        assert.match(row()!.textContent!, /Scholar/);
        assert.match(row()!.textContent!, /1,234/);
        assert.match(row()!.textContent!, /2 fights/);
        assert.match(row()!.textContent!, /You/);
        assert.match(document.body.textContent!, /Our guild/);
        assert.equal(document.querySelector('[role="alert"]'), null);
      });
    });
    await t.test("a successful empty response shows the empty state", async () => {
      await page(url => url === guildUrl ? guild() : Response.json([]), async () => {
        assert.match(document.body.textContent!, /No stats yet/);
        assert.equal(document.querySelector('[role="alert"]'), null);
      });
    });
    for (const status of [403, 503]) {
      await t.test(`a ${status} leaderboard failure is visible and can be retried`, async () => {
        let recovered = false;
        await page(url => url === guildUrl ? guild() : recovered ? Response.json([entry]) : Response.json({ error: "Unavailable" }, { status }), async ({ requests, settle, act }) => {
          assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Could not load leaderboard/);
          assert.doesNotMatch(document.body.textContent!, /No stats yet/);
          assert.ok(retry());
          recovered = true;
          await act(async () => retry()!.click());
          await settle();
          assert.equal(document.querySelector('[role="alert"]'), null);
          assert.match(row()!.textContent!, /Scholar/);
          assert.equal(requests.filter((url: string) => url.includes("leaderboard")).length, 2);
        });
      });
    }
    await t.test("guild metadata errors are retriable instead of reported as missing guilds", async () => {
      let recovered = false;
      await page(url => url === guildUrl ? recovered ? guild() : new Response(null, { status: 503 }) : Response.json([entry]), async ({ settle, act }) => {
        assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Could not load leaderboard/);
        assert.doesNotMatch(document.body.textContent!, /Guild not found|No stats yet/);
        recovered = true;
        await act(async () => retry()!.click());
        await settle();
        assert.match(row()!.textContent!, /Scholar/);
        assert.match(document.body.textContent!, /Our guild/);
      });
    });
    await t.test("failed refreshes show an error even with previously cached rankings", async () => {
      let fail = false;
      await page(url => url === guildUrl ? guild() : fail ? new Response(null, { status: 503 }) : Response.json([entry]), async ({ cache, settle, act }) => {
        assert.ok(row());
        fail = true;
        await act(async () => { await cache.invalidateQueries({ predicate: (query: any) => query.queryKey[0] === `${guildUrl}/leaderboard` }); });
        await settle();
        assert.match(document.querySelector('[role="alert"]')?.textContent ?? "", /Could not load leaderboard/);
        assert.doesNotMatch(document.body.textContent!, /No stats yet/);
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
