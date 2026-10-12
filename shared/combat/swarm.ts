import { z } from "zod";

export const MAX_ENEMIES_PER_GROUP = 60;
export const MAX_ENEMIES_PER_FIGHT = 120;
export const enemySwarmSchema = z.object({
  enemiesPerFourPlayers: z.number().int().min(1).max(MAX_ENEMIES_PER_GROUP),
}).strict();
export type EnemySwarm = z.infer<typeof enemySwarmSchema>;

/** Reserve authored counts, then share remaining capacity between swarm groups. */
export function swarmCounts(
  groups: ReadonlyArray<{ quantity?: number; swarm?: EnemySwarm }>,
  players: number,
): number[] {
  const batches = Number.isFinite(players) ? Math.max(0, Math.floor(players / 4) - 1) : 0;
  const counts = groups.map(g => g.quantity || 1);
  const wanted = groups.map((g, i) => {
    const increment = g.swarm?.enemiesPerFourPlayers || 0;
    return Number.isInteger(increment) && increment > 0 && increment <= MAX_ENEMIES_PER_GROUP
      ? Math.max(counts[i], Math.min(MAX_ENEMIES_PER_GROUP, counts[i] + batches * increment))
      : counts[i];
  });
  let remaining = MAX_ENEMIES_PER_FIGHT - counts.reduce((sum, n) => sum + n, 0);
  while (remaining > 0) {
    let added = false;
    for (let i = 0; i < counts.length && remaining > 0; i++) {
      if (counts[i] < wanted[i]) {
        counts[i]++;
        remaining--;
        added = true;
      }
    }
    if (!added) break;
  }
  return counts;
}
