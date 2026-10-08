import type { CharacterClass, EquipmentItemStats, EquipmentSlot } from './schema';
import { equipmentUnavailable, handConflict, type EquippableItem } from './equipment-rules';
import { equipmentEffectText } from './tier-one-equipment';
export type ComparisonItem = EquippableItem & {name:string;stats:EquipmentItemStats;tier?:number};
export interface ComparisonLoadout {
  student?: Partial<Record<EquipmentSlot,string|null>> & {characterClass?:CharacterClass|null};
  items:Record<string,ComparisonItem>;
  level:number;
  loading?:boolean;
  error?:boolean;
}
const STATS = ['str','int','agi','mnd','vit','def','atk','mat','rtk'] as const;
/** Compare an equip operation, including an off hand that a weapon would force out. */
export function compareEquipment(candidate:ComparisonItem, context:ComparisonLoadout) {
 const {student,items}=context;
 if(context.error)return {unavailable:'Current equipment could not load. Refresh to compare.'} as const;
 if(context.loading || !student)return {unavailable:'Loading current equipment…'} as const;
 const ids=[student[candidate.slot],student.weapon,student.offhand].filter((id):id is string=>!!id);
 if(ids.some(id=>!items[id]))return {unavailable:'Current item details are unavailable. Refresh to compare.'} as const;
 const current=items[student[candidate.slot] || ''] || null;
 const weapon=items[student.weapon || ''] || null, offhand=items[student.offhand || ''] || null;
 const removedOffhand=candidate.slot==='weapon' && handConflict(candidate,offhand) ? offhand : null;
 const replaced=[current,removedOffhand].filter((x):x is ComparisonItem=>!!x);
 const rows=STATS.map(stat=>{
  const before=replaced.reduce((n,item)=>n+(item.stats[stat] || 0),0);
  const after=candidate.stats[stat] || 0;
  return {stat:stat.toUpperCase(),before,after,delta:after-before};
 }).filter(row=>row.before!==0 || row.after!==0);
 const oldEffects=[...new Set(replaced.map(x=>equipmentEffectText(x.id)).filter(Boolean))];
 const newEffect=equipmentEffectText(candidate.id);
 return {current,removedOffhand,rows,
  equipped:current?.id===candidate.id,
  blocker:equipmentUnavailable(student.characterClass || 'warrior',candidate,context.level,weapon,offhand),
  gainedEffect:newEffect && !oldEffects.includes(newEffect) ? newEffect : null,
  lostEffects:oldEffects.filter(text=>text!==newEffect),
 };
}
