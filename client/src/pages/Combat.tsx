import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { VictoryModal } from "@/components/VictoryModal";
import { useToast } from "@/hooks/use-toast";
import { Check, Clock, Shield } from "lucide-react";
import type { CombatState, Question, LootItem } from "@shared/schema";
import { getFireballMaxChargeRounds } from "@shared/jobSystem";

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
  const [isChargingFireball, setIsChargingFireball] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [victoryData, setVictoryData] = useState<{
    xpGained: number;
    leveledUp: boolean;
    newLevel: number;
    currentXP: number;
    lootTable: LootItem[];
  } | null>(null);
  // B5 FIX: Add phase change modal state
  const [showPhaseChangeModal, setShowPhaseChangeModal] = useState(false);
  const [phaseChangeName, setPhaseChangeName] = useState<string>("");
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);

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
        if (message.shuffleOptions !== undefined) {
          setShuffleOptions(message.shuffleOptions);
        }
        // Don't reset isChargingFireball - let it persist from server state
      } else if (message.type === "phase_change") {
        // B5 FIX: Show phase change modal instead of toast
        setPhaseChangeName(message.phase);
        setShowPhaseChangeModal(true);
      } else if (message.type === "game_over") {
        if (message.victory && message.xpGained !== undefined) {
          // Victory with XP data - show victory modal
          setVictoryData({
            xpGained: message.xpGained,
            leveledUp: message.leveledUp,
            newLevel: message.newLevel,
            currentXP: message.currentXP,
            lootTable: message.lootTable || [],
          });
          setShowVictoryModal(true);
        } else {
          // Defeat or basic game over - show toast and navigate
          toast({ title: message.victory ? "Victory!" : "Defeat", description: message.message });
          setTimeout(() => navigate("/student/lobby"), 3000);
        }
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

  // Sync charging state from server
  useEffect(() => {
    const studentId = localStorage.getItem("studentId");
    if (combatState && studentId) {
      const playerState = combatState.players[studentId];
      if (playerState?.isChargingFireball !== undefined) {
        setIsChargingFireball(playerState.isChargingFireball);
      }
    }
  }, [combatState]);

  // B5 FIX: Auto-dismiss phase change modal after 3 seconds
  useEffect(() => {
    if (showPhaseChangeModal) {
      const timer = setTimeout(() => {
        setShowPhaseChangeModal(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showPhaseChangeModal]);

  const submitAnswer = () => {
    if (ws && selectedAnswer) {
      // If creating potion, send create_potion message first
      if (isCreatingPotion) {
        ws.send(JSON.stringify({ type: "create_potion" }));
      }
      
      // If charging fireball, send charge_fireball message first
      if (isChargingFireball) {
        ws.send(JSON.stringify({ type: "charge_fireball" }));
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

  // Shuffle options if enabled - use question ID as seed for consistency
  const displayOptions = useMemo(() => {
    if (!currentQuestion || currentQuestion.type === "short_answer") return null;
    
    if (currentQuestion.type === "true_false") {
      if (!shuffleOptions) return ["true", "false"];
      // Simple shuffle for true/false based on question ID
      const seed = parseInt(currentQuestion.id) || 0;
      return seed % 2 === 0 ? ["true", "false"] : ["false", "true"];
    }
    
    if (currentQuestion.type === "multiple_choice" && currentQuestion.options) {
      if (!shuffleOptions) return currentQuestion.options;
      
      // Fisher-Yates shuffle with seed
      const options = [...currentQuestion.options];
      const seed = parseInt(currentQuestion.id) || 0;
      let random = seed;
      
      for (let i = options.length - 1; i > 0; i--) {
        random = (random * 9301 + 49297) % 233280;
        const j = Math.floor((random / 233280) * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      
      return options;
    }
    
    return null;
  }, [currentQuestion, shuffleOptions]);

  // Split players into left and right columns (max 32 total, 16 per side)
  const allPlayers = Object.values(combatState.players).slice(0, 32);
  const leftPlayers = allPlayers.slice(0, 16);
  const rightPlayers = allPlayers.slice(16, 32);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {enemy && (
        <div className="bg-card border-b border-border p-6">
          <div className="container mx-auto max-w-7xl">
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

      <div className="flex-1 flex p-4 gap-4">
        {/* Left column: Player avatars (50% smaller) */}
        <div className="w-20 flex-shrink-0 space-y-2 hidden lg:block" data-testid="players-left-column">
          {leftPlayers.map((player) => {
            const isBeingBlocked = Object.values(combatState.players).some(
              p => p.blockTarget === player.studentId && p.characterClass === "warrior" && !p.isDead
            );
            const isBeingHealed = Object.values(combatState.players).some(
              p => p.isHealing && p.healTarget === player.studentId && p.characterClass === "herbalist" && !p.isDead
            );
            
            return (
              <div 
                key={player.studentId} 
                className={`p-2 rounded-md bg-card border ${
                  player.isDead ? 'opacity-50' : ''
                } ${isBeingBlocked ? 'border-warrior border-2' : isBeingHealed ? 'border-health border-2' : ''}`} 
                data-testid={`avatar-left-${player.studentId}`}
              >
                <PlayerAvatar characterClass={player.characterClass} gender={player.gender} size="xs" />
                <div className="text-xs text-center mt-1 truncate" title={player.nickname}>{player.nickname}</div>
                <HealthBar current={player.health} max={player.maxHealth} showText={false} className="mt-1" />
                {(isBeingBlocked || isBeingHealed) && (
                  <div className="flex items-center justify-center mt-1">
                    {isBeingBlocked && <Shield className="h-3 w-3 text-warrior" />}
                    {isBeingHealed && <span className="text-health text-xs">+</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Center column: Main content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-4xl">
          {/* B5 FIX: Phase change modal matching question modal styling */}
          {showPhaseChangeModal && (
            <Card className="p-8 border-primary/30">
              <div className="flex items-center justify-center">
                <h2 className="text-4xl font-bold text-center" data-testid="text-phase-change">{phaseChangeName}</h2>
              </div>
            </Card>
          )}
          
          {/* B5 FIX: Only show question modal when phase change modal is not visible */}
          {!showPhaseChangeModal && combatState.currentPhase === "question" && currentQuestion && (
            <Card className="p-8 border-primary/30">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold" data-testid="text-question">{currentQuestion.question}</h3>
                <div className="flex items-center gap-2 text-warning">
                  <Clock className="h-5 w-5" />
                  <span className="text-xl font-bold" data-testid="text-timer">{timeRemaining}s</span>
                </div>
              </div>

              {currentQuestion.type === "multiple_choice" && displayOptions && (
                <div className="space-y-3">
                  {displayOptions.map((option, i) => (
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

              {currentQuestion.type === "true_false" && displayOptions && (
                <div className="grid grid-cols-2 gap-4">
                  {displayOptions.map((option, i) => (
                    <Button
                      key={i}
                      variant={selectedAnswer === option ? "default" : "outline"}
                      className="h-20"
                      onClick={() => setSelectedAnswer(option)}
                      data-testid={i === 0 ? "button-true" : "button-false"}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Button>
                  ))}
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
                    <span className="text-sm font-medium text-health">Potions: {playerState.potionCount} / 5</span>
                  </div>
                  
                  {playerState.potionCount > 0 && (
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
                          {Object.values(combatState.players).filter((p) => !p.isDead).map((player) => {
                            const isMyTarget = healTarget === player.studentId;
                            const allHealers = Object.values(combatState.players).filter(
                              p => p.isHealing && 
                              p.healTarget === player.studentId && 
                              p.characterClass === "herbalist" && 
                              !p.isDead
                            );
                            const otherHealers = allHealers.filter(p => p.studentId !== studentId);
                            const isBeingHealed = allHealers.length > 0;
                            
                            return (
                              <Button
                                key={player.studentId}
                                variant={isBeingHealed ? "default" : "outline"}
                                className={`h-auto p-2 flex flex-col items-center gap-1 ${
                                  isBeingHealed ? 'bg-health border-health text-white' : ''
                                }`}
                                onClick={() => setHealTarget(player.studentId)}
                                size="sm"
                                data-testid={`button-heal-${player.studentId}`}
                              >
                                <PlayerAvatar characterClass={player.characterClass} gender={player.gender} size="sm" />
                                <span className="text-xs">{player.nickname}</span>
                                <HealthBar current={player.health} max={player.maxHealth} showText={false} className="w-full" />
                                <div className="flex items-center gap-1 text-xs">
                                  {isMyTarget && <span>✓</span>}
                                  {otherHealers.length > 0 && (
                                    <span>{otherHealers.length} other healer{otherHealers.length > 1 ? 's' : ''}</span>
                                  )}
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                  
                  {playerState.potionCount < 5 && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isCreatingPotion}
                        onChange={(e) => setIsCreatingPotion(e.target.checked)}
                        className="w-4 h-4"
                        data-testid="checkbox-create-potion"
                      />
                      <span className="text-sm font-medium text-health">Craft potion instead of dealing damage</span>
                    </label>
                  )}
                </div>
              )}

              {playerState?.characterClass === "wizard" && playerState.fireballCooldown === 0 && (() => {
                const wizardLevel = playerState.jobLevels?.wizard || 0;
                const maxChargeRounds = getFireballMaxChargeRounds(wizardLevel);
                return (
                  <div className="mt-6 p-4 border border-wizard/30 rounded-md bg-wizard/10">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChargingFireball}
                        onChange={(e) => setIsChargingFireball(e.target.checked)}
                        className="w-4 h-4"
                        data-testid="checkbox-charge-fireball"
                      />
                      <span className="text-sm font-medium text-wizard">
                        Charge fireball (takes {maxChargeRounds} turns, deals 2x damage)
                      </span>
                    </label>
                    {playerState.fireballChargeRounds > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Charging: {playerState.fireballChargeRounds} / {maxChargeRounds} turns
                      </div>
                    )}
                  </div>
                );
              })()}

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

          {combatState.currentPhase === "tank_blocking" && playerState?.characterClass === "warrior" && !playerState.isDead && (
            <Card className="p-8">
              <h3 className="text-2xl font-bold mb-6">Select Ally to Protect</h3>
              <div className="grid grid-cols-3 gap-4">
                {Object.values(combatState.players).filter((p) => !p.isDead).map((player) => {
                  const isMyTarget = playerState.blockTarget === player.studentId;
                  const allBlockers = Object.values(combatState.players).filter(
                    p => p.blockTarget === player.studentId && 
                    p.characterClass === "warrior" && 
                    !p.isDead
                  );
                  const otherBlockers = allBlockers.filter(p => p.studentId !== studentId);
                  const isBeingBlocked = allBlockers.length > 0;
                  
                  return (
                    <Button
                      key={player.studentId}
                      variant={isBeingBlocked ? "default" : "outline"}
                      className={`h-auto p-4 flex flex-col items-center gap-2 ${
                        isBeingBlocked ? 'bg-warrior border-warrior text-white' : ''
                      }`}
                      onClick={() => selectBlockTarget(player.studentId)}
                      data-testid={`button-block-${player.studentId}`}
                    >
                      <PlayerAvatar characterClass={player.characterClass} gender={player.gender} size="sm" />
                      <span className="text-sm font-semibold">{player.nickname}</span>
                      <HealthBar current={player.health} max={player.maxHealth} showText={false} className="w-full" />
                      <div className="flex items-center gap-1">
                        {isMyTarget && <Shield className="h-4 w-4" />}
                        {otherBlockers.length > 0 && (
                          <div className="text-xs">{otherBlockers.length} other tank{otherBlockers.length > 1 ? 's' : ''}</div>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>
            </Card>
          )}
          </div>
        </div>

        {/* Right column: Player avatars (50% smaller) */}
        <div className="w-20 flex-shrink-0 space-y-2 hidden lg:block" data-testid="players-right-column">
          {rightPlayers.map((player) => {
            const isBeingBlocked = Object.values(combatState.players).some(
              p => p.blockTarget === player.studentId && p.characterClass === "warrior" && !p.isDead
            );
            const isBeingHealed = Object.values(combatState.players).some(
              p => p.isHealing && p.healTarget === player.studentId && p.characterClass === "herbalist" && !p.isDead
            );
            
            return (
              <div 
                key={player.studentId} 
                className={`p-2 rounded-md bg-card border ${
                  player.isDead ? 'opacity-50' : ''
                } ${isBeingBlocked ? 'border-warrior border-2' : isBeingHealed ? 'border-health border-2' : ''}`} 
                data-testid={`avatar-right-${player.studentId}`}
              >
                <PlayerAvatar characterClass={player.characterClass} gender={player.gender} size="xs" />
                <div className="text-xs text-center mt-1 truncate" title={player.nickname}>{player.nickname}</div>
                <HealthBar current={player.health} max={player.maxHealth} showText={false} className="mt-1" />
                {(isBeingBlocked || isBeingHealed) && (
                  <div className="flex items-center justify-center mt-1">
                    {isBeingBlocked && <Shield className="h-3 w-3 text-warrior" />}
                    {isBeingHealed && <span className="text-health text-xs">+</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {playerState && (
        <div className="bg-card border-t border-border p-4">
          <div className="container mx-auto max-w-7xl flex items-center gap-6">
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
      
      {showVictoryModal && victoryData && playerState && (
        <VictoryModal
          fightId={localStorage.getItem("fightId") || ""}
          characterClass={playerState.characterClass}
          gender={playerState.gender}
          xpGained={victoryData.xpGained}
          leveledUp={victoryData.leveledUp}
          newLevel={victoryData.newLevel}
          currentXP={victoryData.currentXP}
          lootTable={victoryData.lootTable}
          onClose={() => navigate("/student/lobby")}
        />
      )}
    </div>
  );
}
