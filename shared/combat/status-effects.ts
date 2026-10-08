import type { CombatPlayer, CombatSnapshot, CombatStatus, StatusType } from "./model";

export const STATUS_LABELS: Record<StatusType, string> = {
  stun: "Stunned", paralysis: "Paralyzed", web: "Webbed", poison: "Poisoned", bleed: "Bleeding",
  hypnosis: "Hypnotized", stare: "Hypnotic Stare", fear: "Afraid", corrosion: "Corroded armor", suffocate: "Suffocating", trip: "Tripped",
};
const controlTypes = new Set<StatusType>(["stun", "paralysis", "web", "hypnosis", "stare", "fear", "suffocate"]);
export const isHypnosis = (x: CombatStatus) => x.type === "hypnosis" || x.type === "stare";
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
/** Called before actions and after source death. Healing an enemy never reinstates control. */
export function releaseInvalidStatuses(s: CombatSnapshot): void {
  for (const p of Object.values(s.players)) {
    const before = p.statuses || [];
    p.statuses = before.filter(x => (x.throughRound === undefined || x.throughRound >= s.round) &&
      (!isHypnosis(x) || s.enemies.some(e => e.id === x.sourceId && e.health > 0)));
    if (before.some(x => controlTypes.has(x.type) && !p.statuses!.includes(x))) grantControlRecovery(s, p);
    if (!p.statuses.some(x => x.type === "stun" || x.type === "paralysis")) p.recoveryCorrectAnswers = 0;
    if (p.actionBlocked && ["hypnosis", "stare", "stun", "paralysis", "fear"].includes(p.actionBlocked.reason) &&
      !p.statuses.some(x => x.type === p.actionBlocked!.reason)) delete p.actionBlocked;
  }
}
/** Recovery is counted once, when answer resolution starts, before support/actions execute. */
export function prepareStatusActions(s: CombatSnapshot, random: () => number): void {
  releaseInvalidStatuses(s);
  for (const p of Object.values(s.players)) {
    delete p.actionBlocked;
    if (p.isDead) continue;
    const statuses = p.statuses ||= [];
    const active = statuses.filter(x => x.appliedRound < s.round);
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
    let reason = web ? "web" : p.statuses.find(x => ["stun", "hypnosis", "stare", "suffocate"].includes(x.type))?.type;
    const paralysis = p.statuses.find(x => x.type === "paralysis");
    if (!reason && paralysis && random() < (paralysis.chance ?? 0.3)) reason = "paralysis";
    if (reason) p.actionBlocked = { round: s.round, reason };
    else if (p.statuses.some(x => x.type === "fear")) p.actionBlocked = { round: s.round, reason: "fear", attacksOnly: true };
  }
}
export function cleansePlayer(s: CombatSnapshot, p: CombatPlayer): void {
  delete p.buffs.poison; // Read compatibility for saved rooms.
  const paralyzed = p.statuses?.some(x => x.type === "paralysis");
  p.statuses = (p.statuses || []).filter(x => x.type !== "poison" && x.type !== "paralysis");
  if (paralyzed) grantControlRecovery(s, p);
  if (p.actionBlocked?.reason === "paralysis") delete p.actionBlocked;
}
