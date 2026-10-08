import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { rewardLabels, type QuestProgress } from "@shared/quests";
import type { Quest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
export type QuestView = Quest & { progress: QuestProgress };
export function QuestBoard({ guildId }: { guildId: string }) {
  const [tab, setTab] = useState("personal");
  const { toast } = useToast();
  const client = useQueryClient();
  const query = useQuery<QuestView[]>({
    queryKey: [`/api/guilds/${guildId}/quests`],
    refetchInterval: 20000,
    refetchOnWindowFocus: "always",
  });
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!query.data) return;
    const now = new Set(
      query.data
        .filter((q) => q.isCompleted)
        .map((q) => q.id + ":" + q.completedWeek),
    );
    if (seen.current) {
      const earned = [...now].filter((k) => !seen.current!.has(k));
      if (earned.length) {
        toast({
          title:
            earned.length === 1
              ? "Quest complete!"
              : `${earned.length} quests complete!`,
          description: "Rewards have been added automatically.",
        });
        client.invalidateQueries({
          predicate: (q) =>
            String(q.queryKey[0]).startsWith("/api/student/") ||
            q.queryKey[0] === `/api/guilds/${guildId}`,
        });
      }
    }
    seen.current = now;
  }, [query.data, guildId, toast, client]);
  useEffect(() => {
    seen.current = null;
  }, [guildId]);
  const rows = (query.data || []).filter(
    (q) =>
      !q.isArchived &&
      (tab === "completed"
        ? q.isCompleted
        : !q.isCompleted &&
          (tab === "personal" ? !!q.studentId : !q.studentId)),
  );
  return (
    <Card className="h-full flex flex-col min-h-0 p-4 gap-3">
      <div>
        <h2 className="font-bold text-lg">Quest board</h2>
        <p className="text-xs text-muted-foreground">
          Track your next goal. Rewards arrive automatically.
        </p>
      </div>
      <div
        className="flex gap-1 flex-wrap"
        role="tablist"
        aria-label="Quest categories"
      >
        {["personal", "guild", "completed"].map((t) => (
          <Button
            key={t}
            size="sm"
            role="tab"
            aria-selected={t === tab}
            variant={t === tab ? "default" : "outline"}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>
      <div className="overflow-y-auto min-h-0 space-y-3" role="tabpanel">
        {query.isLoading && <p>Loading quests…</p>}
        {query.isError && (
          <div role="alert">
            Could not load quests.{" "}
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!query.isLoading && !query.isError && !rows.length && (
          <p className="text-sm text-muted-foreground">
            No {tab} quests to show.
          </p>
        )}
        {rows.map((q) => (
          <article key={q.id} className="border rounded-lg p-3 space-y-2">
            <h3 className="font-semibold">{q.title}</h3>
            <p className="text-sm">{q.description}</p>
            {q.isCompleted ? (
              <p className="text-sm text-green-700">
                Completed · rewards granted
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {q.progress?.label} ·{" "}
                  {Math.min(
                    q.progress?.current || 0,
                    q.progress?.target || 1,
                  ).toFixed((q.progress?.current || 0) % 1 ? 1 : 0)}{" "}
                  / {q.progress?.target || 1}
                </p>
                <progress
                  className="w-full h-2"
                  aria-label={`${q.title} progress`}
                  value={Math.min(
                    q.progress?.current || 0,
                    q.progress?.target || 1,
                  )}
                  max={q.progress?.target || 1}
                />
              </>
            )}
            <p className="text-xs font-medium">
              {rewardLabels(q.rewards).join(" · ") || "Milestone"}
            </p>
          </article>
        ))}
      </div>
    </Card>
  );
}
