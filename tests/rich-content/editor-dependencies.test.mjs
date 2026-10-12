import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { convertLatexToMarkup, convertLatexToMathMl } from 'mathlive';

// Exercise the upstream rendering boundary, before the application's sanitizer.
test('MathLive escapes untrusted text in HTML and MathML', () => {
  for (const command of ['text', 'mbox']) {
    const latex = `\\${command}{<img src=x onerror=alert(1)> & test}`;
    for (const render of [convertLatexToMarkup, convertLatexToMathMl]) {
      const document = new JSDOM(render(latex)).window.document;
      assert.equal(document.querySelector('img, [onerror]'), null);
      // MathLive does not serialize mbox to MathML; its empty output is safe.
      if (command === 'text' || render === convertLatexToMarkup) {
        assert.equal(document.body.textContent, '<img src=x onerror=alert(1)> & test');
      }
    }
  }
});

test('editor HTML paste retains formatting and supports undo/redo without executable attributes', async () => {
  const dom = new JSDOM('<div id="editor"></div>', { pretendToBeVisual: true });
  const previous = new Map();
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    const value = typeof dom.window[key] === 'function' && ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key];
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  let editor;
  try {
    const { Editor } = await import('@tiptap/core');
    const { default: StarterKit } = await import('@tiptap/starter-kit');
    const { default: Image } = await import('@tiptap/extension-image');
    const { default: TextAlign } = await import('@tiptap/extension-text-align');
    const { default: Underline } = await import('@tiptap/extension-underline');
    editor = new Editor({ element: document.querySelector('#editor'), extensions: [StarterKit.configure({ underline: false }), Underline, TextAlign.configure({ types: ['heading', 'paragraph'] }), Image], content: '<p>Original</p>' });
    editor.commands.selectAll();
    editor.view.pasteHTML('<p><strong>Paste</strong> <u>formatting</u><img src="https://example.com/graph.png" onerror="alert(1)"></p>', new dom.window.Event('paste'));
    assert.match(editor.getHTML(), /<strong>Paste<\/strong>/);
    assert.match(editor.getHTML(), /<u>formatting<\/u>/);
    assert.doesNotMatch(editor.getHTML(), /onerror/);
    assert.equal(editor.commands.undo(), true);
    assert.equal(editor.getText(), 'Original');
    assert.equal(editor.commands.redo(), true);
    assert.match(editor.getText(), /Paste/);
  } finally {
    editor?.destroy();
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
