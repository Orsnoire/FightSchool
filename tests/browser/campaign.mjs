import { CONSUMABLE_IDS, CONSUMABLES, consumeItem } from '../../shared/campaign/consumables.ts';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { EQUIPMENT_ITEMS, getStartingEquipment } from '../../shared/schema.ts';
import { ownedEquipment } from '../../shared/equipment-catalog.ts';
import { equipmentUnavailable } from '../../shared/equipment-rules.ts';
import { campaignPath } from '../../shared/campaign/movement.ts';
import { generateCampaignLayout } from '../../shared/campaign/generation.ts';
import { healingActions, fieldHeal, normalizeResources, resetCampaignProgress } from '../../shared/campaign/resources.ts';
import { initialCombatState, addStudent } from '../../worker/combat/engine.ts';
import { fight, student } from '../phase4/fixtures.ts';

const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const output = 'artifacts/combat-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const errors = [];
try {
  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => { errors.push(e.message); console.error('Campaign page error:', e.message); });
    const id = '00000000-0000-4000-8000-000000000010', guildId = '00000000-0000-4000-8000-000000000011';
    const gate = { id: '00000000-0000-4000-8000-000000000012', name: 'Cave Key', open: false };
    const layout = generateCampaignLayout('browser-pilot', [gate]);
    let player = addStudent(initialCombatState('preview', fight), student('herbalist')).players[student().id];
    let view = { id, name: 'Hearthlight Expedition', guildId, guildName: 'Explorers', dungeonName: 'Echo Cave', theme: 'normal_cave', gates: [gate], revision: 0,
      layout, progressRevision: 0, unlockedJobs: ['warrior', 'herbalist'], gold: 500, inventory: [], eligibleQuestionCount: 0,
      progress: { version: 1, zone: 'overworld', position: layout.overworld.spawn, job: 'herbalist', health: 1, maxHealth: player.maxHealth, mp: player.mp, maxMp: player.maxMp,
        healingPotions: 5, shieldPotions: 0, consumables: {}, itemProtections: {}, steps: 0, claimedUnlocks: [], explored: [], cleared: false, activeSessionId: null, lastCommandId: null } };
    let loadout = getStartingEquipment('herbalist');
    const equipment = () => ({ loadout, items: ownedEquipment(view.inventory).map(id => EQUIPMENT_ITEMS[id]).filter(i => i && !equipmentUnavailable(view.progress.job, i, 2, EQUIPMENT_ITEMS[loadout.weapon], EQUIPMENT_ITEMS[loadout.offhand])).map(i => ({ ...i, stats: i.stats || {} })) });
    let moveDelay = 0, rejectReset = false;
    const creations = [], commands = [];
    const stock = [{ id: 't1_fighter_sword', name: "Fighter's Sword", price: 150, shop: 'weapons', slot: 'weapon' }, { id: 't1_fighter_armor', name: "Fighter's Cuirass", price: 150, shop: 'armor', slot: 'armor' }];
    stock.push(...CONSUMABLE_IDS.map(id => ({ id, ...CONSUMABLES[id], shop: 'items', slot: 'consumable' })));
    const currentPlayer = () => ({ ...player, health: view.progress.health, consumables: view.progress.consumables, itemProtections: view.progress.itemProtections });
    await page.addInitScript(({ teacherId, studentId }) => { localStorage.setItem('teacherId', teacherId); localStorage.setItem('studentId', studentId); }, { teacherId: fight.teacherId, studentId: student().id });
    await page.route('**/api/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      let result;
      if (path.endsWith('/check-session')) result = { id: fight.teacherId };
      else if (path === '/api/campaigns/options') result = { guilds: [{ id: guildId, name: 'Explorers' }], quizzes: [{ id: fight.id, title: 'Fractions', questionCount: 10 }, { id: 'other', title: 'Geometry', questionCount: 10 }], assignments: [{ guildId, fightId: fight.id }] };
      else if (path === '/api/campaigns' && request.method() === 'POST') { creations.push(request.postDataJSON()); result = { id }; }
      else if (path === '/api/campaigns') result = [view];
      else if (path.endsWith('/gates')) { view.gates = view.gates.map(g => ({ ...g, open: request.postDataJSON().gates.find(v => v.id === g.id).open })); view.revision++; result = { ok: true }; }
      else if (path.endsWith('/shop')) result = stock;
      else if (path.endsWith('/actions')) {
        const input = request.postDataJSON(), a = input.action; commands.push(input);
        assert.equal(input.revision, view.progressRevision);
        if (a.type === 'reset' && rejectReset) { rejectReset = false; await route.fulfill({ status: 409, json: { error: 'Adventure changed. Refresh and try again.' } }); return; }
        if (a.type === 'reset') { view.progress = resetCampaignProgress(view.progress, view.layout); view.eligibleQuestionCount = 0; }
        if (a.type === 'move_path') { if (moveDelay) await new Promise(resolve => setTimeout(resolve, moveDelay)); view.progress = campaignPath(view, view.progress, a.steps).progress; }
        if (a.type === 'equip') loadout = { ...loadout, [a.slot]: a.itemId };
        if (a.type === 'move') view.progress.position = { x: view.progress.position.x + a.dx, y: view.progress.position.y + a.dy };
        if (a.type === 'quest') { view.progress.claimedUnlocks = [a.gateId]; view.eligibleQuestionCount = 10; }
        if (a.type === 'heal') view.progress = fieldHeal(view.progress, player, a.ability);
        if (a.type === 'job') { loadout = getStartingEquipment(a.job); player = addStudent(initialCombatState('preview', fight), student(a.job)).players[student().id]; view.progress = normalizeResources({ ...view.progress, job: a.job }, player); }
        if (a.type === 'rest') view.progress = { ...view.progress, health: player.maxHealth, mp: player.maxMp, healingPotions: 5 };
        if (a.type === 'buy_item') { const item = CONSUMABLES[a.itemId]; view.gold -= item.price; view.progress.consumables[a.itemId] = (view.progress.consumables[a.itemId] || 0) + 1; }
        if (a.type === 'use_item') { const p = currentPlayer(); consumeItem(p, a.itemId); Object.assign(view.progress, { health: p.health, consumables: p.consumables, itemProtections: p.itemProtections }); }
        if (a.type === 'buy') { const item = stock.find(i => i.id === a.itemId); view.gold -= item.price; view.inventory.push(item.id); }
        if (a.type === 'encounter') view.progress.activeSessionId = 'CPBROWSERTEST';
        view.progressRevision++;
        result = { ...view, player: currentPlayer(), equipment: equipment(), healingActions: healingActions(player) };
      } else if (path === `/api/campaigns/${id}`) result = { ...view, player: currentPlayer(), equipment: equipment(), healingActions: healingActions(player) };
      else result = [];
      await route.fulfill({ json: result });
    });
    await page.goto(`${origin}/teacher/campaigns`);
    await page.getByLabel('Campaign guild', { exact: true }).selectOption(guildId);
    assert.equal(await page.getByRole('button', { name: 'Reset campaign', exact: true }).count(), 0, 'personal reset is student-only');
    await page.getByLabel('Filter quizzes by guild').selectOption(guildId);
    await page.getByLabel('Search quiz names').fill('fract');
    assert.equal(await page.getByLabel('Dungeon quiz', { exact: true }).locator('option').count(), 2);
    await page.getByLabel('Dungeon quiz', { exact: true }).selectOption(fight.id);
    await page.getByRole('button', { name: 'Generate campaign' }).click();
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(b => b.textContent === 'Saving…'));
    assert.equal(creations.length, 1); assert.equal(creations[0].fightId, fight.id); assert.equal(creations[0].gates[0].name, 'Cave Key');
    await page.getByRole('button', { name: 'Open gate', exact: true }).click();
    await page.getByRole('button', { name: 'Close gate', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${output}/${viewport.width}-campaign-teacher.png`, fullPage: true });
    await page.goto(`${origin}/student/campaign/${id}`);
    await page.getByRole('heading', { name: 'Adventure menu' }).waitFor();
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/actions')), page.getByRole('button', { name: /Healing Potion/ }).click()]);
    assert.equal(view.progress.healingPotions, 4); assert.ok(view.progress.health > 1);
    const healedHP = view.progress.health;
    await page.reload(); await page.getByRole('heading', { name: 'Adventure menu' }).waitFor();
    assert.equal(view.progress.health, healedHP);
    const step = async direction => { const previous = view.progressRevision; await Promise.all([page.waitForResponse(r => r.url().endsWith('/actions')), page.getByRole('button', { name: `Move ${direction}`, exact: true }).click()]); await page.getByRole('status').filter({ hasText: 'Progress saved' }).waitFor(); assert.equal(view.progressRevision, previous + 1); };
    // Hold the first response: movement must paint before acknowledgement and queue the next input.
    moveDelay = 700;
    const before = { ...view.progress.position };
    await page.getByRole('button', { name: 'Move east', exact: true }).click();
    await page.getByRole('button', { name: `You, ${before.x + 1}, ${before.y}`, exact: true }).waitFor({ timeout: 500 });
    assert.deepEqual(view.progress.position, before, 'marker moves before delayed server response');
    await page.getByRole('button', { name: 'Move west', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Progress saved' }).waitFor();
    assert.deepEqual(view.progress.position, before); moveDelay = 0;
    await step('south'); await step('west');
    await page.getByRole('button', { name: 'Collect key', exact: true }).click();
    await page.getByRole('button', { name: 'Key collected', exact: true }).waitFor();
    await step('north'); await step('north');
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/actions')), page.getByLabel('Campaign job', { exact: true }).selectOption('warrior')]);
    await page.getByRole('button', { name: 'Rest at the inn' }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('select').disabled);
    assert.equal(view.progress.health, healedHP, 'job switch must not refill HP');
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/actions')), page.getByRole('button', { name: 'Rest at the inn' }).click()]);
    await page.waitForFunction(() => !document.querySelector('select').disabled);
    assert.equal(view.progress.health, view.progress.maxHealth);
    await page.screenshot({ path: `${output}/${viewport.width}-campaign-town.png`, fullPage: true });
    await step('east'); await step('east'); await step('east');
    await page.getByRole('button', { name: 'Buy', exact: true }).click();
    await page.getByRole('button', { name: 'Owned', exact: true }).waitFor();
    await step('south'); await step('south');
    await page.getByRole('button', { name: 'Buy', exact: true }).click();
    await page.getByRole('button', { name: 'Owned', exact: true }).waitFor();
    assert.equal(view.gold, 200); assert.equal(view.inventory.length, 2);
    await page.getByRole('button', { name: 'Equipment', exact: true }).click();
    const armor = page.getByLabel('Adventure Chest', { exact: true });
    assert.ok((await armor.locator('option').allTextContents()).some(text => text.includes("Fighter's Cuirass")));
    assert.equal((await page.getByLabel('Adventure Weapon', { exact: true }).locator('option').allTextContents()).some(text => text.includes('Staff')), false);
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/actions')), armor.selectOption('t1_fighter_armor')]);
    await page.getByRole('status').filter({ hasText: 'Progress saved' }).waitFor();
    assert.equal(loadout.armor, 't1_fighter_armor');
    await page.screenshot({ path: `${output}/${viewport.width}-campaign-equipment.png`, fullPage: true });

    await step('north');
    await page.getByRole('heading', { name: 'Hearthlight Item Shop' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /^Buy / }).count(), 8);
    for (let i = 0; i < 2; i++) {
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/actions')), page.getByRole('button', { name: 'Buy Potion', exact: true }).click()]);
      await page.getByRole('status').filter({ hasText: 'Progress saved' }).waitFor();
    }
    assert.equal(view.progress.consumables.potion, 2); assert.equal(view.gold, 180);
    view.progress.health = 1;
    await page.reload(); await page.getByTestId('consumable-bag').locator('summary').click();
    await page.getByText('Potion ×2', { exact: true }).waitFor();
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/actions')), page.getByRole('button', { name: 'Use Potion', exact: true }).click()]);
    await page.getByText('Potion ×1', { exact: true }).waitFor();
    assert.equal(view.progress.health, 6); assert.equal(view.progress.consumables.potion, 1);
    await page.screenshot({ path: `${output}/${viewport.width}-campaign-items.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    view.progress = { ...view.progress, zone: 'dungeon', position: layout.objective };
    await page.reload(); await page.getByRole('button', { name: 'Challenge guardian' }).waitFor();
    await page.screenshot({ path: `${output}/${viewport.width}-campaign-cave.png`, fullPage: true });
    await page.getByRole('button', { name: 'Challenge guardian' }).click();
    await page.waitForURL('**/student/combat');
    assert.equal(await page.evaluate(() => localStorage.getItem('sessionId')), 'CPBROWSERTEST');
    await page.goto(`${origin}/student/campaign/${id}`);
    await page.getByRole('button', { name: 'Resume encounter' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Move north' }).isDisabled(), true);
    await page.goto(`${origin}/student/campaigns`);
    const resetTrigger = page.getByRole('button', { name: 'Reset campaign', exact: true });
    await resetTrigger.click();
    let dialog = page.getByRole('alertdialog');
    await dialog.getByText('Finish or leave your active encounter before resetting.', { exact: false }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Reset campaign', exact: true }).isDisabled(), true);
    assert.equal(commands.filter(c => c.action.type === 'reset').length, 0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    view.progress = { ...view.progress, activeSessionId: null, cleared: true, health: 1, healingPotions: 1, itemProtections: { trip: 2 } };
    const preservedBag = structuredClone(view.progress.consumables), preservedGold = view.gold;
    await resetTrigger.click();
    await dialog.getByText(/You keep your current job, levels, XP, gold/).waitFor();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(view.progress.cleared, true); assert.equal(commands.filter(c => c.action.type === 'reset').length, 0);
    assert.equal(await resetTrigger.evaluate(e => e === document.activeElement), true, 'cancel restores keyboard focus');
    await resetTrigger.click();
    await page.waitForFunction(() => { const button = document.querySelector('[role="alertdialog"] button:last-child'); return button && !button.disabled; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${output}/${viewport.width}-campaign-reset.png`, fullPage: true });
    rejectReset = true;
    await dialog.getByRole('button', { name: 'Reset campaign', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Adventure changed' }).waitFor();
    assert.equal(view.progress.cleared, true, 'failure does not pretend a reset succeeded');
    await dialog.getByRole('button', { name: 'Reset campaign', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Campaign reset. Enter the adventure to start again.' }).waitFor();
    const resetCommands = commands.filter(c => c.action.type === 'reset');
    assert.equal(resetCommands.length, 2); assert.equal(resetCommands[0].commandId, resetCommands[1].commandId, 'retry retains its command identity');
    assert.equal(view.progress.cleared, false); assert.equal(view.progress.health, view.progress.maxHealth);
    assert.equal(view.gold, preservedGold); assert.deepEqual(view.progress.consumables, preservedBag);
    await page.getByRole('button', { name: 'Enter adventure' }).click();
    await page.getByRole('heading', { name: 'Adventure menu' }).waitFor();
    await page.getByText('Ready — visit its keeper (!)', { exact: false }).waitFor();
    assert.deepEqual(view.progress.position, layout.overworld.spawn); assert.deepEqual(view.progress.claimedUnlocks, []);
    assert.ok(commands.every(c => c.commandId && !('health' in c.action)));
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('Campaign teacher setup, gates, exploration menu, inn, both shops, saved resources and encounter resume passed at desktop/phone sizes.');
} finally { await browser.close(); }
