import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { started, student } from '../phase4/fixtures.ts';

const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const output = 'artifacts/combat-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const id = student().id;
const enemyImage = 'data:image/png;base64,' + (await readFile('attached_assets/generated_images/Goblin_swarm_RPG_enemy_68c45c1e.png')).toString('base64');
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(({ id }) => {
      localStorage.setItem('studentId', id);
      localStorage.setItem('sessionId', 'ABC234');
      window.combatTest = { sockets: [], sent: [] };
      window.WebSocket = class {
        static OPEN = 1;
        readyState = 1;
        constructor() {
          window.combatTest.sockets.push(this);
          setTimeout(() => this.onopen?.(), 0);
        }
        send(data) { window.combatTest.sent.push(JSON.parse(data)); }
        close() { this.readyState = 3; }
      };
    }, { id });
    await page.route('**/api/student/*/stamina', route => route.fulfill({ json: {
      completedCombats: 2, xpMultiplier: 0.691, resetsAt: Date.now() + 3600000, timeZone: 'America/Denver'
    } }));
    await page.goto(origin + '/student/combat');
    await page.waitForFunction(() => window.combatTest?.sockets.length > 0);
    let state = started('herbalist');
    state.enemies[0].image = enemyImage;
    state.enemies[0].name = 'Goblins';
    state.questionStartTime = Date.now() - 1000;
    state.phaseDeadline = Date.now() + 120000;
    let question = { id: 'q1', type: 'multiple_choice', question: '<p>Which is the expansion of <span class="math-inline" data-latex="(x+2)^2"></span>?</p>', options: ['x² + 4x + 4', 'x² + 4'], timeLimit: 120 };
    async function emit() {
      state.revision++;
      await page.evaluate(({ state, question }) => {
        const socket = window.combatTest.sockets.at(-1);
        socket.onmessage({ data: JSON.stringify({ type: 'combat_state', state, question, results: [], serverTime: Date.now() }) });
      }, { state, question });
    }
    async function screenshot(name) {
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      const rect = await dialog.boundingBox();
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1, `${name}: dialog must fit viewport`);
      assert.ok(Math.abs(rect.x + rect.width / 2 - viewport.width / 2) < 2 && Math.abs(rect.y + rect.height / 2 - viewport.height / 2) < 2, `${name}: dialog must be centered`);
      assert.equal(await page.getByRole('dialog').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: no horizontal page overflow`);
      await page.screenshot({ path: `${output}/${viewport.width}-${name}.png` });
    }
    await emit();
    await page.locator('[data-testid="rich-content"] .katex').waitFor();
    await screenshot('question');
    await page.getByRole('button', { name: 'x² + 4x + 4', exact: true }).click();
    await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
    assert.equal(await page.evaluate(() => window.combatTest.sent.at(-1).answer), 'x² + 4x + 4');
    state.players[id].hasAnswered = true;
    state.currentPhase = "actions";
    state.phaseDeadline = Date.now() + 20000;
    await emit();
    await page.getByRole('heading', { name: 'Choose your combat action', exact: true }).waitFor();
    await screenshot('choices');
    await page.getByRole('button', { name: 'Confirm Attack & Ready', exact: true }).click();
    assert.equal(await page.evaluate(() => window.combatTest.sent.at(-1).ready), true);
    state.players[id].ready = true;
    await emit();
    await page.getByRole('heading', { name: 'Ready — waiting for your party', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await screenshot('waiting');
    state.currentPhase = 'abilities';
    state.players[id].ready = false;
    await emit();
    await page.getByRole('button', { name: 'Ready — no support actions', exact: true }).waitFor();
    await screenshot('support');
    state.currentPhase = 'actions';
    state.players[id].healingPotions = 0;
    await emit();
    await page.getByRole('button', { name: /^Create potion/ }).click();
    await screenshot('create-potion');
    await page.getByRole('button', { name: 'Confirm Create potion & Ready', exact: true }).click();
    assert.equal(await page.evaluate(() => window.combatTest.sent.at(-1).ability), 'craft_healing_potion');
    state.players[id].availableAbilities = ['attack', 'warrior_block'];
    for (let i = 0; i < 19; i++) state.players[`ally${i}`] = { ...structuredClone(state.players[id]), studentId: `ally${i}`, nickname: `Ally ${i}`, health: i % 3 ? 7 : 2, maxHealth: 10, threat: i * 2 };
    state.currentPhase = 'abilities';
    await emit();
    const targets = page.getByRole('button', { name: /, HP .*%, threat / });
    await targets.first().waitFor();
    assert.equal(await targets.count(), 20);
    await screenshot('block-grid');
    await targets.first().click();
    assert.equal(await page.evaluate(() => window.combatTest.sent.at(-1).targetId), 'ally18');
    for (let i = 0; i < 19; i++) delete state.players[`ally${i}`];
    state.players[id].availableAbilities = ['attack', 'healing_potion', 'craft_healing_potion'];

    state.currentPhase = 'question_resolution';
    state.players[id].lastAnswerCorrect = true;
    state.players[id].healingPotions = 4;
    state.events = [{ id: '1:0', round: 1, phase: 'question_resolution', type: 'heal', actorId: id, targetId: id, amount: 2, message: 'Herbalist healed for 2 HP' }];
    await emit();
    await page.getByText('Healing potions 4/5', { exact: true }).waitFor();
    await screenshot('resolution');
    state.currentPhase = 'enemy_ai';
    state.events.push({ id: '1:1', round: 1, phase: 'enemy_ai', type: 'enemy_attack', actorId: 'e1', targetId: id, amount: 3, message: 'Damage' });
    await emit();
    await page.getByText('Goblins counterattacks herbalist for 3 damage!', { exact: true }).waitFor();
    assert.equal(await page.getByText('Herbalist healed for 2 HP', { exact: true }).count(), 0);
    await screenshot('counterattack');
    state.round++;
    state.currentPhase = 'question';
    state.players[id].hasAnswered = false;
    question = { ...question, type: 'short_answer', question: '<p>Write an expression equal to x squared.</p>' };
    await emit();
    await page.getByRole('button', { name: 'Use math answer', exact: true }).click();
    const mathfield = page.getByTestId('math-editor');
    await mathfield.waitFor();
    await mathfield.click();
    await page.keyboard.type('x^2');
    // Exercise the real MathLive keyboard, not a stub. Programmatic opening is
    // necessary because desktop focus does not automatically show this panel.
    await page.evaluate(() => window.mathVirtualKeyboard.show());
    await page.locator('[data-math-keyboard-host] .ML__keyboard.is-visible').waitFor();
    await screenshot('math-keyboard');
    // MathLive appends a hidden shifted label to each numeric key's text.
    const key = page.locator('[data-math-keyboard-host] .MLK__keycap').filter({ hasText: /^7/, visible: true }).first();
    await key.click();
    assert.match(await mathfield.evaluate((field) => field.value), /7/);
    await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
    assert.match(await page.evaluate(() => window.combatTest.sent.at(-1).answer), /7/);
    state.players[id].hasAnswered = true;
    state.currentPhase = "actions";
    state.phaseDeadline = Date.now() + 20000;
    await emit();
    await page.getByRole('heading', { name: 'Choose your combat action', exact: true }).waitFor();
    assert.equal(await page.locator('[data-math-keyboard-host] .ML__keyboard.is-visible').count(), 0);
    assert.equal(await page.evaluate(() => window.mathVirtualKeyboard.container === document.body), true);
    // A long rich question must scroll internally while the header stays visible.
    state.round++;
    state.currentPhase = 'question';
    state.phaseDeadline = Date.now() + 120000;
    state.players[id].hasAnswered = false;
    question = { ...question, type: 'multiple_choice', question: '<p>Long question</p>' + '<p>Read this supporting information.</p>'.repeat(40) };
    await emit();
    await page.getByText('Long question', { exact: true }).waitFor();
    await screenshot('long-question');
    assert.ok(await page.getByTestId('combat-overlay-body').evaluate((e) => e.scrollHeight > e.clientHeight));
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}x${viewport.height}: centered overlays, actions, resources, rich content, MathLive key clicks and scrolling`);
    await page.close();
  }
} finally { await browser.close(); }
