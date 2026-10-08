import { useQuery } from '@tanstack/react-query';
import { useStudentLoadout } from './useStudentLoadout';
import { fetchEquipmentItems } from '@/lib/equipment';
import { EQUIPMENT_SLOTS } from '@shared/equipment-slots';
import type { ComparisonLoadout } from '@shared/equipment-comparison';
export function useEquipmentComparison(studentId:string|null):ComparisonLoadout {
 const loadout=useStudentLoadout(studentId);
 const ids=EQUIPMENT_SLOTS.map(slot=>loadout.student?.[slot]).filter((id):id is string=>!!id).sort();
 const gear=useQuery({queryKey:['equipment-items',{ids}],queryFn:()=>fetchEquipmentItems(ids),enabled:!!loadout.student,staleTime:0,refetchOnWindowFocus:true});
 return {student:loadout.student,items:Object.fromEntries((gear.data || []).map(item=>[item.id,item])),
  level:loadout.jobLevels.find(job=>job.jobClass===loadout.student?.characterClass)?.level || 1,
  loading:loadout.isFetching || gear.isFetching || !gear.data,error:loadout.isError || gear.isError};
}
