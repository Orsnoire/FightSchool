import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Zap, Heart, Shield, Skull, Sparkles, Swords, Maximize2, Minimize2 } from "lucide-react";

export interface CombatLogEvent {
  id: string;
  timestamp: number;
  type: "damage" | "heal" | "block" | "death" | "phase_change" | "ability" | "info";
  message: string;
  playerName?: string;
  targetName?: string;
  value?: number;
}

interface CombatLogProps {
  events: CombatLogEvent[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function CombatLog({ events, isFullscreen = false, onToggleFullscreen }: CombatLogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new events come in
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  // Detect manual scroll and disable auto-scroll if user scrolls up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 10;
    setAutoScroll(isAtBottom);
  };

  const filteredEvents = events.filter((event) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      event.message.toLowerCase().includes(query) ||
      event.playerName?.toLowerCase().includes(query) ||
      event.targetName?.toLowerCase().includes(query)
    );
  });

  const getEventIcon = (type: CombatLogEvent["type"]) => {
    switch (type) {
      case "damage":
        return <Zap className="h-4 w-4 text-damage" />;
      case "heal":
        return <Heart className="h-4 w-4 text-health" />;
      case "block":
        return <Shield className="h-4 w-4 text-warrior" />;
      case "death":
        return <Skull className="h-4 w-4 text-destructive" />;
      case "ability":
        return <Sparkles className="h-4 w-4 text-primary" />;
      case "phase_change":
        return <Swords className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Combat Log</CardTitle>
          {onToggleFullscreen && (
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleFullscreen}
              data-testid="button-toggle-fullscreen"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4 mr-1" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-1" />
                  Fullscreen
                </>
              )}
            </Button>
          )}
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="input-search-combat-log"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-6 pb-4"
        >
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No matching events found" : "Combat events will appear here..."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2 p-2 rounded-md hover-elevate text-sm"
                  data-testid={`log-event-${event.id}`}
                >
                  <div className="flex-shrink-0 mt-0.5">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatTime(event.timestamp)}
                      </span>
                      <span className="flex-1 break-words">{event.message}</span>
                      {event.value !== undefined && (
                        <span className={`text-xs font-bold ${
                          event.type === "damage" ? "text-damage" : 
                          event.type === "heal" ? "text-health" : 
                          "text-muted-foreground"
                        }`}>
                          {event.type === "heal" ? "+" : ""}{event.value}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
