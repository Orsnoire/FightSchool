import type { CombatPlayer } from "@shared/combat/model";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AllyTargetGrid({ players, selectedId, onSelect, guard, disabled }: {
  players: CombatPlayer[]; selectedId: string; onSelect: (id: string) => void;
  guard: boolean; disabled: boolean;
}) {
  const living = players.filter(p => !p.isDead);
  const topThreat = Math.max(0, ...living.map(p => p.threat));
  const sorted = [...living].sort((a, b) =>
    (guard ? b.threat - a.threat : 0) || a.health / a.maxHealth - b.health / b.maxHealth || a.nickname.localeCompare(b.nickname));
  return <fieldset className="space-y-2">
    <legend className="font-semibold">Choose an ally</legend>
    <p className="text-xs text-muted-foreground">{guard ? "Highest threat first. Select a tile to save your support target." : "Lowest HP first."} Each tile shows HP and threat.</p>
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[42vh] overflow-y-auto p-1" aria-label="Ally targets">
      {sorted.map(p => {
        const hp = Math.round(100 * p.health / p.maxHealth);
        return <Button key={p.studentId} type="button" disabled={disabled} variant="outline"
          aria-pressed={selectedId === p.studentId}
          aria-label={`${p.nickname}, HP ${hp}%, threat ${p.threat}`}
          onClick={() => onSelect(p.studentId)}
          className={`h-auto min-h-24 p-2 flex-col items-stretch whitespace-normal text-left gap-1 border-2 ${hp <= 30 ? "bg-red-100 dark:bg-red-950 border-red-400" : hp <= 65 ? "bg-amber-100 dark:bg-amber-950 border-amber-400" : "bg-emerald-50 dark:bg-emerald-950 border-emerald-400"} ${selectedId === p.studentId ? "ring-2 ring-primary ring-offset-2" : ""}`}>
          <span className="font-semibold break-words">{p.nickname}</span>
          <span className="text-lg tabular-nums">HP {hp}%</span>
          <span className="flex items-center gap-1 text-xs tabular-nums">{p.threat === topThreat && topThreat > 0 && <Crown aria-hidden size={13}/>} Threat {p.threat}</span>
        </Button>;
      })}
    </div>
  </fieldset>;
}
