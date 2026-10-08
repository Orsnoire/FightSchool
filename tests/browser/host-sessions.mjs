import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fight } from '../phase4/fixtures.ts';
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
await mkdir('artifacts/combat-ui', {recursive:true});
const browser = await chromium.launch();
try {
  for (const viewport of [{width:1366,height:768},{width:390,height:844}]) {
    const page=await browser.newPage({viewport});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let current={sessionId:'ABC234',fightId:fight.id,status:'active'}, launches=0, ends=0;
    await page.addInitScript(()=>{
      window.WebSocket=class {static OPEN=1;readyState=1;constructor(){setTimeout(()=>this.onopen?.(),0);}send(){}close(){}};
    });
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url()),path=url.pathname;
      let json;
      if(path.endsWith('/check-session'))json={id:fight.teacherId,email:'fixture@example.test'};
      else if(path===`/api/teacher/${fight.teacherId}/fights`)json=[fight];
      else if(path==='/api/fights/hosted-sessions')json=current?[current]:[];
      else if(path.endsWith('/host-guilds'))json=[];
      else if(path===`/api/fights/${fight.id}/sessions`){
        if(request.method()==='POST'){launches++;current={sessionId:'NEW234',fightId:fight.id,status:'waiting'};}
        json=current;
      } else if(path.endsWith('/end')){ends++;current=null;json={success:true};}
      else if(path===`/api/fights/${fight.id}`)json=fight;
      else return route.fulfill({status:404,json:{error:'Unknown fixture route'}});
      await route.fulfill({json});
    });
    await page.goto(origin+'/teacher');
    const join=page.getByTestId(`button-host-${fight.id}`);
    await page.getByRole('button',{name:'Join fight in progress',exact:true}).waitFor();
    await page.screenshot({path:`artifacts/combat-ui/${viewport.width}-host-session-controls.png`});
    await join.click();await page.getByTestId('text-session-code').waitFor();
    assert.match(page.url(),/session=ABC234/);assert.equal(launches,0);
    await page.reload();await page.getByTestId('text-session-code').waitFor();assert.equal(launches,0);
    await page.goto(origin+'/teacher');
    const end=page.getByRole('button',{name:'End existing session',exact:true});
    await end.waitFor();page.once('dialog',d=>d.dismiss());await end.click();assert.equal(ends,0);
    page.once('dialog',d=>d.accept());await end.click();
    await page.getByRole('button',{name:'Launch Host',exact:true}).waitFor();assert.equal(ends,1);
    await page.getByRole('button',{name:'Launch Host',exact:true}).evaluate(button=>{button.click();button.click();});
    await page.getByTestId('text-session-code').waitFor();assert.equal(launches,1);
    assert.match(page.url(),/session=NEW234/);
    await page.reload();await page.getByTestId('text-session-code').waitFor();assert.equal(launches,1);
    current=null;
    await page.goto(origin+`/teacher/host/${fight.id}`);
    await page.getByRole('button',{name:'Launch Host',exact:true}).waitFor();assert.equal(launches,1,'a bare host URL never creates a room');
    assert.deepEqual(errors,[]);await page.close();
  }
} finally {await browser.close();}
