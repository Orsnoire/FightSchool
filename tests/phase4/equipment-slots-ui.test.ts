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
