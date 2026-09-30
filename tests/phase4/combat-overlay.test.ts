import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { started, student } from "./fixtures.ts";

test("student question, action, waiting, and resolution share a focused non-dismissible overlay", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "https://qa.example/student/combat", pretendToBeVisual: true });
  const keys = ["window", "document", "addEventListener", "removeEventListener", "requestAnimationFrame", "cancelAnimationFrame", "location", "localStorage", "navigator", "MutationObserver", "HTMLElement", "HTMLInputElement", "Node", "NodeFilter", "CustomEvent", "Event", "getComputedStyle", "WebSocket", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const sockets: any[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    sent: any[] = [];
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    constructor() { sockets.push(this); }
    send(body: string) { this.sent.push(JSON.parse(body)); }
    close() {}
    emit(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }); }
  }
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
    value: key === "WebSocket" ? Socket : key === "IS_REACT_ACT_ENVIRONMENT" ? true : ["addEventListener", "removeEventListener", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle"].includes(key) ? (dom.window as any)[key].bind(dom.window) : (dom.window as any)[key] });
  const dir = await mkdtemp(join(process.cwd(), ".combat-ui-test-"));
  const outfile = join(dir, "Combat.mjs");
  let root: ReturnType<typeof import("react-dom/client").createRoot> | undefined;
  const { act, createElement } = await import("react");
  try {
    // Bundle the real page, including MathEditor. Stub only MathLive registration
    // (its browser rendering needs a real browser) and image/CSS imports in Node.
    await build({ entryPoints: ["client/src/pages/Combat.tsx"], outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external", alias: { "@assets": join(process.cwd(), "attached_assets") }, loader: { ".css": "empty", ".png": "empty" },
      plugins: [{ name: "browser-assets", setup(build) {
        build.onResolve({ filter: /\.css$/ }, () => ({ path: "styles", namespace: "test" }));
        build.onResolve({ filter: /^mathlive$/ }, () => ({ path: "mathlive", namespace: "test" }));
        build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export {}", loader: "js" }));
      } }] });
    const { default: Combat } = await import(pathToFileURL(outfile).href);
    const { createRoot } = await import("react-dom/client");
    localStorage.setItem("sessionId", "ABC234");
    localStorage.setItem("studentId", student().id);
    root = createRoot(document.getElementById("root")!);
    await act(async () => root!.render(createElement(Combat)));
    const socket = sockets[0];
    await act(async () => socket.onopen?.());
    let state = started("herbalist");
    state.questionStartTime = Date.now() - 1000;
    state.phaseDeadline = Date.now() + 120000;
    const question = { id: "q1", type: "multiple_choice", question: "<p>What is <b>2 + 2</b>?</p>", options: ["4", "5"], timeLimit: 120 };
    const emit = async () => { state.revision++; await act(async () => socket.emit({ type: "combat_state", state, question, serverTime: Date.now() })); };
    const dialog = () => document.querySelector('[role="dialog"]')!;
    const button = (text: string) => [...dialog().querySelectorAll("button")].find((b) => b.textContent === text)!;
    await emit();
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    assert.match(dialog().textContent!, /Healing potions 5\/5/);
    assert.equal(dialog().querySelector("b")?.textContent, "2 + 2");
    assert.ok(document.querySelector("main")?.textContent?.includes("herbalist"), "battlefield remains mounted behind the portal");
    await act(async () => button("4").click());
    await act(async () => button("Submit answer").click());
    assert.equal(socket.sent.at(-1).type, "answer");
    assert.equal(socket.sent.at(-1).answer, "4");
    state.players[student().id].hasAnswered = true;
    await emit();
    assert.match(dialog().textContent!, /Choose your combat action/);
    assert.equal(document.activeElement?.textContent, "Choose your combat action");
    await act(async () => button("Confirm Attack & Ready").click());
    assert.equal(socket.sent.at(-1).type, "action");
    assert.equal(socket.sent.at(-1).ready, true);
    state.players[student().id].ready = true;
    await emit();
    assert.match(dialog().textContent!, /Your choices are saved/);
    await act(async () => document.activeElement?.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    assert.ok(dialog(), "Escape cannot dismiss a timed phase");
    state.currentPhase = "abilities";
    state.players[student().id].ready = false;
    await emit();
    assert.ok(button("Ready — no support actions"));
    state.currentPhase = "question_resolution";
    state.players[student().id].healingPotions = 4;
    state.players[student().id].lastAnswerCorrect = true;
    state.events = [{ id: "1:0", round: 1, phase: "question_resolution", type: "heal", actorId: student().id, targetId: student().id, amount: 2, message: "Herbalist healed for 2" }];
    await emit();
    assert.match(dialog().textContent!, /Healing potions 4\/5/);
    assert.match(dialog().textContent!, /Herbalist healed for 2/);
    state.currentPhase = "enemy_ai";
    state.events.push({ id: "1:1", round: 1, phase: "enemy_ai", type: "enemy_attack", actorId: "e1", targetId: student().id, amount: 3, message: "Damage" });
    await emit();
    assert.match(dialog().textContent!, /Slime counterattacks herbalist for 3 damage/);
    assert.doesNotMatch(dialog().textContent!, /Herbalist healed for 2/);
    assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
    const keyboard = { container: document.body, hide: () => {} };
    (dom.window as any).mathVirtualKeyboard = keyboard;
    state.round++;
    state.currentPhase = "question";
    state.players[student().id].hasAnswered = false;
    (question as any).type = "short_answer";
    await emit();
    await act(async () => button("Use math answer").click());
    assert.equal(keyboard.container, dialog().querySelector("[data-math-keyboard-host]"));
    const field = dialog().querySelector("math-field") as any;
    field.value = "x^2";
    await act(async () => field.dispatchEvent(new dom.window.Event("input", { bubbles: true })));
    await act(async () => button("Submit answer").click());
    assert.equal(socket.sent.at(-1).answer, "x^2");
    state.players[student().id].hasAnswered = true;
    await emit();
    assert.equal(keyboard.container, document.body, "keyboard container is restored when the math question closes");
  } finally {
    if (root) await act(async () => root!.unmount());
    await rm(dir, { recursive: true, force: true });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
