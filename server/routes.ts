import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, verifyPassword } from "./storage";
import { insertFightSchema, insertCombatStatSchema, type Question } from "@shared/schema";

interface ExtendedWebSocket extends WebSocket {
  studentId?: string;
  fightId?: string;
  isHost?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Teacher endpoints
  app.get("/api/fights", async (req, res) => {
    const fights = await storage.getAllFights();
    res.json(fights);
  });

  app.get("/api/fights/:id", async (req, res) => {
    const fight = await storage.getFight(req.params.id);
    if (!fight) return res.status(404).json({ error: "Fight not found" });
    res.json(fight);
  });

  app.post("/api/fights", async (req, res) => {
    try {
      const data = insertFightSchema.parse(req.body);
      const fight = await storage.createFight(data);
      res.json(fight);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/fights/:id", async (req, res) => {
    const deleted = await storage.deleteFight(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Fight not found" });
    res.json({ success: true });
  });

  // Student endpoints
  app.post("/api/student/register", async (req, res) => {
    try {
      const { nickname, password, classCode } = req.body;
      const existing = await storage.getStudentByNickname(nickname);
      if (existing) {
        return res.status(400).json({ error: "Nickname already taken" });
      }

      const student = await storage.createStudent({
        nickname,
        password,
        classCode,
        characterClass: "knight",
        gender: "A",
      });
      const { password: _, ...studentWithoutPassword } = student;
      res.json(studentWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/student/login", async (req, res) => {
    const { nickname, password, classCode } = req.body;
    let student = await storage.getStudentByNickname(nickname);
    
    // Auto-create student on first login if they don't exist
    if (!student) {
      try {
        student = await storage.createStudent({
          nickname,
          password,
          classCode: classCode || "DEMO123",
          characterClass: "knight",
          gender: "A",
        });
        const { password: _, ...studentWithoutPassword } = student;
        return res.json(studentWithoutPassword);
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }
    }
    
    // Verify password for existing student
    if (!verifyPassword(password, student.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const { password: _, ...studentWithoutPassword } = student;
    res.json(studentWithoutPassword);
  });

  app.get("/api/student/:id", async (req, res) => {
    const student = await storage.getStudent(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const { password: _, ...studentWithoutPassword } = student;
    res.json(studentWithoutPassword);
  });

  app.patch("/api/student/:id/character", async (req, res) => {
    const { characterClass, gender } = req.body;
    const student = await storage.updateStudent(req.params.id, { characterClass, gender });
    if (!student) return res.status(404).json({ error: "Student not found" });
    const { password: _, ...studentWithoutPassword } = student;
    res.json(studentWithoutPassword);
  });

  app.patch("/api/student/:id/equipment", async (req, res) => {
    const updates = req.body;
    const student = await storage.updateStudent(req.params.id, updates);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const { password: _, ...studentWithoutPassword } = student;
    res.json(studentWithoutPassword);
  });

  app.get("/api/student/:id/available-fights", async (req, res) => {
    const student = await storage.getStudent(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const fights = await storage.getAllFights();
    const availableFights = fights.filter(f => f.classCode === student.classCode);
    res.json(availableFights);
  });

  // Combat stats endpoints
  app.post("/api/combat-stats", async (req, res) => {
    try {
      const data = insertCombatStatSchema.parse(req.body);
      const stat = await storage.createCombatStat(data);
      res.json(stat);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/combat-stats/fight/:fightId", async (req, res) => {
    const stats = await storage.getStatsByFight(req.params.fightId);
    res.json(stats);
  });

  app.get("/api/combat-stats/student/:studentId", async (req, res) => {
    const stats = await storage.getStatsByStudent(req.params.studentId);
    res.json(stats);
  });

  app.get("/api/combat-stats/class/:classCode", async (req, res) => {
    const stats = await storage.getStatsByClassCode(req.params.classCode);
    res.json(stats);
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time combat
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const combatTimers: Map<string, NodeJS.Timeout> = new Map();

  function broadcastToCombat(fightId: string, message: any) {
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      if (ws.readyState === WebSocket.OPEN && (ws.fightId === fightId || ws.isHost)) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  async function startQuestion(fightId: string) {
    const session = await storage.getCombatSession(fightId);
    const fight = await storage.getFight(fightId);
    if (!session || !fight) return;

    if (session.currentQuestionIndex >= fight.questions.length) {
      await checkGameState(fightId);
      return;
    }

    const question = fight.questions[session.currentQuestionIndex];
    await storage.updateCombatSession(fightId, {
      currentPhase: "question",
      questionStartTime: Date.now(),
    });

    // Reset player states for new question
    for (const playerId of Object.keys(session.players)) {
      await storage.updatePlayerState(fightId, playerId, {
        hasAnswered: false,
        currentAnswer: undefined,
        isHealing: false,
        healTarget: undefined,
        blockTarget: undefined,
      });
    }

    broadcastToCombat(fightId, { type: "phase_change", phase: "Question Phase" });
    broadcastToCombat(fightId, { type: "question", question });
    const updatedSession = await storage.getCombatSession(fightId);
    broadcastToCombat(fightId, { type: "combat_state", state: updatedSession });

    // Auto-advance after time limit
    const timer = setTimeout(async () => {
      await tankBlockingPhase(fightId);
    }, question.timeLimit * 1000);
    combatTimers.set(fightId, timer);
  }

  async function tankBlockingPhase(fightId: string) {
    const session = await storage.getCombatSession(fightId);
    if (!session) return;

    await storage.updateCombatSession(fightId, { currentPhase: "tank_blocking" });
    broadcastToCombat(fightId, { type: "phase_change", phase: "Tank Blocking" });
    const updatedSession = await storage.getCombatSession(fightId);
    broadcastToCombat(fightId, { type: "combat_state", state: updatedSession });

    // Auto-advance after 5 seconds
    const timer = setTimeout(async () => {
      await combatPhase(fightId);
    }, 5000);
    combatTimers.set(fightId, timer);
  }

  async function combatPhase(fightId: string) {
    const session = await storage.getCombatSession(fightId);
    const fight = await storage.getFight(fightId);
    if (!session || !fight) return;

    await storage.updateCombatSession(fightId, { currentPhase: "combat" });
    broadcastToCombat(fightId, { type: "phase_change", phase: "Combat!" });

    const question = fight.questions[session.currentQuestionIndex];

    // Process answers and deal damage
    for (const [playerId, player] of Object.entries(session.players)) {
      if (player.isDead) continue;

      // Only process if player actually answered
      if (!player.hasAnswered || !player.currentAnswer) continue;

      // Track question answered
      await storage.updatePlayerState(fightId, playerId, {
        questionsAnswered: player.questionsAnswered + 1,
      });

      const isCorrect = player.currentAnswer.toLowerCase() === question.correctAnswer.toLowerCase();

      if (isCorrect) {
        // Track correct answer
        await storage.updatePlayerState(fightId, playerId, {
          questionsCorrect: player.questionsCorrect + 1,
        });

        if (player.isHealing && player.healTarget && player.characterClass === "herbalist") {
          // Heal target
          const target = session.players[player.healTarget];
          if (target && !target.isDead) {
            const healAmount = 1;
            await storage.updatePlayerState(fightId, player.healTarget, {
              health: Math.min(target.health + healAmount, target.maxHealth),
            });
            // Track healing done
            await storage.updatePlayerState(fightId, playerId, {
              healingDone: player.healingDone + healAmount,
            });
          }
        } else {
          // Deal damage to enemy
          let damage = 1;
          if (player.characterClass === "wizard" || player.characterClass === "scout") {
            damage = 2;
            const newStreak = player.streakCounter + 1;
            if (newStreak >= 3) {
              damage = 6;
              await storage.updatePlayerState(fightId, playerId, { streakCounter: 0 });
            } else {
              await storage.updatePlayerState(fightId, playerId, { streakCounter: newStreak });
            }
          }

          if (session.enemies.length > 0) {
            const enemy = session.enemies[0];
            enemy.health = Math.max(0, enemy.health - damage);
            await storage.updateCombatSession(fightId, { enemies: session.enemies });
            
            // Track damage dealt
            await storage.updatePlayerState(fightId, playerId, {
              damageDealt: player.damageDealt + damage,
            });
          }
        }
      } else {
        // Wrong answer - take damage (unless blocked)
        let blocked = false;
        for (const [, blocker] of Object.entries(session.players)) {
          if (blocker.blockTarget === playerId && blocker.characterClass === "knight") {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          const damageAmount = 1;
          const newHealth = Math.max(0, player.health - damageAmount);
          const wasAlive = !player.isDead;
          const nowDead = newHealth === 0;
          
          await storage.updatePlayerState(fightId, playerId, {
            health: newHealth,
            isDead: nowDead,
            streakCounter: 0,
            damageTaken: player.damageTaken + damageAmount,
            deaths: wasAlive && nowDead ? player.deaths + 1 : player.deaths,
          });
        }
      }
    }

    const updatedSession = await storage.getCombatSession(fightId);
    broadcastToCombat(fightId, { type: "combat_state", state: updatedSession });

    // Auto-advance to state check
    setTimeout(async () => {
      await checkGameState(fightId);
    }, 2000);
  }

  async function saveCombatStats(fightId: string) {
    const session = await storage.getCombatSession(fightId);
    if (!session) return;

    for (const player of Object.values(session.players)) {
      await storage.createCombatStat({
        fightId,
        studentId: player.studentId,
        nickname: player.nickname,
        characterClass: player.characterClass,
        questionsAnswered: player.questionsAnswered,
        questionsCorrect: player.questionsCorrect,
        damageDealt: player.damageDealt,
        healingDone: player.healingDone,
        damageTaken: player.damageTaken,
        deaths: player.deaths,
        survived: !player.isDead,
      });
    }
  }

  async function checkGameState(fightId: string) {
    const session = await storage.getCombatSession(fightId);
    const fight = await storage.getFight(fightId);
    if (!session || !fight) return;

    // Check if all players dead
    const allPlayersDead = Object.values(session.players).every((p) => p.isDead);
    if (allPlayersDead) {
      await saveCombatStats(fightId);
      await storage.updateCombatSession(fightId, { currentPhase: "game_over" });
      broadcastToCombat(fightId, {
        type: "game_over",
        victory: false,
        message: "All heroes have fallen...",
      });
      return;
    }

    // Check if all enemies dead
    const allEnemiesDead = session.enemies.every((e) => e.health <= 0);
    if (allEnemiesDead) {
      await saveCombatStats(fightId);
      await storage.updateCombatSession(fightId, { currentPhase: "game_over" });
      broadcastToCombat(fightId, {
        type: "game_over",
        victory: true,
        message: "Victory! All enemies defeated!",
      });
      return;
    }

    // Continue to next question
    await storage.updateCombatSession(fightId, {
      currentQuestionIndex: session.currentQuestionIndex + 1,
    });
    await startQuestion(fightId);
  }

  wss.on("connection", (ws: ExtendedWebSocket) => {
    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "host") {
          ws.fightId = message.fightId;
          ws.isHost = true;
          const fight = await storage.getFight(message.fightId);
          if (fight) {
            let session = await storage.getCombatSession(message.fightId);
            if (!session) {
              session = await storage.createCombatSession(message.fightId, fight);
            }
            ws.send(JSON.stringify({ type: "combat_state", state: session }));
          }
        } else if (message.type === "join") {
          const student = await storage.getStudent(message.studentId);
          const fightId = message.fightId;
          if (!student || !fightId) return;

          const fight = await storage.getFight(fightId);
          if (!fight || fight.classCode !== student.classCode) return;

          ws.studentId = student.id;
          ws.fightId = fightId;

          let session = await storage.getCombatSession(fightId);
          if (!session) {
            session = await storage.createCombatSession(fightId, fight);
          }

          if (!session.players[student.id]) {
            await storage.addPlayerToCombat(fightId, student);
          }

          const updatedSession = await storage.getCombatSession(fightId);
          broadcastToCombat(fightId, { type: "combat_state", state: updatedSession });
        } else if (message.type === "start_fight" && ws.isHost && ws.fightId) {
          await startQuestion(ws.fightId);
        } else if (message.type === "answer" && ws.studentId && ws.fightId) {
          await storage.updatePlayerState(ws.fightId, ws.studentId, {
            currentAnswer: message.answer,
            hasAnswered: true,
            isHealing: message.isHealing || false,
            healTarget: message.healTarget,
          });
          const session = await storage.getCombatSession(ws.fightId);
          broadcastToCombat(ws.fightId, { type: "combat_state", state: session });
        } else if (message.type === "block" && ws.studentId && ws.fightId) {
          await storage.updatePlayerState(ws.fightId, ws.studentId, {
            blockTarget: message.targetId,
          });
        } else if (message.type === "heal" && ws.studentId && ws.fightId) {
          await storage.updatePlayerState(ws.fightId, ws.studentId, {
            isHealing: true,
            healTarget: message.targetId,
          });
        }
      } catch (error) {
        console.error("WebSocket error:", error);
      }
    });

    ws.on("close", () => {
      // Cleanup
    });
  });

  return httpServer;
}
