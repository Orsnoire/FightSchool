import { useEffect, useState } from "react";
import type { StaminaStatus } from "@shared/combat/stamina";

export function StaminaBar({ studentId, refreshKey }: { studentId: string | null; refreshKey?: string }) {
  const [data, setData] = useState<StaminaStatus | null>(null);
  useEffect(() => {
    if (!studentId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let latest: StaminaStatus | null = null;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/student/${studentId}/stamina`, { credentials: "include", signal: controller.signal });
        if (!response.ok) throw new Error("Stamina unavailable");
        const value = await response.json();
        if (typeof value.xpMultiplier !== "number" || typeof value.resetsAt !== "number") throw new Error("Invalid stamina");
        latest = value;
        if (!controller.signal.aborted) setData(value);
      } catch { /* Combat remains available during a failed status refresh. */ }
      if (!controller.signal.aborted) timer = setTimeout(refresh,
        Math.max(1000, Math.min(60000, latest ? latest.resetsAt - Date.now() + 100 : 60000)));
    };
    setData(null);
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [studentId, refreshKey]);
  if (!studentId) return null;
  if (!data) return <p className="text-xs text-muted-foreground">Stamina updates when connected.</p>;
  const percent = Math.max(1, Math.round(data.xpMultiplier * 1000) / 10);
  return <div className="space-y-1" aria-label="Daily stamina">
    <div className="flex flex-wrap justify-between gap-x-4 text-sm"><span className="font-semibold">Stamina</span><span>{percent}% XP · {data.completedCombats} fights today</span></div>
    <div role="progressbar" aria-label="XP multiplier for your next completed fight" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }}/>
    </div>
    <p className="text-xs text-muted-foreground">Resets at midnight Mountain time. You can keep playing at any stamina.</p>
  </div>;
}
