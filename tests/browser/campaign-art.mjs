import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { started, student } from '../phase4/fixtures.ts';
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const output = 'artifacts/combat-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
try {
  for (const width of [1366,390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(id => {
      localStorage.setItem('studentId', id); localStorage.setItem('sessionId', 'ABC234');
      window.artSockets = [];
      window.WebSocket = class {
        static OPEN = 1; readyState = 1;
        constructor(url) { this.url = url; window.artSockets.push(this); setTimeout(() => this.onopen?.(),0); }
        send() {} close() { this.readyState = 3; }
      };
    }, student().id);
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.goto(`${origin}/student/combat`);
    await page.waitForFunction(() => window.artSockets.some(s => typeof s.onmessage === 'function'));
    let revision = 10;
    for (const environment of ['grassland','normal_cave',undefined]) {
      const state = started(); state.currentPhase = 'waiting'; state.revision = revision++; state.battleEnvironment = environment;
      state.enemies[0].image = '/enemies/slime-v2.png';
      await page.evaluate(state => window.artSockets.filter(s => s.url.includes('sessionId=ABC234')).at(-1).onmessage({ data: JSON.stringify({ type:'combat_state',state,question:null,serverTime:Date.now() }) }), state);
      await page.waitForFunction(environment => {
        const image = document.querySelector('.battle-scenery');
        return image?.dataset.environment === (environment || 'grassland') && image.complete && image.naturalWidth > 0;
      }, environment);
      await page.locator('.battle-paperdoll canvas[data-avatar-ready="true"]').first().waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
      await page.locator('.battle-scenery').evaluate(async image => { await image.decode(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      if (environment) await page.screenshot({ path: `${output}/${width}-battle-${environment}.png`, fullPage:true });
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
  const sheet = await browser.newPage({ viewport:{ width:1100,height:900 } });
  await sheet.goto(origin);
  await sheet.evaluate(async url => { const module = await import(url); await module.renderBorderSheet(); }, `/@fs${process.cwd()}/tests/support/campaign-art-review.tsx`);
  await sheet.locator('[data-review-mask]').last().waitFor();
  assert.equal(await sheet.locator('[data-review-mask]').count(),141);
  await sheet.screenshot({ path:`${output}/campaign-border-vocabulary.png`,fullPage:true });
  await sheet.close();
} finally { await browser.close(); }
console.log('Campaign scene selection, legacy fallback, avatar rendering and 47-case border sheet pass.');
