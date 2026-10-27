import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { AA_CATALOG, AA_CATALOG_VERSION, aaWallet } from '../../shared/aa.ts';
import { ALL_CHARACTER_CLASSES, EQUIPMENT_ITEMS, getStartingEquipment } from '../../shared/schema.ts';
import { initialAppearance } from '../../shared/avatar/appearance.ts';
import { getCrossClassAbilities } from '../../shared/jobSystem.ts';
import { student, fight } from '../phase4/fixtures.ts';
import { addStudent, initialCombatState, startQuestion, selectAction, advancePhase } from '../../worker/combat/engine.ts';
import { projectCombatLoadout } from '../../shared/combat/loadout.ts';
import { publicSnapshot } from '../../worker/combat/public-snapshot.ts';

const origin=process.env.UI_ORIGIN || 'http://127.0.0.1:4173';
await mkdir('artifacts/combat-ui',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const errors=[];
try {
 for (const viewport of [{width:1366,height:768},{width:390,height:844}]) {
  const page=await browser.newPage({viewport}); page.on('pageerror',error=>errors.push(error.message));
  let current={...student(),...getStartingEquipment('warrior'),aaExperience:12005,aaPointsSpent:66,aaRanks:{'stat:str':2,'cross-class-slots':3},aaRevision:0,crossClassAbilities:[null,null,null,null,null]};
  let appearance=initialAppearance(null,'human-male-v1',()=>0);
  const writes=[], receipts=new Map(); let failPurchase=true,failCustomize=true;
  const summary=()=>({catalog:AA_CATALOG,catalogVersion:AA_CATALOG_VERSION,wallet:aaWallet(current.aaExperience,current.aaPointsSpent),ranks:current.aaRanks,revision:current.aaRevision,characterName:current.characterName||current.nickname,appearance});
  await page.addInitScript(id=>localStorage.setItem('studentId',id),current.id);
  await page.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
   if(path.endsWith('/advancement'))return route.fulfill({json:summary()});
   if(path.endsWith('/purchase')||path.endsWith('/customize')) {
    const body=request.postDataJSON();writes.push({path,body});
    if(receipts.has(body.requestId))return route.fulfill({json:receipts.get(body.requestId)});
    if(path.endsWith('/purchase')&&failPurchase){failPurchase=false;return route.fulfill({status:503,json:{error:'Temporary purchase failure'}});}
    if(path.endsWith('/customize')&&failCustomize){failCustomize=false;return route.fulfill({status:503,json:{error:'Temporary customization failure'}});}
    const upgrade=AA_CATALOG.find(u=>u.id===(body.upgradeId||'recustomization')),cost=upgrade.costs[(body.rank||1)-1];
    current={...current,aaPointsSpent:current.aaPointsSpent+cost,aaRevision:current.aaRevision+1};
    if(body.appearance){appearance=body.appearance;current={...current,characterName:body.characterName,gender:appearance.modelId==='human-female-v1'?'B':'A'};}
    else current.aaRanks={...current.aaRanks,[body.upgradeId]:body.rank};
    const receipt={requestId:body.requestId,upgradeId:upgrade.id,rank:body.rank||1,cost,revision:current.aaRevision};receipts.set(body.requestId,receipt);
    return route.fulfill({json:receipt});
   }
   if(path.endsWith('/equipment')&&method==='PATCH'){
    const body=request.postDataJSON();writes.push({path,body});current={...current,...body,crossClassAbility1:body.crossClassAbilities?.[0]??null,crossClassAbility2:body.crossClassAbilities?.[1]??null};return route.fulfill({json:current});
   }
   if(path===`/api/student/${current.id}`||path.endsWith('/check-session'))return route.fulfill({json:current});
   if(path.endsWith('/job-levels'))return route.fulfill({json:ALL_CHARACTER_CLASSES.map(jobClass=>({jobClass,level:15,experience:630}))});
   if(path.endsWith('/avatar'))return route.fulfill({json:appearance});
   if(path.endsWith('/guilds'))return route.fulfill({json:[{id:'fixture-guild',name:'Tier One Classroom',limitTier:1}]});
   if(path==='/api/equipment-items')return route.fulfill({json:(url.searchParams.get('ids')||'').split(',').map(id=>EQUIPMENT_ITEMS[id]).filter(Boolean)});
   if(path.endsWith('/stamina'))return route.fulfill({json:{completedCombats:0,xpMultiplier:1,resetsAt:Date.now()+60000}});
   return route.fulfill({json:[]});
  });
  await page.goto(`${origin}/student/advancement`);
  await page.getByRole('heading',{name:'Alternate Advancement'}).waitFor();
  const strength=page.getByTestId('aa-stat:str');
  assert.match(await strength.textContent(),/Owned 2\/10.*Active 1\/10/s);
  await strength.getByRole('button',{name:'All ranks & effects'}).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('dialog').locator('tbody tr').count(),10);
  assert.ok(await page.getByRole('dialog').getByText('Owned · inactive',{exact:true}).isVisible());
  await page.keyboard.press('Escape');
  await page.getByLabel('Power preview',{exact:true}).selectOption('tier:4');
  assert.match(await strength.textContent(),/Active 2\/10/);
  await page.getByLabel('AA status',{exact:true}).selectOption('owned');
  assert.equal(await page.locator('[data-testid^="aa-"]').count(),2);
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.getByLabel('Search advancements',{exact:true}).fill('Maximum HP');
  assert.equal(await page.locator('[data-testid^="aa-"]').count(),1);
  await page.getByRole('button',{name:'Buy rank 1 — 2 AA',exact:true}).click();
  await page.getByText('503: {"error":"Temporary purchase failure"}',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Buy rank 1 — 2 AA',exact:true}).click();
  await page.getByRole('button',{name:'Buy rank 2 — 3 AA',exact:true}).waitFor();
  assert.equal(writes.length,2);assert.deepEqual(writes[0].body,writes[1].body,'retry reuses the receipt key');assert.equal(current.aaPointsSpent,68);
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.getByLabel('Search advancements',{exact:true}).fill('recustomization');
  const open=page.getByRole('button',{name:'Preview changes · 5 AA',exact:true});
  await open.click();await page.getByLabel('Character name',{exact:true}).fill('Unsaved draft');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(writes.length,2);
  await open.click();assert.equal(await page.getByLabel('Character name',{exact:true}).inputValue(),current.nickname);
  await page.getByLabel('Character name',{exact:true}).fill('New hero');
  await page.getByLabel('Body model',{exact:true}).selectOption('human-female-v1');
  await page.getByRole('button',{name:'Save changes — 5 AA',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Temporary customization failure'}).waitFor();
  assert.equal(await page.getByLabel('Character name',{exact:true}).inputValue(),'New hero');
  await page.getByRole('button',{name:'Save changes — 5 AA',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(current.aaPointsSpent,73);assert.equal(current.nickname,'warrior');assert.equal(current.characterName,'New hero');assert.equal(current.gender,'B');
  assert.deepEqual(writes[2].body,writes[3].body,'paid editing retry uses the same receipt key');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.getByLabel('AA category',{exact:true}).selectOption('Primary stats');
  await page.screenshot({path:`artifacts/combat-ui/aa-${viewport.width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  await page.getByRole('link',{name:'Equipment & cross-class slots',exact:true}).click();
  await page.getByTestId('select-ability-5').waitFor();
  const ability=getCrossClassAbilities('warrior',Object.fromEntries(ALL_CHARACTER_CLASSES.map(j=>[j,15])))[4].id;
  await page.getByTestId('select-ability-5').selectOption(ability);
  await page.getByTestId('button-remove-ability-5').waitFor();
  assert.equal(current.crossClassAbilities[4],ability);
  await page.reload();await page.getByTestId('button-remove-ability-5').waitFor();
  assert.equal(await page.getByTestId('select-ability-5').inputValue(),ability);
  await page.getByRole('button',{name:'Remove ability from slot 5',exact:true}).click();
  await page.getByTestId('button-remove-ability-5').waitFor({state:'hidden'});
  assert.equal(current.crossClassAbilities[4],null);
  await page.screenshot({path:`artifacts/combat-ui/aa-slots-${viewport.width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  // Choose five different real unlocks, then navigate through the other loadout screen into combat.
  const slots=['fireball_crossclass','healing_potion_crossclass','hex_crossclass','mend_crossclass','fortify_crossclass'];
  for(let i=0;i<5;i++){
   await page.getByTestId(`select-ability-${i+1}`).selectOption(slots[i]);
   await page.getByTestId(`button-remove-ability-${i+1}`).waitFor();
  }
  const beforePreviewWrites=writes.length;
  await page.getByLabel('Ability power preview',{exact:true}).selectOption('2');
  assert.match(await page.getByTestId('ability-slot-5').textContent(),/Locked/);
  assert.equal(await page.getByTestId('select-ability-5').count(),0);
  assert.equal(current.crossClassAbilities[4],slots[4]);assert.equal(writes.length,beforePreviewWrites,'tier preview never rewrites saved selections');
  await page.getByLabel('Ability power preview',{exact:true}).selectOption('4');
  assert.deepEqual(current.crossClassAbilities,slots,'all five selections reached authoritative storage');
  await page.goto(`${origin}/student/lobby`);
  for(let i=0;i<5;i++){
   // The student and class-level requests resolve independently. An empty menu
   // before its ability options load is not the saved selection.
   await page.getByTestId(`button-remove-ability-${i+1}`).waitFor();
   assert.equal(await page.getByTestId(`select-ability-${i+1}`).inputValue(),slots[i]);
  }
  const levels=Object.fromEntries(ALL_CHARACTER_CLASSES.map(job=>[job,15]));
  const projection=projectCombatLoadout('warrior',current,15,current.aaRanks,4);
  let state=startQuestion(addStudent(initialCombatState('ABC234',fight,0),current,{levels,crossClass:slots,...projection}),100,30);
  const id=current.id;
  state.currentPhase='actions'; state.players[id].hasAnswered=true; state.players[id].lastAnswerCorrect=true;
  state.phaseDeadline=Date.now()+120000; state.enemies[0].health=state.enemies[0].maxHealth=10000;
  await page.addInitScript(()=>{
   localStorage.setItem('sessionId','ABC234');window.aaCombat={sockets:[],sent:[]};
   window.WebSocket=class{static OPEN=1;readyState=1;constructor(url){this.url=url;window.aaCombat.sockets.push(this);setTimeout(()=>this.onopen?.(),0)}send(data){window.aaCombat.sent.push(JSON.parse(data))}close(){this.readyState=3}};
  });
  await page.goto(`${origin}/student/combat`);
  await page.waitForFunction(()=>window.aaCombat.sockets.some(s=>s.url.includes('sessionId=ABC234')&&typeof s.onmessage==='function'));
  async function emit(){state.revision++;await page.evaluate(state=>window.aaCombat.sockets.filter(s=>s.url.includes('sessionId=ABC234')).at(-1).onmessage({data:JSON.stringify({type:'combat_state',state,question:null,results:[],serverTime:Date.now()})}),publicSnapshot(state));}
  await emit();
  await page.getByRole('button',{name:/^Hex /}).click();
  await page.getByRole('button',{name:'Confirm Hex & Ready',exact:true}).click();
  let command=await page.evaluate(()=>window.aaCombat.sent.filter(m=>m.type==='action').at(-1));
  assert.equal(command.ability,'hex');assert.equal(command.targetId,'e1');
  state=selectAction(state,id,command.ability,command.targetId);state=advancePhase(state,fight,Date.now());await emit();
  await page.getByRole('button',{name:/^Fortify /}).click();
  await page.getByText('Support action. Doubles VIT for this fight. Repeated uses do not stack.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Add Fortify',exact:true}).click();
  command=await page.evaluate(()=>window.aaCombat.sent.filter(m=>m.type==='action').at(-1));
  assert.equal(command.ability,'fortify');state=selectAction(state,id,command.ability,command.targetId);
  state=advancePhase(state,fight,Date.now());
  assert.ok(state.players[id].buffs.fortify,'slot 5 support executes through the real engine');
  assert.ok(state.enemies[0].effects.some(e=>e.type==='hex'),'slot 3 attack executes through the real engine');
  assert.ok(state.players[id].totals.damageDealt>0);
  await page.screenshot({path:`artifacts/combat-ui/aa-combat-${viewport.width}.png`});
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log('AA desktop/phone: wallet, ranks, tier preview, filters, keyboard details, retry receipts, paid edit/cancel and five-slot save/reload and selected slot 3/5 combat execution pass.');
} catch(error) {
 for(const page of browser.contexts().flatMap(context=>context.pages()))await page.screenshot({path:'artifacts/combat-ui/aa-failure.png',fullPage:true}).catch(()=>{});
 throw error;
} finally {await browser.close();}
