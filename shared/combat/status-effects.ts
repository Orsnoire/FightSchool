import { activeEnemies } from './encounters';
import type { CombatPlayer, CombatSnapshot, CombatStatus, StatusType } from "./model";

export const STATUS_LABELS: Record<StatusType, string> = {
  stun: "Stunned", paralysis: "Paralyzed", web: "Webbed", poison: "Poisoned", bleed: "Bleeding",
  hypnosis: "Hypnotized", stare: "Hypnotic Stare", fear: "Afraid", corrosion: "Corroded armor", suffocate: "Suffocating", trip: "Tripped",
};
const controlTypes = new Set<StatusType>(["stun", "paralysis", "web", "hypnosis", "stare", "fear", "suffocate"]);
export const isHypnosis = (x: CombatStatus) => x.type === "hypnosis" || x.type === "stare";
/** Conservative exception: one automatic basic attack, never an unrestricted turn. */
export function naturalAgilityEligible(p: CombatPlayer, round: number): boolean {
  const statuses = (p.statuses || []).filter(x => x.throughRound === undefined || x.throughRound >= round);
  return !p.isDead && p.characterClass !== 'priest' && p.lastAnswerCorrect === true &&
    !!p.actionBlocked && p.actionBlocked.round === round && ['stun', 'hypnosis', 'stare'].includes(p.actionBlocked.reason) &&
    statuses.some(x => x.type === 'stun' || isHypnosis(x)) &&
    !statuses.some(x => ['web', 'suffocate', 'fear', 'trip'].includes(x.type) ||
      (x.type === 'paralysis' && x.actionFailure?.round === round && x.actionFailure.skip));
}
export function naturalAgilityAttack(p: CombatPlayer, round: number): boolean {
  return p.agilityAttack?.round === round && p.agilityAttack.allowed && naturalAgilityEligible(p, round);
}
/** Shared by selection validation, readiness and the student waiting view. */
export function combatActionBlock(s: Pick<CombatSnapshot, "round" | "enemies">, p: CombatPlayer): CombatPlayer["actionBlocked"] {
  if (p.actionBlocked?.round === s.round) return p.actionBlocked;
  // Also cover rooms saved before status preparation moved ahead of choices.
  const statuses = (p.statuses || []).filter(x =>
    (x.throughRound === undefined || x.throughRound >= s.round) &&
    (!isHypnosis(x) || s.enemies.some(e => e.id === x.sourceId && e.health > 0)));
  const hard = statuses.find(x => ["web", "stun", "hypnosis", "stare", "suffocate"].includes(x.type)) ||
    statuses.find(x => x.type === "paralysis" && x.actionFailure?.round === s.round && x.actionFailure.skip);
  if (hard) return { round: s.round, reason: hard.type };
  if (statuses.some(x => x.type === "fear")) return { round: s.round, reason: "fear", attacksOnly: true };
}
export function actionBlockLabel(reason: string): string {
  return reason === "hypnosis" || reason === "stare" ? "Mesmerized" : STATUS_LABELS[reason as StatusType] || "Unable to act";
}
export function statusSummary(p: CombatPlayer): string[] {
  const statuses = p.statuses || [];
  return [...new Set(statuses.map(x => {
    const label = STATUS_LABELS[x.type];
    if (x.type === "stun" || x.type === "paralysis") return `${label} · Recovery: ${p.recoveryCorrectAnswers || 0}/2`;
    if (isHypnosis(x)) return `${label} · Recovery: ${x.correctAnswers || 0}/3`;
    if (x.type === "web") return `${label} · Correct answer frees you; action resumes next round`;
    if (x.type === "fear") return `${label} · Cannot attack; support and answers available`;
    if (x.type === "corrosion") return `${label} · −${Math.min(100, statuses.filter(s => s.type === "corrosion").length * 10)}% DEF`;
    if (x.type === "trip") return `${label} · Next correct answer fails in combat only`;
    if (x.type === "poison") return `${label} · Purify or Cleansing Chorus removes this`;
    return label;
  }))];
}
export function effectiveDefense(p: CombatPlayer): number {
  const corrosion = Math.min(10, (p.statuses || []).filter(x => x.type === "corrosion").length);
  return Math.max(0, p.stats.def * (1 - corrosion / 10));
}
export function grantControlRecovery(s: CombatSnapshot, p: CombatPlayer): void {
  // At least one complete following round in which no enemy can disable them again.
  p.controlImmuneThroughRound = Math.max(p.controlImmuneThroughRound || 0, s.round + 1);
}
export function addStatus(s: CombatSnapshot, p: CombatPlayer, status: CombatStatus): boolean {
  if (p.isDead || p.buffs.immunity) return false;
  const itemProtection = isHypnosis(status) ? 'hypnosis' : status.type === 'trip' || status.type === 'stun' ? status.type : undefined;
  if (itemProtection && (p.itemProtections?.[itemProtection] || 0) > 0) return false;
  if (controlTypes.has(status.type) && (p.controlImmuneThroughRound || 0) >= s.round) return false;
  const statuses = p.statuses ||= [];
  if (isHypnosis(status) && statuses.some(isHypnosis)) return false;
  if (status.type === "corrosion") {
    if (statuses.filter(x => x.type === "corrosion").length >= 10) return false;
    statuses.push(status);
    return true;
  }
  const existing = statuses.find(x => x.type === status.type);
  if (existing) {
    // Reapplication never erases correct-answer recovery, especially in swarms.
    if (status.type === "stun") existing.throughRound = Math.max(s.round, existing.throughRound || s.round) + Math.max(1, (status.throughRound || s.round + 1) - s.round);
    else if (status.throughRound !== undefined) existing.throughRound = Math.max(existing.throughRound || 0, status.throughRound);
    existing.amount = Math.max(existing.amount || 0, status.amount || 0);
    return true;
  }
  statuses.push(status);
  return true;
}
function refreshActionBlock(s: CombatSnapshot, p: CombatPlayer,
  webEscape = p.actionBlocked?.round === s.round && p.actionBlocked.reason === "web"): void {
  const statuses = p.statuses || [];
  const hard = statuses.find(x => ["web", "stun", "hypnosis", "stare", "suffocate"].includes(x.type));
  const paralysis = statuses.find(x => x.type === "paralysis");
  const reason = webEscape ? "web" : hard?.type ||
    (paralysis?.actionFailure?.round === s.round && paralysis.actionFailure.skip ? "paralysis" : undefined);
  if (reason) p.actionBlocked = { round: s.round, reason };
  else if (statuses.some(x => x.type === "fear")) p.actionBlocked = { round: s.round, reason: "fear", attacksOnly: true };
  else delete p.actionBlocked;
}
/** Only a damaging direct hit from another encounter enemy breaks hypnosis. */
export function breakHypnosisFromAttack(s: CombatSnapshot, p: CombatPlayer, sourceId: string): boolean {
  if (!s.enemies.some(e => e.id === sourceId)) return false;
  const before = p.statuses || [];
  p.statuses = before.filter(x => !isHypnosis(x) || x.sourceId === sourceId);
  if (p.statuses.length === before.length) return false;
  grantControlRecovery(s, p);
  refreshActionBlock(s, p);
  return true;
}
/** Called before actions and after source death. Healing an enemy never reinstates control. */
export function releaseInvalidStatuses(s: CombatSnapshot): void {
  for (const p of Object.values(s.players)) {
    const before = p.statuses || [];
    p.statuses = before.filter(x => (x.throughRound === undefined || x.throughRound >= s.round) &&
      (!isHypnosis(x) || s.enemies.some(e => e.id === x.sourceId && e.health > 0)));
    if (before.some(x => controlTypes.has(x.type) && !p.statuses!.includes(x))) grantControlRecovery(s, p);
    if (!p.statuses.some(x => x.type === "stun" || x.type === "paralysis")) p.recoveryCorrectAnswers = 0;
    if (p.actionBlocked && ["hypnosis", "stare", "stun", "paralysis", "fear"].includes(p.actionBlocked.reason) &&
      !p.statuses.some(x => x.type === p.actionBlocked!.reason)) refreshActionBlock(s, p);
  }
}
/** Prepare before choices; repeats/reconnects must not count the same answer twice. */
export function prepareStatusActions(s: CombatSnapshot, random: () => number): void {
  releaseInvalidStatuses(s);
  for (const p of Object.values(s.players)) {
    const prepared = p.statusPreparedRound === s.round;
    const webEscape = prepared && p.actionBlocked?.round === s.round && p.actionBlocked.reason === "web";
    delete p.actionBlocked;
    if (p.isDead) continue;
    p.statusPreparedRound = s.round;
    const statuses = p.statuses ||= [];
    const active = prepared ? [] : statuses.filter(x => x.appliedRound < s.round);
    if (active.some(x => x.type === "stun" || x.type === "paralysis") && p.lastAnswerCorrect) {
      p.recoveryCorrectAnswers = (p.recoveryCorrectAnswers || 0) + 1;
      if (p.recoveryCorrectAnswers >= 2) {
        p.statuses = p.statuses.filter(x => x.type !== "stun" && x.type !== "paralysis");
        p.recoveryCorrectAnswers = 0;
        grantControlRecovery(s, p);
      }
    }
    for (const x of active.filter(isHypnosis)) {
      if (p.lastAnswerCorrect) x.correctAnswers = (x.correctAnswers || 0) + 1;
      if ((x.correctAnswers || 0) >= 3) {
        p.statuses = p.statuses.filter(y => y !== x);
        grantControlRecovery(s, p);
      }
    }
    const web = p.statuses.find(x => x.type === "web");
    if (web && p.lastAnswerCorrect) {
      p.statuses = p.statuses.filter(x => x !== web);
      grantControlRecovery(s, p);
    }
    const paralysis = p.statuses.find(x => x.type === "paralysis");
    // Resolve independent effects once, even while another effect takes priority.
    // A source dying mid-turn cannot erase an unrelated stun or reroll paralysis.
    if (paralysis && paralysis.actionFailure?.round !== s.round)
      paralysis.actionFailure = { round: s.round, skip: random() < (paralysis.chance ?? 0.3) };
    refreshActionBlock(s, p, webEscape || !!web);
    if (!prepared && (p.advancement?.agilityChance || 0) > 0 && naturalAgilityEligible(p, s.round))
      p.agilityAttack = { round: s.round, allowed: random() < p.advancement!.agilityChance };
    if (naturalAgilityAttack(p, s.round)) {
      const targets = activeEnemies(s);
      const previous = targets.find(e => e.id === p.questionAction?.targetId);
      p.questionAction = { ability: 'attack', targetId: previous?.id || targets[0]?.id || '' };
    }
  }
}
export function cleansePlayer(s: CombatSnapshot, p: CombatPlayer): void {
  delete p.buffs.poison; // Read compatibility for saved rooms.
  const paralyzed = p.statuses?.some(x => x.type === "paralysis");
  p.statuses = (p.statuses || []).filter(x => x.type !== "poison" && x.type !== "paralysis");
  if (paralyzed) grantControlRecovery(s, p);
  if (p.actionBlocked?.reason === "paralysis") refreshActionBlock(s, p);
}
