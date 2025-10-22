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
  // B10 FIX: Track answer feedback for damage toast
  const [lastAnsweredCorrectly, setLastAnsweredCorrectly] = useState<boolean | null>(null);
  const [previousPhase, setPreviousPhase] = useState<string>("");

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    
    let hasReceivedState = false;
    
    // Defensive timeout: if no combat_state within 5 seconds, show error and redirect
    const connectionTimeout = setTimeout(() => {
      if (!hasReceivedState) {
        toast({
          title: "Connection Failed",
          description: "Could not connect to the session. It may have ended.",
          variant: "destructive",
        });
        navigate("/student/lobby");
      }
    }, 5000);

    socket.onopen = () => {
      const studentId = localStorage.getItem("studentId");
      const sessionId = localStorage.getItem("sessionId");
      
      if (!sessionId) {
        toast({
          title: "No Session Code",
          description: "Please enter a session code to join",
          variant: "destructive",
        });
        navigate("/student/lobby");
        return;
      }
      
      socket.send(JSON.stringify({ type: "join", studentId, sessionId }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === "combat_state") {
        hasReceivedState = true;
        clearTimeout(connectionTimeout);
        setCombatState(message.state);
      } else if (message.type === "error") {
        clearTimeout(connectionTimeout);
        toast({
          title: "Error",
          description: message.message || "Failed to join session",
          variant: "destructive",
        });
        navigate("/student/lobby");
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
    return () => {
      clearTimeout(connectionTimeout);
      socket.close();
    };
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

  // B10 FIX: Show damage feedback toast when transitioning from question phase
  useEffect(() => {
    const studentId = localStorage.getItem("studentId");
    if (!combatState || !studentId) return;
    
    const currentPhase = combatState.currentPhase;
    const playerState = combatState.players[studentId];
    
    // Check if we just transitioned FROM question phase TO another phase
    if (previousPhase === "question" && currentPhase !== "question" && lastAnsweredCorrectly !== null) {
      // Show damage feedback toast
      if (lastAnsweredCorrectly) {
        // Player was correct - show damage dealt
        const baseDamage = playerState?.characterClass === "wizard" ? 3 : 
                          playerState?.characterClass === "scout" ? 2 : 
                          playerState?.characterClass === "herbalist" ? 1 : 2; // warrior
        toast({
          title: "Correct Answer!",
          description: `You dealt ${baseDamage}+ damage to the enemy`,
          duration: 2500,
        });
      } else {
        // Player was wrong - show damage taken (need to estimate from fight data)
        toast({
          title: "Incorrect Answer",
          description: "You took damage from the enemy",
          variant: "destructive",
          duration: 2500,
        });
      }
      // Reset feedback tracker
      setLastAnsweredCorrectly(null);
    }
    
    // Update previous phase
    setPreviousPhase(currentPhase);
  }, [combatState?.currentPhase, previousPhase, lastAnsweredCorrectly, toast]);

  const submitAnswer = () => {
    if (ws && selectedAnswer && currentQuestion) {
      // B10 FIX: Track if answer was correct for damage feedback toast
      const isCorrect = selectedAnswer.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();
      setLastAnsweredCorrectly(isCorrect);
      
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

  // Shuffle options if enabled - use question ID as seed for consistency
  // MUST be called before any early returns to comply with Rules of Hooks
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

  // Early return AFTER all hooks have been called
  if (!combatState) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Connecting...</div>;
  }

  const studentId = localStorage.getItem("studentId");
  const playerState = studentId ? combatState.players[studentId] : null;
  const enemy = combatState.enemies[0];

  // Split players into left and right columns (max 32 total, 16 per side)
  const allPlayers = Object.values(combatState.players).slice(0, 32);
  const leftPlayers = allPlayers.slice(0, 16);
  const rightPlayers = allPlayers.slice(16, 32);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* B4 FIX: Enemy section constrained to max 12.5vh (1/8 of viewport) */}
      {enemy && (
        <div className="bg-card border-b border-border p-2 flex items-center justify-center" style={{ maxHeight: '12.5vh' }}>
          <div className="flex items-center gap-4 h-full">
            <img
              src={enemy.image}
              alt={enemy.name}
              className="object-contain rounded-lg"
              style={{ maxHeight: '10vh', maxWidth: '15vw' }}
              data-testid="img-enemy"
            />
            <div className="flex flex-col justify-center">
              <h2 className="text-xl font-serif font-bold truncate" data-testid="text-enemy-name">{enemy.name}</h2>
              <HealthBar current={enemy.health} max={enemy.maxHealth} className="w-48" />
            </div>
          </div>
        </div>
      )}

      {/* B4 FIX: Main combat area with fixed viewport sizing */}
      <div className="flex-1 flex gap-2 px-2 overflow-hidden" style={{ height: 'calc(100vh - 12.5vh - 10vh)' }}>
        {/* B4 FIX: Left column - 2-column grid, tiny avatars, no names */}
        <div className="flex-shrink-0 hidden lg:block overflow-y-auto" style={{ width: '10vw' }} data-testid="players-left-column">
          <div className="grid grid-cols-2 gap-1">
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
                  className={`p-1 rounded bg-card border flex flex-col items-center ${
                    player.isDead ? 'opacity-40' : ''
                  } ${isBeingBlocked ? 'border-warrior' : isBeingHealed ? 'border-health' : 'border-border'}`} 
                  data-testid={`avatar-left-${player.studentId}`}
                  title={player.nickname}
                >
                  <div style={{ width: '24px', height: '24px' }}>
                    <PlayerAvatar characterClass={player.characterClass} gender={player.gender} size="xs" />
                  </div>
                  <div className="mt-0.5 w-full bg-destructive/30 rounded-sm overflow-hidden" style={{ height: '1px' }}>
                    <div 
                      className={`h-full transition-all ${
                        (player.health / player.maxHealth) > 0.6 ? 'bg-health' : 
                        (player.health / player.maxHealth) > 0.3 ? 'bg-warning' : 'bg-damage'
                      }`}
                      style={{ width: `${Math.max(0, (player.health / player.maxHealth) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
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

        {/* B4 FIX: Right column - 2-column grid, tiny avatars, no names */}
        <div className="flex-shrink-0 hidden lg:block overflow-y-auto" style={{ width: '10vw' }} data-testid="players-right-column">
          <div className="grid grid-cols-2 gap-1">
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
                  className={`p-1 rounded bg-card border flex flex-col items-center ${
                    player.isDead ? 'opacity-40' : ''
                  } ${isBeingBlocked ? 'border-warrior' : isBeingHealed ? 'border-health' : 'border-border'}`} 
                  data-testid={`avatar-right-${player.studentId}`}
                  title={player.nickname}
                >
                  <div style={{ width: '24px', height: '24px' }}>
                    <PlayerAvatar characterClass={player.characterClass} gender={player.gender} size="xs" />
                  </div>
                  <div className="mt-0.5 w-full bg-destructive/30 rounded-sm overflow-hidden" style={{ height: '1px' }}>
                    <div 
                      className={`h-full transition-all ${
                        (player.health / player.maxHealth) > 0.6 ? 'bg-health' : 
                        (player.health / player.maxHealth) > 0.3 ? 'bg-warning' : 'bg-damage'
                      }`}
                      style={{ width: `${Math.max(0, (player.health / player.maxHealth) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* B4 FIX: Player footer constrained to fixed height */}
      {playerState && (
        <div className="bg-card border-t border-border p-2" style={{ height: '10vh' }}>
          <div className="flex items-center gap-3 h-full max-w-7xl mx-auto">
            <div style={{ width: '48px', height: '48px' }}>
              <PlayerAvatar characterClass={playerState.characterClass} gender={playerState.gender} size="md" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold truncate" data-testid="text-player-nickname">{playerState.nickname}</span>
                <div className="flex gap-2 text-xs">
                  {playerState.characterClass === "wizard" && (
                    <>
                      {playerState.fireballCooldown > 0 ? (
                        <span className="text-muted-foreground whitespace-nowrap" data-testid="text-fireball-cooldown">
                          🔥 CD: {playerState.fireballCooldown}
                        </span>
                      ) : (
                        <span className="text-wizard font-semibold whitespace-nowrap" data-testid="text-fireball-charge">
                          🔥 {playerState.fireballChargeRounds}
                        </span>
                      )}
                    </>
                  )}
                  {playerState.characterClass === "scout" && (
                    <span className="text-scout font-semibold whitespace-nowrap" data-testid="text-streak">
                      ⚡ {playerState.streakCounter}/3
                    </span>
                  )}
                </div>
              </div>
              <HealthBar current={playerState.health} max={playerState.maxHealth} />
            </div>
          </div>
        </div>
      )}
      
      {showVictoryModal && victoryData && playerState && combatState && (
        <VictoryModal
          fightId={combatState.fightId}
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
