import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { useToast } from "@/hooks/use-toast";
import { Check, Clock, Shield } from "lucide-react";
import type { CombatState, Question } from "@shared/schema";

export default function Combat() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isHealing, setIsHealing] = useState(false);
  const [healTarget, setHealTarget] = useState<string>("");
  const [isCreatingPotion, setIsCreatingPotion] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      const studentId = localStorage.getItem("studentId");
      const fightId = localStorage.getItem("fightId");
      socket.send(JSON.stringify({ type: "join", studentId, fightId }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === "combat_state") {
        setCombatState(message.state);
      } else if (message.type === "question") {
        setCurrentQuestion(message.question);
        setSelectedAnswer("");
        setTimeRemaining(message.question.timeLimit);
        setIsHealing(false);
        setHealTarget("");
        setIsCreatingPotion(false);
      } else if (message.type === "phase_change") {
        toast({ title: message.phase });
      } else if (message.type === "game_over") {
        toast({ title: message.victory ? "Victory!" : "Defeat", description: message.message });
        setTimeout(() => navigate("/student/lobby"), 3000);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, [navigate, toast]);

  useEffect(() => {
    if (timeRemaining > 0 && combatState?.currentPhase === "question") {
      const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeRemaining, combatState?.currentPhase]);

  const submitAnswer = () => {
    if (ws && selectedAnswer) {
      // If creating potion, send create_potion message first
      if (isCreatingPotion) {
        ws.send(JSON.stringify({ type: "create_potion" }));
      }
      
      ws.send(JSON.stringify({ 
        type: "answer", 
        answer: selectedAnswer,
        isHealing,
        healTarget
      }));
    }
  };

  const selectBlockTarget = (targetId: string) => {
    if (ws) {
      ws.send(JSON.stringify({ type: "block", targetId }));
    }
  };

  const selectHealTarget = (targetId: string) => {
    if (ws) {
      ws.send(JSON.stringify({ type: "heal", targetId }));
    }
  };

  if (!combatState) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Connecting...</div>;
  }

  const studentId = localStorage.getItem("studentId");
  const playerState = studentId ? combatState.players[studentId] : null;
  const enemy = combatState.enemies[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {enemy && (
        <div className="bg-card border-b border-border p-6">
          <div className="container mx-auto max-w-4xl">
            <div className="flex flex-col items-center gap-4">
              <img
                src={enemy.image}
                alt={enemy.name}
                className="w-48 h-48 object-cover rounded-lg"
                data-testid="img-enemy"
              />
              <h2 className="text-3xl font-serif font-bold" data-testid="text-enemy-name">{enemy.name}</h2>
              <HealthBar current={enemy.health} max={enemy.maxHealth} className="w-full max-w-md" />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="container mx-auto max-w-4xl">
          {combatState.currentPhase === "question" && currentQuestion && (
            <Card className="p-8 border-primary/30">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold" data-testid="text-question">{currentQuestion.question}</h3>
                <div className="flex items-center gap-2 text-warning">
                  <Clock className="h-5 w-5" />
                  <span className="text-xl font-bold" data-testid="text-timer">{timeRemaining}s</span>
                </div>
              </div>

              {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
                <div className="space-y-3">
                  {currentQuestion.options.map((option, i) => (
                    <Button
                      key={i}
                      variant={selectedAnswer === option ? "default" : "outline"}
                      className="w-full justify-start text-left h-auto py-4"
                      onClick={() => setSelectedAnswer(option)}
                      data-testid={`button-option-${i}`}
                    >
                      <span className="font-semibold mr-3">{String.fromCharCode(65 + i)}.</span>
                      {option}
                    </Button>
                  ))}
                </div>
              )}

              {currentQuestion.type === "true_false" && (
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={selectedAnswer === "true" ? "default" : "outline"}
                    className="h-20"
                    onClick={() => setSelectedAnswer("true")}
                    data-testid="button-true"
                  >
                    True
                  </Button>
                  <Button
                    variant={selectedAnswer === "false" ? "default" : "outline"}
                    className="h-20"
                    onClick={() => setSelectedAnswer("false")}
                    data-testid="button-false"
                  >
                    False
                  </Button>
                </div>
              )}

              {currentQuestion.type === "short_answer" && (
                <input
                  type="text"
                  value={selectedAnswer}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  className="w-full p-4 border border-border rounded-md bg-background"
                  placeholder="Type your answer..."
                  data-testid="input-answer"
                />
              )}

              {playerState?.characterClass === "herbalist" && (
                <div className="mt-6 p-4 border border-health/30 rounded-md bg-health/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-health">Potions: {playerState.potionCount}</span>
                  </div>
                  
                  {playerState.potionCount > 0 ? (
                    <>
                      <label className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          checked={isHealing}
                          onChange={(e) => setIsHealing(e.target.checked)}
                          className="w-4 h-4"
                          data-testid="checkbox-healing"
                        />
                        <span className="text-sm font-medium text-health">Use potion to heal (in Phase 2)</span>
                      </label>
                      {isHealing && (
                        <div className="grid grid-cols-3 gap-2">
                          {Object.values(combatState.players).filter((p) => !p.isDead).map((player) => (
                            <Button
                              key={player.studentId}
                              variant={healTarget === player.studentId ? "default" : "outline"}
                              className="h-auto p-2 flex flex-col items-center gap-1"
                              onClick={() => setHealTarget(player.studentId)}
                              size="sm"
                              data-testid={`button-heal-${player.studentId}`}
                            >
                              <PlayerAvatar characterClass={player.characterClass} gender={player.gender} size="sm" />
                              <span className="text-xs">{player.nickname}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <div className="text-sm text-muted-foreground mb-3">
                        <p>No potions remaining!</p>
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isCreatingPotion}
                          onChange={(e) => setIsCreatingPotion(e.target.checked)}
                          className="w-4 h-4"
                          data-testid="checkbox-create-potion"
                        />
                        <span className="text-sm font-medium text-health">Create potion instead of dealing damage</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <Button
                size="lg"
                className="w-full mt-6"
                onClick={submitAnswer}
                disabled={!selectedAnswer || playerState?.hasAnswered || (isHealing && !healTarget)}
                data-testid="button-submit"
              >
                {playerState?.hasAnswered ? (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Answer Submitted
                  </>
                ) : isHealing ? (
                  "Heal Target"
                ) : (
                  "Submit Answer"
                )}
              </Button>
            </Card>
          )}

          {combatState.currentPhase === "tank_blocking" && playerState?.characterClass === "warrior" && (
            <Card className="p-8">
              <h3 className="text-2xl font-bold mb-6">Select Ally to Protect</h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.values(combatState.players).filter((p) => !p.isDead).map((player) => (
                  <Button
                    key={player.studentId}
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2"
                    onClick={() => selectBlockTarget(player.studentId)}
                    data-testid={`button-block-${player.studentId}`}
                  >
                    <PlayerAvatar characterClass={player.characterClass} gender={player.gender} size="sm" />
                    <span className="text-sm font-semibold">{player.nickname}</span>
                    <Shield className="h-4 w-4 text-warrior" />
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {playerState && (
        <div className="bg-card border-t border-border p-4">
          <div className="container mx-auto max-w-4xl flex items-center gap-6">
            <PlayerAvatar characterClass={playerState.characterClass} gender={playerState.gender} size="md" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold" data-testid="text-player-nickname">{playerState.nickname}</span>
                <div className="flex gap-3 text-sm">
                  {playerState.characterClass === "wizard" && (
                    <>
                      {playerState.fireballCooldown > 0 ? (
                        <span className="text-muted-foreground" data-testid="text-fireball-cooldown">
                          🔥 Cooldown: {playerState.fireballCooldown}
                        </span>
                      ) : (
                        <span className="text-wizard font-semibold" data-testid="text-fireball-charge">
                          🔥 Charge: {playerState.fireballChargeRounds}
                        </span>
                      )}
                    </>
                  )}
                  {playerState.characterClass === "scout" && (
                    <span className="text-scout font-semibold" data-testid="text-streak">
                      ⚡ Streak: {playerState.streakCounter}/3
                    </span>
                  )}
                </div>
              </div>
              <HealthBar current={playerState.health} max={playerState.maxHealth} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
