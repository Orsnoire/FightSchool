import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { Play, ArrowLeft, Skull, XCircle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import type { Fight, CombatState } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function HostFight() {
  const [, params] = useRoute("/teacher/host/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fightId = params?.id;

  const { data: fight } = useQuery<Fight>({
    queryKey: [`/api/fights/${fightId}`],
    enabled: !!fightId,
  });

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  // B6/B7 FIX: Connection status tracking for host
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");

  // B6/B7 FIX: Manual reconnect function for host
  const connectWebSocket = () => {
    if (!fightId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setConnectionStatus("connected");
      socket.send(JSON.stringify({ type: "host", fightId }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "session_created") {
        setSessionId(message.sessionId);
        setCombatState(message.state);
        setHasStarted(false);
      } else if (message.type === "combat_state") {
        setCombatState(message.state);
      } else if (message.type === "game_over") {
        toast({ 
          title: message.victory ? "Victory!" : "Fight Ended", 
          description: message.message 
        });
        setTimeout(() => navigate("/teacher"), 2000);
      }
    };

    socket.onclose = () => {
      setConnectionStatus("disconnected");
    };

    socket.onerror = () => {
      setConnectionStatus("disconnected");
    };

    setWs(socket);
    return socket;
  };

  useEffect(() => {
    const socket = connectWebSocket();
    return () => socket?.close();
  }, [fightId]);

  const startFight = () => {
    if (ws && !hasStarted) {
      ws.send(JSON.stringify({ type: "start_fight" }));
      setHasStarted(true);
      toast({ title: "Fight started!" });
    }
  };

  const endFight = () => {
    if (ws && hasStarted) {
      if (confirm("Are you sure you want to end this fight? All progress will be lost.")) {
        ws.send(JSON.stringify({ type: "end_fight" }));
        toast({ title: "Fight ended", description: "Students have been disconnected" });
        setHasStarted(false);
      }
    }
  };

  if (!fight) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  const playerCount = combatState ? Object.keys(combatState.players).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate("/teacher")} data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-serif font-bold" data-testid="text-fight-title">{fight.title}</h1>
          <div className="flex gap-2 items-center">
            {/* B6/B7 FIX: Connection status indicator for host */}
            <div className="flex items-center gap-2 px-3 py-1 rounded border border-border">
              {connectionStatus === "connected" && (
                <>
                  <Wifi className="h-4 w-4 text-health" data-testid="icon-host-connected" />
                  <span className="text-xs text-muted-foreground">Connected</span>
                </>
              )}
              {connectionStatus === "disconnected" && (
                <>
                  <WifiOff className="h-4 w-4 text-damage" data-testid="icon-host-disconnected" />
                  <span className="text-xs text-damage">Disconnected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      ws?.close();
                      connectWebSocket();
                    }}
                    data-testid="button-host-refresh"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                </>
              )}
            </div>
            <Button
              onClick={startFight}
              disabled={hasStarted || playerCount === 0 || connectionStatus !== "connected"}
              data-testid="button-start"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Fight
            </Button>
            <Button
              variant="destructive"
              onClick={endFight}
              disabled={!hasStarted || connectionStatus !== "connected"}
              data-testid="button-end-fight"
            >
              <XCircle className="mr-2 h-4 w-4" />
              End Fight
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Connected Students ({playerCount})</CardTitle>
              </CardHeader>
              <CardContent>
                {combatState && Object.keys(combatState.players).length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.values(combatState.players).map((player) => (
                      <Card key={player.studentId} className={player.isDead ? "opacity-50" : ""} data-testid={`player-${player.studentId}`}>
                        <CardContent className="p-4 flex flex-col items-center gap-2">
                          <div className="relative">
                            <PlayerAvatar
                              characterClass={player.characterClass}
                              gender={player.gender}
                              size="md"
                            />
                            {player.isDead && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Skull className="h-8 w-8 text-damage" />
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-center" data-testid={`text-name-${player.studentId}`}>
                            {player.nickname}
                          </span>
                          <HealthBar current={player.health} max={player.maxHealth} className="w-full" showText={false} />
                          {player.hasAnswered && combatState.currentPhase === "question" && (
                            <div className="text-xs text-health">✓ Answered</div>
                          )}
                          {(player.characterClass === "wizard" || player.characterClass === "scout") && (
                            <div className="text-xs text-muted-foreground">
                              Streak: {player.streakCounter}/3
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-6">Waiting for students to join...</p>
                    {sessionId && (
                      <div className="bg-primary/10 border-2 border-primary rounded-lg p-6 inline-block">
                        <p className="text-sm text-muted-foreground mb-2">Share this Session Code with students:</p>
                        <p className="text-4xl font-bold font-mono text-primary tracking-widest" data-testid="text-session-code">
                          {sessionId}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Battle Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Phase</p>
                  <p className="font-semibold capitalize" data-testid="text-phase">
                    {combatState?.currentPhase || "Waiting"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Question</p>
                  <p className="font-semibold" data-testid="text-question-index">
                    {combatState ? `${combatState.currentQuestionIndex + 1} / ${fight.questions.length}` : "0 / " + fight.questions.length}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Guild Code</p>
                  <p className="font-bold text-lg text-primary" data-testid="text-guild-code">{fight.guildCode}</p>
                </div>
              </CardContent>
            </Card>

            {combatState && combatState.enemies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Enemies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {combatState.enemies.map((enemy) => (
                    <div key={enemy.id} data-testid={`enemy-${enemy.id}`}>
                      <img src={enemy.image} alt={enemy.name} className="w-full h-32 object-cover rounded-md mb-2" />
                      <p className="font-semibold text-center mb-2">{enemy.name}</p>
                      <HealthBar current={enemy.health} max={enemy.maxHealth} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
