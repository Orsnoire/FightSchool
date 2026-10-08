import { useEffect, useState } from "react";
import { Coins, Gift, Shield, Sword } from "lucide-react";
import type { EquipmentItemDb } from "@shared/schema";
import { SLOT_LABELS } from "@shared/equipment-catalog";
import { fetchEquipmentItems } from "@/lib/equipment";
import { Button } from "./ui/button";

function RewardIcon({ item }: { item: EquipmentItemDb }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.iconUrl]);
  const Icon = item.slot === "weapon" ? Sword : item.slot === "offhand" || item.slot === "armor" ? Shield : Gift;
  return item.iconUrl && !failed
    ? <img src={item.iconUrl} alt="" className="h-12 w-12 shrink-0 rounded object-contain" onError={() => setFailed(true)} />
    : <Icon aria-hidden="true" className="h-12 w-12 shrink-0 p-2 text-muted-foreground" />;
}

export function LootRewardChoices({ lootTable, goldReward, claiming, onClaim }: {
  lootTable: readonly { itemId: string }[];
  goldReward: number;
  claiming: boolean;
  onClaim: (itemId?: string) => void;
}) {
  const idsKey = JSON.stringify([...new Set(lootTable.map(item => item.itemId))]);
  const [loaded, setLoaded] = useState<{ key: string; items: EquipmentItemDb[] } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoaded(null);
    setError("");
    fetchEquipmentItems(JSON.parse(idsKey)).then(items => {
      if (active) setLoaded({ key: idsKey, items });
    }).catch(() => { if (active) setError("Equipment details could not load. Retry to see your item choices."); });
    return () => { active = false; };
  }, [idsKey, attempt]);
  const ids: string[] = JSON.parse(idsKey);
  const items = new Map((loaded?.key === idsKey ? loaded.items : []).map(item => [item.id, item]));
  const loading = !error && loaded?.key !== idsKey;
  const missing = !loading && !error && ids.some(id => !items.has(id));
  return <section className="space-y-3" aria-label="Reward choices" aria-busy={claiming}>
    <p>Choose one reward: gold or one equipment item. Equipment goes into your inventory.</p>
    <Button onClick={() => onClaim()} disabled={claiming} className="gap-2"><Coins aria-hidden="true" size={18} />Claim {goldReward} gold</Button>
    {loading && <p role="status">Loading equipment details…</p>}
    {error && <p role="alert">{error}</p>}
    {missing && <p role="status">Some equipment details are unavailable. Retry, or choose another reward.</p>}
    {(error || missing) && <Button variant="outline" disabled={claiming} onClick={() => setAttempt(n => n + 1)}>Retry equipment details</Button>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {ids.map(id => {
        const item = items.get(id);
        if (!item) return <div key={id} className="rounded-lg border p-4 text-sm text-muted-foreground">{loading ? "Equipment details loading…" : "Equipment details unavailable"}</div>;
        const stats = Object.entries(item.stats || {}).filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value !== 0);
        return <article key={id} className="min-w-0 rounded-lg border bg-card p-4 space-y-3" aria-label={item.name}>
          <div className="flex items-center gap-3"><RewardIcon item={item} /><div className="min-w-0"><h3 className="font-semibold break-words">{item.name}</h3><p className="text-xs text-muted-foreground capitalize">{item.quality} · Tier {item.tier} · {SLOT_LABELS[item.slot] || item.slot}</p></div></div>
          {stats.length ? <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{stats.map(([stat, value]) => <div className="flex gap-1" key={stat}><dt>{stat.toUpperCase()}</dt><dd className="font-semibold">{value! > 0 ? "+" : ""}{value}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">No stat bonuses</p>}
          <Button className="w-full h-auto min-h-9 whitespace-normal" variant="outline" onClick={() => onClaim(id)} disabled={claiming}>Claim {item.name}</Button>
        </article>;
      })}
    </div>
    {claiming && <p role="status">Saving your reward…</p>}
  </section>;
}
