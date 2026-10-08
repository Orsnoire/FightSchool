/** Classroom presets. Keep these values shared by authoring, validation and encounter resolution. */
export const ENEMY_ROLES = ["trash", "normal", "leader", "boss"] as const;
export type EnemyRole = (typeof ENEMY_ROLES)[number];
export const ENEMY_ROLE_LABELS: Record<EnemyRole, string> = {
  trash: "Trash",
  normal: "Normal",
  leader: "Leader",
  boss: "Boss",
};
export const ENCOUNTER_TIERS = [
  { label: "Tier 1", level: 4, damage: 1, difficulty: 1, hp: 1 },
  { label: "Tier 2", level: 8, damage: 2, difficulty: 1.3, hp: 1.15 },
  { label: "Tier 3", level: 10, damage: 3, difficulty: 1.7, hp: 1.3 },
  { label: "Tier 4", level: 15, damage: 4, difficulty: 2.5, hp: 1.5 },
] as const;
export const ROLE_SCALING: Record<
  EnemyRole,
  { difficulty: number; hp: number }
> = {
  trash: { difficulty: 5, hp: 0.6 },
  normal: { difficulty: 10, hp: 1 },
  leader: { difficulty: 20, hp: 1.35 },
  boss: { difficulty: 40, hp: 1.8 },
};
export function enemyTuning(tier: number, role: EnemyRole) {
  const t = ENCOUNTER_TIERS[tier - 1] || ENCOUNTER_TIERS[0];
  const r = ROLE_SCALING[role];
  const difficulty = Math.min(100, r.difficulty * t.difficulty);
  return {
    difficultyMultiplier: difficulty,
    baseEnemyDamage: t.damage,
    hpMultiplier: r.hp * t.hp,
    rawCounterattack: Math.ceil(t.damage * Math.sqrt(difficulty / 10)),
  };
}
export function inferEnemyRole(difficulty: number): EnemyRole {
  return difficulty < 10
    ? "trash"
    : difficulty < 20
      ? "normal"
      : difficulty < 40
        ? "leader"
        : "boss";
}
