import assert from "node:assert/strict";
import { test } from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { useCombatSession } from "../../client/src/hooks/useCombatSession.ts";
import { started } from "./fixtures.ts";

test("combat client keeps questions in sync and resets state when changing rooms", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://qa.example" });
  const keys = ["window", "document", "location", "WebSocket", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const sockets: Socket[] = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    sent: any[] = [];
    onopen?: () => void;
    onmessage?: (event: { data: string }) => void;
    onclose?: (event: { code: number }) => void;
    onerror?: () => void;
    constructor(public url: string) { sockets.push(this); }
    send(message: string) { this.sent.push(JSON.parse(message)); }
    close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
    emit(message: any) { this.onmessage?.({ data: JSON.stringify(message) }); }
  }
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    location: dom.window.location, WebSocket: Socket, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.getElementById("root")!);
  let current!: ReturnType<typeof useCombatSession>;
  function App({ room }: { room: string }) { current = useCombatSession(room, "student"); return null; }
  try {
    await act(async () => root.render(createElement(App, { room: "ABC234" })));
    const socket = sockets[0];
    await act(async () => socket.onopen?.());
    const state = { ...started(), revision: 10 };
    const question = { id: "q10", type: "short_answer", question: "Current question", timeLimit: 30 };
    await act(async () => socket.emit({ type: "combat_state", state, question, results: [] }));
    await act(async () => current.send("answer", { questionId: "q10", answer: "4" }));
    assert.equal(socket.sent.filter(m => m.type === "answer").length, 1);
    await act(async () => socket.emit({ type: "combat_state", state: { ...state, revision: 11 }, question }));
    assert.equal(socket.sent.filter(m => m.type === "answer").length, 1, "ordinary broadcasts must not repeatedly resend pending commands");
    await act(async () => socket.emit({ type: "combat_state", state: { ...state, revision: 9 }, question: { ...question, id: "old" } }));
    assert.equal(current.state?.revision, 11);
    assert.equal(current.question?.id, "q10", "an old snapshot cannot replace the current question");
    await act(async () => root.render(createElement(App, { room: "DEF234" })));
    assert.equal(current.state, null);
    assert.equal(current.question, null);
    const next = sockets[1];
    await act(async () => next.onopen?.());
    await act(async () => next.emit({ type: "combat_state", state: { ...state, sessionId: "DEF234", revision: 0 }, question: { ...question, id: "fresh" } }));
    assert.equal(current.state?.sessionId, "DEF234");
    assert.equal(current.question?.id, "fresh");
    assert.equal(next.sent.filter(m => m.type === "answer").length, 0, "commands from the previous room must never be replayed in the new room");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
