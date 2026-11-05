import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { mathAuthoringFixture } from "./math-authoring-fixture";

test("teacher UI preserves drafts, renders math, handles ambiguous saves, approves and reopens real revisions", async () => {
  const f = await mathAuthoringFixture();
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "https://qa.example/teacher/create", pretendToBeVisual: true });
  const globals = ["window", "document", "navigator", "HTMLElement", "Element", "Node", "HTMLInputElement", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT", "fetch"];
  const saved = globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let loseFirstCreate = true;
  const creates: any[] = [];
  for (const key of globals) if (key !== "fetch") Object.defineProperty(globalThis, key, { configurable: true, writable: true,
    value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : ["requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle"].includes(key) ? (dom.window as any)[key].bind(dom.window) : (dom.window as any)[key] });
  dom.window.confirm = () => true;
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: async (path: string, init: RequestInit = {}) => {
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const response = await f.send(path, init.method || "GET", f.teacher.cookie, body);
    if (path === "/api/math/templates" && init.method === "POST") {
      creates.push(body);
      if (loseFirstCreate) { loseFirstCreate = false; return Response.json({ error: "Response lost. Retry save." }, { status: 503 }); }
    }
    if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return response;
  } });
  const { act, createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const dir = await mkdtemp(join(process.cwd(), ".math-ui-test-"));
  try {
    const file = join(dir, "harness.mjs");
    await build({ stdin: { contents: `import React, { useState } from "react";
      import { useMathAuthoring } from "./client/src/features/math-authoring/useMathAuthoring";
      import MathAuthoringPanel from "./client/src/features/math-authoring/MathAuthoringPanel";
      export function Harness() {
        const editor = useMathAuthoring(); const [tab,setTab] = useState(true); const [fixed,setFixed] = useState("");
        return <form id="fixed-fight"><input aria-label="Fixed draft" value={fixed} onChange={e=>setFixed(e.target.value)}/><button type="button" onClick={()=>setTab(!tab)}>Switch tab</button>{tab && <MathAuthoringPanel editor={editor}/>}</form>;
      }`, resolveDir: process.cwd(), loader: "tsx" }, outfile: file, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "dom-without-stylesheets", setup(build) {
        build.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: "css-stub" }));
        build.onLoad({ filter: /.*/, namespace: "css-stub" }, () => ({ contents: "", loader: "js" }));
      } }] });
    const { Harness } = await import(pathToFileURL(file).href);
    await act(async () => root.render(createElement(Harness)));
    async function waitFor(check: () => boolean, label: string) {
      const end = Date.now() + 5000;
      while (!check() && Date.now() < end) await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
      assert.ok(check(), label + "\n" + document.body.textContent);
    }
    const text = () => document.body.textContent || "";
    const button = (label: string) => {
      const el = [...document.querySelectorAll("button")].find(el => el.textContent === label);
      assert.ok(el, `Button ${label}`); return el;
    };
    const field = (label: string) => {
      const el = [...document.querySelectorAll("label")].find(el => el.textContent?.startsWith(label))?.querySelector("input,select") as HTMLInputElement;
      assert.ok(el, `Field ${label}`); return el;
    };
    const click = async (label: string) => { await act(async () => button(label).click()); };
    const fill = async (el: HTMLInputElement, value: string) => {
      const prototype = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(el, value);
        el.dispatchEvent(new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      });
    };
    await fill(document.querySelector('[aria-label="Fixed draft"]')!, "Keep fixed question work");
    await click("Open templates");
    await fill(field("Preview count"), "11");
    assert.equal(field("Preview count").form, null, "template input does not belong to the fixed-fight form");
    assert.equal((document.getElementById("fixed-fight") as HTMLFormElement).checkValidity(), true, "template bounds cannot block fixed-fight native validation");
    await fill(field("Preview count"), "5");
    await click("Use quotient rule");
    await fill(field("Template title"), "Quotient review");
    for (const [label, value] of [["m minimum", "2"], ["m maximum", "2"], ["n minimum", "5"], ["n maximum", "5"]]) await fill(field(label), value);
    await click("Switch tab"); await click("Switch tab");
    assert.equal(field("Template title").value, "Quotient review");
    assert.equal((document.querySelector('[aria-label="Fixed draft"]') as HTMLInputElement).value, "Keep fixed question work");
    await click("Preview variants"); await waitFor(() => text().includes("Preview: 1 of 1 distinct variants"), "bounded preview appears");
    assert.ok(document.querySelectorAll('[aria-label="Template variants"] .katex').length >= 2, "math rendered through real renderer");
    for (const [value, expected] of [["-3", "Correct"], ["-6/2", "Equal value, but enter a single integer only."], ["x^-3", "Could not grade: unsupported notation. This is not a wrong answer."]]) {
      await fill(field("Try an answer for variant 1"), value);
      assert.equal(document.querySelector('[aria-label="Template variants"] article [role="status"]'), null, "editing an answer clears the previous grading result");
      await click("Check variant 1");
      await waitFor(() => [...document.querySelectorAll('[role="status"]')].some(el => el.textContent === expected), "grading result " + expected);
    }
    await fill(field("Answer sign"), "positive"); await click("Preview variants");
    await waitFor(() => text().includes("No valid variants match"), "empty-pool feedback");
    await fill(field("Answer sign"), "any");
    await click("Save template draft"); await waitFor(() => text().includes("Response lost. Retry save."), "ambiguous commit feedback");
    await click("Save template draft"); await waitFor(() => text().includes("Saved draft revision 1"), "retry recovered");
    assert.equal(creates.length, 2); assert.equal(creates[0].mutationId, creates[1].mutationId);
    await act(async () => field("I reviewed these variants").click());
    await click("Approve reviewed template"); await waitFor(() => text().includes("Approved revision 2 for authoring reuse."), "approved");
    await fill(field("Teacher note"), "Later draft"); await click("Save template draft");
    await waitFor(() => text().includes("Saved draft revision 3"), "new draft");
    await click("View last approved"); await waitFor(() => text().includes("Opened revision 2."), "approved history");
    assert.equal(field("Teacher note").value, ""); assert.equal(field("Template title").matches(":disabled"), true);
    await click("Create draft from this version"); await fill(field("Teacher note"), "Historical edit");
    await click("Discard template changes"); assert.equal(field("Teacher note").value, "");
    await click("Reopen latest"); await waitFor(() => text().includes("Opened revision 3."), "latest recovered");
    assert.equal(field("Teacher note").value, "Later draft");
    const [record] = (await f.pg.query<{ id: string }>("SELECT id FROM math_templates")).rows;
    const latest = (await f.api(`/api/math/templates/${record.id}`, "GET", f.teacher.cookie)).data;
    await f.api(`/api/math/templates/${record.id}/revisions`, "POST", f.teacher.cookie, { mutationId: crypto.randomUUID(), expectedRevision: 3,
      preset: { ...latest.revision.preset, note: "Other tab" }, preview: { seed: 1, count: 5 } }, 201);
    await fill(field("Teacher note"), "Keep conflicting draft"); await click("Save template draft");
    await waitFor(() => text().includes("A newer revision exists"), "stale edit feedback");
    assert.equal(field("Teacher note").value, "Keep conflicting draft");
    await click("Reopen latest"); await waitFor(() => text().includes("Opened revision 4."), "conflict recovery");
    await act(async () => root.render(createElement(Harness, { key: "reload" })));
    await click("Open templates"); await waitFor(() => text().includes("Open Quotient review"), "saved list after remount");
    await click("Open Quotient review"); await waitFor(() => text().includes("Opened revision 4."), "reopen after remount");
    assert.equal(field("Teacher note").value, "Other tab");
    assert.equal(f.roomCalls(), 0);
  } finally {
    await act(async () => root.unmount()); dom.window.close(); await rm(dir, { recursive: true, force: true });
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; }
    await f.close();
  }
});
