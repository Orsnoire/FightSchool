import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverAnchor } from './ui/popover';
import { compareEquipment, type ComparisonItem, type ComparisonLoadout } from '@shared/equipment-comparison';
import { SLOT_LABELS } from '@shared/equipment-slots';

export function GearComparison({item,context,children,disabled=false}:{item:ComparisonItem;context:ComparisonLoadout;children?:ReactNode;disabled?:boolean}) {
 const panelId=useId();
 const [open,setOpen]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>>();
 const enter=()=>{clearTimeout(timer.current);setOpen(true);};
 const leave=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>setOpen(false),180);};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const result=compareEquipment(item,context);
 return <Popover open={open && !disabled} onOpenChange={setOpen}>
  <PopoverAnchor asChild><div className="min-w-0" onPointerEnter={e=>{if(e.pointerType!=='touch')enter();}} onPointerLeave={leave}>
   {children}
   <button aria-haspopup="dialog" aria-expanded={open && !disabled} aria-controls={open ? panelId : undefined} type="button" disabled={disabled} className="text-sm underline underline-offset-4 p-2 rounded focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Compare ${item.name}`} onFocus={enter} onClick={e=>{e.stopPropagation();enter();}}>Compare</button>
  </div></PopoverAnchor>
  <PopoverContent side="right" align="start" collisionPadding={16} id={panelId} aria-label={`Comparison for ${item.name}`} className="w-[min(24rem,calc(100vw-2rem))] max-h-[70vh] overflow-auto space-y-3 z-[100]" onOpenAutoFocus={e=>e.preventDefault()} onCloseAutoFocus={e=>e.preventDefault()} onPointerEnter={enter} onPointerLeave={leave} onClick={e=>e.stopPropagation()}>
   <div className="flex justify-between gap-3"><p className="font-semibold">{item.name} · {SLOT_LABELS[item.slot]}</p><button type="button" aria-label="Close comparison" className="text-sm underline shrink-0" onClick={()=>setOpen(false)}>Close</button></div>
   {'unavailable' in result ? <p role="status">{result.unavailable}</p> : <>
    <p className="text-sm">Equipped: {result.current?.name || 'Nothing (empty slot)'}</p>
    {result.equipped && <p className="text-sm">Already equipped.</p>}
    {result.blocker && <p className="text-sm font-medium">Cannot equip now: {result.blocker}</p>}
    {result.removedOffhand && <p className="text-sm">Requires removing {result.removedOffhand.name}. Totals below include losing its bonuses; this does not unequip it.</p>}
    {result.rows.length ? <table className="w-full text-sm text-right"><caption className="text-left text-xs mb-2">Equipment bonuses only{result.removedOffhand ? ' — weapon and off hand combined' : ''}</caption><thead><tr><th className="text-left">Stat</th><th>Current</th><th>After</th><th>Change</th></tr></thead><tbody>{result.rows.map(row=><tr key={row.stat}><th className="text-left font-normal">{row.stat}</th><td>{row.before}</td><td>{row.after}</td><td className={row.delta>0?'text-green-600 dark:text-green-400':row.delta<0?'text-red-600 dark:text-red-400':''}>{row.delta>0?'+':''}{row.delta}</td></tr>)}</tbody></table>:<p className="text-sm">No numerical stat changes.</p>}
    {result.gainedEffect && <p className="text-sm">Gain effect: {result.gainedEffect}</p>}
    {result.lostEffects.map(effect=><p key={effect} className="text-sm">Lose effect: {effect}</p>)}
    <p className="text-xs text-muted-foreground">Preview only. Claiming loot adds it to inventory; it does not equip it.</p>
   </>}
  </PopoverContent>
 </Popover>;
}
