import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { started } from "./fixtures";

test("playback completion belongs to the rendered batch and phase changes cancel pending effects", async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
  const keys = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value:
        key === "IS_REACT_ACT_ENVIRONMENT" ? true : (dom.window as any)[key],
    });
  let reduced = false;
  (dom.window as any).matchMedia = () => ({ matches: reduced });
  const directory = await mkdtemp(join(process.cwd(), ".playback-ui-test-"));
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  try {
    const outfile = join(directory, "hook.mjs");
    await build({
      entryPoints: ["client/src/hooks/useCombatPlayback.ts"],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
    });
    const { useCombatPlayback } = await import(pathToFileURL(outfile).href);
    let controller: ReturnType<typeof useCombatPlayback>;
    const done: string[] = [],
      onComplete = (id: string) => done.push(id);
    function Harness({ state }: { state: any }) {
      controller = useCombatPlayback(state, onComplete);
      return null;
    }
    const batch = (id: string) => {
      const state = started();
      state.currentPhase = "question_resolution";
      state.phaseDeadline = null;
      state.events = [
        {
          id,
          round: 1,
          phase: "question_resolution",
          type: "damage",
          actorId: "p",
          targetId: "e1",
          amount: 1,
          message: "Hit",
          healthAfter: 4,
        },
      ];
      state.playback = {
        id,
        round: 1,
        phase: "question_resolution",
        eventIds: [id],
        initialHealth: { e1: 5 },
      };
      return state;
    };
    const render = async (state: any) => {
      await act(async () => root.render(createElement(Harness, { state })));
    };
    await render(batch("one"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    assert.equal(controller!.active.length, 1);
    assert.deepEqual(done, []);
    await act(async () => controller!.completeCue("one"));
    assert.deepEqual(done, ["one"]);
    await render(batch("two"));
    assert.deepEqual(
      done,
      ["one"],
      "completion state from batch one cannot acknowledge batch two",
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await act(async () => controller!.completeCue("two"));
    assert.deepEqual(done, ["one", "two"]);
    const cancelled = batch("cancelled");
    await render(cancelled);
    await render({ ...cancelled, currentPhase: "game_over" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 220));
    });
    assert.equal(controller!.active.length, 0);
    assert.deepEqual(done, ["one", "two"]);
    reduced = true;
    await render(batch("reduced"));
    assert.deepEqual(done, ["one", "two", "reduced"]);
    assert.equal(controller!.showing, false);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    await rm(directory, { recursive: true, force: true });
    for (const [key, descriptor] of saved)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
  }
});
