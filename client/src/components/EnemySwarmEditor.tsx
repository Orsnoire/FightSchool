import type { Enemy } from "@shared/schema";
import { MAX_ENEMIES_PER_GROUP, MAX_ENEMIES_PER_FIGHT, swarmCounts } from "@shared/combat/swarm";

export function EnemySwarmEditor({ enemy, encounterTier = 1, onChange }: {
  enemy: Partial<Enemy>;
  encounterTier?: number;
  onChange: (enemy: Partial<Enemy>) => void;
}) {
  return <fieldset className="space-y-3 rounded-lg border p-4">
    <legend className="px-2 font-medium">Party size</legend>
    <label className="flex items-center gap-2">
      <input type="checkbox" aria-label="Swarm" checked={!!enemy.swarm}
        onChange={event => onChange({ ...enemy, swarm: event.target.checked ? { enemiesPerFourPlayers: 1 } : undefined })} />
      Swarm
    </label>
    {enemy.swarm ? <>
      <label className="block text-sm">Add enemies per 4 additional players
        <input aria-label="Extra swarm enemies" type="number" min="1" max={MAX_ENEMIES_PER_GROUP} step="1"
          value={enemy.swarm.enemiesPerFourPlayers}
          onChange={event => onChange({ ...enemy, swarm: {
            enemiesPerFourPlayers: Math.max(1, Math.min(MAX_ENEMIES_PER_GROUP, Math.floor(Number(event.target.value) || 1))),
          } })}
          className="mt-1 block w-full rounded border bg-background p-2" />
      </label>
      <p className="text-sm text-muted-foreground">Starting quantity is base × tier ({encounterTier}). Extra batches at 8, 12, 16 players, and so on. The extra batch size is unchanged by tier. Counts lock at Start Fight.</p>
      <p className="text-sm" aria-label="Swarm count examples">{[4, 8, 12, 16].map(players =>
        `${players} players: ${swarmCounts([{ ...enemy, quantity: Math.max(enemy.enemyType === "goblin" ? 5 : 1, enemy.quantity || 1) }], players, encounterTier)[0]} enemies`
      ).join(" · ")}</p>
      <p className="text-xs text-muted-foreground">Maximum {MAX_ENEMIES_PER_GROUP} per group and {MAX_ENEMIES_PER_FIGHT} across the fight. Groups share any remaining capacity; the waiting room shows the final counts.</p>
    </> : <p className="text-sm text-muted-foreground">This group always uses its base quantity.</p>}
  </fieldset>;
}
