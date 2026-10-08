import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

test("teacher authoring submits limits and quest rewards, and shop creation carries the selected tier", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://qa.example/teacher",
  });
  const keys = [
    "window",
    "document",
    "navigator",
    "location",
    "addEventListener",
    "removeEventListener",
    "fetch",
    "IS_REACT_ACT_ENVIRONMENT",
  ];
  const saved = keys.map(
    (k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const,
  );
  const writes: any[] = [];
  for (const k of keys)
    Object.defineProperty(globalThis, k, {
      configurable: true,
      writable: true,
      value: ["addEventListener", "removeEventListener"].includes(k)
        ? (dom.window as any)[k].bind(dom.window)
        : k === "IS_REACT_ACT_ENVIRONMENT"
          ? true
          : k === "fetch"
            ? async (url: string, init: any) => {
                writes.push({ url, ...init, body: JSON.parse(init.body) });
                return Response.json({});
              }
            : (dom.window as any)[k],
    });
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import(
    "@tanstack/react-query"
  );
  const cache = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        queryFn: async ({ queryKey }) =>
          String(queryKey[0]).endsWith("/fights")
            ? [{ id: "quiz", title: "Fractions" }]
            : [],
      },
    },
  });
  const root = createRoot(document.getElementById("root")!);
  const dir = await mkdtemp(join(process.cwd(), ".guild-ui-test-"));
  const guild: any = {
    id: "guild",
    teacherId: "teacher",
    limitTier: 1,
    experience: 0,
    unlockedTier: 1,
    isArchived: false,
  };
  try {
    const outfile = join(dir, "ui.mjs");
    await build({
      stdin: {
        contents:
          'export {GuildAdministration} from "./client/src/components/GuildAdministration"; export {TeacherGuildShop} from "./client/src/components/TeacherGuildShop";',
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
    const { GuildAdministration, TeacherGuildShop } = await import(
      pathToFileURL(outfile).href
    );
    await act(async () =>
      root.render(
        createElement(
          QueryClientProvider,
          { client: cache },
          createElement(GuildAdministration, { guild }),
        ),
      ),
    );
    const field = (label: string) => {
      const l = [...document.querySelectorAll("label")].find((l) =>
        l.textContent?.trim().startsWith(label),
      );
      assert.ok(l, label);
      return l.querySelector("input,select,textarea") as HTMLInputElement;
    };
    const change = async (label: string, value: string) => {
      const el = field(label);
      const proto =
        el.tagName === "SELECT"
          ? dom.window.HTMLSelectElement.prototype
          : el.tagName === "TEXTAREA"
            ? dom.window.HTMLTextAreaElement.prototype
            : dom.window.HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(
          new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", {
            bubbles: true,
          }),
        );
      });
    };
    const click = async (text: string) => {
      const b = [...document.querySelectorAll("button")].find(
        (b) => b.textContent === text,
      )!;
      assert.ok(b);
      assert.equal(b.disabled, false);
      await act(async () => b.click());
    };
    await change("Current limit tier", "2");
    await click("Save guild progression");
    assert.equal(writes.at(-1).body.limitTier, 2);
    await change("Title", "Accuracy break");
    await change("Description", "Clear the fractions quiz.");
    await change("Objective", "fight_accuracy");
    await change("Quiz fight", "quiz");
    await change("Minimum accuracy", "90");
    await change("Limit-break reward", "3");
    await change("Job unlock", "ranger");
    await click("Create quest");
    const data = writes.at(-1).body;
    assert.equal(data.criteria.type, "fight_accuracy");
    assert.equal(data.criteria.accuracy, 90);
    assert.equal(data.criteria.fightId, "quiz");
    assert.equal(data.rewards.limitBreak, 3);
    assert.equal(data.rewards.unlockJob, "ranger");
    assert.equal(data.questType, "guild");
    await act(async () =>
      root.render(
        createElement(
          QueryClientProvider,
          { client: cache },
          createElement(TeacherGuildShop, { guild }),
        ),
      ),
    );
    await change("Browse shop tier", "4");
    assert.equal(
      document.querySelector("a")?.getAttribute("href"),
      "/teacher/items?guild=guild&tier=4&create=1",
    );
    assert.match(document.body.textContent!, /This tier is locked/);
    assert.equal(writes.length, 2, "browsing does not mutate guild limits");
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    await rm(dir, { recursive: true, force: true });
    dom.window.close();
    for (const [k, d] of saved) {
      if (d) Object.defineProperty(globalThis, k, d);
      else Reflect.deleteProperty(globalThis, k);
    }
  }
});
