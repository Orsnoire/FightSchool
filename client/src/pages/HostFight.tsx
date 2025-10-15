import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { Play, ArrowLeft, Skull } from "lucide-react";
import type { Fight, CombatState } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function HostFight() {
  const [, params] = useRoute("/teacher/host/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fightId = params?.id;

  const { data: fight } = useQuery<Fight>({
    queryKey: ["/api/fights", fightId],
    enabled: !!fightId,
  });

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!fightId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "host", fightId }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "combat_state") {
        setCombatState(message.state);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, [fightId]);

  const startFight = () => {
    if (ws && !hasStarted) {
      ws.send(JSON.stringify({ type: "start_fight" }));
      setHasStarted(true);
      toast({ title: "Fight started!" });
    }
  };

  if (!fight) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  const playerCount = combatState ? Object.keys(combatState.players).length : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/teacher")} data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-serif font-bold" data-testid="text-fight-title">{fight.title}</h1>
          <Button
            onClick={startFight}
            disabled={hasStarted || playerCount === 0}
            data-testid="button-start"
          >
            <Play className="mr-2 h-4 w-4" />
            Start Fight
          </Button>
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
                  <div className="text-center py-12 text-muted-foreground">
                    Waiting for students to join...
                    <div className="mt-4">
                      <p className="text-sm">Class Code: <span className="font-bold text-foreground">{fight.classCode}</span></p>
                    </div>
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
                  <p className="text-sm text-muted-foreground">Class Code</p>
                  <p className="font-bold text-lg text-primary" data-testid="text-class-code">{fight.classCode}</p>
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
