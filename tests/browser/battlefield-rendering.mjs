import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { started, student, fight } from '../phase4/fixtures.ts';
import { avatarFixture } from '../support/avatar-rendering-fixture.ts';
const origin=process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
const label=process.env.C08_LABEL || 'after', optimized=label==='after';
const output=`artifacts/c08-browser/${label}`;await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const cases=[
  {role:'teacher',count:30,width:1366,height:768,dpr:1},
  {role:'teacher',count:60,width:1366,height:768,dpr:1},
  {role:'student',count:30,width:390,height:844,dpr:2},
  {role:'student',count:60,width:390,height:844,dpr:2},
  {role:'teacher',count:60,width:3840,height:2160,dpr:2},
];
const results=[];
try {
 for(const config of cases) {
  const context=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.dpr});
  const page=await context.newPage(),errors=[];
  // The pinned renderer can block the browser for >30s on a distinct 4x-CPU roster.
  page.setDefaultTimeout(180000);
  page.on('pageerror',error=>{errors.push(error.message);console.error('C08_PAGE_ERROR',error.message);});
  page.on('console',message=>{if(message.type()==='error')console.error('C08_CONSOLE_ERROR',message.text());});
  page.on('response',response=>{if(response.status()>=400)console.log('C08_HTTP',response.status(),response.url());});
  page.on('requestfailed',request=>console.log('C08_REQUEST_FAILED',request.url(),request.failure()));
  await page.addInitScript(({studentId})=>{
    localStorage.setItem('studentId',studentId);localStorage.setItem('sessionId','ABC234');
    window.c08={sockets:[],sent:[],renders:{HostFight:0,Combat:0,CombatBoard:0,StaticAvatar:0}};
    window.WebSocket=class {static OPEN=1;readyState=1;constructor(url){this.url=url;window.c08.sockets.push(this);setTimeout(()=>this.onopen?.(),0);}send(s){window.c08.sent.push(JSON.parse(s));}close(){this.readyState=3;}};
  },{studentId:student().id});
  // Count actual component function executions in Vite's test build, without
  // adding instrumentation or counters to shipped application modules.
  await page.route(/\/src\/(pages\/(HostFight|Combat)|components\/(CombatBoard|StaticAvatar))\.tsx(?:\?.*)?$/,async route=>{
    const response=await route.fetch(),source=await response.text();
    const name=new URL(route.request().url()).pathname.split('/').at(-1).replace('.tsx','');
    const pattern=new RegExp(`(function ${name}\\d*\\([\\s\\S]*?\\)\\s*\\{)`);
    assert.ok(pattern.test(source),`instrumentation anchor for ${name}`);
    await route.fulfill({response,body:source.replace(pattern,`$1 window.c08.renders.${name}++;`)});
  });
  await page.route('**/api/teacher/check-session',route=>route.fulfill({json:{id:fight.teacherId,email:'fixture@example.test',guildCode:'FIXTURE'}}));
  await page.route(`**/api/fights/${fight.id}`,route=>route.fulfill({json:fight}));
  await page.route(`**/api/fights/${fight.id}/host-guilds`,route=>route.fulfill({json:[]}));
  await page.route(`**/api/fights/${fight.id}/sessions`,route=>route.fulfill({json:{sessionId:'ABC234'}}));
  await page.route('**/api/student/**/stamina',route=>route.fulfill({json:{completedCombats:0,xpMultiplier:1,resetsAt:Date.now()+3600000,timeZone:'America/Denver'}}));
  await page.goto(origin+(config.role==='teacher'?`/teacher/host/${fight.id}`:'/student/combat'));
  try {await page.waitForFunction(()=>window.c08.sockets.some(s=>s.url.includes('sessionId=ABC234')&&typeof s.onmessage==='function'));}
  catch(error){console.error('C08_INIT_FAILURE',JSON.stringify({config,errors,body:await page.locator('body').innerText()}));throw error;}
  const state=started(),template=structuredClone(state.players[student().id]);state.players={};
  for(let i=0;i<config.count;i++){
    const id=i===0?student().id:`fixture-${i}`,f=avatarFixture(i);
    state.players[id]={...structuredClone(template),studentId:id,nickname:`Player ${i}`,characterClass:f.job,appearance:f.appearance,equipmentLoadout:f.loadout,hasAnswered:true,ready:true};
  }
  state.currentPhase='actions';state.questionStartTime=null;state.phaseDeadline=Date.now()+120000;
  const emit=async(question=null)=>{
    state.revision++;
    await page.evaluate(({state,question})=>window.c08.sockets.filter(s=>s.url.includes('sessionId=ABC234')).at(-1).onmessage({data:JSON.stringify({type:'combat_state',state,question,serverTime:Date.now()})}),{state,question});
  };
  const cdp=await context.newCDPSession(page);
  // A controlled CPU slowdown is an emulation, not a physical Chromebook result.
  const cpuRate=config.role==='teacher'&&config.count===30?4:1;
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
  const coldStart=performance.now();await emit();
  const roster=page.locator('.battle-roster summary');
  try {await roster.waitFor();}
  catch(error){console.error('C08_ROSTER_FAILURE',JSON.stringify({config,errors,body:await page.locator('body').innerText(),debug:await page.evaluate(()=>window.c08)}));throw error;}
  const clickStart=performance.now();await roster.click({timeout:120000});
  const coldRosterClickMs=Math.round(performance.now()-clickStart);
  const waitForAvatars=()=>page.waitForFunction(count=>{
    const canvases=[...document.querySelectorAll('[data-testid="static-avatar"] canvas')];
    return canvases.length===count&&canvases.every(c=>c.dataset.avatarReady==='true'||c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height*.6),1,1).data[3]>0);
  },config.count,{timeout:180000});
  await waitForAvatars();const coldReadyMs=Math.round(performance.now()-coldStart);
  await roster.click();
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  const backing=await page.locator('[data-testid="static-avatar"] canvas').evaluateAll(canvases=>({
    bytes:canvases.reduce((sum,c)=>sum+c.width*c.height*4,0),
    dimensions:canvases.map(c=>({width:c.width,height:c.height,cssWidth:c.getBoundingClientRect().width,cssHeight:c.getBoundingClientRect().height})),
  }));
  const baselineBytes=config.count*1200*1950*4,reduction=1-backing.bytes/baselineBytes;
  if(optimized)assert.ok(reduction>=.8,`backing reduction ${reduction}`);
  await page.screenshot({path:`${output}/${config.role}-${config.count}-${config.width}-dpr${config.dpr}.png`});
  await page.clock.install();
  // Refresh deadlines against the controlled browser clock, including its offset.
  const time=await page.evaluate(()=>Date.now());state.phaseDeadline=time+35000;await emit();
  const secondsBefore=await page.locator('[aria-label$="seconds remaining"]').first().textContent();
  const before=await page.evaluate(()=>({...window.c08.renders}));
  await page.clock.runFor(10200);
  const after=await page.evaluate(()=>({...window.c08.renders}));
  const deltas=Object.fromEntries(Object.keys(before).map(key=>[key,after[key]-before[key]]));
  const secondsAfter=await page.locator('[aria-label$="seconds remaining"]').first().textContent();
  assert.ok(parseInt(secondsAfter)<parseInt(secondsBefore)-8,'countdown advances');
  if(optimized){assert.equal(deltas[config.role==='teacher'?'HostFight':'Combat'],0);assert.equal(deltas.CombatBoard,0);assert.equal(deltas.StaticAvatar,0);}
  else assert.ok(deltas[config.role==='teacher'?'HostFight':'Combat']>=35,'baseline reproduces broad quarter-second updates');
  if(optimized){
    state.currentPhase='question';state.questionStartTime=time-1000;state.phaseDeadline=time+60000;
    for(const p of Object.values(state.players)){p.ready=false;p.hasAnswered=false;}
    await emit({id:'q1',question:'<p>Enter 2 + 2.</p>',type:'short_answer',timeLimit:60});
    const renders=await page.evaluate(()=>window.c08.renders.CombatBoard);
    if(config.role==='teacher'){
      await page.getByRole('button',{name:'Hide question',exact:true}).click();
      await page.getByRole('button',{name:'Show question',exact:true}).click();
    } else {
      const answer=page.locator('[data-testid="combat-overlay"] input').first();
      await answer.fill('4');assert.equal(await answer.inputValue(),'4');
    }
    assert.equal(await page.evaluate(()=>window.c08.renders.CombatBoard),renders,'unrelated parent state leaves the battlefield stable');
    // Native ResizeObserver must resize backing stores after a viewport change.
    await page.clock.resume();
    await page.setViewportSize({width:config.width===390?768:900,height:900});
    await waitForAvatars();
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="static-avatar"] canvas')].every(c=>{
      const box=c.parentElement.getBoundingClientRect(),target=Math.min(box.width/1200,box.height/1950)*devicePixelRatio;
      return c.dataset.avatarReady==='true'&&c.width>=Math.min(1200,1200*target)-1&&c.width<=Math.min(1200,1200*target+9);
    }));
    const resized=await page.locator('[data-testid="static-avatar"] canvas').evaluateAll(cs=>cs.map(c=>({w:c.width,h:c.height,box:c.parentElement.getBoundingClientRect().toJSON(),dpr:devicePixelRatio})));
    for(const c of resized){const target=Math.min(c.box.width/1200,c.box.height/1950)*c.dpr;assert.ok(c.w>=Math.min(1200,1200*target)-1);assert.ok(c.w<=Math.min(1200,1200*target+9));}
  }
  assert.deepEqual(errors,[]);
  const result={...config,cpuRate,coldRosterClickMs,coldReadyMs,backingBytes:backing.bytes,baselineBytes,reductionPercent:Number((reduction*100).toFixed(3)),timerWindowMs:10200,renderDeltas:deltas,secondsBefore,secondsAfter};
  results.push(result);console.log('C08_CASE '+JSON.stringify({label,...result}));
  await context.close();
 }
 await writeFile(`${output}/measurements.json`,JSON.stringify({label,limits:'Fixture API/WebSockets; Chromium viewport/DPR and one 4x CPU case. Visible canvas backing bytes, not total process/GPU memory. One cold interaction per fixture, not physical Chromebook certification.',results},null,2)+'\n');
} finally {await browser.close();}
