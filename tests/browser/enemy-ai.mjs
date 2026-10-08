import assert from 'node:assert/strict';
import { fight } from '../phase4/fixtures.ts';
import { ENEMY_CATALOG } from '../../shared/combat/enemy-catalog.ts';
import { enemySchema } from '../../shared/schema.ts';

export async function verifyEnemyAuthoring(browser, origin) {
  for (const viewport of [{width:1366,height:768},{width:390,height:844}]) {
    const page = await browser.newPage({viewport});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let saved = {...fight, encounterTier:1, enemies:[{...fight.enemies[0], name:'Review Zombie', enemyType:'zombie', image:ENEMY_CATALOG.zombie.image, quantity:1, wave:1, role:'normal'}]};
    await page.route('**/api/**', async route => {
      const request=route.request(), path=new URL(request.url()).pathname;
      if(path==='/api/teacher/check-session') return route.fulfill({json:{id: fight.teacherId,email:'fixture@example.test'}});
      if(path===`/api/fights/${fight.id}`) {
        if(request.method()==='PATCH') saved={...saved,...request.postDataJSON()};
        return route.fulfill({json:saved});
      }
      if(path===`/api/teacher/${fight.teacherId}/fights`) return route.fulfill({json:[saved]});
      return route.fulfill({json:[]});
    });
    await page.goto(`${origin}/teacher/edit/${fight.id}`);
    await page.getByTestId('tab-enemies').click();
    await page.getByTestId('button-edit-enemy-0').click();
    assert.equal(await page.getByLabel('Enemy AI type',{exact:true}).locator('option').count(),7);
    for(const type of Object.keys(ENEMY_CATALOG)) {
      const button=page.getByTestId(`button-select-${type}`);
      await button.locator('img').evaluate(img=>img.decode());
      assert.equal(await button.locator('img').evaluate(img=>getComputedStyle(img).objectFit),'contain');
      await button.click();
      assert.equal(await page.getByLabel('Enemy AI type',{exact:true}).inputValue(),type);
    }
    await page.getByTestId('button-select-vampire').click();
    await page.getByLabel('Enemy AI preset',{exact:true}).selectOption('custom');
    await page.getByLabel('vampiric_bite condition',{exact:true}).selectOption('self_hp_below');
    await page.getByLabel('vampiric_bite threshold',{exact:true}).fill('40');
    await page.getByLabel('vampiric_bite target',{exact:true}).selectOption('lowest_hp');
    await page.getByLabel('vampiric_bite priority',{exact:true}).fill('90');
    await page.getByLabel('vampiric_bite cooldown',{exact:true}).fill('7');
    await page.getByText('Preview priorities',{exact:true}).click();
    await page.getByLabel('Preview enemy HP',{exact:true}).fill('30');
    assert.match(await page.getByLabel('Enemy priority preview',{exact:true}).innerText(),/Vampiric Bite: Eligible/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'enemy editor must fit phone width');
    await page.getByTestId('enemy-ai-editor').screenshot({path:`artifacts/combat-ui/${viewport.width}-enemy-ai-editor.png`});
    await page.getByTestId('button-update-enemy').click();
    await page.getByTestId('button-select-goblin').click();
    await page.getByTestId('input-enemy-name').fill('Review Goblins');
    await page.getByLabel('Enemy quantity',{exact:true}).fill('1');
    assert.equal(await page.getByLabel('Enemy quantity',{exact:true}).inputValue(),'5');
    assert.equal(await page.getByLabel('Enemy AI preset',{exact:true}).count(),0);
    await page.getByTestId('button-add-enemy').click();
    await page.getByTestId('button-create-fight-submit').click();
    await page.waitForURL(`${origin}/teacher`);
    assert.equal(saved.enemies.length,2);
    saved.enemies.forEach(e=>enemySchema.parse(e));
    assert.equal(saved.enemies[1].quantity,5);
    const bite=saved.enemies[0].ai.rules.find(r=>r.move==='vampiric_bite');
    assert.deepEqual([bite.value,bite.priority,bite.cooldown,bite.target],[40,90,7,'lowest_hp']);
    await page.goto(`${origin}/teacher/edit/${fight.id}`);
    await page.getByTestId('tab-enemies').click();
    await page.getByTestId('button-edit-enemy-0').click();
    assert.equal(await page.getByLabel('Enemy AI preset',{exact:true}).inputValue(),'custom');
    assert.equal(await page.getByLabel('vampiric_bite priority',{exact:true}).inputValue(),'90');
    await page.getByRole('button',{name:'Restore species defaults',exact:true}).click();
    assert.equal(await page.getByLabel('Enemy AI preset',{exact:true}).inputValue(),'default');
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(`PASS ${viewport.width}: all seven portraits, enemy priorities, goblin minimum, save/reload and default reset`);
  }
}
