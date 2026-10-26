import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fight, fightSummary, student } from '../phase4/fixtures.ts';
import { STARTER_EQUIPMENT, STARTER_LOADOUTS } from '../../shared/equipment-catalog.ts';
import { initialAppearance, PALETTES } from '../../shared/avatar/appearance.ts';

// Captured on pre-extraction C10. Network fixtures exercise real page state,
// controls and payloads; database/permission enforcement has separate HTTP tests.
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const output = `artifacts/c11-browser/${process.env.C11_LABEL || 'current'}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const errors = [];
const loot = { id: '00000000-0000-4000-8000-000000000010', teacherId: fight.teacherId,
  name: 'Authored reward', quality: 'rare', slot: 'armor', tier: 1, stats: { def: 2 } };
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => errors.push(error.message));
    let saved = { ...structuredClone(fight), encounterTier: 1,
      enemies: [{ ...fight.enemies[0], enemyType: 'slime', image: '/enemies/slime-v2.png', role: 'trash', quantity: 1, wave: 1 }] };
    const attempts = [];
    let failSave = true;
    await page.addInitScript(id => localStorage.setItem('teacherId', id), fight.teacherId);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('check-session')) return route.fulfill({ json: { id: fight.teacherId, email: 'fixture@example.test', guildCode: 'TEST' } });
      if (path.includes('equipment-items')) return route.fulfill({ json: [loot] });
      if (path.endsWith('hosted-sessions')) return route.fulfill({ json: [] });
      if (path === `/api/teacher/${fight.teacherId}/fights`) return route.fulfill({ json: [fightSummary(saved)] });
      if (route.request().method() === 'PATCH') {
        attempts.push(route.request().postDataJSON());
        if (failSave) { failSave = false; return route.fulfill({ status: 503, json: { error: 'Try the save again' } }); }
        saved = { ...saved, ...attempts.at(-1) };
      }
      return route.fulfill({ json: saved });
    });
    await page.goto(`${origin}/teacher/edit/${fight.id}`);
    await page.getByTestId('button-edit-question-0').click();
    await page.getByTestId('textarea-question').fill('<p>Draft, with math \\(x^2\\)</p>');
    await page.getByTestId('input-correct-answer').fill('16');
    await page.getByTestId('button-create-fight-submit').click();
    await page.getByText('Save or cancel your question changes before saving the fight', { exact: true }).waitFor();
    assert.equal(attempts.length, 0);
    await page.getByTestId('tab-enemies').click();
    await page.getByTestId('button-edit-enemy-0').click();
    await page.getByTestId('input-enemy-name').fill('Draft goblins');
    await page.getByTestId('button-select-goblin').click();
    assert.equal(await page.getByLabel('Enemy quantity', { exact: true }).inputValue(), '5');
    await page.getByLabel('Swarm', { exact: true }).check();
    await page.getByLabel('Extra swarm enemies', { exact: true }).fill('3');
    await page.getByTestId('tab-questions').click();
    assert.equal(await page.getByTestId('input-correct-answer').inputValue(), '16');
    await page.getByTestId('button-save-question').click();
    await page.getByTestId('input-csv-upload').setInputFiles({ name: 'review.csv', mimeType: 'text/csv', buffer: Buffer.from(
      'Question Text,QUESTION TYPE,time limit,answer1,answer2,answer3,answer4\n' +
      '"<p>Comma, and a\nsecond line</p>",MC,5,yes,no,,\n' +
      'Statement,TF,120,true,,,\n' +
      'Expression,SA,999,x^2,,,\n' +
      'Skip one-option MC,MC,30,only,,,\n') });
    await page.getByTestId('question-item-3').waitFor();
    assert.equal(await page.locator('[data-testid^="question-item-"]').count(), 4);
    await page.getByTestId('tab-enemies').click();
    assert.equal(await page.getByTestId('input-enemy-name').inputValue(), 'Draft goblins');
    assert.equal(await page.getByLabel('Extra swarm enemies', { exact: true }).inputValue(), '3');
    await page.getByTestId('button-update-enemy').click();
    await page.getByTestId('button-select-slime').click();
    await page.getByTestId('input-enemy-name').fill('Second wave');
    await page.getByLabel('Enemy wave', { exact: true }).fill('2');
    await page.getByTestId('button-add-enemy').click();
    const dragEnemy = page.getByTestId('button-drag-enemy-0');
    await page.getByTestId('enemy-item-1').scrollIntoViewIfNeeded();
    await dragEnemy.focus();
    await dragEnemy.press('Space');
    await page.locator('[data-testid="button-drag-enemy-0"][aria-pressed="true"]').waitFor();
    // The keyboard sensor installs its listener asynchronously and measures on
    // the next frame. Observe activation and collision before ending the drag.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await dragEnemy.press('ArrowDown');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(node => {
      const text = node.textContent || '';
      return text.includes('Draggable item e1 was moved over droppable area ') && !text.endsWith('area e1.');
    }));
    await dragEnemy.press('Space');
    await page.getByTestId('enemy-item-0').filter({ hasText: 'Second wave' }).waitFor();
    await page.getByTestId('tab-loot').click();
    await page.getByTestId('select-loot-item').click();
    await page.getByRole('option', { name: /Authored reward/ }).click();
    await page.getByTestId('button-delete-loot-0').click();
    await page.getByTestId('select-loot-item').click();
    await page.getByRole('option', { name: /Authored reward/ }).click();
    if (process.env.C11_BASELINE === '1') {
      assert.equal(await page.getByTestId('loot-item-0').count(), 0, 'C10 reproduces the stale Select value after same-item re-add');
      console.log('BASELINE DEFECT: removed loot cannot be re-added until its tab remounts');
      await page.getByTestId('tab-enemies').click();
      await page.getByTestId('tab-loot').click();
      await page.getByTestId('select-loot-item').click();
      await page.getByRole('option', { name: /Authored reward/ }).click();
    }
    await page.getByTestId('loot-item-0').waitFor();
    await page.getByTestId('button-create-fight-submit').click();
    await page.getByText('Failed to update fight', { exact: true }).waitFor();
    assert.equal(attempts.length, 1);
    assert.ok(page.url().includes('/teacher/edit/'));
    await page.getByTestId('tab-questions').click();
    assert.equal(await page.locator('[data-testid^="question-item-"]').count(), 4);
    await page.getByTestId('button-create-fight-submit').click();
    await page.waitForURL('**/teacher');
    assert.deepEqual(attempts[1], attempts[0], 'retry retains the complete authored payload');
    assert.equal(saved.questions[0].id, 'q1');
    assert.equal(saved.questions[0].correctAnswer, '16');
    assert.equal(saved.questions[1].question, '<p>Comma, and a\nsecond line</p>');
    assert.deepEqual(saved.questions.map(q => [q.type, q.timeLimit]), [['short_answer', 30], ['multiple_choice', 5], ['true_false', 120], ['short_answer', 30]]);
    assert.deepEqual(saved.questions[1].options, ['yes', 'no']);
    assert.equal(new Set(saved.questions.map(q => q.id)).size, 4);
    assert.equal(saved.enemies[1].id, 'e1');
    assert.equal(saved.enemies[1].quantity, 5);
    assert.deepEqual(saved.enemies[1].swarm, { enemiesPerFourPlayers: 3 });
    assert.equal(saved.enemies[0].wave, 2);
    assert.deepEqual(saved.lootTable, [{ itemId: loot.id }]);
    await page.goto(`${origin}/teacher/edit/${fight.id}`);
    await page.getByTestId('question-item-3').waitFor();
    await page.getByTestId('button-edit-question-0').click();
    await page.getByTestId('textarea-question').fill('Discard this');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByTestId('button-edit-question-0').click();
    assert.equal(await page.getByTestId('input-correct-answer').inputValue(), '16');
    await page.screenshot({ path: `${output}/${viewport.width}-c11-authoring.png` });
    if (process.env.C11_BASELINE !== '1') {
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      const mathQuestion = {
        question: 'Differentiate x^2. Compare x_1 and \\(\\frac{x^{2}}{2}\\).',
        answers: ['2x', 'x^2', '\\frac{x^2}{2}', '<span class="math-inline" data-latex="x_{1}"></span>'],
      };
      const csv = [
        ['Question Text', 'Question Type', 'Timer', 'Answer1', 'Answer2', 'Answer3', 'Answer4'],
        [mathQuestion.question, 'MC', '90', ...mathQuestion.answers],
      ].map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\n');
      await page.getByTestId('input-csv-upload').setInputFiles({ name: 'math.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
      const imported = page.getByTestId('question-item-4');
      await imported.waitFor();
      assert.equal(await imported.locator('.katex').count(), 6);
      assert.equal(await imported.locator('math msup').count(), 4);
      assert.equal(await imported.locator('math mfrac').count(), 2);
      assert.equal(await imported.locator('math msub').count(), 2);
      assert.equal(await imported.locator('.katex-error').count(), 0);
      await page.getByTestId('button-edit-question-4').click();
      assert.equal(await page.getByTestId('textarea-question').inputValue(), mathQuestion.question);
      await page.getByTestId('textarea-question').fill(mathQuestion.question + ' Use the power rule.');
      await page.getByTestId('button-save-question').click();
      await page.getByTestId('button-create-fight-submit').click();
      await page.waitForURL('**/teacher');
      assert.deepEqual(saved.questions[4].options, mathQuestion.answers);
      assert.equal(saved.questions[4].correctAnswer, '2x');
      await page.goto(origin + '/teacher/edit/' + fight.id);
      await page.getByTestId('question-item-4').waitFor();
      assert.equal(await page.getByTestId('question-item-4').locator('.katex').count(), 6);
      await page.getByTestId('question-item-4').scrollIntoViewIfNeeded();
      await page.screenshot({ path: output + '/' + viewport.width + '-math-roundtrip.png' });
    }
    await page.close();

    const lobby = await browser.newPage({ viewport });
    lobby.on('pageerror', error => errors.push(error.message));
    let current = { ...student(), ...STARTER_LOADOUTS.warrior, inventory: Object.keys(STARTER_EQUIPMENT), crossClassAbility1: 'fireball_crossclass' };
    let appearance = initialAppearance(null, 'human-male-v1', () => 0);
    const savedJobs = { warrior: { ...STARTER_LOADOUTS.warrior, crossClassAbility1: 'fireball_crossclass', crossClassAbility2: null }, wizard: { ...STARTER_LOADOUTS.wizard, crossClassAbility1: null, crossClassAbility2: null } };
    const writes = [];
    let failEquipment = true, failAppearance = true, failClass = true;
    await lobby.addInitScript(id => localStorage.setItem('studentId', id), current.id);
    await lobby.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname, method = route.request().method();
      let json = [];
      if (path.endsWith('/avatar')) {
        if (method !== 'GET') {
          writes.push({ kind: 'avatar', data: route.request().postDataJSON() });
          if (failAppearance) { failAppearance = false; return route.fulfill({ status: 503, json: { error: 'Avatar retry' } }); }
          appearance = route.request().postDataJSON();
        }
        json = appearance;
      } else if (path.endsWith('/equipment')) {
        const data = route.request().postDataJSON(); writes.push({ kind: 'equipment', data });
        if (failEquipment) { failEquipment = false; return route.fulfill({ status: 503, json: { error: 'Gear retry' } }); }
        current = { ...current, ...data, ...(data.crossClassAbilities ? {crossClassAbility1:data.crossClassAbilities[0] ?? null,crossClassAbility2:data.crossClassAbilities[1] ?? null} : {}) }; savedJobs[current.characterClass] = { ...savedJobs[current.characterClass], ...data }; json = current;
      } else if (path.endsWith('/character')) {
        const data = route.request().postDataJSON(); writes.push({ kind: 'character', data });
        if (failClass) { failClass = false; return route.fulfill({ status: 503, json: { error: 'Class retry' } }); }
        current = { ...current, ...data, ...savedJobs[data.characterClass] }; json = current;
      } else if (path === `/api/student/${current.id}` || path.endsWith('/check-session')) json = current;
      else if (path.endsWith('/job-levels')) json = [{ jobClass: 'warrior', level: 2, experience: 123 }, { jobClass: 'wizard', level: 30, experience: 456 }];
      else if (path === '/api/equipment-items') json = (url.searchParams.get('ids') || '').split(',').filter(Boolean).map(id => ({ ...STARTER_EQUIPMENT[id], quality: 'common' }));
      else if (path.endsWith('/stamina')) json = { used: 0, remaining: 100, limit: 100 };
      return route.fulfill({ json });
    });
    await lobby.goto(`${origin}/student/lobby`);
    await lobby.getByTestId('text-weapon').filter({ hasText: 'Starter Sword' }).waitFor();
    assert.equal(await lobby.getByTestId('item-basic_staff').getAttribute('aria-disabled'), 'true');
    assert.equal(writes.length, 0, 'incompatible weapon has no save');
    await lobby.getByRole('button', { name: 'Unequip Weapon', exact: true }).click();
    await lobby.getByText('Equipment could not be changed', { exact: true }).waitFor();
    assert.match(await lobby.getByTestId('text-weapon').textContent(), /Starter Sword/);
    await lobby.getByRole('button', { name: 'Unequip Weapon', exact: true }).click();
    await lobby.getByTestId('text-weapon').filter({ hasText: 'None' }).waitFor();
    await lobby.getByTestId('item-basic_sword').click();
    await lobby.getByTestId('text-weapon').filter({ hasText: 'Starter Sword' }).waitFor();
    await lobby.getByTestId('button-remove-ability-1').click();
    await lobby.getByText('Cross-class ability removed!', { exact: true }).waitFor();
    assert.equal(current.crossClassAbility1, null);
    assert.match(await lobby.getByTestId(process.env.C11_BASELINE === '1' ? 'ability-slot-2' : 'ability-slot-3').textContent(), /Locked/);
    await lobby.getByTestId('filter-spell').click();
    const abilityIcon = lobby.getByTestId('draggable-ability-fireball_crossclass');
    await abilityIcon.scrollIntoViewIfNeeded();
    const source = await abilityIcon.boundingBox();
    assert.ok(source);
    await lobby.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await lobby.mouse.down();
    await lobby.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2, { steps: 3 });
    await lobby.locator('[data-testid="draggable-ability-fireball_crossclass"][aria-pressed="true"]').waitFor();
    await lobby.getByTestId('ability-slot-1').scrollIntoViewIfNeeded();
    const target = await lobby.getByTestId('ability-slot-1').boundingBox();
    assert.ok(target);
    await lobby.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await lobby.getByRole('status').filter({ hasText: 'was moved over droppable area slot-1.' }).waitFor({ state: 'attached' });
    await lobby.mouse.up();
    await lobby.getByTestId('button-remove-ability-1').waitFor();
    assert.equal(current.crossClassAbility1, 'fireball_crossclass');
    await lobby.getByTestId('button-remove-ability-1').click();
    await lobby.getByTestId('button-remove-ability-1').waitFor({ state: 'hidden' });
    await lobby.getByTestId('button-open-class-modal').click();
    if (process.env.C11_BASELINE === '1') {
    assert.equal(await lobby.getByLabel('Body model', { exact: true }).isDisabled(), true);
    await lobby.getByLabel('hair', { exact: true }).selectOption(PALETTES.hair[1].id);
    await lobby.getByLabel('Preview job', { exact: true }).selectOption('wizard');
    const beforeClass = writes.length;
    await lobby.getByTestId('modal-class-wizard').click();
    await lobby.getByText('Your appearance could not be saved. Please try again.', { exact: true }).waitFor();
    assert.equal(writes.length, beforeClass + 1);
    assert.equal(writes.at(-1).kind, 'avatar');
    assert.equal(current.characterClass, 'warrior');
    assert.equal(await lobby.getByLabel('hair', { exact: true }).inputValue(), PALETTES.hair[1].id);
    await lobby.getByTestId('modal-class-wizard').click();
    await lobby.getByText('Failed to change class', { exact: true }).waitFor();
    assert.equal(current.characterClass, 'warrior');
    assert.equal(appearance.hairColorId, PALETTES.hair[1].id);
    await lobby.getByTestId('modal-class-wizard').click();
    await lobby.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(current.characterClass, 'wizard');
    assert.deepEqual(writes.slice(beforeClass).map(w => w.kind), ['avatar', 'avatar', 'character', 'avatar', 'character']);
    await lobby.getByTestId('text-weapon').filter({ hasText: 'Starter Staff' }).waitFor();
    await lobby.getByTestId('button-open-class-modal').click();
    assert.equal(await lobby.getByLabel('hair', { exact: true }).inputValue(), PALETTES.hair[1].id);
    await lobby.getByTestId('modal-class-warrior').click();
    await lobby.getByRole('dialog').waitFor({ state: 'hidden' });
    } else {
      assert.equal(await lobby.getByLabel('hair', {exact:true}).count(),0,'paid editor is no longer available in free class changes');
      assert.equal(await lobby.getByRole('link',{name:'Recustomize character with AA'}).getAttribute('href'),'/student/advancement?customize=1');
      const beforeClass=writes.length;
      await lobby.getByTestId('modal-class-wizard').click();
      await lobby.getByText('Failed to change class',{exact:true}).waitFor();
      assert.equal(current.characterClass,'warrior');
      await lobby.getByTestId('modal-class-wizard').click();
      await lobby.getByRole('dialog').waitFor({state:'hidden'});
      assert.equal(current.characterClass,'wizard');
      assert.deepEqual(writes.slice(beforeClass).map(w=>w.kind),['character','character'],'class changes never write or charge appearance');
      assert.equal(appearance.hairColorId,PALETTES.hair[0].id);
      await lobby.getByTestId('text-weapon').filter({hasText:'Starter Staff'}).waitFor();
      await lobby.getByTestId('button-open-class-modal').click();
      await lobby.getByTestId('modal-class-warrior').click();
      await lobby.getByRole('dialog').waitFor({state:'hidden'});
    }
    await lobby.getByTestId('text-weapon').filter({ hasText: 'Starter Sword' }).waitFor();
    assert.equal(current.crossClassAbility1, null, 'returning jobs keep the authoritative remembered ability selection');
    await lobby.screenshot({ path: `${output}/${viewport.width}-c11-lobby.png` });
    await lobby.close();
  }
  assert.deepEqual(errors, []);
  console.log('C11 authoring/lobby: draft tab retention, CSV, enemy limits, loot, save retry, gear restrictions, keyboard enemy ordering, ability drag/removal and appearance/class save ordering pass at both sizes.');
} finally { await browser.close(); }
