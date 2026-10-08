import { TIER_ONE_LOOT_POOLS } from '../tier-one-equipment';
import type { LootItem } from '../schema';
/** Resolve once on room creation. A separate seeded stream never changes combat randomness. */
export function instanceLoot(assigned: readonly LootItem[], sessionId:string): LootItem[] {
  if (assigned.length) return assigned.map(item=>({...item}));
  let seed = 2166136261;
  for (const c of `loot:${sessionId}`) seed = Math.imul(seed ^ c.charCodeAt(0),16777619) >>> 0;
  return Object.values(TIER_ONE_LOOT_POOLS).map(pool => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return {itemId:pool[(seed >>> 0) % pool.length]};
  });
}
