import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

test('roster stats distinguish missing, partial, zero and scored data; tracker follows actual DOM visibility and input', async () => {
  const dir=await mkdtemp(join(process.cwd(),'.roster-ui-test-'));
  const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.example/student/guilds'});
  const keys=['window','document','navigator','location','history','localStorage','addEventListener','removeEventListener','dispatchEvent','fetch','performance','IS_REACT_ACT_ENVIRONMENT'];
  const saved=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  let now=0;
  for(const key of keys) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:key==='performance'?{now:()=>now}:['addEventListener','removeEventListener','dispatchEvent'].includes(key)?(dom.window as any)[key].bind(dom.window):(dom.window as any)[key]});
  try {
    const outfile=join(dir,'ui.mjs');
    await build({stdin:{contents:'export {TeacherRosterStats} from "./client/src/components/TeacherRosterStats"; export {PlayerActivityTracker} from "./client/src/features/activity/PlayerActivityTracker";',resolveDir:process.cwd(),loader:'tsx'},outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
    const {TeacherRosterStats,PlayerActivityTracker}=await import(pathToFileURL(outfile).href);
    const {createElement,act}=await import('react');
    const {renderToStaticMarkup}=await import('react-dom/server');
    const {createRoot}=await import('react-dom/client');
    const member={studentId:'00000000-0000-4000-8000-000000000030',totalAAsEarned:10,weeklyActiveHours:null,activityHistoryPartial:true,activityTrackedSince:null,dailyAccuracy:null,dailyFights:0,dailyLegacyFights:0};
    const render=(changes={})=>renderToStaticMarkup(createElement(TeacherRosterStats,{member:{...member,...changes}}));
    assert.match(render(),/Not recorded/);assert.match(render(),/No fights/);assert.doesNotMatch(render(),/0\.0%/);
    assert.match(render({weeklyActiveHours:0,activityTrackedSince:1}),/0\.00 h/);
    assert.match(render({weeklyActiveHours:1.25,activityTrackedSince:1}),/Partial history/);
    assert.match(render({dailyAccuracy:0,dailyAttempts:3,dailyCorrect:0,dailyFights:1}),/0\.0%/);
    assert.match(render({dailyAccuracy:20,dailyAttempts:10,dailyCorrect:2,dailyFights:2}),/20\.0%/);
    assert.match(render({dailyFights:1}),/No recorded answers/);
    assert.match(render({dailyLegacyFights:1}),/Older results may omit unanswered/);
    const pulses:any[]=[];
    globalThis.fetch=async (_url,init)=>{pulses.push(JSON.parse(String(init?.body)));assert.equal(init?.credentials,'include');return Response.json({recorded:true});};
    let tick: (()=>void)|undefined;
    window.setInterval=((fn:()=>void)=>{tick=fn;return 1;}) as any;
    window.clearInterval=(()=>{tick=undefined;}) as any;
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
    localStorage.setItem('studentId',member.studentId);
    const root=createRoot(document.getElementById('root')!);
    const advance=async (time:number)=>{now=time;await act(async()=>tick?.());};
    try {
      await act(async()=>root.render(createElement(PlayerActivityTracker)));
      assert.equal(pulses.length,1);assert.equal(pulses[0].active,false);
      await advance(30_000); assert.equal(pulses.filter(p=>p.active).length,1);
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
      document.dispatchEvent(new dom.window.Event('visibilitychange'));
      await advance(60_000); assert.equal(pulses.length,2);
      Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
      document.dispatchEvent(new dom.window.Event('visibilitychange'));
      await advance(90_000); assert.equal(pulses.length,3);
      await advance(120_000);await advance(150_000);await advance(180_000);
      const idle=pulses.length;await advance(210_000);assert.equal(pulses.length,idle);
      window.dispatchEvent(new dom.window.Event('keydown'));
      await advance(240_000);assert.equal(pulses.length,idle+1);
      localStorage.removeItem('studentId');await advance(270_000);assert.equal(pulses.length,idle+1);
    } finally {await act(async()=>root.unmount());}
    assert.equal(tick,undefined);
  } finally {
    dom.window.close();
    for(const [key,value] of saved) value?Object.defineProperty(globalThis,key,value):Reflect.deleteProperty(globalThis,key);
    await rm(dir,{recursive:true,force:true});
  }
});
