import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

test('deferred loading keeps current controlled values across pending, failure, retry and unmount', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const keys = ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'];
  const saved = keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const);
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true,
    value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] });
  const { act, createElement: h } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  const dir = await mkdtemp(join(process.cwd(), '.deferred-test-'));
  const consoleError = console.error;
  try {
    const outfile = join(dir, 'ui.mjs');
    await build({ stdin: { contents: 'export {deferred} from "./client/src/components/Deferred";', resolveDir: process.cwd(), loader: 'tsx' },
      outfile, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external' });
    const { deferred } = await import(pathToFileURL(outfile).href);
    let resolve!: (value: any) => void, reject!: (error: Error) => void, loads = 0;
    const Editor = deferred(() => { loads++; return new Promise((yes, no) => { resolve = yes; reject = no; }); }, 'the math editor');
    const changes: string[] = [];
    const render = async (value: string) => act(async () => root.render(h('div', null,
      h('span', null, `Draft: ${value}`), h(Editor, { value, onChange: (v: string) => changes.push(v) }))));
    await render('first');
    assert.match(document.querySelector('[role=status]')!.textContent!, /Loading the math editor/);
    await render('updated while loading');
    assert.equal(loads, 1);
    // React reports an intentionally rejected load even when the boundary handles it.
    console.error = () => {};
    await act(async () => reject(new Error('injected download failure')));
    console.error = consoleError;
    assert.match(document.querySelector('[role=alert]')!.textContent!, /Could not load/);
    assert.match(document.body.textContent!, /Draft: updated while loading/);
    assert.equal(document.body.textContent!.includes('Reload page'), false, 'editor retry never discards its parent draft');
    await act(async () => (document.querySelector('button') as HTMLButtonElement).click());
    assert.equal(loads, 2);
    await render('newest value');
    const implementation = { default: ({ value, onChange }: any) => h('button', { onClick: () => onChange(value + '+1') }, value) };
    await act(async () => resolve(implementation));
    const button = document.querySelector('button') as HTMLButtonElement;
    assert.equal(button.textContent, 'newest value');
    await act(async () => button.click());
    assert.deepEqual(changes, ['newest value+1']);
    await act(async () => root.render(null));
    await render('unmounted');
    assert.equal(loads, 3);
    await act(async () => root.render(null));
    await act(async () => resolve(implementation));
    assert.equal(document.getElementById('root')!.childElementCount, 0, 'late download cannot resurrect an abandoned route/editor');
  } finally {
    console.error = consoleError;
    await act(async () => root.unmount());
    await rm(dir, { recursive: true, force: true });
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key];
    }
  }
});
