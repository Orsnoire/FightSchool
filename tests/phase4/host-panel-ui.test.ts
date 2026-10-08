import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { started, student, fight } from "./fixtures.ts";

test("host panel keeps controls with the code and updates attendance, eligibility and recent feedback", async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: `https://qa.example/teacher/host/${fight.id}` });
  const keys = ["window", "document", "navigator", "location", "localStorage", "addEventListener", "removeEventListener", "WebSocket", "fetch", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
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
    value: key === "WebSocket" ? Socket : key === "IS_REACT_ACT_ENVIRONMENT" ? true : key === "fetch" ? async (url: string) => Response.json(url.endsWith("check-session") ? { id: fight.teacherId, email: "fixture@example.test", guildCode: "FIXTURE" } : url.endsWith("sessions") ? { sessionId: "ABC234" } : fight) : ["addEventListener", "removeEventListener"].includes(key) ? (dom.window as any)[key].bind(dom.window) : (dom.window as any)[key] });
  const dir = await mkdtemp(join(process.cwd(), ".host-panel-test-"));
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, queryFn: async ({queryKey}) => String(queryKey[0]).endsWith("host-guilds") ? [] : String(queryKey[0]).includes("/sessions") ? {sessionId:"ABC234"} : fight } } });
  const root = createRoot(document.getElementById("root")!);
  try {
    const outfile = join(dir, "host.mjs");
    await build({ entryPoints: ["client/src/pages/HostFight.tsx"], outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic", packages: "external", alias: { "@assets": join(process.cwd(), "attached_assets") }, loader: { ".png": "empty", ".css": "empty" },
      plugins: [{ name: "styles", setup(build) {
        build.onResolve({ filter: /\.css$/ }, () => ({ path: "styles", namespace: "test" }));
        build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export {}", loader: "js" }));
      } }] });
    const { default: HostFight } = await import(pathToFileURL(outfile).href);
    await act(async () => root.render(createElement(QueryClientProvider, { client: cache }, createElement(HostFight))));
    for(let i=0;i<10&&!sockets.length;i++)await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});
    assert.equal(sockets.length, 1);
    const socket = sockets[0];
    await act(async () => socket.onopen?.());
    const state = started();
    state.currentPhase = "waiting";
    state.phaseDeadline = null;
    const question = { id: "q1", question: "<p>Find <b>2 + 2</b>.</p>", type: "short_answer", timeLimit: 30 };
    const emit = async () => { state.revision++; await act(async () => socket.emit({ type: "combat_state", state, question: state.currentPhase === "waiting" ? null : question })); };
    const panel = () => document.querySelector('[data-testid="host-controls"]')!;
    const button = (text: string) => [...panel().querySelectorAll("button")].find(b => b.textContent === text)!;
    await emit();
    assert.match(panel().textContent!, /ABC234/);
    assert.match(panel().textContent!, /1 player joined/);
    await act(async () => button("Start fight").click());
    assert.equal(socket.sent.at(-1).type, "start_fight");
    state.currentPhase = "question";
    state.phaseDeadline = Date.now() + 30000;
    state.players[student().id].hasAnswered = true;
    state.players.other = { ...structuredClone(state.players[student().id]), studentId: "other", isDead: true, health: 0 };
    state.events = [{ id: "1:0", round: 1, type: "damage", actorId: student().id, targetId: "e1", amount: 2, message: "First round damage" }];
    await emit();
    assert.match(panel().textContent!, /2 players joined/);
    assert.match(panel().textContent!, /1\/1 answered/);
    assert.ok(button("Advance current phase"));
    assert.ok(button("End fight"));
    assert.equal(document.querySelector('[data-testid="host-question"] b')?.textContent, "2 + 2");
    assert.ok(document.querySelector('[aria-label="Combat log entries"]')?.textContent?.includes("First round damage"));
    delete state.players.other;
    state.round++;
    state.events = [];
    await emit();
    assert.match(panel().textContent!, /1 player joined/);
    assert.ok(document.querySelector('[aria-label="Combat log entries"]')?.textContent?.includes("First round damage"), "log keeps feedback when the server resets the round");
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    await rm(dir, { recursive: true, force: true });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
