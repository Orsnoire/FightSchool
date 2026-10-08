import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { started, student, fight } from '../phase4/fixtures.ts';
import { initialAppearance } from '../../shared/avatar/appearance.ts';
import { ENEMY_CATALOG } from '../../shared/combat/enemy-catalog.ts';
import { verifyEnemyAuthoring } from './enemy-ai.mjs';
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const output = 'artifacts/combat-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const enemyImage = 'data:image/png;base64,' + (await readFile('client/public/enemies/goblin-v1.png')).toString('base64');
try {
  await verifyEnemyAuthoring(browser, origin);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 3840, height: 2160 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.hostTest = { sockets: [], sent: [] };
      window.WebSocket = class {
        static OPEN = 1;
        readyState = 1;
        constructor(url) { this.url = url; window.hostTest.sockets.push(this); setTimeout(() => this.onopen?.(), 0); }
        send(data) { window.hostTest.sent.push(JSON.parse(data)); }
        close() { this.readyState = 3; }
      };
    });
    await page.route('**/api/teacher/check-session', route => route.fulfill({ json: { id: fight.teacherId, email: 'fixture@example.test', guildCode: 'FIXTURE' } }));
    await page.route(`**/api/fights/${fight.id}`, route => route.fulfill({ json: { ...fight, title: 'Unit 2 No-Calculator' } }));
    await page.route(`**/api/fights/${fight.id}/host-guilds`, route => route.fulfill({json:[]}));
    await page.route(`**/api/fights/${fight.id}/sessions`, route => route.fulfill({ json: { sessionId: 'ABC234' } }));
    await page.route('**/api/combat/ABC234/force-question', route => route.fulfill({ json: { success: true } }));
    await page.goto(origin + '/teacher/host/' + fight.id);
    await page.waitForFunction(() => window.hostTest.sockets.some(s => s.url.includes("sessionId=ABC234") && typeof s.onmessage === "function"));
    const state = started();
    state.enemies[0].image = enemyImage;
    state.enemies[0].name = 'Goblins';
    state.phaseDeadline = null;
    state.currentPhase = 'waiting';
    for (let i = 1; i < 30; i++) state.players['student-' + i] = { ...structuredClone(state.players[student().id]), studentId: 'student-' + i, nickname: 'Player ' + i, characterClass: ['warrior','wizard','scout','herbalist'][i % 4], gender: i % 2 ? 'B' : 'A', appearance: initialAppearance(null, i % 2 ? 'human-female-v1' : 'human-male-v1', () => (i % 8) / 8) };
    state.damageLeaderId = student().id;
    state.players[student().id].totals.damageDealt = 12;
    state.players['student-3'].health = 3;
    state.players['student-1'].isDead = true;
    state.players['student-1'].health = 0;
    const question = { id: 'q1', type: 'multiple_choice', question: '<p>Which expression is equivalent to <span class="math-inline" data-latex="\\frac{x^2-9}{x-3}"></span>, for x ≠ 3?</p>', options: ['x+3', 'x−3'], timeLimit: 60 };
    async function emit() {
      state.revision++;
      await page.evaluate(({ state, question }) => window.hostTest.sockets.filter(s => s.url.includes("sessionId=ABC234")).at(-1).onmessage({ data: JSON.stringify({ type: 'combat_state', state, question: state.currentPhase === 'waiting' ? null : question, serverTime: Date.now() }) }), { state, question });
    }
    const panel = page.getByTestId('host-controls');
    await emit();
    await panel.getByRole('button', { name: 'Start fight', exact: true }).click();
    assert.equal(await page.evaluate(() => window.hostTest.sent.at(-1).type), 'start_fight');
    assert.match(await page.getByTestId('host-status').innerText(), /30 players joined/);
    assert.match(await panel.innerText(), /ABC234/);
    assert.equal(await page.getByLabel('Damage leader', {exact:true}).count(), 1);
    await page.screenshot({ path: `${output}/${viewport.width}-host-waiting.png` });
    state.currentPhase = 'question';
    state.phaseDeadline = Date.now() + 45000;
    state.players[student().id].hasAnswered = true;
    state.events = Array.from({ length: 45 }, (_, i) => ({ id: `1:${i}`, round: 1, phase: 'question_resolution', type: 'damage', actorId: student().id, targetId: 'e1', amount: 3, message: `Player ${i % 24} dealt 3 damage to Goblins (${i + 1}).` }));
    await emit();
    await panel.getByRole('button', { name: 'Advance current phase' }).waitFor();
    assert.match(await page.getByTestId('host-status').innerText(), /1\/29 answered/);
    await page.getByTestId('host-question').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    await page.getByRole('button', { name: 'Combat log ↗' }).click();
    const log = page.getByTestId('combat-log');
    const feed = page.getByRole('region', { name: 'Combat log entries' });
    await feed.getByText(/Player 20 dealt/).first().waitFor();
    assert.ok(await feed.evaluate(el => el.scrollHeight > el.clientHeight), 'log scrolls internally');
    const enemy = await page.getByAltText('Goblins').boundingBox();
    const player = await page.locator('[data-player-id]').first().boundingBox();
    assert.ok(player.x + player.width < enemy.x, 'party left, enemy right');
    await page.getByRole('button', { name: 'Minimize combat log' }).click();
    await page.getByRole('button', { name: 'Combat log ↗' }).click();
    const handle = page.getByLabel('Move combat log with arrow keys');
    const before = await page.getByTestId('floating-log').boundingBox();
    await handle.focus(); await page.keyboard.press('ArrowLeft');
    assert.ok((await page.getByTestId('floating-log').boundingBox()).x < before.x, 'log can move with keyboard');
    await page.getByRole('button', { name: 'Hide question' }).click();
    assert.equal(await page.getByTestId('host-question').count(), 0);
    await page.getByRole('button', { name: 'Show question' }).click();
    await page.getByRole('button', { name: 'Minimize combat log' }).click();
    // Removal requires confirmation and does not trigger resurrection.
    page.once('dialog', dialog => dialog.dismiss());
    const remove = page.getByRole('button', { name: 'Remove Player 1 from fight', exact: true });
    await remove.focus(); await remove.click();
    assert.equal(await page.evaluate(() => window.hostTest.sent.some(m => m.type === 'remove_player')), false);
    page.once('dialog', dialog => dialog.accept()); await remove.click();
    assert.equal(await page.evaluate(() => window.hostTest.sent.at(-1).type), 'remove_player');
    assert.equal(await page.evaluate(() => window.hostTest.sent.at(-1).targetId), 'student-1');
    await page.getByRole('button', { name: 'Fullscreen combat' }).click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    await page.getByRole('button', { name: 'Exit fullscreen' }).click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.getByRole('button', { name: 'Combat log ↗' }).click();
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
    assert.match(await page.getByTestId('host-status').innerText(), /29 players joined/);
    const completeRoster = structuredClone(state.players);
    await page.getByRole('button', { name: 'Minimize combat log' }).click();
    for (const count of [1, 2, 4, 5, 10, 20, 30]) {
      state.players = Object.fromEntries(Object.entries(completeRoster).slice(0, count));
      if (count === 30) state.players['student-2'] = { ...structuredClone(state.players[student().id]), studentId: 'student-2', nickname: 'Player 2' };
      await emit();
      assert.equal(await page.locator('[data-player-id]').count(), count);
      await page.waitForTimeout(650);
      if ([1, 4, 30].includes(count)) await page.screenshot({ path: `${output}/${viewport.width}-formation-${count}.png` });
    }
    state.encounterRules = 2;
    state.activeWave = 1;
    state.enemyDisplayMode = 'simultaneous';
    state.enemies = Object.entries(ENEMY_CATALOG).map(([type,definition])=>({...structuredClone(state.enemies[0]),id:`portrait-${type}`,name:definition.name,image:definition.image,enemyType:type,species:type==='goblin'?'goblin':'other',wave:1}));
    state.players[student().id].statuses=[{type:'paralysis',sourceId:'portrait-zombie',appliedRound:0}];
    state.players[student().id].recoveryCorrectAnswers=1;
    state.players['student-3'].statuses=[{type:'hypnosis',sourceId:'portrait-ghost',appliedRound:0,correctAnswers:2}];
    await emit();
    await page.waitForFunction(()=>document.querySelectorAll('.battle-enemy-field img').length===7);
    await page.locator('.battle-enemy-field img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
    await page.getByText('Recovery 1/2',{exact:true}).waitFor();
    await page.getByText('Hypnotized 2/3',{exact:true}).waitFor();
    await page.getByText('Maintaining hypnosis · cannot act',{exact:true}).waitFor();
    await page.screenshot({path:`${output}/${viewport.width}-seven-enemies-recovery.png`});
    state.enemyDisplayMode = 'consecutive';
    const templateEnemy = structuredClone(state.enemies[0]);
    for (const count of [1, 10, 30, 60]) {
      state.enemies = Array.from({length:count}, (_,i) => ({...templateEnemy,id:`g${i}`,name:`Goblin ${i+1}`,species:'goblin',role:'trash',wave:1,health:.5,maxHealth:1}));
      await emit();
      await page.waitForFunction(n => document.querySelectorAll('.battle-enemy-field .battle-enemy').length === n, count);
      await page.locator('.battle-enemy-field img').first().evaluate(img => img.decode());
      const contained = await page.locator('.battle-enemy-field').evaluate(field => {
        const box = field.getBoundingClientRect();
        return [...field.querySelectorAll('.battle-enemy')].every(el => {const r=el.getBoundingClientRect();return r.left>=box.left-1 && r.right<=box.right+1 && r.top>=box.top-1 && r.bottom<=box.bottom+1;});
      });
      assert.ok(contained, `${count} goblins fit their fixed field`);
      await page.screenshot({path:`${output}/${viewport.width}-goblin-swarm-${count}.png`});
    }
    state.currentPhase = 'wave_break'; state.phaseDeadline = null;
    await emit();
    await panel.getByRole('button', {name:'Start next wave',exact:true}).waitFor();
    state.revision++;
    await page.evaluate(({ state, question }) => window.hostTest.sockets.filter(s => s.url.includes('sessionId=ABC234')).at(-1).onmessage({ data: JSON.stringify({ type:'combat_state', state, question, rejoinRequests:[{studentId:'removed',nickname:'Alex'}] }) }), {state,question});
    await page.getByRole('dialog').waitFor();
    await page.getByLabel('Block future rejoin requests for this fight').check();
    await page.getByRole('button', {name:'Block requests',exact:true}).click();
    assert.equal(await page.evaluate(() => window.hostTest.sent.at(-1).decision), 'block');
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}: host panel, player count, question, sticky controls and scrolling log`);
    await page.close();
  }
} finally { await browser.close(); }
