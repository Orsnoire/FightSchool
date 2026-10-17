import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

test("student history pages older fights without truncating all-time totals and offers retry", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://qa.example/student/stats",
  });
  const keys = [
    "window",
    "document",
    "navigator",
    "fetch",
    "IS_REACT_ACT_ENVIRONMENT",
  ];
  const saved = keys.map(
    (k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const,
  );
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value:
        key === "IS_REACT_ACT_ENVIRONMENT" ? true : (dom.window as any)[key],
    });
  const dir = await mkdtemp(join(process.cwd(), ".history-ui-test-"));
  let root: any, cache: any;
  try {
    const outfile = join(dir, "page.mjs");
    await build({
      stdin: {
        contents:
          'export {default as Page} from "./client/src/pages/StudentStats"; export {getQueryFn} from "./client/src/lib/queryClient";',
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      jsx: "automatic",
      packages: "external",
    });
    const { Page, getQueryFn } = await import(pathToFileURL(outfile).href);
    const { act, createElement } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { QueryClient, QueryClientProvider } = await import(
      "@tanstack/react-query"
    );
    let fail = false;
    const requests: string[] = [];
    const row = (id: string) => ({
      id,
      characterClass: "warrior",
      completedAt: 1700000000000,
      survived: true,
      damageDealt: 10,
      healingDone: 3,
    });
    globalThis.fetch = async (input, init) => {
      assert.equal(init?.credentials, "include");
      const url = String(input);
      requests.push(url);
      if (fail) return new Response(null, { status: 503 });
      if (url.endsWith("/summary"))
        return Response.json({
          totalFights: 200,
          survived: 175,
          totalDamage: 9999,
          totalHealing: 600,
          totalDamageTaken: 99,
          favoriteClass: "warrior",
        });
      if (url.includes("before=")) return Response.json([row("older")]);
      return Response.json([row("newer")], {
        headers: {
          "X-Next-Cursor": "1700000000000:10000000-0000-4000-8000-000000000001",
        },
      });
    };
    cache = new QueryClient({
      defaultOptions: {
        queries: {
          queryFn: getQueryFn({ on401: "throw" }),
          retry: false,
          gcTime: Infinity,
        },
      },
    });
    root = createRoot(document.getElementById("root")!);
    const settle = async () => {
      for (let i = 0; i < 100; i++) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 10));
        });
        if (!cache.isFetching()) return;
      }
      assert.fail("queries did not settle");
    };
    await act(async () =>
      root.render(
        createElement(
          QueryClientProvider,
          { client: cache },
          createElement(Page, { params: { id: "student" } }),
        ),
      ),
    );
    await settle();
    assert.equal(
      document
        .querySelector('[data-testid="text-total-fights"]')!
        .textContent!.trim(),
      "200",
    );
    assert.equal(
      document
        .querySelector('[data-testid="text-damage-dealt"]')!
        .textContent!.trim(),
      "9999",
    );
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Load older fights",
    );
    assert.ok(button);
    await act(async () => button.click());
    await settle();
    assert.equal(
      document.querySelectorAll('[data-testid^="fight-"]').length,
      2,
    );
    assert.ok(requests.some((url) => url.includes("limit=10&before=")));
    assert.equal(
      document
        .querySelector('[data-testid="text-total-fights"]')!
        .textContent!.trim(),
      "200",
    );
    fail = true;
    await act(async () => {
      await cache.invalidateQueries();
    });
    await settle();
    assert.match(
      document.querySelector('[role="alert"]')!.textContent!,
      /Unable to load/,
    );
    fail = false;
    await act(async () =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent === "Retry")!
        .click(),
    );
    await settle();
    assert.equal(document.querySelector('[role="alert"]'), null);
    await act(async () => root.unmount());
    root = null;
  } finally {
    if (root) root.unmount();
    cache?.clear();
    await rm(dir, { recursive: true, force: true });
    dom.window.close();
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
});
