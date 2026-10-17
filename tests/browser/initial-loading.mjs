import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { measureInitialLoading } from '../support/measure-initial-loading.ts';
import { fight, started, student } from '../phase4/fixtures.ts';

// Run against `vite preview`, never the dev server: hashed imports, preloads and
// failed module downloads must exercise exactly the production build.
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4174';
const output = 'artifacts/initial-loading';
await mkdir(output, { recursive: true });
const measured = await measureInitialLoading();
const baseline = JSON.parse(await readFile('docs/reviews/c07/before.json', 'utf8'));
assert.ok(measured.workloads.teacherLogin.javascriptGzipBytes <= baseline.workloads.teacherLogin.javascriptGzipBytes * 0.6, 'C07 40% login reduction gate');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const report = { build: measured, loginRequests: {}, requests: {}, checks: [] };
const summary = f => ({ id: f.id, teacherId: f.teacherId, title: f.title, guildCode: f.guildCode,
  encounterTier: f.encounterTier ?? null, questionCount: f.questions.length, enemyCount: f.enemies.length,
  createdAt: 0, updatedAt: 0 });
try {
  for (const [name, path, ready] of [['teacherLogin', '/', 'button-teacher-login'], ['studentLogin', '/student/login', 'button-login']]) {
    const p = await browser.newPage();
    const scripts = new Set();
    p.on('request', r => { if (new URL(r.url()).pathname.endsWith('.js')) scripts.add(new URL(r.url()).pathname.slice(1)); });
    await p.goto(origin + path);
    await p.getByTestId(ready).waitFor();
    await p.waitForLoadState('networkidle');
    assert.deepEqual([...scripts].sort(), measured.workloads[name].javascript.map(f => f.file).sort(), 'network and manifest static closure must agree');
    assert.ok(![...scripts].some(s => /MathEditor|Combat-|CreateFight-|TeacherDashboard-/.test(s)));
    report.loginRequests[name] = [...scripts];
    await p.close();
  }
  report.checks.push('production login request graph and gzip budget');

  const p = await browser.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  let saved = { ...fight, encounterTier: 1, enemies: [{ ...fight.enemies[0], enemyType: 'slime', role: 'normal', wave: 1, quantity: 1 }] };
  let listReads = 0, sessionReads = 0, detailReads = 0, saves = 0, deletes = 0, failList = false, failSessions = false, deleted = false;
  await p.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path === '/api/teacher/login' || path.endsWith('/check-session')) return route.fulfill({ json: { id: fight.teacherId, email: 'fixture@example.invalid', guildCode: 'FIXTURE' } });
    if (path === `/api/teacher/${fight.teacherId}/fights`) {
      assert.equal(url.searchParams.get('view'), 'summary', 'dashboard never downloads the full bank');
      listReads++;
      return route.fulfill({ status: failList ? 503 : 200, json: failList ? { error: 'injected list outage' } : deleted ? [] : [summary(saved)] });
    }
    if (path === '/api/fights/hosted-sessions') {
      sessionReads++;
      return route.fulfill({ status: failSessions ? 503 : 200, json: failSessions ? { error: 'injected status outage' } : [] });
    }
    if (path.includes('equipment-items')) return route.fulfill({ json: [] });
    if (path === `/api/fights/${fight.id}`) {
      if (request.method() === 'PATCH') { saves++; saved = { ...saved, ...request.postDataJSON() }; }
      else if (request.method() === 'DELETE') { deletes++; deleted = true; }
      else detailReads++;
      return route.fulfill({ json: saved });
    }
    throw new Error(`Unexpected fixture route: ${request.method()} ${path}`);
  });
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  await p.route('**/assets/TeacherDashboard-*.js', async route => { await delayed; await route.continue(); });
  await p.clock.install();
  await p.goto(origin);
  await p.getByTestId('input-teacher-email').fill('fixture@example.invalid');
  await p.getByTestId('input-teacher-password').fill('fixture-only');
  await p.getByTestId('button-teacher-login').click();
  await p.getByRole('status').filter({ hasText: 'Loading your battles' }).waitFor();
  release();
  await p.getByTestId(`card-fight-${fight.id}`).waitFor();
  await p.getByRole('button', { name: 'Launch Host', exact: true }).waitFor();
  assert.equal(listReads, 1); assert.equal(detailReads, 0);
  assert.match(await p.getByTestId(`card-fight-${fight.id}`).innerText(), /1 Questions/);
  for (let n = 0; n < 2; n++) {
    const next = p.waitForResponse(r => new URL(r.url()).pathname === '/api/fights/hosted-sessions');
    await p.clock.runFor(5100); await next;
  }
  assert.equal(listReads, 1, 'unchanged definitions do not poll');
  assert.ok(sessionReads >= 3, 'visible live status still polls');
  report.requests.visible10200ms = { definitions: listReads, liveStatus: sessionReads, fullDefinitions: detailReads };
  const beforeHidden = sessionReads;
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.clock.runFor(11000);
  assert.equal(sessionReads, beforeHidden, 'background tabs do not poll');
  const focusRefresh = p.waitForResponse(r => new URL(r.url()).pathname === `/api/teacher/${fight.teacherId}/fights`);
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await focusRefresh;
  assert.equal(listReads, 2, 'returning to the tab refreshes definitions');

  // Authoring is a deferred route; save and return must refresh the summary.
  await p.getByTestId(`button-edit-${fight.id}`).click();
  await p.getByTestId('input-title').fill('C07 edited battle');
  await p.getByTestId('tab-questions').click();
  await p.getByRole('button', { name: 'Edit question 1', exact: true }).click();
  await p.getByTestId('textarea-question').fill('<p>What is 3 + 3?</p>');
  await p.getByTestId('input-correct-answer').fill('6');
  await p.getByTestId('button-save-question').click();
  const offRouteReads = sessionReads;
  await p.clock.runFor(11000);
  assert.equal(sessionReads, offRouteReads, 'live polling stops off dashboard');
  await p.getByTestId('button-create-fight-submit').click();
  await p.getByTestId(`card-fight-${fight.id}`).getByText('C07 edited battle', { exact: true }).waitFor();
  assert.equal(saves, 1); assert.equal(saved.questions[0].correctAnswer, '6');
  assert.ok(listReads >= 3);
  await p.getByTestId(`button-edit-${fight.id}`).click();
  await p.getByTestId('tab-questions').click();
  await p.getByRole('button', { name: 'Edit question 1', exact: true }).click();
  assert.equal(await p.getByTestId('textarea-question').inputValue(), '<p>What is 3 + 3?</p>');
  assert.equal(await p.getByTestId('input-correct-answer').inputValue(), '6');
  failList = true; failSessions = true;
  await p.getByTestId('button-back').click();
  await p.getByRole('button', { name: 'Retry battles', exact: true }).waitFor();
  await p.getByRole('button', { name: 'Retry session check', exact: true }).waitFor();
  assert.equal(await p.getByRole('button', { name: 'Launch Host', exact: true }).isDisabled(), true);
  assert.equal(await p.getByText('No fights yet', { exact: true }).count(), 0, 'errors do not masquerade as empty data');
  failList = false; failSessions = false;
  await p.getByRole('button', { name: 'Retry battles', exact: true }).click();
  await p.getByRole('button', { name: 'Retry session check', exact: true }).click();
  await p.waitForFunction(() => !document.querySelector('[data-testid^="button-host-"]')?.disabled);
  p.once('dialog', d => d.accept());
  await p.getByTestId(`button-delete-${fight.id}`).click();
  await p.getByText('No fights yet', { exact: true }).waitFor();
  assert.equal(deletes, 1);
  assert.deepEqual(errors, []);
  report.checks.push('delayed route, summary-only list, foreground polling, navigation/mutation refresh, list/status failure and retry, persisted teacher editing');
  await p.screenshot({ path: `${output}/dashboard.png` });
  await p.close();

  // Native browsers can cache rejected module imports. Explicit page reload is
  // the reliable escape hatch; no automatic refresh may discard a draft.
  const failed = await browser.newPage();
  let failChunk = true;
  await failed.route('**/assets/TeacherSignup-*.js', route => failChunk ? route.abort('failed') : route.continue());
  await failed.goto(origin + '/teacher/signup');
  await failed.getByRole('alert').filter({ hasText: 'Could not load teacher signup' }).waitFor();
  failChunk = false;
  await failed.getByRole('button', { name: 'Reload page', exact: true }).click();
  await failed.getByTestId('input-firstname').waitFor();
  report.checks.push('failed production route chunk recovers through explicit reload');
  await failed.close();

  for (const failMath of [false, true]) {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const scripts = [];
    p.on('request', r => { if (r.url().endsWith('.js')) scripts.push(r.url()); });
    await p.addInitScript(id => {
      localStorage.setItem('studentId', id); localStorage.setItem('sessionId', 'ABC234');
      window.sockets = []; window.answers = [];
      window.WebSocket = class { static OPEN = 1; readyState = 1;
        constructor() { window.sockets.push(this); setTimeout(() => this.onopen?.(), 0); }
        send(data) { window.answers.push(JSON.parse(data)); } close() { this.readyState = 3; }
      };
    }, student().id);
    await p.route('**/api/**', route => route.fulfill({ json: { completedCombats: 0, xpMultiplier: 1, resetsAt: Date.now() + 3600000, timeZone: 'UTC' } }));
    let releaseMath;
    const delayedMath = new Promise(resolve => { releaseMath = resolve; });
    await p.route('**/assets/MathEditorImpl-*.js', async route => { await delayedMath; await (failMath ? route.abort('failed') : route.continue()); });
    await p.goto(origin + '/student/combat');
    await p.waitForFunction(() => window.sockets.some(s => typeof s.onmessage === 'function'));
    const state = started(); state.questionStartTime = Date.now() - 1000; state.phaseDeadline = Date.now() + 120000;
    await p.evaluate(({ state }) => window.sockets.at(-1).onmessage({ data: JSON.stringify({ type: 'combat_state', state,
      question: { id: 'q1', type: 'short_answer', question: '<p>Write x squared.</p>', timeLimit: 120 }, results: [], serverTime: Date.now() }) }), { state });
    await p.getByLabel('Your answer', { exact: true }).fill('x^2');
    assert.equal(scripts.some(s => s.includes('MathEditorImpl-')), false, 'math dependency stays deferred until chosen');
    await p.getByRole('button', { name: 'Use math answer', exact: true }).click();
    await p.getByRole('status').filter({ hasText: 'Loading the math editor' }).waitFor();
    releaseMath();
    if (failMath) {
      await p.getByRole('alert').filter({ hasText: 'Could not load the math editor' }).waitFor();
      await p.getByRole('button', { name: 'Use text answer', exact: true }).click();
      assert.equal(await p.getByLabel('Your answer', { exact: true }).inputValue(), 'x^2');
    } else {
      const field = p.getByTestId('math-editor'); await field.waitFor();
      assert.equal(await field.evaluate(f => f.value), 'x^2', 'answer survives delayed MathLive load');
      await field.click();
      await p.evaluate(() => window.mathVirtualKeyboard.show());
      await p.locator('[data-math-keyboard-host] .ML__keyboard.is-visible').waitFor();
      await p.locator('[data-math-keyboard-host] .MLK__keycap').filter({ hasText: /^7/, visible: true }).first().click();
      assert.match(await field.evaluate(f => f.value), /7/);
    }
    await p.getByRole('button', { name: 'Submit answer', exact: true }).click();
    const answer = await p.evaluate(() => window.answers.at(-1).answer);
    if (failMath) assert.equal(answer, 'x^2'); else assert.match(answer, /7/);
    await p.screenshot({ path: `${output}/math-${failMath ? 'fallback' : 'loaded'}.png` });
    await p.close();
  }
  report.checks.push('delayed MathLive retains text answer, phone virtual keyboard submits, failed math chunk preserves text-entry fallback');
  await writeFile(`${output}/measurements.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
