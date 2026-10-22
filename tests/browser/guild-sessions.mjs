import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fight, student } from '../phase4/fixtures.ts';
const origin=process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
await mkdir('artifacts/combat-ui',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const guild={id:'00000000-0000-4000-8000-000000000008',teacherId:fight.teacherId,name:'Battle guild',level:2,limitTier:1,unlockedTier:2};
try {
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
  const page=await browser.newPage({viewport}); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let failList=false,ended=false,lookups=0,launches=0;
  let sessions=[
    {sessionId:'ABC234',fightId:fight.id,title:'Fractions with friends',soloMode:true,hostNickname:'Robin',isHost:false,status:'active',createdAt:2},
    {sessionId:'DEF234',fightId:fight.id,title:'My solo practice',soloMode:true,hostNickname:'warrior',isHost:true,status:'waiting',createdAt:1},
  ];
  await page.addInitScript(({id})=>{
    localStorage.setItem('studentId',id);
    window.WebSocket=class {static OPEN=1;readyState=1;constructor(){setTimeout(()=>this.onopen?.(),0);}send(){}close(){}};
  },{id:student().id});
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let json=[];
    if(path.endsWith('/active-sessions'))return route.fulfill({status:failList?503:200,json:failList?{error:'Battle list unavailable'}:sessions});
    if(path.startsWith('/api/sessions/')) {lookups++;return route.fulfill({status:ended?404:200,json:ended?{error:'Session not found or has ended'}:{sessionId:path.split('/').at(-1),status:'active'}});}
    if(path.endsWith('/solo-sessions')){launches++;json={sessionId:'NEW234'};}
    else if(path===`/api/guilds/${guild.id}`)json=guild;
    else if(path.endsWith('/fights'))json=[{...fight,questionCount:1,soloModeEnabled:true}];
    else if(path===`/api/student/${student().id}` || path.endsWith('/check-session'))json={...student(),guildId:guild.id};
    else if(path.endsWith('/job-levels'))json=[{jobClass:'warrior',level:2}];
    else if(path.endsWith('/stamina'))json={completedCombats:0,xpMultiplier:1,resetsAt:Date.now()+100000};
    else if(path.endsWith('/avatar'))json=null;
    await route.fulfill({json});
  });
  for(const path of [`/student/guild-lobby/${guild.id}`,`/student/guilds/${guild.id}/fights`]) {
    await page.goto(origin+path);
    await page.getByTestId('button-join-ABC234').waitFor();
    assert.equal(await page.getByTestId('button-join-ABC234').textContent(),'Join battle');
    assert.equal(await page.getByTestId('button-join-DEF234').textContent(),'Rejoin battle');
    assert.ok((await page.getByTestId('current-battles').boundingBox()).y < viewport.height);
    await page.screenshot({path:`artifacts/combat-ui/${viewport.width}-${path.includes('guild-lobby')?'guild-lobby':'fight-library'}-sessions.png`});
    const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
      elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,60)}))}));
    assert.ok(overflow.scroll<=viewport.width,JSON.stringify({path,viewport,overflow}));
  }
  await page.getByTestId('button-join-ABC234').click();
  await page.waitForURL('**/student/combat');
  assert.equal(await page.evaluate(()=>localStorage.getItem('sessionId')),'ABC234');assert.equal(lookups,1);
  await page.goto(origin+`/student/guilds/${guild.id}/fights`);
  await page.getByTestId('button-join-DEF234').click();
  await page.waitForURL('**/student/combat');assert.equal(await page.evaluate(()=>localStorage.getItem('sessionId')),'DEF234');
  ended=true;
  await page.goto(origin+`/student/guilds/${guild.id}/fights`);
  await page.getByTestId('button-join-ABC234').click();
  await page.getByText('Unable to join battle',{exact:true}).waitFor();
  assert.ok(page.url().endsWith('/fights'));assert.equal(await page.evaluate(()=>localStorage.getItem('sessionId')),'DEF234');
  ended=false; sessions=[];
  await page.getByRole('button',{name:'Refresh battles'}).click();
  await page.getByText('No current battles.',{exact:false}).waitFor();
  failList=true;
  await page.reload();
  await page.getByRole('button',{name:'Retry battles'}).waitFor();
  failList=false;
  await page.getByRole('button',{name:'Retry battles'}).click();
  await page.getByText('No current battles.',{exact:false}).waitFor();
  await page.getByTestId(`button-host-solo-${fight.id}`).click();
  await page.waitForURL('**/student/combat');
  assert.equal(launches,1);assert.equal(await page.evaluate(()=>localStorage.getItem('sessionId')),'NEW234');
  assert.deepEqual(errors,[]); await page.close();
 }
 console.log('Current battles: visible join/rejoin, stale room recovery, retry, empty state and solo launch pass on Chromebook and phone.');
} finally {await browser.close();}
