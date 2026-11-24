import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { expandEnemies, quizHpPool, referenceRotationDamage } from "@shared/combat/encounters";
import { estimatedQuizSeconds, ROUND_ALLOWANCE_SECONDS } from "@shared/combat/round-timing";
import type { Enemy, Question } from "@shared/schema";
import { useMemo } from "react";

export function QuizRoundPlanner({ questions, minimum, enemies, tier, onChange }: {
  questions: Question[]; minimum: number; enemies: Enemy[]; tier: number; onChange: (rounds: number) => void;
}) {
  const rounds = questions.length;
  const damage = useMemo(() => referenceRotationDamage(tier, rounds), [tier, rounds]);
  const count = expandEnemies(enemies, false, 4, tier).length;
  const seconds = estimatedQuizSeconds(questions);
  return <Card>
    <CardHeader><CardTitle>Randomized quiz pacing</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <label className="block space-y-2"><span className="font-medium">Target rounds · {rounds}</span>
        <input className="block w-full" type="range" aria-label="Target rounds" min={minimum} max={Math.max(60, rounds)}
          step={1} value={rounds} onChange={event => onChange(Number(event.target.value))} />
      </label>
      <p className="text-sm text-muted-foreground">Each fixed question and selected skill gets at least one round. Extra rounds cycle through the selected skills. Combat can finish earlier or continue longer.</p>
      <div aria-live="polite" className="space-y-1">
        <p><strong>Target time</strong> · {Math.floor(seconds / 60)} min {seconds % 60} s</p>
        <p className="text-sm text-muted-foreground">Each round includes its question timer, countdown, feedback, action and ability windows, plus {ROUND_ALLOWANCE_SECONDS} seconds.</p>
        <p><strong>Projected enemy HP pool</strong> · {quizHpPool(damage, count).toLocaleString()} HP</p>
        <p className="text-sm text-muted-foreground">{rounds} rounds × {(damage / rounds).toLocaleString(undefined, { maximumFractionDigits: 1 })} projected damage per round for the tier {tier} reference party of four. The lobby updates this estimate for the joined roster. Each enemy gets at least 1 HP.</p>
      </div>
    </CardContent>
  </Card>;
}
