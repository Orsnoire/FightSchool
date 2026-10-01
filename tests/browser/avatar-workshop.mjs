import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch(process.env.AVATAR_BROWSER_PATH ? { executablePath: process.env.AVATAR_BROWSER_PATH, args: ['--no-sandbox', '--disable-gpu'] } : {});
const url = pathToFileURL(resolve('attached_assets/characters/human/rig-prototype-v1/preview/workshop.html')).href;
const output = 'artifacts/avatar-workshop';await mkdir(output, {recursive:true});
try {
  for (const viewport of [{width:1366,height:900},{width:390,height:844}]) {
    const page = await browser.newPage({viewport});const errors = [];const external = [];
    page.on('pageerror', error => errors.push(error.message));page.on('request', request => {if(/^https?:/.test(request.url()))external.push(request.url());});
    await page.goto(url);await page.waitForFunction(() => !!window.avatarWorkshop);
    await page.evaluate(() => window.avatarWorkshop.seek('attack', .9, 'starter'));
    const before = await page.evaluate(() => ({world:window.avatarWorkshop.frame.world,colors:window.avatarWorkshop.state.colors,pixels:document.querySelector('canvas').toDataURL()}));
    await page.getByRole('button',{name:'Armor',exact:true}).click();
    const after = await page.evaluate(() => ({world:window.avatarWorkshop.frame.world,colors:window.avatarWorkshop.state.colors,pixels:document.querySelector('canvas').toDataURL()}));
    assert.deepEqual(after.world,before.world);assert.deepEqual(after.colors,before.colors);assert.notEqual(after.pixels,before.pixels);
    await page.getByLabel('Show joints & attachments').check();
    const overlay = await page.locator('canvas').evaluate(c => c.toDataURL());assert.notEqual(overlay,after.pixels);
    await page.getByLabel('Show joints & attachments').uncheck();
    await page.getByLabel('Hair',{exact:true}).selectOption({index:5});
    assert.notEqual((await page.evaluate(() => window.avatarWorkshop.state.colors)).hair,before.colors.hair);
    await page.locator('[data-clip="block"]').click();
    await page.locator('#timeline').evaluate(input => {input.value='1.20';input.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal((await page.evaluate(() => window.avatarWorkshop.state)).playing,false);
    await page.getByLabel('Still pose / reduced motion').check();
    const still = await page.evaluate(() => window.avatarWorkshop.frame.world);
    await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(() => window.avatarWorkshop.frame.world),still);
    await page.getByRole('button',{name:'Play',exact:true}).click();
    await page.waitForTimeout(200);assert.ok((await page.evaluate(() => window.avatarWorkshop.state)).time>0);
    await page.evaluate(() => window.avatarWorkshop.seek('block',1.2,'armor'));
    await page.screenshot({path:`${output}/${viewport.width}.png`,fullPage:true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log(`Workshop controls, offline loading, and layout passed at ${viewport.width}×${viewport.height}.`);
    await page.close();
  }
  const reduced = await browser.newPage({reducedMotion:'reduce'});await reduced.goto(url);await reduced.waitForFunction(() => !!window.avatarWorkshop);assert.equal(await reduced.evaluate(() => window.avatarWorkshop.state.playing),false);await reduced.close();
} finally {await browser.close();}
