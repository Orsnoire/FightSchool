import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { started, student, fight } from '../phase4/fixtures.ts';
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const output = 'artifacts/combat-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const enemyImage = 'data:image/png;base64,' + (await readFile('attached_assets/generated_images/Goblin_swarm_RPG_enemy_68c45c1e.png')).toString('base64');
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.hostTest = { sockets: [], sent: [] };
      window.WebSocket = class {
        static OPEN = 1;
        readyState = 1;
        constructor() { window.hostTest.sockets.push(this); setTimeout(() => this.onopen?.(), 0); }
        send(data) { window.hostTest.sent.push(JSON.parse(data)); }
        close() { this.readyState = 3; }
      };
    });
    await page.route('**/api/teacher/check-session', route => route.fulfill({ json: { id: fight.teacherId, email: 'fixture@example.test', guildCode: 'FIXTURE' } }));
    await page.route(`**/api/fights/${fight.id}`, route => route.fulfill({ json: { ...fight, title: 'Unit 2 No-Calculator' } }));
    await page.route(`**/api/fights/${fight.id}/sessions`, route => route.fulfill({ json: { sessionId: 'ABC234' } }));
    await page.route('**/api/combat/ABC234/force-question', route => route.fulfill({ json: { success: true } }));
    await page.goto(origin + '/teacher/host/' + fight.id);
    await page.waitForFunction(() => window.hostTest.sockets.length > 0);
    const state = started();
    state.enemies[0].image = enemyImage;
    state.enemies[0].name = 'Goblins';
    state.phaseDeadline = null;
    state.currentPhase = 'waiting';
    for (let i = 1; i < 24; i++) state.players['student-' + i] = { ...structuredClone(state.players[student().id]), studentId: 'student-' + i, nickname: 'Player ' + i };
    state.players['student-1'].isDead = true;
    state.players['student-1'].health = 0;
    const question = { id: 'q1', type: 'multiple_choice', question: '<p>Which expression is equivalent to <span class="math-inline" data-latex="\\frac{x^2-9}{x-3}"></span>, for x ≠ 3?</p>', options: ['x+3', 'x−3'], timeLimit: 60 };
    async function emit() {
      state.revision++;
      await page.evaluate(({ state, question }) => window.hostTest.sockets.at(-1).onmessage({ data: JSON.stringify({ type: 'combat_state', state, question: state.currentPhase === 'waiting' ? null : question, serverTime: Date.now() }) }), { state, question });
    }
    const panel = page.getByTestId('host-controls');
    await emit();
    await panel.getByRole('button', { name: 'Start fight', exact: true }).click();
    assert.equal(await page.evaluate(() => window.hostTest.sent.at(-1).type), 'start_fight');
    assert.match(await page.getByTestId('host-status').innerText(), /24 players joined/);
    assert.match(await panel.innerText(), /ABC234/);
    await page.screenshot({ path: `${output}/${viewport.width}-host-waiting.png` });
    state.currentPhase = 'question';
    state.phaseDeadline = Date.now() + 45000;
    state.players[student().id].hasAnswered = true;
    state.events = Array.from({ length: 45 }, (_, i) => ({ id: `1:${i}`, round: 1, phase: 'question_resolution', type: 'damage', actorId: student().id, targetId: 'e1', amount: 3, message: `Player ${i % 24} dealt 3 damage to Goblins (${i + 1}).` }));
    await emit();
    await panel.getByRole('button', { name: 'Advance current phase' }).waitFor();
    assert.match(await page.getByTestId('host-status').innerText(), /1\/23 answered/);
    await page.getByTestId('host-question').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    const log = page.getByTestId('combat-log');
    const feed = page.getByRole('region', { name: 'Combat log entries' });
    await feed.getByText(/Player 20 dealt/).first().waitFor();
    assert.ok(await feed.evaluate(el => el.scrollHeight > el.clientHeight), 'log scrolls internally');
    if (viewport.width > 1000) {
      const enemy = await page.getByRole('heading', { name: 'Goblins', exact: true }).boundingBox();
      const logRect = await log.boundingBox();
      assert.ok(logRect.x > enemy.x && Math.abs(logRect.y - (await page.getByAltText('Goblins').boundingBox()).y) < 80, 'log fills row beside enemies');
    }
    await page.screenshot({ path: `${output}/${viewport.width}-host-question.png` });
    await feed.evaluate(el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
    await page.getByRole('button', { name: 'Jump to latest' }).waitFor();
    state.events.push({ ...state.events[0], id: '1:45', message: 'New damage event' });
    await emit();
    assert.equal(await feed.evaluate(el => el.scrollTop), 0, 'new events preserve reading position');
    await page.getByRole('button', { name: 'Jump to latest' }).click();
    await page.waitForFunction(() => { const el = document.querySelector('[aria-label="Combat log entries"]'); return el.scrollHeight - el.scrollTop - el.clientHeight < 24; });
    await page.evaluate(() => window.scrollTo(0, 900));
    assert.ok((await panel.boundingBox()).y >= -1, 'controls remain sticky');
    await page.screenshot({ path: `${output}/${viewport.width}-host-scrolled.png` });
    delete state.players['student-2'];
    await emit();
    assert.match(await page.getByTestId('host-status').innerText(), /23 players joined/);
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}: host panel, player count, question, sticky controls and scrolling log`);
    await page.close();
  }
} finally { await browser.close(); }
