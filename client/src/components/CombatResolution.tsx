import type { CombatSnapshot } from "@shared/combat/model";

export function CombatResolution({ state, studentId }: { state: CombatSnapshot; studentId: string | null }) {
  const counterattack = state.currentPhase === "enemy_ai";
  const events = state.events.filter((e) => e.round === state.round && (
    e.phase ? e.phase === (counterattack ? "enemy_ai" : "question_resolution")
      : !counterattack || (e.type === "enemy_attack" && state.enemies.some((enemy) => enemy.id === e.actorId))
  ));
  const personal = events.filter((e) => e.actorId === studentId || e.targetId === studentId);
  const visible = counterattack ? events : personal;
  const enemies = state.enemies.filter((enemy) => events.some((e) => e.actorId === enemy.id || e.targetId === enemy.id));
  const p = studentId ? state.players[studentId] : undefined;
  const damage = events.filter((e) => e.type === "damage").reduce((sum, e) => sum + e.amount, 0);
  return (
    <div className="space-y-4" role="status">
      <div className="flex flex-wrap items-end justify-center gap-6">
        {enemies.map((e) => <div key={e.id} className="text-center"><img src={e.image} alt="" className="h-28 sm:h-40 max-w-40 object-contain mx-auto" /><p className="font-semibold">{e.name}</p></div>)}
      </div>
      {!counterattack && p?.hasAnswered && <p className="text-center text-2xl font-bold">{p.lastAnswerCorrect ? "Correct!" : "Incorrect this round"}</p>}
      {!counterattack && <p className="text-center font-semibold">Your party dealt {damage} damage this round.</p>}
      <ul className="space-y-2">
        {visible.map((e) => <li key={e.id} className="rounded-lg bg-muted p-3">{e.type === "enemy_attack" && counterattack
          ? `${state.enemies.find((enemy) => enemy.id === e.actorId)?.name || "Enemy"} counterattacks ${state.players[e.targetId]?.nickname || "an ally"} for ${e.amount} damage!`
          : e.message}</li>)}
      </ul>
      {!visible.length && <p className="text-center text-muted-foreground">{counterattack ? "No enemy counterattack." : "Your party’s actions have resolved."}</p>}
    </div>
  );
}
