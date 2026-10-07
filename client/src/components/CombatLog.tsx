import { useEffect, useRef, useState } from "react";
import type { CombatEvent } from "@shared/combat/model";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

/** Keep recent feedback across round changes without growing the battlefield. */
export function CombatLog({ events }: { events: CombatEvent[] }) {
  const [history, setHistory] = useState<CombatEvent[]>([]);
  const [following, setFollowing] = useState(true);
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setHistory(previous => {
      const known = new Set(previous.map(event => JSON.stringify(event)));
      const added = events.filter(event => !known.has(JSON.stringify(event)));
      return added.length ? [...previous, ...added].slice(-200) : previous;
    });
  }, [events]);
  useEffect(() => {
    if (following && feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [history, following]);
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden h-72 lg:h-auto lg:min-h-64 lg:max-h-96" data-testid="combat-log">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <h2 className="font-semibold">Combat log</h2>
        {!following && <Button size="sm" variant="ghost" onClick={() => setFollowing(true)}>Jump to latest</Button>}
      </div>
      <div ref={feed} role="region" aria-label="Combat log entries" tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-2 text-sm"
        onScroll={event => { const el = event.currentTarget; setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 24); }}>
        {!history.length && <p className="text-muted-foreground">Combat updates will appear here.</p>}
        {history.map(event => <p key={JSON.stringify(event)} className="break-words"><span className="text-muted-foreground">R{event.round} · </span>{event.message}</p>)}
      </div>
    </Card>
  );
}
