import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { started } from './fixtures';

test('countdowns tick without rerendering transport, preserve server offsets/intro boundaries and clean up',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.example/combat'});
  const keys=['window','document','location','WebSocket','IS_REACT_ACT_ENVIRONMENT','setInterval','clearInterval','setTimeout','clearTimeout'];
  const saved=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)] as const);
  let now=100000,id=0,pageRenders=0,countdownRenders=0,current:any,intro=false;
  const oldNow=Date.now,intervals=new Map<number,()=>void>(),timeouts=new Map<number,{at:number;fn:()=>void}>(),sockets:any[]=[];
  class Socket { static OPEN=1;readyState=1;onmessage?:any;onopen?:any;onclose?:any;sent:any[]=[];constructor(){sockets.push(this);}send(s:string){this.sent.push(JSON.parse(s));}close(){} }
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,WebSocket:Socket,IS_REACT_ACT_ENVIRONMENT:true,
    setInterval:(fn:()=>void)=>{intervals.set(++id,fn);return id;},clearInterval:(i:number)=>intervals.delete(i),
    setTimeout:(fn:()=>void,ms:number)=>{timeouts.set(++id,{at:now+ms,fn});return id;},clearTimeout:(i:number)=>timeouts.delete(i)});
  Date.now=()=>now;
  const dir=await mkdtemp(join(process.cwd(),'.c08-clock-')),root=createRoot(document.getElementById('root')!);
  try {
    const outfile=join(dir,'hooks.mjs');
    await build({stdin:{contents:'export {useCombatSession} from "./client/src/hooks/useCombatSession"; export {useCombatCountdown,useBeforeCombatDeadline} from "./client/src/hooks/useCombatCountdown";',resolveDir:process.cwd(),loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',packages:'external'});
    const {useCombatSession,useCombatCountdown,useBeforeCombatDeadline}=await import(pathToFileURL(outfile).href);
    function Clock({deadline,offset}:any){countdownRenders++;return createElement('span',null,useCombatCountdown(deadline,offset));}
    function Page({session}:any){pageRenders++;current=useCombatSession(session,'student');intro=useBeforeCombatDeadline(current.state?.currentPhase==='question'?current.state.questionStartTime:null,current.clockOffset);return createElement(Clock,{deadline:current.state?.phaseDeadline,offset:current.clockOffset});}
    const advance=async(ms:number)=>{now+=ms;await act(async()=>{for(const fn of [...intervals.values()])fn();for(const [i,t] of [...timeouts])if(t.at<=now){timeouts.delete(i);t.fn();}});};
    await act(async()=>root.render(createElement(Page,{session:'ABC234'})));
    const state=started();state.phaseDeadline=now+5000+10000;state.questionStartTime=now+5000+2000;
    await act(async()=>sockets[0].onmessage({data:JSON.stringify({type:'combat_state',state,question:null,serverTime:now+5000})}));
    assert.equal(document.querySelector('span')?.textContent,'10');assert.equal(intro,true);
    const initialRenders=pageRenders;
    await advance(1000);assert.equal(document.querySelector('span')?.textContent,'9');assert.equal(pageRenders,initialRenders);
    await advance(1001);assert.equal(intro,false);assert.equal(pageRenders,initialRenders+1);
    const stableRenders=pageRenders;
    await advance(1000);assert.equal(document.querySelector('span')?.textContent,'7');assert.equal(pageRenders,stableRenders);
    const childRenders=countdownRenders;await advance(100);assert.equal(countdownRenders,childRenders,'unchanged displayed second does not render');
    const newer=structuredClone(state);newer.revision++;newer.phaseDeadline=now+7000+20000;
    await act(async()=>sockets[0].onmessage({data:JSON.stringify({type:'combat_state',state:newer,question:null,serverTime:now+7000})}));
    assert.equal(document.querySelector('span')?.textContent,'20');assert.equal(current.clockOffset,7000);
    await act(async()=>sockets[0].onmessage({data:JSON.stringify({type:'combat_state',state,question:null,serverTime:now-99999})}));
    assert.equal(current.clockOffset,7000,'stale snapshot cannot move the clock');
    await advance(25000);assert.equal(document.querySelector('span')?.textContent,'0');assert.equal(intervals.size,0);
    newer.revision++;newer.phaseDeadline=null;newer.currentPhase='enemy_ai';
    await act(async()=>sockets[0].onmessage({data:JSON.stringify({type:'combat_state',state:newer,question:null})}));
    assert.equal(intervals.size,0,'completion-driven resolution has no ticking clock');
    await act(async()=>root.render(createElement(Page,{session:'OTHER1'})));
    assert.equal(current.clockOffset,0);assert.equal(current.state,null);
    await act(async()=>root.unmount());assert.equal(intervals.size,0);assert.equal(timeouts.size,0);
  } finally {
    await act(async()=>root.unmount());Date.now=oldNow;
    for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
    dom.window.close();await rm(dir,{recursive:true,force:true});
  }
});
