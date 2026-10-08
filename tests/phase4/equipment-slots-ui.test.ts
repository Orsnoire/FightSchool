import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getStartingEquipment, EQUIPMENT_ITEMS } from '../../shared/schema.ts';
import { EQUIPMENT_SLOTS, SLOT_LABELS, STARTER_ITEM_IDS } from '../../shared/equipment-catalog.ts';

test('equipment screen renders eight labeled controls and Tier 0 starters, including separate arms and hands', async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:{getItem:()=>'student'}});
  const dir = await mkdtemp(join(process.cwd(), '.equipment-ui-test-'));
  const cache = new QueryClient({defaultOptions:{queries:{staleTime:Infinity,gcTime:Infinity,retry:false}}});
  const loadout = getStartingEquipment('warrior');
  const ids = EQUIPMENT_SLOTS.map(slot => loadout[slot]).filter(Boolean) as string[];
  const metadata = (keys:string[]) => keys.map(id => ({...EQUIPMENT_ITEMS[id],quality:'common'}));
  cache.setQueryData(['/api/student/student'], {id:'student',characterClass:'warrior',...loadout,inventory:STARTER_ITEM_IDS});
  cache.setQueryData(['/api/student/student/job-levels'], [{jobClass:'warrior',level:1}]);
  cache.setQueryData(['equipment-items',{ids:[...ids].sort()}], metadata(ids));
  cache.setQueryData(['equipment-items',{ids:[...STARTER_ITEM_IDS].sort()}], metadata(STARTER_ITEM_IDS));
  try {
    const outfile = join(dir,'equipment.mjs');
    await build({entryPoints:['client/src/pages/StudentEquipment.tsx'],outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
    const {default:Equipment} = await import(pathToFileURL(outfile).href);
    const dom = new JSDOM(renderToStaticMarkup(createElement(QueryClientProvider,{client:cache},createElement(Equipment))));
    const card = dom.window.document.querySelector('[data-testid="card-equipment"]')!;
    assert.equal(card.querySelectorAll('[role="combobox"]').length,8);
    for (const slot of EQUIPMENT_SLOTS) {
      assert.equal(card.querySelector(`label[for="equipment-${slot}"]`)?.textContent,SLOT_LABELS[slot]);
      assert.ok(card.querySelector(`[data-testid="select-${slot}"]`));
    }
    assert.match(card.textContent!,/Starter Vambraces · Tier 0/);
    assert.match(card.textContent!,/Starter Gauntlets · Tier 0/);
    assert.match(card.textContent!,/Starter Plate Leggings · Tier 0/);
    dom.window.close();
  } finally {
    cache.clear();
    if(previousStorage) Object.defineProperty(globalThis,'localStorage',previousStorage); else delete (globalThis as any).localStorage;
    await rm(dir,{recursive:true,force:true});
  }
});

test('mounted loadout screen follows saves for the same student without a reload', async () => {
  const dom=new JSDOM('<div id="root"></div>',{url:'https://qa.example'});
  const keys=['window','document','navigator','localStorage','IS_REACT_ACT_ENVIRONMENT'];
  const saved=keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  for(const key of keys)Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:(dom.window as any)[key]});
  localStorage.setItem('studentId','student');
  const dir=await mkdtemp(join(process.cwd(),'.equipment-sync-ui-'));
  const cache=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,gcTime:Infinity,retry:false,queryFn:async({queryKey})=>cache.getQueryData(queryKey)}}});
  const {act}=await import('react');
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('root')!);
  let current:any={id:'student',characterClass:'warrior',...getStartingEquipment('warrior'),inventory:STARTER_ITEM_IDS};
  cache.setQueryData(['/api/student/student'],current);
  cache.setQueryData(['/api/student/student/job-levels'],[{jobClass:'warrior',level:1}]);
  const metadata=(ids:string[])=>ids.map(id=>({...EQUIPMENT_ITEMS[id],quality:'common'}));
  cache.setQueryData(['equipment-items',{ids:[...STARTER_ITEM_IDS].sort()}],metadata(STARTER_ITEM_IDS));
  const putEquipped=()=>{const ids=EQUIPMENT_SLOTS.map(slot=>current[slot]).filter(Boolean).sort();cache.setQueryData(['equipment-items',{ids}],metadata(ids));};
  putEquipped();
  try {
    const outfile=join(dir,'equipment.mjs');
    await build({entryPoints:['client/src/pages/StudentEquipment.tsx'],outfile,bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external'});
    const {default:Equipment}=await import(pathToFileURL(outfile).href);
    await act(async()=>root.render(createElement(QueryClientProvider,{client:cache},createElement(Equipment))));
    assert.match(document.body.textContent!,/Starter Vambraces/);
    await act(async()=>{
      current={...current,characterClass:'priest',...getStartingEquipment('priest')};
      putEquipped();
      cache.setQueryData(['/api/student/student'],current);
      cache.setQueryData(['/api/student/student/job-levels'],[{jobClass:'priest',level:4}]);
    });
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
    assert.match(document.body.textContent!,/Starter Sleeves · Tier 0/);
    assert.match(document.body.textContent!,/Starter Linen Pants · Tier 0/);
    assert.doesNotMatch(document.querySelector('[data-testid="card-equipment"]')!.textContent!,/Starter Vambraces/);
  }finally{
    await act(async()=>root.unmount());cache.clear();dom.window.close();
    for(const [key,value] of saved)if(value)Object.defineProperty(globalThis,key,value);else delete (globalThis as any)[key];
    await rm(dir,{recursive:true,force:true});
  }
});
