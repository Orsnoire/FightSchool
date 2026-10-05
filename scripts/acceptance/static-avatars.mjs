// Local browser acceptance. Set PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE when using a supplied runtime.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'vite';
const server=process.env.APP_ORIGIN?null:await createServer({server:{host:'127.0.0.1',port:4173,strictPort:true}});
await server?.listen();
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
const output='artifacts/static-avatar-review';mkdirSync(output,{recursive:true});
const page=await browser.newPage({viewport:{width:1280,height:1050}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(pathToFileURL(resolve('workshop/site/previews/static-starters-01.html')).href);
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready for review');
 const values=await page.evaluate(()=>Object.fromEntries(['hair','eyes','skin'].map(id=>[id,document.querySelector('#'+id).options[7].value])));
 for(const [id,value] of Object.entries(values))await page.selectOption('#'+id,value);
 for(const model of ['human-male-v1','human-female-v1']) {
  await page.selectOption('#model',model);
  for(const job of ['warrior','wizard','herbalist','scout','warrior']) {
   await page.selectOption('#job',job);
   await page.waitForFunction(({model,job,values})=>{
    const c=document.querySelector('#avatar');if(c.dataset.job!==job)return false;
    const a=JSON.parse(c.dataset.appearance);return a.modelId===model&&a.hairColorId===values.hair&&a.eyeColorId===values.eyes&&a.skinColorId===values.skin;
   },{model,job,values});
   for(const [id,value] of Object.entries(values))assert.equal(await page.inputValue('#'+id),value);
  }
 }
 await page.selectOption('#job','herbalist');
 await page.waitForFunction(()=>document.querySelector('#avatar').dataset.job==='herbalist');
 await page.screenshot({path:`${output}/workshop-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`${output}/workshop-mobile.png`,fullPage:true});
 const id='00000000-0000-4000-8000-000000000001';
 let saved=null,student={id,nickname:'Preview Student',characterClass:'warrior',gender:'A',inventory:[],gold:0,weapon:'basic_sword',headgear:'basic_helm',armor:'basic_armor',offhand:'basic_shield',hands:null,legs:null,feet:null};
 const saves=[];
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,body=request.postDataJSON();
  let json=[];
  if(path===`/api/student/${id}/avatar`) {if(request.method()!=='GET'){saved=body;saves.push(body);}json=saved;}
  else if(path===`/api/student/${id}/character`) {student={...student,...body};json=student;}
  else if(path===`/api/student/${id}`) json=student;
  else if(path.endsWith('/job-levels'))json=['warrior','wizard','herbalist','scout'].map(jobClass=>({jobClass,level:1,experience:0}));
  else if(path.endsWith('/stamina'))json={completedCombats:0,remainingAtFullRate:10,xpMultiplier:1,resetsAt:Date.now()+3600000};
  await route.fulfill({json});
 });
 await page.addInitScript(studentId=>localStorage.setItem('studentId',studentId),id);
 await page.setViewportSize({width:1280,height:1050});
 await page.goto((process.env.APP_ORIGIN||'http://127.0.0.1:4173')+'/student/character-select');
 await page.getByLabel('Job',{exact:true}).selectOption('wizard');
 await page.getByLabel('hair',{exact:true}).selectOption(values.hair);
 await page.getByLabel('skin',{exact:true}).selectOption(values.skin);
 await page.getByLabel('Job',{exact:true}).selectOption('scout');
 assert.equal(await page.getByLabel('hair',{exact:true}).inputValue(),values.hair);
 await page.waitForFunction(()=>{const c=document.querySelector('[data-testid="static-avatar"] canvas');return c&&c.getContext('2d').getImageData(600,1200,1,1).data[3]>0;});
 await page.screenshot({path:`${output}/creator.png`,fullPage:true});
 await page.getByTestId('button-confirm-character').click();
 await page.waitForURL('**/student/lobby');
 assert.equal(saves.length,1);assert.equal(saved.hairColorId,values.hair);assert.equal(student.characterClass,'scout');
 await page.getByTestId('button-open-class-modal').click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Preview job').selectOption('herbalist');
 const changed=await dialog.getByLabel('hair',{exact:true}).locator('option').first().getAttribute('value');
 await dialog.getByLabel('hair',{exact:true}).selectOption(changed);
 await dialog.getByLabel('Preview job').selectOption('warrior');
 await dialog.getByLabel('Preview job').selectOption('herbalist');
 assert.equal(await dialog.getByLabel('hair',{exact:true}).inputValue(),changed);
 await page.screenshot({path:`${output}/job-change.png`,fullPage:true});
 await dialog.getByTestId('modal-class-herbalist').click();
 await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
 assert.equal(saved.hairColorId,changed);assert.equal(student.characterClass,'herbalist');
 assert.deepEqual(errors,[]);
 writeFileSync(`${output}/browser-result.json`,JSON.stringify({passed:true,checks:['both bodies and four jobs','latest shared colors retained','desktop and phone workshop layout','real creator save','real job-change save','no browser exceptions']},null,2)+'\n');
 console.log('Static workshop, creator and job-change browser acceptance passed');
} finally {await browser.close();await server?.close();}
