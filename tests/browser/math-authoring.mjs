import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { mathAuthoringFixture } from '../phase4/math-authoring-fixture.ts';

const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const output = process.env.MATH_BROWSER_OUTPUT || 'artifacts/math-authoring';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const errors = [];
try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const f = await mathAuthoringFixture();
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    let dropCreateResponse = true;
    const creates = [];
    try {
      await page.addInitScript(id => localStorage.setItem('teacherId', id), f.teacher.data.id);
      await page.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url());
        const body = req.postData() ? req.postDataJSON() : undefined;
        const response = await f.send(url.pathname + url.search, req.method(), f.teacher.cookie, body);
        if (req.method() === 'POST' && url.pathname === '/api/math/templates') {
          creates.push(body);
          if (dropCreateResponse) { dropCreateResponse = false; return route.fulfill({ status: 503, json: { error: 'Response lost after commit. Retry your save.' } }); }
        }
        await route.fulfill({ status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: await response.text() });
      });
      await page.goto(`${origin}/teacher/edit/${f.fight.data.id}`);
      await page.getByTestId('button-edit-question-0').click();
      await page.getByTestId('textarea-question').fill('Preserved fixed-question draft');
      await page.getByTestId('button-math-templates').click();
      await page.getByLabel('Search skills or saved titles').fill('division');
      await page.getByRole('button', { name: 'Use quotient rule', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Use product rule', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Use quotient rule', exact: true }).click();
      await page.getByLabel('Search skills or saved titles').fill('');
      await page.getByLabel('Template title', { exact: true }).fill('Quotient review');
      await page.getByLabel('m minimum', { exact: true }).fill('2');
      await page.getByLabel('m maximum', { exact: true }).fill('2');
      await page.getByLabel('n minimum', { exact: true }).fill('5');
      await page.getByLabel('n maximum', { exact: true }).fill('5');
      await page.getByTestId('tab-enemies').click();
      await page.getByTestId('tab-questions').click();
      assert.equal(await page.getByLabel('Template title', { exact: true }).inputValue(), 'Quotient review');
      assert.equal(await page.getByTestId('textarea-question').inputValue(), 'Preserved fixed-question draft');
      await page.getByRole('button', { name: 'Preview variants', exact: true }).click();
      await page.getByRole('heading', { name: 'Preview: 1 of 1 distinct variants', exact: true }).waitFor();
      await page.getByText('All available variants are shown; no questions were repeated.', { exact: true }).waitFor();
      assert.ok(await page.locator('[aria-label="Template variants"] .katex').count() >= 2);
      const answer = page.getByLabel('Try an answer for variant 1', { exact: true });
      for (const [value, result] of [['-3', 'Correct'], ['-6/2', 'Equal value, but enter a single integer only.'], ['x^-3', 'Could not grade: unsupported notation. This is not a wrong answer.']]) {
        await answer.fill(value); await page.getByRole('button', { name: 'Check variant 1', exact: true }).click();
        await page.getByText(result, { exact: true }).waitFor();
      }
      await page.getByLabel('Answer sign', { exact: true }).selectOption('positive');
      await page.getByRole('button', { name: 'Preview variants', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'No valid variants' }).waitFor();
      await page.getByLabel('Answer sign', { exact: true }).selectOption('any');
      await page.getByRole('button', { name: 'Save template draft', exact: true }).click();
      await page.getByText('Response lost after commit. Retry your save.', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Template title', { exact: true }).inputValue(), 'Quotient review');
      await page.getByRole('button', { name: 'Save template draft', exact: true }).click();
      await page.getByText('Saved draft revision 1. Review the preview before approving.', { exact: true }).waitFor();
      assert.equal(creates.length, 2); assert.equal(creates[0].mutationId, creates[1].mutationId);
      assert.equal((await f.pg.query('SELECT * FROM math_templates')).rows.length, 1);
      await page.getByLabel('I reviewed these variants', { exact: false }).check();
      await page.getByRole('button', { name: 'Approve reviewed template', exact: true }).click();
      await page.getByText('Approved revision 2 for authoring reuse.', { exact: true }).waitFor();
      await page.getByLabel('Teacher note', { exact: true }).fill('A later draft');
      await page.getByRole('button', { name: 'Save template draft', exact: true }).click();
      await page.getByText('Saved draft revision 3. Review the preview before approving.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'View last approved', exact: true }).click();
      await page.getByText('Opened revision 2.', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Teacher note', { exact: true }).inputValue(), '');
      assert.equal(await page.getByLabel('Template title', { exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Create draft from this version', exact: true }).click();
      await page.getByLabel('Teacher note', { exact: true }).fill('Draft based on approval');
      await page.getByRole('button', { name: 'Discard template changes', exact: true }).click();
      assert.equal(await page.getByLabel('Teacher note', { exact: true }).inputValue(), '', 'discard restores actual historical version');
      await page.getByRole('button', { name: 'Reopen latest', exact: true }).click();
      await page.getByText('Opened revision 3.', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Teacher note', { exact: true }).inputValue(), 'A later draft');

      // Simulate another tab saving after this editor loaded revision 3.
      const [record] = (await f.pg.query('SELECT id FROM math_templates')).rows;
      const latest = (await f.api(`/api/math/templates/${record.id}`, 'GET', f.teacher.cookie)).data;
      await f.api(`/api/math/templates/${record.id}/revisions`, 'POST', f.teacher.cookie, {
        mutationId: crypto.randomUUID(), expectedRevision: 3, preset: { ...latest.revision.preset, note: 'Other tab' }, preview: { seed: 1, count: 5 },
      }, 201);
      await page.getByLabel('Teacher note', { exact: true }).fill('Keep my conflicting draft');
      await page.getByRole('button', { name: 'Save template draft', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'A newer revision exists' }).waitFor();
      assert.equal(await page.getByLabel('Teacher note', { exact: true }).inputValue(), 'Keep my conflicting draft');
      await page.getByRole('button', { name: 'Reopen latest', exact: true }).click();
      await page.getByText('Opened revision 4.', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('textarea-question').inputValue(), 'Preserved fixed-question draft');
      await page.getByTestId('button-save-question').click();
      await page.getByTestId('input-csv-upload').setInputFiles({ name: 'fixed.csv', mimeType: 'text/csv', buffer: Buffer.from('Question Text,Question Type,Timer,Answer1,Answer2\nImported fixed,SA,30,2/4,\n') });
      await page.getByTestId('question-item-1').waitFor();
      assert.equal(await page.locator('[data-testid^="question-item-"]').count(), 2, 'templates never append to fixed questions');
      await page.getByTestId('button-create-fight-submit').click();
      await page.waitForURL(`${origin}/teacher`);
      await page.goto(`${origin}/teacher/edit/${f.fight.data.id}`);
      await page.getByTestId('button-math-templates').click();
      await page.getByRole('button', { name: 'Open Quotient review', exact: true }).click();
      await page.getByText('Opened revision 4.', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Teacher note', { exact: true }).inputValue(), 'Other tab');
      assert.equal(await page.locator('[data-testid^="question-item-"]').count(), 2);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
      await page.getByRole('heading', { name: 'Math templates', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/${viewport.width}-templates.png`, fullPage: true });
      assert.equal(f.roomCalls(), 0);
    } finally { await page.close(); await f.close(); }
  }
  assert.deepEqual(errors, []);
  console.log('Math authoring: real Worker/Postgres + desktop/phone search, drafts, previews, exact grading, ambiguous-commit retry, approval, history, stale-edit recovery, CSV and fixed-fight save/reopen passed.');
} finally { await browser.close(); }
