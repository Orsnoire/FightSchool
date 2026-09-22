export interface ResolutionPlayer {
  nickname: string;
  characterClass: string;
  health: number;
  maxHealth: number;
  mp: number;
  mnd: number;
  vit: number;
  def: number;
  threat: number;
  isDead: boolean;
  potionCount: number;
  healingDone: number;
  damageTaken: number;
  damageBlocked: number;
  deaths: number;
  blockTarget?: string;
}

export interface ResolutionEnemy {
  id: string;
  name: string;
  image: string;
  health: number;
}

export type HealingKind = "potion" | "mend" | "healing_guard";

export interface HealingIntent {
  healerId: string;
  targetId: string;
  kind: HealingKind;
}

export interface HealingOutcome {
  healerId: string;
  targetId: string;
  kind: HealingKind;
  amount: number;
}

export interface DamageOutcome {
  rawDamage: number;
  actualDamage: number;
  defendedAmount: number;
  health: number;
  isDead: boolean;
  becameDead: boolean;
}

export interface EnemyAttackOutcome {
  enemyId: string;
  enemyName: string;
  enemyImage: string;
  targetId: string;
  targetName: string;
  rawDamage: number;
  damage: number;
  defendedAmount: number;
  blocked: boolean;
  blockerId?: string;
  blockerName?: string;
}

export interface EnemyAttackOptions {
  baseDamage: number;
  soloModeDamageCap?: number;
}

export interface ResolutionSchedule {
  questionResolutionMs: number;
  enemyAiMs: number;
  nextQuestionMs: number;
}

const TANK_CLASSES = new Set(["warrior", "knight", "paladin", "dark_knight", "blood_knight", "monk"]);

function clonePlayers<T extends ResolutionPlayer>(players: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(players).map(([id, player]) => [id, { ...player } as T]));
}

function healingAmount(healer: ResolutionPlayer, kind: HealingKind): number {
  return kind === "healing_guard" ? healer.vit : healer.mnd;
}

function canHeal(healer: ResolutionPlayer, kind: HealingKind): boolean {
  if (kind === "potion") return healer.characterClass === "herbalist" && healer.potionCount > 0;
  if (kind === "mend") return healer.characterClass === "priest" && healer.mp >= 1;
  return healer.characterClass === "paladin" && healer.mp >= 1;
}

export function resolveHealing<T extends ResolutionPlayer>(
  players: Record<string, T>,
  intents: HealingIntent[],
): { players: Record<string, T>; outcomes: HealingOutcome[] } {
  const next = clonePlayers(players);
  const outcomes: HealingOutcome[] = [];

  for (const intent of intents) {
    const healer = next[intent.healerId];
    const target = next[intent.targetId];
    if (!healer || healer.isDead || !target || target.isDead || !canHeal(healer, intent.kind)) continue;

    const amount = Math.min(
      Math.max(0, healingAmount(healer, intent.kind)),
      Math.max(0, target.maxHealth - target.health),
    );
    target.health = Math.min(target.maxHealth, target.health + amount);
    if (intent.kind === "potion") healer.potionCount -= 1;
    else healer.mp = Math.max(0, healer.mp - 1);
    healer.healingDone += amount;
    healer.threat += amount * 2;
    outcomes.push({ ...intent, amount });
  }

  return { players: next, outcomes };
}

export function resolveDamage(
  health: number,
  rawDamage: number,
  defense: number,
  vitality: number,
  wasDead = false,
): DamageOutcome {
  const normalizedRaw = Math.max(1, Math.floor(rawDamage));
  const reduction = Math.max(0, Math.floor(defense) + Math.floor(vitality / 2));
  const actualDamage = Math.max(1, normalizedRaw - reduction);
  const defendedAmount = Math.max(0, normalizedRaw - actualDamage);
  const nextHealth = Math.max(0, health - actualDamage);
  const isDead = nextHealth === 0;
  return {
    rawDamage: normalizedRaw,
    actualDamage,
    defendedAmount,
    health: nextHealth,
    isDead,
    becameDead: !wasDead && isDead,
  };
}

export function findBlocker<T extends Pick<ResolutionPlayer, "characterClass" | "blockTarget" | "isDead">>(
  players: Record<string, T>,
  targetId: string,
): string | null {
  for (const [playerId, player] of Object.entries(players)) {
    if (!player.isDead && player.blockTarget === targetId && TANK_CLASSES.has(player.characterClass)) return playerId;
  }
  return null;
}

function findThreatTarget<T extends Pick<ResolutionPlayer, "isDead" | "threat">>(
  players: Record<string, T>,
): string | null {
  let highestThreat = 0;
  let targetId: string | null = null;
  for (const [playerId, player] of Object.entries(players)) {
    if (!player.isDead && player.threat > highestThreat) {
      highestThreat = player.threat;
      targetId = playerId;
    }
  }
  return targetId;
}

export function resolveEnemyAttacks<T extends ResolutionPlayer>(
  players: Record<string, T>,
  enemies: ResolutionEnemy[],
  options: EnemyAttackOptions,
): { players: Record<string, T>; attacks: EnemyAttackOutcome[] } {
  const next = clonePlayers(players);
  const attacks: EnemyAttackOutcome[] = [];
  const uncapped = Math.max(1, Math.floor(options.baseDamage));
  const rawDamage = options.soloModeDamageCap == null
    ? uncapped
    : Math.min(uncapped, Math.max(1, Math.floor(options.soloModeDamageCap)));

  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const targetId = findThreatTarget(next);
    if (!targetId) continue;
    const target = next[targetId];
    const blockerId = findBlocker(next, targetId);

    if (blockerId) {
      const blocker = next[blockerId];
      blocker.damageBlocked += rawDamage;
      blocker.threat += rawDamage;
      attacks.push({
        enemyId: enemy.id,
        enemyName: enemy.name,
        enemyImage: enemy.image,
        targetId,
        targetName: target.nickname,
        rawDamage,
        damage: rawDamage,
        defendedAmount: 0,
        blocked: true,
        blockerId,
        blockerName: blocker.nickname,
      });
      continue;
    }

    const damage = resolveDamage(target.health, rawDamage, target.def, target.vit, target.isDead);
    target.health = damage.health;
    target.isDead = damage.isDead;
    target.damageTaken += damage.actualDamage;
    if (damage.becameDead) target.deaths += 1;
    attacks.push({
      enemyId: enemy.id,
      enemyName: enemy.name,
      enemyImage: enemy.image,
      targetId,
      targetName: target.nickname,
      rawDamage,
      damage: damage.actualDamage,
      defendedAmount: damage.defendedAmount,
      blocked: false,
    });
  }

  return { players: next, attacks };
}

export function scheduleResolution(
  feedbackCounts: number[],
  hasPartyDamageSummary: boolean,
  enemyAttackCount: number,
): ResolutionSchedule {
  const personalModalCount = feedbackCounts.reduce((maximum, count) => Math.max(maximum, count), 0);
  const resolutionModalCount = personalModalCount + (hasPartyDamageSummary ? 1 : 0);
  return {
    questionResolutionMs: Math.max(3_000, resolutionModalCount * 3_000),
    enemyAiMs: enemyAttackCount > 0 ? 1_800 + enemyAttackCount * 3_000 : 1_000,
    nextQuestionMs: 2_000,
  };
}
