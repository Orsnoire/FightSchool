import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ALL_CHARACTER_CLASSES } from '../../shared/schema.ts';
import { fight } from '../phase4/fixtures.ts';
const origin=process.env.UI_ORIGIN||'http://127.0.0.1:4173';
const guild={id:'00000000-0000-4000-8000-000000000040',teacherId:fight.teacherId,name:'Roster review',code:'ROSTER',level:1};
const id='00000000-0000-4000-8000-000000000030';
const now=Date.now();
const member={studentId:id,nickname:'Scholar',joinedAt:now,jobLevels:Object.fromEntries(ALL_CHARACTER_CLASSES.map(job=>[job,job==='wizard'?7:0])),totalAAsEarned:10,weeklyActiveHours:1.25,activityTrackedSince:now-86400000,activityHistoryPartial:true,dailyAccuracy:20,dailyCorrect:2,dailyAttempts:10,dailyFights:2,dailyLegacyFights:0};
await mkdir('artifacts/combat-ui',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try {
  for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
    const page=await browser.newPage({viewport});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    let failing=false,empty=false;
    const pulses=[];
    await page.addInitScript(({id,teacherId})=>{localStorage.setItem('studentId',id);localStorage.setItem('teacherId',teacherId);},{id,teacherId:fight.teacherId});
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path.endsWith('/activity')) {pulses.push(route.request().postDataJSON());return route.fulfill({json:{recorded:true}});}
      if(path.endsWith('/roster')) return route.fulfill({status:failing?503:200,json:failing?{error:'Unavailable'}:empty?[]:[member,{...member,studentId:id.slice(0,-1)+'1',nickname:'New player',weeklyActiveHours:null,activityTrackedSince:null,dailyAccuracy:null,dailyCorrect:0,dailyAttempts:0,dailyFights:0}]});
      return route.fulfill({json:path===`/api/guilds/${guild.id}`?guild:[]});
    });
    await page.goto(`${origin}/teacher/guild/${guild.id}?tab=members`);
    const card=page.getByTestId(`member-${id}`);
    await card.getByText('1.25 h',{exact:true}).waitFor();
    await card.getByText('20.0%',{exact:true}).waitFor();
    assert.equal(await card.locator('dl').last().locator('dd').count(),12);
    assert.equal(await card.locator('dl').last().locator('dd').filter({hasText:/^0$/}).count(),11);
    await page.getByText('Not recorded',{exact:true}).waitFor();
    await page.getByText('No fights',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`artifacts/combat-ui/${viewport.width}-teacher-roster.png`,fullPage:true});
    failing=true;
    await page.getByRole('button',{name:'Refresh roster'}).click();
    await page.getByRole('alert').filter({hasText:'Could not refresh roster'}).waitFor();
    await card.getByText('1.25 h',{exact:true}).waitFor(); // Stale data remains labeled.
    failing=false;empty=true;
    await page.getByRole('button',{name:'Refresh roster'}).click();
    await page.getByText('No members yet.',{exact:false}).waitFor();
    assert.equal(pulses.length,0,'teacher pages must not collect student activity');
    // Use a simple student page to exercise the actual app-level tracker with virtual time.
    await page.clock.install();
    await page.goto(`${origin}/student/guilds/${guild.id}/roster`);
    await page.waitForFunction(()=>!!document.querySelector('[data-testid="text-page-title"]'));
    await page.waitForTimeout(100);
    assert.equal(pulses.filter(p=>p.active).length,0);
    await page.clock.runFor(30_000);
    await page.waitForTimeout(50);
    assert.equal(pulses.filter(p=>p.active).length,1);
    await page.clock.runFor(120_000);
    await page.waitForTimeout(50);
    const idleCount=pulses.filter(p=>p.active).length;
    await page.clock.runFor(60_000);
    assert.equal(pulses.filter(p=>p.active).length,idleCount);
    await page.mouse.click(10,200);
    await page.clock.runFor(60_000);
    await page.waitForTimeout(50);
    assert.ok(pulses.filter(p=>p.active).length>idleCount);
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    const hiddenCount=pulses.filter(p=>p.active).length;
    await page.clock.runFor(90_000);
    assert.equal(pulses.filter(p=>p.active).length,hiddenCount);
    assert.deepEqual(errors,[]);
    await page.close();
  }
} finally {await browser.close();}
console.log('Teacher roster desktop/phone, errors/retry and activity visibility/idle checks passed');
