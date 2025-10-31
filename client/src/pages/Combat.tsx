import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { HealthBar } from "@/components/HealthBar";
import { MPBar } from "@/components/MPBar";
import { ComboPoints } from "@/components/ComboPoints";
import { VictoryModal } from "@/components/VictoryModal";
import { AbilitySelectionModal } from "@/components/AbilitySelectionModal";
import { TargetSelectionModal } from "@/components/TargetSelectionModal";
import { BlockTargetSelectionModal } from "@/components/BlockTargetSelectionModal";
import { FloatingNumber } from "@/components/FloatingNumber";
import { CombatFeedbackModal } from "@/components/CombatFeedbackModal";
import { PartyDamageModal } from "@/components/PartyDamageModal";
import { EnemyAIModal } from "@/components/EnemyAIModal";
import { CounterattackModal } from "@/components/CounterattackModal";
import { NextQuestionModal } from "@/components/NextQuestionModal";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { MathEditor } from "@/components/MathEditor";
import { useToast } from "@/hooks/use-toast";
import { Check, Clock, Shield, Wifi, WifiOff, RefreshCw, Swords, Calculator, Sparkles } from "lucide-react";
import type { CombatState, Question, LootItem, CharacterClass, Gender, ResolutionFeedback, PartyDamageData, EnemyAIAttackData, PlayerState } from "@shared/schema";
import { TANK_CLASSES, HEALER_CLASSES } from "@shared/schema";
import { type AnimationType, ULTIMATE_ABILITIES } from "@shared/ultimateAbilities";
import { UltimateAnimation } from "@/components/UltimateAnimation";
import { ABILITY_DISPLAYS, JOB_ABILITY_SLOTS } from "@shared/abilityUI";
import { motion, AnimatePresence } from "framer-motion";

export default function Combat() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [combatState, setCombatState] = useState<CombatState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [abilitiesTimeRemaining, setAbilitiesTimeRemaining] = useState<number | undefined>(undefined);
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [showAbilityModal, setShowAbilityModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showBlockTargetModal, setShowBlockTargetModal] = useState(false);
  const [targetType, setTargetType] = useState<"enemy" | "ally">("enemy");
  const [mathMode, setMathMode] = useState(false);
  const [usedAbilityInPhase1, setUsedAbilityInPhase1] = useState<string | null>(null);
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
  const [previousPhase, setPreviousPhase] = useState<string>("");
  // Track previous combat state for detecting healing, blocking, and enemy attacks
  const [previousCombatState, setPreviousCombatState] = useState<CombatState | null>(null);
  // Animation state for attacks
  const [isEnemyHit, setIsEnemyHit] = useState(false);
  const [isPlayerHit, setIsPlayerHit] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  // Floating damage numbers
  const [floatingNumbers, setFloatingNumbers] = useState<Array<{ id: string; value: number; type: "damage" | "heal" }>>([]);
  // Shield block animation
  const [showShieldPulse, setShowShieldPulse] = useState(false);
  // Healing pulse animation
  const [showHealingPulse, setShowHealingPulse] = useState(false);
  // Animation timer refs for cleanup
  const enemyHitDelayTimer = useRef<NodeJS.Timeout | null>(null);
  const enemyHitResetTimer = useRef<NodeJS.Timeout | null>(null);
  const playerHitDelayTimer = useRef<NodeJS.Timeout | null>(null);
  const playerHitResetTimer = useRef<NodeJS.Timeout | null>(null);
  const shieldPulseTimer = useRef<NodeJS.Timeout | null>(null);
  const healingPulseTimer = useRef<NodeJS.Timeout | null>(null);
  // B6/B7 FIX: Connection status and reconnection logic
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const isUnmounting = useRef(false);
  const gameIsOver = useRef(false);
  // Ultimate ability animation state
  const [showUltimateAnimation, setShowUltimateAnimation] = useState(false);
  const [ultimateAnimationData, setUltimateAnimationData] = useState<{
    playerName: string;
    ultimateName: string;
    animationType: AnimationType;
    currentClass: CharacterClass;
    currentGender: Gender;
  } | null>(null);
  // Smart submit button: show fixed button when primary button is scrolled out of view
  const [showFixedSubmit, setShowFixedSubmit] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const primarySubmitRef = useRef<HTMLButtonElement>(null);
  
  // Resolution feedback system
  const [feedbackQueue, setFeedbackQueue] = useState<ResolutionFeedback[]>([]);
  const [partyDamageData, setPartyDamageData] = useState<PartyDamageData | null>(null);
  const [currentModalIndex, setCurrentModalIndex] = useState(0);
  const [resolutionPhaseStartTime, setResolutionPhaseStartTime] = useState<number | null>(null);
  const [showPartyDamageModal, setShowPartyDamageModal] = useState(false);
  const resolutionTimeoutTimer = useRef<NodeJS.Timeout | null>(null);
  const modalSequenceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Enemy AI attack system
  const [showEnemyAIModal, setShowEnemyAIModal] = useState(false);
  const [enemyAIData, setEnemyAIData] = useState<{attacks: EnemyAIAttackData[], allEnemies: Array<{id: string, name: string, image: string}>} | null>(null);
  const [currentAttackIndex, setCurrentAttackIndex] = useState(0);
  const [showCounterattackModal, setShowCounterattackModal] = useState(false);
  const enemyAIModalTimer = useRef<NodeJS.Timeout | null>(null);
  const counterattackModalTimer = useRef<NodeJS.Timeout | null>(null);
  const enemyAICleanupTimer = useRef<NodeJS.Timeout | null>(null);

  // Next Question modal state
  const [showNextQuestionModal, setShowNextQuestionModal] = useState(false);
  const [nextQuestionNumber, setNextQuestionNumber] = useState(0);
  const nextQuestionTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Track if answer has been submitted to prevent double submissions
  const hasSubmitted = useRef(false);

  // B6/B7 FIX: Reconnection logic with exponential backoff
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    
    let hasReceivedState = false;
    let connectionTimeout: NodeJS.Timeout | null = null;
    
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
      
      setConnectionStatus("connected");
      setReconnectAttempts(0);
      socket.send(JSON.stringify({ type: "join", studentId, sessionId }));
      
      connectionTimeout = setTimeout(() => {
        if (!hasReceivedState) {
          toast({
            title: "Connection Failed",
            description: "Could not connect to the session. It may have ended.",
            variant: "destructive",
          });
          navigate("/student/lobby");
        }
      }, 5000);
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === "combat_state") {
        hasReceivedState = true;
        if (connectionTimeout) clearTimeout(connectionTimeout);
        setCombatState(message.state);
      } else if (message.type === "error") {
        if (connectionTimeout) clearTimeout(connectionTimeout);
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
        setUsedAbilityInPhase1(null); // Reset ability usage
        hasSubmitted.current = false; // Reset submission flag for new question
        if (message.shuffleOptions !== undefined) {
          setShuffleOptions(message.shuffleOptions);
        }
      } else if (message.type === "phase_change") {
        // Show intro modal for "Question" and "Next Question" phases
        if (message.phase === "Question" || message.phase === "Next Question") {
          setPhaseChangeName(message.phase);
          setShowPhaseChangeModal(true);
        }
      } else if (message.type === "phase_timer") {
        // Update abilities phase timer
        if (message.phase === "abilities") {
          setAbilitiesTimeRemaining(message.timeRemaining);
        }
      } else if (message.type === "game_over") {
        gameIsOver.current = true;
        if (message.victory && message.xpGained !== undefined) {
          setVictoryData({
            xpGained: message.xpGained,
            leveledUp: message.leveledUp,
            newLevel: message.newLevel,
            currentXP: message.currentXP,
            lootTable: message.lootTable || [],
          });
          setShowVictoryModal(true);
        } else {
          toast({ title: message.victory ? "Victory!" : "Defeat", description: message.message });
          setTimeout(() => navigate("/student/lobby"), 3000);
        }
      } else if (message.type === "force_disconnect") {
        gameIsOver.current = true;
        toast({ 
          title: "Fight Ended", 
          description: message.message || "Returning to lobby...",
          variant: "default"
        });
        setTimeout(() => navigate("/student/lobby"), 1000);
      } else if (message.type === "ultimate_animation") {
        // Ultimate ability animation triggered
        setUltimateAnimationData({
          playerName: message.playerName,
          ultimateName: message.ultimateName,
          animationType: message.animationType,
          currentClass: message.currentClass,
          currentGender: message.currentGender,
        });
        setShowUltimateAnimation(true);
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
          setShowUltimateAnimation(false);
        }, 4000);
      } else if (message.type === "combat_log") {
        // Silently consume combat log events (displayed on host view only)
        // Students don't display the log but still receive events to keep WebSocket healthy
      } else if (message.type === "resolution_feedback") {
        // Individual resolution feedback - add to queue
        console.log("[FEEDBACK] Received resolution_feedback:", message.feedback);
        // Clear the 4-second timeout since we received valid feedback
        if (resolutionTimeoutTimer.current) {
          clearTimeout(resolutionTimeoutTimer.current);
          resolutionTimeoutTimer.current = null;
        }
        // Server sends array of feedback, spread it into queue
        setFeedbackQueue(prev => {
          const newQueue = [...prev, ...message.feedback];
          console.log("[FEEDBACK] Queue updated:", newQueue);
          return newQueue;
        });
      } else if (message.type === "party_damage_summary") {
        // Party damage summary - store for display after individual modals
        // Clear the 4-second timeout since we received valid data
        if (resolutionTimeoutTimer.current) {
          clearTimeout(resolutionTimeoutTimer.current);
          resolutionTimeoutTimer.current = null;
        }
        setPartyDamageData(message.data);
      } else if (message.type === "enemy_ai_attack") {
        // Enemy AI attack - show enemy modal then counterattack modals
        setEnemyAIData({
          attacks: message.attacks,
          allEnemies: message.allEnemies
        });
        setCurrentAttackIndex(0);
        setShowEnemyAIModal(true);
        setShowCounterattackModal(false);
      } else if (message.type === "next_question") {
        setNextQuestionNumber(message.questionNumber);
        setShowNextQuestionModal(true);
        
        // Auto-hide after 2 seconds (matching backend timing)
        if (nextQuestionTimer.current) clearTimeout(nextQuestionTimer.current);
        nextQuestionTimer.current = setTimeout(() => {
          setShowNextQuestionModal(false);
        }, 2000);
      }
    };

    socket.onclose = () => {
      setConnectionStatus("disconnected");
      if (connectionTimeout) clearTimeout(connectionTimeout);
      
      // Only reconnect if not unmounting and game is not over
      if (!isUnmounting.current && !gameIsOver.current) {
        setReconnectAttempts(prev => prev + 1);
      }
    };

    socket.onerror = () => {
      setConnectionStatus("disconnected");
    };

    return socket;
  }, [navigate, toast]);

  useEffect(() => {
    isUnmounting.current = false;
    const socket = connectWebSocket();
    setWs(socket);
    return () => {
      isUnmounting.current = true;
      socket.close();
      
      // Clean up all timers on unmount
      if (resolutionTimeoutTimer.current) clearTimeout(resolutionTimeoutTimer.current);
      if (modalSequenceTimer.current) clearTimeout(modalSequenceTimer.current);
      if (enemyHitDelayTimer.current) clearTimeout(enemyHitDelayTimer.current);
      if (enemyHitResetTimer.current) clearTimeout(enemyHitResetTimer.current);
      if (playerHitDelayTimer.current) clearTimeout(playerHitDelayTimer.current);
      if (playerHitResetTimer.current) clearTimeout(playerHitResetTimer.current);
      if (shieldPulseTimer.current) clearTimeout(shieldPulseTimer.current);
      if (healingPulseTimer.current) clearTimeout(healingPulseTimer.current);
      if (enemyAIModalTimer.current) clearTimeout(enemyAIModalTimer.current);
      if (counterattackModalTimer.current) clearTimeout(counterattackModalTimer.current);
      if (enemyAICleanupTimer.current) clearTimeout(enemyAICleanupTimer.current);
      if (nextQuestionTimer.current) clearTimeout(nextQuestionTimer.current);
    };
  }, [connectWebSocket]);

  // B6/B7 FIX: Auto-reconnect with exponential backoff
  useEffect(() => {
    if (reconnectAttempts === 0 || gameIsOver.current) {
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
    
    setConnectionStatus("reconnecting");
    
    const timer = setTimeout(() => {
      const socket = connectWebSocket();
      setWs(socket);
    }, delay);

    return () => clearTimeout(timer);
  }, [reconnectAttempts, connectWebSocket]);

  useEffect(() => {
    if (combatState?.currentPhase === "question") {
      if (timeRemaining > 0) {
        const timer = setTimeout(() => setTimeRemaining(timeRemaining - 1), 1000);
        return () => clearTimeout(timer);
      } else if (timeRemaining === 0 && !hasSubmitted.current) {
        // Timer expired - auto-submit if not already submitted
        hasSubmitted.current = true; // Mark as submitted to prevent duplicate
        
        if (ws) {
          // Submit selected answer or empty string (counts as wrong)
          ws.send(JSON.stringify({ 
            type: "answer", 
            answer: selectedAnswer || "" 
          }));
        }
      }
    }
  }, [timeRemaining, combatState?.currentPhase, ws, selectedAnswer]);

  // Track ability usage and reset on phase changes
  useEffect(() => {
    if (combatState?.currentPhase === "question") {
      setUsedAbilityInPhase1(null); // Reset when entering question phase
    }
  }, [combatState?.currentPhase]);

  // B5 FIX: Auto-dismiss phase change modal after 3 seconds
  useEffect(() => {
    if (showPhaseChangeModal) {
      const timer = setTimeout(() => {
        setShowPhaseChangeModal(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showPhaseChangeModal]);

  // Update previous phase tracking (removed toast feedback - now handled by modals)
  useEffect(() => {
    if (!combatState) return;
    setPreviousPhase(combatState.currentPhase);
  }, [combatState?.currentPhase]);
  
  // Helper function to check if player has block passive unlocked
  const hasBlockPassive = (player: PlayerState): boolean => {
    if (!player) return false;
    
    const currentJobLevel = player.jobLevels?.[player.characterClass] || 1;
    const jobAbilities = JOB_ABILITY_SLOTS[player.characterClass as CharacterClass];
    
    // Check if warrior_block is unlocked (level 1 for warriors)
    if (jobAbilities?.level1 === "warrior_block" && currentJobLevel >= 1) {
      return true;
    }
    
    // Check cross-class abilities
    if (player.crossClassAbility1 === "block_crossclass" || player.crossClassAbility2 === "block_crossclass") {
      return true;
    }
    
    return false;
  };
  
  // Show ability selection modal when abilities phase starts (ONLY for correct answers)
  useEffect(() => {
    if (!combatState) return;
    
    const studentId = localStorage.getItem("studentId");
    const currentPlayer = studentId ? combatState.players[studentId] : null;
    
    if (combatState.currentPhase === "abilities" && currentPlayer && !currentPlayer.isDead) {
      // Only show modal if:
      // 1. Player answered the current question correctly
      // 2. Player hasn't already selected an ability this phase
      if (currentPlayer.answeredCurrentQuestionCorrectly && !currentPlayer.hasSelectedAbility) {
        setShowAbilityModal(true);
        setSelectedAbility(null);
        setShowTargetModal(false);
        // Don't show block target modal yet - wait until ability modal is handled
      } else {
        // Either answered incorrectly or already selected - don't show modal
        setShowAbilityModal(false);
      }
    } else {
      setShowAbilityModal(false);
      setShowTargetModal(false);
      setShowBlockTargetModal(false);
    }
  }, [combatState?.currentPhase, combatState?.players]);

  // Phase transition overlays removed - vision document only specifies modals for feedback

  // Track when question_resolution phase starts and set 4-second timeout
  useEffect(() => {
    if (!combatState) return;
    
    const currentPhase = combatState.currentPhase;
    
    // Reset everything when entering question_resolution phase
    if (currentPhase === "question_resolution" && previousPhase !== "question_resolution") {
      console.log("[FEEDBACK] Entering question_resolution phase - resetting feedback system");
      setResolutionPhaseStartTime(Date.now());
      setFeedbackQueue([]);
      setPartyDamageData(null);
      setCurrentModalIndex(0);
      setShowPartyDamageModal(false);
      
      // Set 4-second timeout - if no feedback appears, reset the feedback system
      if (resolutionTimeoutTimer.current) clearTimeout(resolutionTimeoutTimer.current);
      resolutionTimeoutTimer.current = setTimeout(() => {
        // Timeout reached - clear any pending feedback
        console.log("[FEEDBACK] 4-second timeout reached - clearing feedback");
        setFeedbackQueue([]);
        setPartyDamageData(null);
        setCurrentModalIndex(0);
        setShowPartyDamageModal(false);
        setResolutionPhaseStartTime(null);
      }, 4000);
    }
    
    // Clean up when leaving question_resolution phase
    if (previousPhase === "question_resolution" && currentPhase !== "question_resolution") {
      console.log("[FEEDBACK] Leaving question_resolution phase - clearing feedback");
      if (resolutionTimeoutTimer.current) clearTimeout(resolutionTimeoutTimer.current);
      if (modalSequenceTimer.current) clearTimeout(modalSequenceTimer.current);
      setFeedbackQueue([]);
      setPartyDamageData(null);
      setCurrentModalIndex(0);
      setShowPartyDamageModal(false);
      setResolutionPhaseStartTime(null);
    }
  }, [combatState?.currentPhase, previousPhase]);

  // Modal sequencing system - show modals one by one every 2 seconds
  useEffect(() => {
    if (feedbackQueue.length === 0) {
      console.log("[FEEDBACK] Modal sequencing: queue is empty");
      return;
    }
    
    console.log("[FEEDBACK] Modal sequencing: queue length =", feedbackQueue.length, "currentIndex =", currentModalIndex);
    
    // Start showing modals from the queue
    if (currentModalIndex < feedbackQueue.length) {
      console.log("[FEEDBACK] Showing modal", currentModalIndex, "of", feedbackQueue.length, ":", feedbackQueue[currentModalIndex]);
      // Clear any existing timer
      if (modalSequenceTimer.current) clearTimeout(modalSequenceTimer.current);
      
      // Show current modal for 3 seconds (matching minimum display time), then advance to next
      modalSequenceTimer.current = setTimeout(() => {
        console.log("[FEEDBACK] Advancing to next modal");
        setCurrentModalIndex(prev => prev + 1);
      }, 3000);
    } else if (currentModalIndex === feedbackQueue.length && partyDamageData && !showPartyDamageModal) {
      // All individual modals shown, now show party damage modal
      console.log("[FEEDBACK] All individual modals shown, showing party damage modal");
      setShowPartyDamageModal(true);
      
      // Auto-hide party damage modal after 3 seconds
      if (modalSequenceTimer.current) clearTimeout(modalSequenceTimer.current);
      modalSequenceTimer.current = setTimeout(() => {
        setShowPartyDamageModal(false);
      }, 3000);
    }
    
    return () => {
      if (modalSequenceTimer.current) clearTimeout(modalSequenceTimer.current);
    };
  }, [feedbackQueue, currentModalIndex, partyDamageData, showPartyDamageModal]);

  // Enemy AI attack modal sequencing
  useEffect(() => {
    if (!enemyAIData || enemyAIData.attacks.length === 0) {
      return;
    }
    
    // Clean up any existing timers
    if (enemyAIModalTimer.current) clearTimeout(enemyAIModalTimer.current);
    if (counterattackModalTimer.current) clearTimeout(counterattackModalTimer.current);
    if (enemyAICleanupTimer.current) clearTimeout(enemyAICleanupTimer.current);
    
    // Step 1: Show EnemyAIModal for 800ms
    if (showEnemyAIModal) {
      enemyAIModalTimer.current = setTimeout(() => {
        setShowEnemyAIModal(false);
        // Step 2: Show first counterattack modal
        setCurrentAttackIndex(0);
        setShowCounterattackModal(true);
      }, 800);
    }
    
    return () => {
      if (enemyAIModalTimer.current) clearTimeout(enemyAIModalTimer.current);
    };
  }, [enemyAIData, showEnemyAIModal]);

  // Counterattack modal sequencing - advance through attacks
  useEffect(() => {
    if (!enemyAIData || !showCounterattackModal) {
      return;
    }
    
    // Clean up any existing timer
    if (counterattackModalTimer.current) clearTimeout(counterattackModalTimer.current);
    
    // Show current attack for 3 seconds (matching backend timing)
    counterattackModalTimer.current = setTimeout(() => {
      if (currentAttackIndex < enemyAIData.attacks.length - 1) {
        // More attacks to show - advance to next
        setCurrentAttackIndex(prev => prev + 1);
      } else {
        // All attacks shown - hide modal and clean up
        setShowCounterattackModal(false);
        
        if (enemyAICleanupTimer.current) clearTimeout(enemyAICleanupTimer.current);
        enemyAICleanupTimer.current = setTimeout(() => {
          setEnemyAIData(null);
          setCurrentAttackIndex(0);
        }, 1000);
      }
    }, 3000);
    
    return () => {
      if (counterattackModalTimer.current) clearTimeout(counterattackModalTimer.current);
    };
  }, [enemyAIData, showCounterattackModal, currentAttackIndex]);

  // Track animations for healing/blocking (toasts removed - now handled by modals)
  useEffect(() => {
    const studentId = localStorage.getItem("studentId");
    if (!combatState || !studentId || !previousCombatState) {
      if (combatState) setPreviousCombatState(combatState);
      return;
    }

    const currentPlayer = combatState.players[studentId];
    const previousPlayer = previousCombatState.players[studentId];

    // Detect healing events for animation only
    if (currentPlayer && previousPlayer && currentPlayer.health > previousPlayer.health) {
      const healAmount = currentPlayer.health - previousPlayer.health;
      // Trigger healing pulse animation
      if (healingPulseTimer.current) clearTimeout(healingPulseTimer.current);
      setShowHealingPulse(true);
      healingPulseTimer.current = setTimeout(() => setShowHealingPulse(false), 1500);
      // Add floating heal number
      setFloatingNumbers(prev => [...prev, {
        id: `heal-${Date.now()}`,
        value: healAmount,
        type: "heal"
      }]);
    }

    // Detect when you're being blocked by someone for animation only
    const previousBlocker = Object.values(previousCombatState.players).find(
      p => p.blockTarget === studentId && TANK_CLASSES.includes(p.characterClass) && !p.isDead
    );
    const currentBlocker = Object.values(combatState.players).find(
      p => p.blockTarget === studentId && TANK_CLASSES.includes(p.characterClass) && !p.isDead
    );
    // Trigger shield pulse animation when blocker starts blocking
    if (currentBlocker && !previousBlocker) {
      if (shieldPulseTimer.current) clearTimeout(shieldPulseTimer.current);
      setShowShieldPulse(true);
      shieldPulseTimer.current = setTimeout(() => setShowShieldPulse(false), 1500);
    }

    // Update previous combat state
    setPreviousCombatState(combatState);
  }, [combatState, previousCombatState]);

  // Detect attacks and trigger animations
  useEffect(() => {
    if (!combatState || !previousCombatState) return;

    // Detect player attacks (enemy health decreased)
    const currentEnemy = combatState.enemies[0];
    const previousEnemy = previousCombatState.enemies[0];
    if (currentEnemy && previousEnemy && currentEnemy.health < previousEnemy.health) {
      const damageDealt = previousEnemy.health - currentEnemy.health;
      
      // Add floating damage number
      const numberId = `damage-${Date.now()}`;
      setFloatingNumbers(prev => [...prev, { id: numberId, value: damageDealt, type: "damage" }]);
      
      // Clear ALL existing timers for enemy hit animation
      if (enemyHitDelayTimer.current) {
        clearTimeout(enemyHitDelayTimer.current);
        enemyHitDelayTimer.current = null;
      }
      if (enemyHitResetTimer.current) {
        clearTimeout(enemyHitResetTimer.current);
        enemyHitResetTimer.current = null;
      }
      
      // Reset state to ensure animation retriggering
      setIsEnemyHit(false);
      
      // Use setTimeout to ensure state change is detected
      enemyHitDelayTimer.current = setTimeout(() => {
        setIsEnemyHit(true);
        enemyHitDelayTimer.current = null;
        
        // Schedule reset after animation completes
        enemyHitResetTimer.current = setTimeout(() => {
          setIsEnemyHit(false);
          enemyHitResetTimer.current = null;
        }, 600);
      }, 10);
    }

    // Detect enemy attacks (any player health decreased)
    const studentId = localStorage.getItem("studentId");
    if (studentId) {
      const currentPlayer = combatState.players[studentId];
      const previousPlayer = previousCombatState.players[studentId];
      if (currentPlayer && previousPlayer && currentPlayer.health < previousPlayer.health) {
        // Clear ALL existing timers for player hit animation
        if (playerHitDelayTimer.current) {
          clearTimeout(playerHitDelayTimer.current);
          playerHitDelayTimer.current = null;
        }
        if (playerHitResetTimer.current) {
          clearTimeout(playerHitResetTimer.current);
          playerHitResetTimer.current = null;
        }
        
        // Reset state to ensure animation retriggering
        setIsPlayerHit(false);
        setScreenShake(false);
        
        // Use setTimeout to ensure state change is detected
        playerHitDelayTimer.current = setTimeout(() => {
          setIsPlayerHit(true);
          setScreenShake(true);
          playerHitDelayTimer.current = null;
          
          // Schedule reset after animation completes
          playerHitResetTimer.current = setTimeout(() => {
            setIsPlayerHit(false);
            setScreenShake(false);
            playerHitResetTimer.current = null;
          }, 600);
        }, 10);
      }
    }
  }, [combatState, previousCombatState]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (enemyHitDelayTimer.current) clearTimeout(enemyHitDelayTimer.current);
      if (enemyHitResetTimer.current) clearTimeout(enemyHitResetTimer.current);
      if (playerHitDelayTimer.current) clearTimeout(playerHitDelayTimer.current);
      if (playerHitResetTimer.current) clearTimeout(playerHitResetTimer.current);
      if (shieldPulseTimer.current) clearTimeout(shieldPulseTimer.current);
      if (healingPulseTimer.current) clearTimeout(healingPulseTimer.current);
    };
  }, []);

  // Scroll detection: show fixed submit button when primary button is out of view
  useEffect(() => {
    const checkSubmitVisibility = () => {
      if (!primarySubmitRef.current) return;
      
      // Get viewport element - search in the entire document since Radix portal might render elsewhere
      const viewports = Array.from(document.querySelectorAll('[data-radix-scroll-area-viewport]'));
      let scrollContainer: Element | null = null;
      
      // Find the viewport that contains our submit button
      for (const viewport of viewports) {
        if (viewport.contains(primarySubmitRef.current)) {
          scrollContainer = viewport;
          break;
        }
      }
      
      if (!scrollContainer) {
        // If not in a scroll container, check window scroll
        const submitRect = primarySubmitRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        // Button is out of view if scrolled above viewport or below the visible area
        const isScrolledAbove = submitRect.top < 0;
        const isScrolledBelow = submitRect.bottom > viewportHeight;
        const isOutOfView = isScrolledAbove || isScrolledBelow;
        setShowFixedSubmit(isOutOfView);
        return;
      }
      
      const submitRect = primarySubmitRef.current.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      
      // Check if submit button is partially or fully outside the visible area
      // Button is hidden if ANY part is above or below the container viewport
      const isPartiallyAbove = submitRect.top < containerRect.top;
      const isPartiallyBelow = submitRect.bottom > containerRect.bottom;
      const isOutOfView = isPartiallyAbove || isPartiallyBelow;
      setShowFixedSubmit(isOutOfView);
    };
    
    // Add scroll listeners to all potential scroll containers
    const viewports = Array.from(document.querySelectorAll('[data-radix-scroll-area-viewport]'));
    viewports.forEach(viewport => {
      viewport.addEventListener('scroll', checkSubmitVisibility);
    });
    
    // Also listen to window scroll
    window.addEventListener('scroll', checkSubmitVisibility);
    window.addEventListener('resize', checkSubmitVisibility);
    
    // Check on mount and when question changes
    setTimeout(checkSubmitVisibility, 100); // Small delay to ensure DOM is ready
    
    return () => {
      viewports.forEach(viewport => {
        viewport.removeEventListener('scroll', checkSubmitVisibility);
      });
      window.removeEventListener('scroll', checkSubmitVisibility);
      window.removeEventListener('resize', checkSubmitVisibility);
    };
  }, [currentQuestion]);

  const submitAnswer = () => {
    if (ws && selectedAnswer && currentQuestion && !hasSubmitted.current) {
      hasSubmitted.current = true; // Mark as submitted to prevent duplicate
      ws.send(JSON.stringify({ 
        type: "answer", 
        answer: selectedAnswer
      }));
    }
  };

  const handleAbilitySelected = (abilityId: string) => {
    const ability = ABILITY_DISPLAYS[abilityId];
    if (!ability) return;
    
    setSelectedAbility(abilityId);
    setShowAbilityModal(false);
    
    // Determine if targeting is needed
    if (ability.requiresTarget || ability.opensHealingWindow) {
      // Determine target type: allies for healing, enemies for damage
      if (ability.abilityClass.includes("healing") || abilityId === "warrior_block") {
        setTargetType("ally");
      } else {
        setTargetType("enemy");
      }
      setShowTargetModal(true);
    } else {
      // No targeting needed, use ability immediately
      if (ws) {
        ws.send(JSON.stringify({ type: "use_ability", abilityId }));
      }
      
      // Check if player has block passive and show block target modal
      const studentId = localStorage.getItem("studentId");
      const currentPlayer = studentId && combatState ? combatState.players[studentId] : null;
      if (currentPlayer && hasBlockPassive(currentPlayer)) {
        setShowBlockTargetModal(true);
      }
    }
  };

  const handleBaseDamageSelected = () => {
    setShowAbilityModal(false);
    
    // Send message to server marking that base damage was selected
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "base_damage_selected",
      }));
    }
    
    // Check if player has block passive and show block target modal
    const studentId = localStorage.getItem("studentId");
    const currentPlayer = studentId && combatState ? combatState.players[studentId] : null;
    if (currentPlayer && hasBlockPassive(currentPlayer)) {
      setShowBlockTargetModal(true);
    }
  };
  
  const handleBlockTargetSelected = (targetId: string) => {
    setShowBlockTargetModal(false);
    
    if (ws) {
      ws.send(JSON.stringify({ 
        type: "ability_selection", 
        abilityId: "warrior_block",
        targetId 
      }));
    }
  };

  const handleTargetSelected = (targetId: string) => {
    setShowTargetModal(false);
    
    if (ws && selectedAbility) {
      ws.send(JSON.stringify({ 
        type: "use_ability", 
        abilityId: selectedAbility,
        targetId 
      }));
    } else if (ws && !selectedAbility) {
      // Generic target selection without ability (e.g., block)
      ws.send(JSON.stringify({ 
        type: "select_target", 
        targetId 
      }));
    }
    
    setSelectedAbility(null);
    
    // Check if player has block passive and show block target modal
    const studentId = localStorage.getItem("studentId");
    const currentPlayer = studentId && combatState ? combatState.players[studentId] : null;
    if (currentPlayer && hasBlockPassive(currentPlayer)) {
      setShowBlockTargetModal(true);
    }
  };

  const useUltimate = (ultimateId: string) => {
    if (ws) {
      ws.send(JSON.stringify({ type: "use_ultimate", ultimateId }));
      // Ultimate feedback shown via animation modal
    }
  };
  
  // Handle ability bar clicks
  const handleAbilityClick = (abilityId: string) => {
    const abilityConfig = ABILITY_DISPLAYS[abilityId];
    if (!abilityConfig) {
      console.warn("Unknown ability clicked:", abilityId);
      return;
    }
    
    // Check if it's a pure healing ability that opens healing window - these are handled in block/heal phase, not clickable
    if (abilityConfig.opensHealingWindow) {
      toast({
        title: "Healing abilities work differently now",
        description: "You'll choose to heal during the block & healing phase after answering the question",
      });
      return;
    }
    
    // Check if it's an ultimate/cross-class ability (from ULTIMATE_ABILITIES)
    const isUltimate = !!ULTIMATE_ABILITIES[abilityId];
    
    // Ultimate abilities can be used during combat/tank_blocking phases, not just question phase
    if (isUltimate) {
      if (combatState?.currentPhase === "waiting" || combatState?.currentPhase === "game_over") {
        toast({
          title: "Cannot use ability",
          description: "Ultimate abilities cannot be used right now",
          variant: "destructive",
        });
        return;
      }
      useUltimate(abilityId);
      return;
    }
    
    // Regular job abilities typically work in question phase
    if (combatState?.currentPhase !== "question") {
      toast({
        title: "Cannot use ability",
        description: "This ability can only be used during the question phase",
        variant: "destructive",
        });
      return;
    }
    
    // Track that ability was used in phase 1
    setUsedAbilityInPhase1(abilityId);
    
    // Send appropriate message to server based on ability type
    if (abilityConfig.isToggle) {
      // For toggleable abilities like fireball charging
      if (ws && abilityId === "fireball") {
        ws.send(JSON.stringify({ type: "charge_fireball" }));
      }
    } else if (abilityId === "craft_healing_potion" || abilityId === "craft_shield_potion") {
      // Potion crafting abilities
      if (ws) {
        ws.send(JSON.stringify({ type: "create_potion" }));
      }
    }
    
    // Ability feedback shown via combat modals during resolution
  };

  const removeFloatingNumber = (id: string) => {
    setFloatingNumbers(prev => prev.filter(num => num.id !== id));
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
    <motion.div 
      className="h-screen bg-background flex flex-col overflow-hidden"
      animate={{ 
        x: screenShake ? [0, -8, 8, -6, 6, -4, 4, 0] : 0,
        y: screenShake ? [0, -4, 4, -3, 3, -2, 2, 0] : 0
      }}
      transition={{ duration: 0.5 }}
    >
      {/* B6/B7 FIX: Connection status indicator */}
      <div className="bg-card border-b border-border px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {connectionStatus === "connected" && (
            <>
              <Wifi className="h-4 w-4 text-health" data-testid="icon-connected" />
              <span className="text-xs text-muted-foreground">Connected</span>
            </>
          )}
          {connectionStatus === "disconnected" && (
            <>
              <WifiOff className="h-4 w-4 text-damage" data-testid="icon-disconnected" />
              <span className="text-xs text-damage">Disconnected</span>
            </>
          )}
          {connectionStatus === "reconnecting" && (
            <>
              <RefreshCw className="h-4 w-4 text-warning animate-spin" data-testid="icon-reconnecting" />
              <span className="text-xs text-warning">Reconnecting...</span>
            </>
          )}
          {/* Solo Mode Host - Session Code Display */}
          {combatState?.soloModeEnabled && combatState?.soloModeHostId === studentId && (
            <>
              <span className="text-xs text-muted-foreground mx-2">|</span>
              <span className="text-xs text-muted-foreground">Session:</span>
              <span className="text-xs font-mono font-bold text-primary" data-testid="text-session-code-solo">
                {combatState.sessionId}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Solo Mode Host - End Fight Button (during active combat) */}
          {combatState?.soloModeEnabled && combatState?.soloModeHostId === studentId && combatState?.currentPhase !== "waiting" && combatState?.currentPhase !== "game_over" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (ws) {
                  ws.send(JSON.stringify({ type: "end_fight" }));
                  navigate("/student/lobby");
                }
              }}
              data-testid="button-end-fight"
            >
              End Fight
            </Button>
          )}
          {connectionStatus === "disconnected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReconnectAttempts(1);
              }}
              data-testid="button-reconnect"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reconnect
            </Button>
          )}
        </div>
      </div>

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

      {/* B4 FIX: Main combat area with fixed viewport sizing and bottom padding for fixed player footer */}
      <div className="flex-1 flex gap-2 px-2 overflow-hidden pb-2" style={{ height: 'calc(100vh - 12.5vh)' }}>
        {/* B4 FIX: Left column - 2-column grid, tiny avatars, no names */}
        <div className="flex-shrink-0 hidden lg:block overflow-y-auto" style={{ width: '10vw' }} data-testid="players-left-column">
          <div className="grid grid-cols-2 gap-1">
            {leftPlayers.map((player) => {
              const isBeingBlocked = Object.values(combatState.players).some(
                p => p.blockTarget === player.studentId && TANK_CLASSES.includes(p.characterClass) && !p.isDead
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
                    <PlayerAvatar 
                      characterClass={player.characterClass} 
                      gender={player.gender} 
                      size="xs"
                      isThreatLeader={combatState?.threatLeaderId === player.studentId}
                    />
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
          {/* Solo Mode Host Controls - Waiting Phase */}
          {combatState.soloModeEnabled && combatState.soloModeHostId === studentId && combatState.currentPhase === "waiting" && (
            <Card className="p-8 border-primary/30">
              <div className="flex flex-col items-center gap-6">
                <h2 className="text-3xl font-bold text-center" data-testid="text-waiting-for-host">
                  Waiting for host to start the fight...
                </h2>
                <p className="text-muted-foreground text-center">
                  Session Code: <span className="font-bold text-foreground">{combatState.sessionId}</span>
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  {Object.keys(combatState.players).length} player{Object.keys(combatState.players).length !== 1 ? 's' : ''} ready
                </p>
                <Button
                  size="lg"
                  onClick={() => {
                    if (ws) {
                      ws.send(JSON.stringify({ type: "start_fight" }));
                    }
                  }}
                  data-testid="button-start-fight"
                  className="w-full max-w-md"
                >
                  <Swords className="h-5 w-5 mr-2" />
                  Start Fight
                </Button>
              </div>
            </Card>
          )}

          {/* Regular waiting phase (non-host or teacher-hosted) */}
          {combatState.currentPhase === "waiting" && !(combatState.soloModeEnabled && combatState.soloModeHostId === studentId) && (
            <Card className="p-8 border-primary/30">
              <div className="flex flex-col items-center gap-4">
                <h2 className="text-3xl font-bold text-center" data-testid="text-waiting">
                  Waiting for teacher to start the fight...
                </h2>
                <p className="text-sm text-muted-foreground text-center">
                  {Object.keys(combatState.players).length} player{Object.keys(combatState.players).length !== 1 ? 's' : ''} ready
                </p>
              </div>
            </Card>
          )}

          {/* B5 FIX: Phase change modal matching question modal styling */}
          {showPhaseChangeModal && (
            <Card className="p-8 border-primary/30">
              <div className="flex items-center justify-center">
                <h2 className="text-4xl font-bold text-center" data-testid="text-phase-change">{phaseChangeName}</h2>
              </div>
            </Card>
          )}
          
          {/* Timer-only modal after answer submission */}
          {!showPhaseChangeModal && combatState.currentPhase === "question" && currentQuestion && playerState?.hasAnswered && (
            <Card className="p-8 border-primary/30">
              <div className="flex flex-col items-center gap-6">
                <h2 className="text-3xl font-bold text-center">Waiting for other players...</h2>
                <div className="flex items-center gap-3 text-warning">
                  <Clock className="h-8 w-8" />
                  <span className="text-5xl font-bold" data-testid="text-timer-large">{timeRemaining}s</span>
                </div>
              </div>
            </Card>
          )}
          
          {/* B5 FIX: Only show question modal when phase change modal is not visible and player hasn't answered yet */}
          {!showPhaseChangeModal && combatState.currentPhase === "question" && currentQuestion && !playerState?.hasAnswered && (
            <Card className="p-8 border-primary/30 max-h-[80vh] flex flex-col">
              {/* Top half: Question prompt */}
              <div className="flex-1 flex flex-col mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold">Question</h3>
                  <div className="flex items-center gap-2 text-warning">
                    <Clock className="h-5 w-5" />
                    <span className="text-xl font-bold" data-testid="text-timer">{timeRemaining}s</span>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <RichContentRenderer html={currentQuestion.question} className="text-lg" />
                </ScrollArea>
              </div>

              {/* Bottom half: Answer options - scrollable with submit button inside */}
              <div className="flex-1 flex flex-col">
                <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4">
                  {currentQuestion.type === "multiple_choice" && displayOptions && (
                    <div className="grid grid-cols-2 gap-3">
                      {displayOptions.map((option, i) => (
                        <Button
                          key={i}
                          variant={selectedAnswer === option ? "default" : "outline"}
                          className="w-full justify-start text-left h-auto py-4"
                          onClick={() => setSelectedAnswer(option)}
                          data-testid={`button-option-${i}`}
                        >
                          <span className="font-semibold mr-3 flex-shrink-0">{String.fromCharCode(65 + i)}.</span>
                          <RichContentRenderer html={option} className="flex-1" />
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
                    <div className="space-y-3 flex flex-col items-center">
                      <div className="flex items-center justify-between w-full max-w-md">
                        <label className="text-sm font-medium">Your Answer</label>
                        <Button
                          type="button"
                          variant={mathMode ? "default" : "outline"}
                          size="sm"
                          onClick={() => setMathMode(!mathMode)}
                          data-testid="button-toggle-math-mode"
                          className="gap-2"
                        >
                          <Calculator className="h-4 w-4" />
                          {mathMode ? "Math Mode ON" : "Math Mode OFF"}
                        </Button>
                      </div>
                      {mathMode ? (
                        <MathEditor
                          value={selectedAnswer}
                          onChange={(latex) => setSelectedAnswer(latex)}
                          placeholder="Enter math expression..."
                        />
                      ) : (
                        <input
                          type="text"
                          value={selectedAnswer}
                          onChange={(e) => setSelectedAnswer(e.target.value)}
                          className="w-full max-w-md p-4 border border-border rounded-md bg-background"
                          placeholder="Type your answer..."
                          data-testid="input-answer"
                        />
                      )}
                    </div>
                  )}

                  {/* Primary submit button - inside scroll area */}
                  <div className="mt-6">
                    <Button
                      ref={primarySubmitRef}
                      size="lg"
                      className="w-full"
                      onClick={submitAnswer}
                      disabled={!selectedAnswer || playerState?.hasAnswered}
                      data-testid="button-submit"
                    >
                      {playerState?.hasAnswered ? (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          Answer Submitted
                        </>
                      ) : (
                        "Submit Answer"
                      )}
                    </Button>
                  </div>
                </ScrollArea>
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
                p => p.blockTarget === player.studentId && TANK_CLASSES.includes(p.characterClass) && !p.isDead
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
                    <PlayerAvatar 
                      characterClass={player.characterClass} 
                      gender={player.gender} 
                      size="xs"
                      isThreatLeader={combatState?.threatLeaderId === player.studentId}
                    />
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

      {/* ENEMY OVERLAY: Large centered enemy image during Question Resolution phase */}
      <AnimatePresence>
        {enemy && combatState && combatState.currentPhase === "question_resolution" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            style={{ paddingBottom: '10vh' }}
            data-testid="enemy-overlay"
          >
            <div className="flex flex-col items-center gap-6 max-w-5xl w-full px-8">
              <motion.h2
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-5xl font-serif font-bold text-damage drop-shadow-lg"
                data-testid="text-enemy-phase-name"
              >
                COMBAT!
              </motion.h2>
              
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: isEnemyHit ? [1, 1.1, 0.95, 1] : 1, 
                  opacity: 1,
                  x: isEnemyHit ? [0, -10, 10, -5, 5, 0] : 0
                }}
                transition={{ 
                  scale: { duration: 0.6 },
                  x: { duration: 0.4 },
                  opacity: { delay: 0.3, duration: 0.5 }
                }}
                className="relative"
                style={{ maxHeight: '70vh', maxWidth: '80vw' }}
              >
                <img
                  src={enemy.image}
                  alt={enemy.name}
                  className="object-contain rounded-lg"
                  style={{ maxHeight: '70vh', maxWidth: '80vw', height: 'auto', width: 'auto' }}
                  data-testid="img-enemy-large"
                />
                {/* Attack flash overlay */}
                <AnimatePresence>
                  {isEnemyHit && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.7, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-0 bg-damage rounded-lg pointer-events-none"
                    />
                  )}
                </AnimatePresence>
                
                {/* Floating damage numbers */}
                {floatingNumbers.filter(num => num.type === "damage").map((num) => (
                  <FloatingNumber
                    key={num.id}
                    value={num.value}
                    type={num.type}
                    onComplete={() => removeFloatingNumber(num.id)}
                  />
                ))}
              </motion.div>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="flex flex-col items-center gap-3"
              >
                <h3 className="text-3xl font-serif font-bold text-foreground" data-testid="text-enemy-name-large">
                  {enemy.name}
                </h3>
                <HealthBar current={enemy.health} max={enemy.maxHealth} className="w-96" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase transition overlay removed - vision document specifies modals only */}

      {/* FIXED SUBMIT BUTTON: Appears at bottom of screen when primary button is scrolled out of view */}
      <AnimatePresence>
        {showFixedSubmit && combatState.currentPhase === "question" && currentQuestion && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 left-0 right-0 z-40 px-4"
          >
            <div className="max-w-7xl mx-auto">
              <Button
                size="lg"
                className="w-full shadow-lg backdrop-blur-sm bg-primary/95 hover:bg-primary border-2 border-primary-foreground/20"
                onClick={submitAnswer}
                disabled={!selectedAnswer || playerState?.hasAnswered}
                data-testid="button-submit-fixed"
              >
                {playerState?.hasAnswered ? (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Answer Submitted
                  </>
                ) : (
                  "Submit Answer"
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIXED PLAYER FOOTER: Always visible at bottom of screen */}
      {playerState && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border py-1 px-2 z-50" style={{ maxHeight: '12.5vh' }}>
          <div className="flex items-center gap-2 max-w-7xl mx-auto">
            <div className="relative flex-shrink-0" style={{ width: '40px', height: '40px' }}>
              <PlayerAvatar 
                characterClass={playerState.characterClass} 
                gender={playerState.gender} 
                size="sm"
                isThreatLeader={combatState?.threatLeaderId === studentId}
              />
              {/* Shield pulse animation */}
              <AnimatePresence>
                {showShieldPulse && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <Shield className="h-8 w-8 text-warrior drop-shadow-lg" />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Healing pulse animation */}
              <AnimatePresence>
                {showHealingPulse && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [0.5, 1.3, 0.5], opacity: [0, 1, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <Sparkles className="h-8 w-8 text-herbalist drop-shadow-lg" />
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Floating heal numbers */}
              {floatingNumbers.filter(num => num.type === "heal").map((num) => (
                <FloatingNumber
                  key={num.id}
                  value={num.value}
                  type={num.type}
                  onComplete={() => removeFloatingNumber(num.id)}
                />
              ))}
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold truncate" data-testid="text-player-nickname">{playerState.nickname}</span>
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
                </div>
              </div>
              
              {/* Combo Points (display for scouts and anyone with killshot equipped) */}
              {(playerState.characterClass === "scout" || playerState.characterClass === "ranger" || playerState.crossClassAbility1 === "killshot" || playerState.crossClassAbility2 === "killshot") && playerState.maxComboPoints > 0 && (
                <ComboPoints current={playerState.comboPoints} max={playerState.maxComboPoints} />
              )}
              
              {/* Health Bar */}
              <HealthBar current={playerState.health} max={playerState.maxHealth} />
              
              {/* MP Bar (displayed for wizards and anyone with max MP > 0) */}
              {playerState.maxMp > 0 && (
                <MPBar current={playerState.mp} max={playerState.maxMp} />
              )}
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

      {/* Unified Ability Selection Modal - shows during abilities phase for all players */}
      {combatState && playerState && studentId && showAbilityModal && (
        <AbilitySelectionModal
          open={showAbilityModal}
          player={playerState}
          timeRemaining={abilitiesTimeRemaining}
          onSelectAbility={handleAbilitySelected}
          onSelectBaseDamage={handleBaseDamageSelected}
        />
      )}

      {/* Target Selection Modal - shows after ability selection if targeting is needed */}
      {combatState && playerState && studentId && showTargetModal && (
        <TargetSelectionModal
          open={showTargetModal}
          targetType={targetType}
          enemies={combatState.enemies}
          players={combatState.players}
          currentPlayerId={studentId}
          threatLeaderId={combatState.threatLeaderId}
          timeRemaining={abilitiesTimeRemaining}
          onSelectTarget={handleTargetSelected}
        />
      )}

      {/* Block Target Selection Modal - shows during abilities phase if player has block passive */}
      {combatState && playerState && studentId && showBlockTargetModal && (
        <BlockTargetSelectionModal
          open={showBlockTargetModal}
          players={combatState.players}
          currentPlayerId={studentId}
          threatLeaderId={combatState.threatLeaderId}
          timeRemaining={abilitiesTimeRemaining}
          onSelectTarget={handleBlockTargetSelected}
        />
      )}

      {/* Resolution Feedback Modal - individual player feedback */}
      {feedbackQueue.length > 0 && currentModalIndex < feedbackQueue.length && (
        <CombatFeedbackModal
          open={true}
          feedback={feedbackQueue[currentModalIndex]}
          shake={feedbackQueue[currentModalIndex].type === "incorrect_damage"}
        />
      )}

      {/* Party Damage Summary Modal */}
      {showPartyDamageModal && partyDamageData && combatState && (
        <PartyDamageModal
          open={true}
          totalDamage={partyDamageData.totalDamage}
          enemyName={partyDamageData.enemiesHit.length === 1 ? partyDamageData.enemiesHit[0].enemyName : ""}
          enemyImage={partyDamageData.enemiesHit.length === 1 ? partyDamageData.enemiesHit[0].enemyImage : undefined}
          multipleEnemies={partyDamageData.enemiesHit.length > 1 ? partyDamageData.enemiesHit.map(e => ({
            id: e.enemyId,
            name: e.enemyName,
            image: e.enemyImage,
            damage: 0
          })) : undefined}
        />
      )}

      {/* Enemy AI Attack Modal - shows enemies animating to center */}
      {enemyAIData && showEnemyAIModal && (
        <EnemyAIModal
          open={true}
          allEnemies={enemyAIData.allEnemies}
        />
      )}

      {/* Counterattack Modal - shows individual attack details */}
      {enemyAIData && showCounterattackModal && currentAttackIndex < enemyAIData.attacks.length && (
        <CounterattackModal
          open={true}
          attack={enemyAIData.attacks[currentAttackIndex]}
        />
      )}

      {/* Ultimate Ability Animation */}
      {showUltimateAnimation && ultimateAnimationData && (
        <UltimateAnimation
          playerName={ultimateAnimationData.playerName}
          ultimateName={ultimateAnimationData.ultimateName}
          animationType={ultimateAnimationData.animationType}
          currentClass={ultimateAnimationData.currentClass}
          currentGender={ultimateAnimationData.currentGender}
          onComplete={() => setShowUltimateAnimation(false)}
        />
      )}

      {showNextQuestionModal && (
        <NextQuestionModal
          questionNumber={nextQuestionNumber}
          isOpen={showNextQuestionModal}
        />
      )}
    </motion.div>
  );
}
