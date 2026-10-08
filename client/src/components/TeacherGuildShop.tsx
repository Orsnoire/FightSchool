import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { SLOT_LABELS } from "@shared/equipment-slots";
import type { EquipmentItemDb, Guild } from "@shared/schema";
export function TeacherGuildShop({ guild }: { guild: Guild }) {
  const [tier, setTier] = useState(guild.unlockedTier);
  const {
    data: items = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<EquipmentItemDb[]>({
    queryKey: [`/api/teacher/${guild.teacherId}/equipment-items`],
    refetchOnWindowFocus: "always",
  });
  const rows = items.filter((i) => i.tier === tier);
  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Guild shop</h2>
            <p className="text-sm text-muted-foreground">
              Students can shop through tier {guild.unlockedTier}. Items are
              shared across your guilds.
            </p>
          </div>
          <Link href={`/teacher/items?guild=${guild.id}&tier=${tier}&create=1`}>
            <Button disabled={guild.isArchived}>Create item</Button>
          </Link>
        </div>
        <label className="block font-medium">
          Browse shop tier: {tier}
          <input
            aria-label="Browse shop tier"
            className="block w-full mt-3"
            type="range"
            min="1"
            max="10"
            step="1"
            value={tier}
            onChange={(e) => setTier(+e.target.value)}
          />
        </label>
        <div className="flex justify-between text-xs text-muted-foreground">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <p className="text-sm">
          {tier > guild.unlockedTier
            ? "This tier is locked for this guild."
            : "This tier is available to this guild."}{" "}
          Browsing does not change unlocks.
        </p>
      </Card>
      {isLoading && <p>Loading shop…</p>}
      {isError && (
        <p role="alert">
          Unable to load items. <Button onClick={() => refetch()}>Retry</Button>
        </p>
      )}
      {!isLoading && !isError && !rows.length && (
        <p className="p-5 text-muted-foreground">
          No custom items at tier {tier}. Create an item to stock this tier.
        </p>
      )}
      <div className="grid md:grid-cols-3 gap-3">
        {rows.map((item) => (
          <Card key={item.id} className="p-4 space-y-2">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-sm">
              {SLOT_LABELS[item.slot]} · {item.quality}
            </p>
            <p className="text-sm">
              {Object.entries(item.stats)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k.toUpperCase()} ${v! > 0 ? "+" : ""}${v}`)
                .join(" · ") || "No stat bonuses"}
            </p>
            <p className="text-sm">
              {item.isPurchasable
                ? `${item.shopPrice || "Automatic price"} gold`
                : "Loot only"}
            </p>
            <Link
              href={`/teacher/items?guild=${guild.id}&tier=${tier}&edit=${item.id}`}
            >
              <Button variant="outline" size="sm">
                Edit item
              </Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
