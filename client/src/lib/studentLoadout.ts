import type { QueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';
import type { Student, EquipmentSlot, CharacterClass } from '@shared/schema';

type EquipmentChange = Partial<Record<EquipmentSlot, string | null>> & {crossClassAbility1?:string|null;crossClassAbility2?:string|null};
type CharacterChange = {characterClass:CharacterClass;gender:string};
const pending = new WeakMap<QueryClient, Map<string, Promise<unknown>>>();

/** Publish only authoritative saves and retire reads that started before the save. */
export async function refreshStudentLoadout(client:QueryClient, studentId:string, saved?:Student) {
  const key = [`/api/student/${studentId}`];
  await client.cancelQueries({queryKey:key,exact:true});
  if (saved) client.setQueryData(key,saved);
  await Promise.all([
    client.invalidateQueries({queryKey:key,exact:true}),
    client.invalidateQueries({queryKey:[`/api/student/${studentId}/job-levels`]}),
    client.invalidateQueries({queryKey:['equipment-items']}),
    client.invalidateQueries({queryKey:[`/api/student/${studentId}/currency`]}),
    client.invalidateQueries({predicate:q=>typeof q.queryKey[0]==='string' && /^\/api\/guilds\/[^/]+\/members$/.test(q.queryKey[0])}),
  ]);
}

/** Serialize class/gear edits per student so late responses cannot replace newer saves. */
export function saveStudentLoadout(client:QueryClient, studentId:string, section:'equipment'|'character', change:EquipmentChange|CharacterChange):Promise<Student> {
  let queue=pending.get(client);
  if(!queue) { queue=new Map(); pending.set(client,queue); }
  const previous=queue.get(studentId) || Promise.resolve();
  const save=previous.catch(()=>{}).then(async()=>{
    try {
      const response=await apiRequest('PATCH',`/api/student/${studentId}/${section}`,change);
      const saved=await response.json() as Student;
      await refreshStudentLoadout(client,studentId,saved);
      return saved;
    } catch(error) {
      await refreshStudentLoadout(client,studentId);
      throw error;
    }
  });
  queue.set(studentId,save);
  void save.finally(()=>{if(queue!.get(studentId)===save)queue!.delete(studentId);}).catch(()=>{});
  return save;
}
