import assert from "node:assert/strict";
import { test } from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { JSDOM } from "jsdom";
import { useTeacherAuth } from "../../client/src/hooks/useTeacherAuth.ts";

test("verified teacher session restores missing or stale browser identity", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://qa.example/teacher" });
  const keys = ["window", "document", "localStorage", "fetch", "IS_REACT_ACT_ENVIRONMENT"];
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.assign(globalThis, { window: dom.window, document: dom.window.document,
    localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => Response.json({ id: "verified-teacher", email: "teacher@example.invalid", guildCode: "ABC234", sessionActive: true }),
  });
  const root = createRoot(document.getElementById("root")!);
  let current!: ReturnType<typeof useTeacherAuth>;
  function App() { current = useTeacherAuth(); return null; }
  try {
    const location = memoryLocation({ path: "/teacher" });
    await act(async () => root.render(createElement(Router, { hook: location.hook }, createElement(App))));
    assert.equal(current.isAuthenticated, true);
    assert.equal(current.isChecking, false);
    assert.equal(localStorage.getItem("teacherId"), "verified-teacher");
    assert.equal(localStorage.getItem("teacherEmail"), "teacher@example.invalid");
    assert.equal(localStorage.getItem("teacherGuildCode"), "ABC234");
    await act(async () => root.render(null));
    localStorage.setItem("teacherId", "previous-teacher");
    await act(async () => root.render(createElement(Router, { hook: location.hook }, createElement(App))));
    assert.equal(localStorage.getItem("teacherId"), "verified-teacher");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
