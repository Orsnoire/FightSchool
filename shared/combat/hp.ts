import type { CombatSnapshot } from "./model";

/** HP is integral: maximum rounds down; current rounds up within its maximum. */
export const maximumHP = (value: number): number => Math.max(0, Math.floor(value));
export const currentHP = (value: number, maximum: number): number =>
  Math.min(maximumHP(maximum), Math.max(0, Math.ceil(value)));


/** New-rule rooms enforce the same HP invariant after storage recovery. Existing
 * active rooms without the budget marker retain their saved combat balance. */
export function normalizeSnapshotHP(snapshot: CombatSnapshot): CombatSnapshot {
  if (snapshot.encounterHpPool === undefined) return snapshot;
  const actors = (s: CombatSnapshot) => [
    ...s.enemies, ...Object.values(s.players),
    ...Object.values(s.pendingPlayers || {}), ...Object.values(s.departedPlayers || {}),
  ];
  if (actors(snapshot).every(a => a.maxHealth === Math.max(1, maximumHP(a.maxHealth)) &&
    a.health === currentHP(a.health, a.maxHealth))) return snapshot;
  const next = structuredClone(snapshot);
  for (const actor of actors(next)) {
    actor.maxHealth = Math.max(1, maximumHP(actor.maxHealth));
    actor.health = currentHP(actor.health, actor.maxHealth);
  }
  return next;
}
