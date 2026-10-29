import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import Papa from 'papaparse';
import { fight, fightSummary } from '../phase4/fixtures.ts';
import { insertFightSchema } from '../../shared/contracts/fights.ts';

const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const output = `artifacts/c11-browser/${process.env.C11_LABEL || 'current'}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const csv = questions => Buffer.from(Papa.unparse(questions.map(question => ({
  'Question Text': question, 'Question Type': 'MC', Answer1: '\\(1\\)', Answer2: '\\(x\\)', Timer: '90',
}))));
const oversized = '<svg><desc>' + 'x'.repeat(25_000) + '</desc></svg>';
const compact = '<p>Which graph has a hole?</p><svg viewBox="0 0 100 100"><path d="M0 90 L90 0" stroke="blue"/><circle cx="50" cy="40" r="4" fill="white" stroke="blue"/></svg>';
const question = 'Simplify \\(\\frac{x}{x}\\) for nonzero \\(x\\).';

try {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [], writes = [];
    let saved;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(id => localStorage.setItem('teacherId', id), fight.teacherId);
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('check-session')) return route.fulfill({ json: { id: fight.teacherId, email: 'fixture@example.test' } });
      if (path === '/api/fights' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        writes.push(body);
        const result = insertFightSchema.safeParse(body);
        assert.equal(result.success, true, 'the actual save contract must accept the UI payload');
        saved = { ...fight, ...result.data };
        return route.fulfill({ status: 201, json: saved });
      }
      if (path.endsWith('/fights')) return route.fulfill({ json: saved ? [fightSummary(saved)] : [] });
      return route.fulfill({ json: [] });
    });
    await page.goto(`${origin}/teacher/create`);
    await page.getByTestId('input-title').fill('Validation recovery');
    await page.getByTestId('input-csv-upload').setInputFiles({ name: 'oversized.csv', mimeType: 'text/csv', buffer: csv([question, oversized]) });
    await page.getByText('CSV could not be imported', { exact: true }).waitFor();
    await page.getByText(/No questions were added. Question 2: use at most 20,000 characters/).waitFor();
    assert.equal(await page.locator('[data-testid^="question-item-"]').count(), 0, 'a failed import leaves the draft unchanged');
    assert.equal(writes.length, 0);
    assert.equal(await page.getByTestId('input-csv-upload').inputValue(), '', 'the file input can retry the same filename');

    await page.getByTestId('input-csv-upload').setInputFiles({ name: 'oversized.csv', mimeType: 'text/csv', buffer: csv([question, compact]) });
    await page.getByTestId('question-item-1').waitFor();
    await page.getByTestId('button-create-fight-submit').click();
    const alert = page.getByTestId('fight-validation-errors');
    await alert.getByText('Add at least one enemy.', { exact: true }).waitFor();
    assert.equal(writes.length, 0);
    assert.equal(await page.getByTestId('input-title').inputValue(), 'Validation recovery');
    await page.getByTestId('tab-enemies').click();
    await page.getByTestId('button-select-slime').click();
    await page.getByTestId('input-enemy-name').fill('Practice slime');
    await page.getByTestId('button-add-enemy').click();

    await page.getByTestId('tab-questions').click();
    await page.getByTestId('button-edit-question-1').click();
    await page.getByTestId('textarea-question').fill(oversized);
    await page.getByTestId('button-save-question').click();
    await page.getByTestId('button-create-fight-submit').click();
    await alert.getByText('Question 2: use at most 20,000 characters (including graph markup).', { exact: true }).waitFor();
    assert.equal(writes.length, 0, 'manual edits receive the same save feedback');
    await alert.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${viewport.width}-fight-validation.png` });

    await page.getByTestId('button-edit-question-1').click();
    await page.getByTestId('textarea-question').fill(compact);
    await page.getByTestId('button-save-question').click();
    await page.getByTestId('button-create-fight-submit').click();
    await page.waitForURL('**/teacher');
    assert.equal(writes.length, 1);
    assert.equal(saved.questions.length, 2);
    assert.deepEqual(saved.questions.map(q => q.question), [question, compact]);
    assert.ok(saved.questions.every(q => q.correctAnswer === '\\(1\\)' && q.timeLimit === 90));
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Fight creation rejects oversized CSVs, exposes save errors, and recovers without losing the draft at desktop/phone sizes.');
} finally {
  await browser.close();
}
