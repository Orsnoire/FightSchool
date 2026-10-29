import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import Papa from "papaparse";

test("CSV hook rejects invalid imports atomically and permits a corrected retry without losing the draft", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://qa.example/teacher/create" });
  const globals = ["window", "document", "navigator", "File", "FileReader", "IS_REACT_ACT_ENVIRONMENT", "__csvToast"];
  const saved = globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const toasts: any[] = [];
  let notify: (toast: any) => void = () => {};
  for (const key of globals) Object.defineProperty(globalThis, key, {
    configurable: true, writable: true,
    value: key === "IS_REACT_ACT_ENVIRONMENT" ? true : key === "__csvToast"
      ? (toast: any) => { toasts.push(toast); notify(toast); }
      : (dom.window as any)[key],
  });
  const { act, createElement, useState } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  const dir = await mkdtemp(join(process.cwd(), ".question-csv-test-"));
  const existing = { id: "existing", question: "Existing work", type: "multiple_choice", options: ["A", "B"], correctAnswer: "A", timeLimit: 60 };
  let draft = [existing];
  let writes = 0;
  try {
    const outfile = join(dir, "hook.mjs");
    await build({
      stdin: { contents: 'export { useQuestionCsv } from "./client/src/features/fight-authoring/useQuestionCsv";', resolveDir: process.cwd(), loader: "tsx" },
      outfile, bundle: true, platform: "node", format: "esm", packages: "external",
      plugins: [{ name: "toast-observer", setup(build) {
        build.onResolve({ filter: /^@\/hooks\/use-toast$/ }, () => ({ path: "toast", namespace: "test-toast" }));
        build.onLoad({ filter: /.*/, namespace: "test-toast" }, () => ({ contents: 'export const useToast = () => ({ toast: globalThis.__csvToast });' }));
      } }],
    });
    const { useQuestionCsv } = await import(pathToFileURL(outfile).href);
    function Harness() {
      const [questions, setQuestions] = useState(draft);
      const editor = useQuestionCsv(questions, (next: typeof draft) => { writes++; draft = next; setQuestions(next); });
      return createElement("input", { id: "csv", type: "file", ref: editor.csvInputRef, onChange: editor.handleCSVUpload, disabled: editor.isUploadingCSV });
    }
    await act(async () => root.render(createElement(Harness)));
    const upload = async (questions: string[]) => {
      const text = Papa.unparse(questions.map(question => ({ "Question Text": question, "Question Type": "MC", Answer1: "yes", Answer2: "no", Timer: "120" })));
      const input = document.getElementById("csv") as HTMLInputElement;
      Object.defineProperty(input, "files", { configurable: true, value: [new dom.window.File([text], "practice.csv", { type: "text/csv" })] });
      const completed = new Promise(resolve => { notify = resolve; });
      await act(async () => { input.dispatchEvent(new dom.window.Event("change", { bubbles: true })); await completed; });
      assert.equal(input.disabled, false);
    };
    await upload(["A valid imported row", "x".repeat(20_001)]);
    assert.equal(writes, 0);
    assert.deepEqual(draft, [existing]);
    assert.equal(toasts.at(-1).title, "CSV could not be imported");
    assert.match(toasts.at(-1).description, /No questions were added. Question 3: use at most 20,000 characters/);
    await upload(["A valid imported row", "x".repeat(20_000)]);
    assert.equal(writes, 1);
    assert.equal(draft.length, 3);
    assert.deepEqual(draft[0], existing);
    assert.equal(draft[2].question.length, 20_000);
    assert.equal(draft[2].correctAnswer, "yes");
    assert.equal(draft[2].timeLimit, 120);
    assert.equal(toasts.at(-1).title, "Successfully imported 2 questions");
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    await rm(dir, { recursive: true, force: true });
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
});
