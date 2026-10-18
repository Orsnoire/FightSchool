import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { avatarFixture } from '../support/avatar-rendering-fixture';
import { avatarSurface } from '../../shared/avatar/render-budget';

test('avatar observes size/DPR, ignores equivalent props and rejects stale draws after change/unmount',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.example/'});
  const keys=['window','document','ResizeObserver','IS_REACT_ACT_ENVIRONMENT','__avatarRequests'];
  const saved=keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)] as const);
  const requests:any[]=[],observers:any[]=[],media=new Set<()=>void>(),draws:any[]=[];
  let width=72,height=72;
  class Observer {constructor(readonly callback:()=>void){observers.push(this);}observe(){}disconnect(){observers.splice(observers.indexOf(this),1);}}
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,ResizeObserver:Observer,IS_REACT_ACT_ENVIRONMENT:true,__avatarRequests:requests});
  dom.window.matchMedia=(()=>({addEventListener:(_type:string,fn:()=>void)=>media.add(fn),removeEventListener:(_type:string,fn:()=>void)=>media.delete(fn)})) as any;
  dom.window.HTMLElement.prototype.getBoundingClientRect=(()=>({width,height,x:0,y:0,left:0,top:0,right:width,bottom:height,toJSON(){}})) as any;
  dom.window.HTMLCanvasElement.prototype.getContext=(()=>({clearRect(){},drawImage(source:any){draws.push(source);}})) as any;
  const dir=await mkdtemp(join(process.cwd(),'.c08-avatar-ui-')),root=createRoot(document.getElementById('root')!);
  try {
    const outfile=join(dir,'avatar.mjs');
    await build({entryPoints:['client/src/components/StaticAvatar.tsx'],outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',loader:{'.png':'empty'},plugins:[{name:'deferred-composition',setup(build){
      build.onResolve({filter:/avatar\/static-renderer$/},()=>({path:'renderer',namespace:'fixture'}));
      build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export function composeStaticAvatar(...args){return new Promise((resolve,reject)=>globalThis.__avatarRequests.push({args,resolve,reject}));}',loader:'js'}));
    }}]});
    const {StaticAvatar}=await import(pathToFileURL(outfile).href),f=avatarFixture(0);
    const render=async(props:any)=>act(async()=>root.render(createElement(StaticAvatar,props)));
    await render(f);assert.equal(requests.length,1);
    const canvas=()=>document.querySelector('canvas')!;
    assert.equal(canvas().width,48);assert.equal(canvas().height,78);
    await render({...f,appearance:{...f.appearance},loadout:{...f.loadout}});
    assert.equal(requests.length,1,'equivalent decoded DTOs do not request composition again');
    width=height=144;await act(async()=>observers[0].callback());assert.equal(requests.length,2);
    const changed=avatarFixture(1);await render(changed);assert.equal(requests.length,3);
    await act(async()=>{requests[0].resolve('old-size');requests[1].resolve('old-appearance');});assert.deepEqual(draws,[]);
    await act(async()=>requests[2].resolve('current'));assert.deepEqual(draws,['current']);assert.equal(canvas().dataset.avatarReady,'true');
    Object.defineProperty(dom.window,'devicePixelRatio',{configurable:true,value:2});
    await act(async()=>{for(const fn of [...media])fn();});
    const next=avatarSurface(width,height,2)!;assert.equal(canvas().width,next.width);assert.equal(canvas().height,next.height);
    await act(async()=>requests[3].reject(new Error('asset unavailable')));
    assert.match(document.querySelector('[role="alert"]')?.textContent || '',/could not load/);
    await render(f);assert.equal(document.querySelector('[role="alert"]'),null);
    const latest=requests.at(-1);
    await act(async()=>root.unmount());assert.equal(observers.length,0);assert.equal(media.size,0);
    await act(async()=>latest.resolve('after-unmount'));assert.deepEqual(draws,['current']);
  } finally {
    await act(async()=>root.unmount());dom.window.close();await rm(dir,{recursive:true,force:true});
    for(const [k,d] of saved){if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
  }
});
