import type { CombatSnapshot } from "@shared/combat/model";
import { PlayerAvatar } from "./PlayerAvatar";
import { HealthBar } from "./HealthBar";
import { MPBar } from "./MPBar";
import { Card } from "./ui/card";
export function CombatBoard({ state }: { state: CombatSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(state.enemyDisplayMode === "consecutive"
          ? state.enemies.filter((e) => e.health > 0).slice(0, 1)
          : state.enemies
        ).map((e) => (
          <Card
            key={e.id}
            className={`p-4 text-center ${e.health <= 0 ? "opacity-40" : ""}`}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.values(state.players).map((p) => (
          <Card
            key={p.studentId}
            className={`p-3 space-y-2 ${p.isDead ? "opacity-50" : ""}`}
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
                ? "Knocked out"
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
