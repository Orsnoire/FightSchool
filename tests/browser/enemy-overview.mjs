import assert from 'node:assert/strict';

export async function verifyEnemyOverview(page, count, wave) {
  const overview = page.getByRole('region', { name: 'Enemy overview' });
  await overview.waitFor();
  assert.equal(await overview.locator('[data-enemy-list-id]').count(), count);
  if (wave) assert.match(await overview.locator('h2').innerText(), new RegExp(`^Wave ${wave} ·`));
  assert.equal(await page.locator('.battle-enemy-field .battle-enemy-name').count(), 0);
  assert.ok((await page.locator('.battle-enemy-info').allTextContents()).every(text => !text.trim()), 'only health bars stay over sprites');
  const bounds = await overview.evaluate(el => {
    const rect = node => node.getBoundingClientRect().toJSON();
    return { overview: rect(el), field: rect(document.querySelector('.battle-enemy-field')), board: rect(document.querySelector('.battlefield')),
      blockers: [...document.querySelectorAll('.battle-wait,.battle-student-top')].filter(node => node.getClientRects().length).map(rect) };
  });
  assert.ok(bounds.overview.y >= bounds.board.y && bounds.overview.y <= bounds.board.y + 80, 'wave and list are at the top of the field');
  assert.ok(bounds.overview.bottom <= bounds.field.top - 8, 'enemy list clears formation health bars');
  for (const other of bounds.blockers) assert.ok(bounds.overview.right <= other.left || bounds.overview.left >= other.right || bounds.overview.bottom <= other.top || bounds.overview.top >= other.bottom, 'status/header does not cover enemy text');
  const list = overview.getByRole('list');
  assert.ok(await list.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'enemy names wrap without horizontal overflow');
  if (count >= 30) {
    assert.equal(await list.evaluate(el => getComputedStyle(el).overflowY), 'auto', 'enemy list supports internal scrolling');
    if (page.viewportSize().width <= 1366) {
      assert.ok(await list.evaluate(el => el.scrollHeight > el.clientHeight), 'large swarms scroll on phone and Chromebook screens');
    }
    await list.focus();
    await page.keyboard.press('End');
    await list.locator('li').last().scrollIntoViewIfNeeded();
    assert.ok(await list.evaluate(el => {
      const box = el.getBoundingClientRect(), last = el.lastElementChild.getBoundingClientRect();
      return last.top >= box.top - 1 && last.bottom <= box.bottom + 1;
    }), 'last enemy is fully readable, whether the list fits or scrolls');
    await list.evaluate(el => { el.scrollTop = 0; });
  }
}
