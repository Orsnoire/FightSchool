import type { ReactNode } from "react";
import type { CombatSnapshot } from "@shared/combat/model";
import { PlayerAvatar } from "./PlayerAvatar";
import { HealthBar } from "./HealthBar";
import { MPBar } from "./MPBar";
import { Card } from "./ui/card";
export function CombatBoard({ state, onResurrect, enemyAside }: { state: CombatSnapshot; onResurrect?: (studentId: string) => void; enemyAside?: ReactNode }) {
  return (
    <div className="space-y-6">
      <div className={enemyAside ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" : ""}>
      <div className={enemyAside ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-1 min-w-0" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"}>
        {(state.enemyDisplayMode === "consecutive"
          ? state.enemies.filter((e) => e.health > 0).slice(0, 1)
          : state.enemies
        ).map((e) => (
          <Card
            key={e.id}
            className={`p-4 text-center flex flex-col justify-center ${e.health <= 0 ? "opacity-40" : ""}`}
          >
            <img
              src={e.image}
              alt={e.name}
              className="h-32 object-contain mx-auto mb-2"
            />
            <h2 className="font-bold mb-2">{e.name}</h2>
            <HealthBar current={e.health} max={e.maxHealth} />
          </Card>
        ))}
      </div>
        {enemyAside}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.values(state.players).map((p) => (
          <Card
            key={p.studentId}
            role={onResurrect && p.isDead ? "button" : undefined}
            tabIndex={onResurrect && p.isDead ? 0 : undefined}
            aria-label={onResurrect && p.isDead ? `Resurrect ${p.nickname} with 1 HP` : undefined}
            onClick={() => { if (p.isDead) onResurrect?.(p.studentId); }}
            onKeyDown={(e) => {
              if (p.isDead && onResurrect && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onResurrect(p.studentId);
              }
            }}
            className={`p-3 space-y-2 ${p.isDead ? "opacity-50" : ""} ${onResurrect && p.isDead ? "cursor-pointer hover:ring-2 focus-visible:ring-2 ring-primary" : ""}`}
          >
            <PlayerAvatar
              characterClass={p.characterClass}
              appearance={p.appearance}
              gender={p.gender}
              size="sm"
              isThreatLeader={state.threatLeaderId === p.studentId}
            />
            <p className="font-semibold break-words">{p.nickname}</p>
            <HealthBar current={p.health} max={p.maxHealth} />
            {p.maxMp > 0 && <MPBar current={p.mp} max={p.maxMp} />}
            <p className="text-xs text-muted-foreground">
              Threat {p.threat}
              {p.maxComboPoints > 0
                ? ` · Combo ${p.comboPoints}/${p.maxComboPoints}`
                : ""}
            </p>
            <p className="text-xs">
              {p.isDead
                ? onResurrect ? "Resurrect with 1 HP" : "Knocked out"
                : p.ready
                  ? "Ready"
                  : p.hasAnswered
                    ? "Answered"
                    : "Thinking"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
