import { type CombatSnapshot, type CombatEvent } from "../../shared/combat/model.ts";
import { abilityEffect } from "../../shared/combat/presentation";

export function event(
  s: CombatSnapshot,
  type: CombatEvent["type"],
  actorId: string,
  targetId: string,
  amount: number,
  message: string,
  details: Partial<CombatEvent> = {},
) {
  s.events.push({
    id: `${s.round}:${s.events.length}`,
    round: s.round,
    phase: s.currentPhase === "enemy_ai" ? "enemy_ai" : "question_resolution",
    type,
    actorId,
    targetId,
    amount,
    message,
    ...(s.currentPhase === 'enemy_ai' ? {abilityId:s.enemies.find(e=>e.id===actorId)?.aiState?.lastMove||'attack',actionId:`${s.round}:enemy:${actorId}`} : {}),
    effect: type==='heal'?'heal':type==='block'?'block':abilityEffect(s.currentPhase==='enemy_ai'?(s.enemies.find(e=>e.id===actorId)?.aiState?.lastMove||'attack'):'attack',s.players[actorId]),
    ...details,
  });
}

export function leader(s: CombatSnapshot) {
  const top = Object.values(s.players).filter(p => p.totals.damageDealt > 0)
    .sort((a, b) => b.totals.damageDealt - a.totals.damageDealt ||
      (a.studentId === s.damageLeaderId ? -1 : b.studentId === s.damageLeaderId ? 1 : a.studentId.localeCompare(b.studentId)))[0];
  s.damageLeaderId = top?.studentId || null;
  s.threatLeaderId =
    Object.values(s.players)
      .filter((p) => !p.isDead)
      .sort(
        (a, b) => b.threat - a.threat || a.studentId.localeCompare(b.studentId),
      )[0]?.studentId || null;
}
