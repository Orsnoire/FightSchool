import type { EquipmentItemDb } from '@shared/schema';
/** Inventory can exceed one API request once the permanent wardrobe is included. */
export async function fetchEquipmentItems(ids:readonly string[]):Promise<EquipmentItemDb[]> {
 const unique=[...new Set(ids)],chunks:string[][]=[];
 for(let i=0;i<unique.length;i+=100)chunks.push(unique.slice(i,i+100));
 const results=await Promise.all(chunks.map(async chunk=>{
  const response=await fetch(`/api/equipment-items?ids=${chunk.map(encodeURIComponent).join(',')}`);
  if(!response.ok)throw new Error('Equipment could not load');
  return response.json() as Promise<EquipmentItemDb[]>;
 }));
 return results.flat();
}
