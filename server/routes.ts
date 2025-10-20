import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, verifyPassword } from "./storage";
import { insertFightSchema, insertCombatStatSchema, insertEquipmentItemSchema, type Question, getStartingEquipment, type CharacterClass } from "@shared/schema";
import { log } from "./vite";
import { getCrossClassAbilities, getFireballCooldown, getFireballDamageBonus, getFireballMaxChargeRounds, getHeadshotMaxComboPoints, calculateXP } from "@shared/jobSystem";

interface ExtendedWebSocket extends WebSocket {
  studentId?: string;
  fightId?: string;
  isHost?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Teacher authentication endpoints
  app.post("/api/teacher/signup", async (req, res) => {
    try {
      const { firstName, lastName, email, password, billingAddress, schoolDistrict, school, subject, gradeLevel } = req.body;
      
      // Check if email already exists
      const existing = await storage.getTeacherByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const teacher = await storage.createTeacher({
        firstName,
        lastName,
        email,
        password,
        billingAddress,
        schoolDistrict,
        school,
        subject,
        gradeLevel,
      });
      
      const { password: _, ...teacherWithoutPassword } = teacher;
      res.json(teacherWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/teacher/login", async (req, res) => {
    const { email, password } = req.body;
    const teacher = await storage.getTeacherByEmail(email);
    
    if (!teacher || !verifyPassword(password, teacher.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const { password: _, ...teacherWithoutPassword } = teacher;
    res.json(teacherWithoutPassword);
  });

  app.get("/api/teacher/:id", async (req, res) => {
    const teacher = await storage.getTeacher(req.params.id);
    if (!teacher) return res.status(404).json({ error: "Teacher not found" });
    const { password: _, ...teacherWithoutPassword } = teacher;
    res.json(teacherWithoutPassword);
  });

  // Teacher fight endpoints
  app.get("/api/fights", async (req, res) => {
    const fights = await storage.getAllFights();
    res.json(fights);
  });

  app.get("/api/teacher/:teacherId/fights", async (req, res) => {
    const fights = await storage.getFightsByTeacherId(req.params.teacherId);
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

  app.patch("/api/fights/:id", async (req, res) => {
    try {
      const data = insertFightSchema.parse(req.body);
      const fight = await storage.updateFight(req.params.id, data);
      if (!fight) return res.status(404).json({ error: "Fight not found" });
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

  // Find active fight by class code
  app.get("/api/fights/active/:classCode", async (req, res) => {
    const { classCode } = req.params;
    const allFights = await storage.getAllFights();
    
    // Find fights with matching class code
    const matchingFights = allFights.filter(f => f.classCode === classCode);
    
    if (matchingFights.length === 0) {
      return res.status(404).json({ error: "No fight found with this class code" });
    }
    
    // Check which ones have active combat sessions (are being hosted)
    const activeFights = [];
    for (const fight of matchingFights) {
      const session = await storage.getCombatSession(fight.id);
      if (session) {
        activeFights.push(fight);
      }
    }
    
    if (activeFights.length === 0) {
      return res.status(404).json({ error: "No active fight found with this class code. Make sure your teacher has started hosting the battle." });
    }
    
    // Return the first active fight (there should typically only be one active at a time per class code)
    res.json(activeFights[0]);
  });

  // Equipment items endpoints
  app.get("/api/teacher/:teacherId/equipment-items", async (req, res) => {
    const items = await storage.getEquipmentItemsByTeacher(req.params.teacherId);
    res.json(items);
  });

  app.get("/api/equipment-items/:id", async (req, res) => {
    const item = await storage.getEquipmentItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Equipment item not found" });
    res.json(item);
  });

  app.post("/api/equipment-items", async (req, res) => {
    try {
      const data = insertEquipmentItemSchema.parse(req.body);
      const item = await storage.createEquipmentItem(data);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/equipment-items/:id", async (req, res) => {
    try {
      const item = await storage.getEquipmentItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Equipment item not found" });
      
      const updated = await storage.updateEquipmentItem(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/equipment-items/:id", async (req, res) => {
    const deleted = await storage.deleteEquipmentItem(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Equipment item not found" });
    res.json({ success: true });
  });

  // Get equipment items by IDs (for student inventory)
  app.get("/api/equipment-items", async (req, res) => {
    const ids = req.query.ids as string;
    if (!ids) {
      return res.json([]);
    }
    const idArray = ids.split(',').filter(id => id.trim());
    if (idArray.length === 0) {
      return res.json([]);
    }
    const items = await storage.getEquipmentItemsByIds(idArray);
    res.json(items);
  });

  // Student endpoints
  app.post("/api/student/register", async (req, res) => {
    try {
      const { nickname, password, classCode, characterClass = null, gender = null } = req.body;
      const existing = await storage.getStudentByNickname(nickname);
      if (existing) {
        return res.status(400).json({ error: "Nickname already taken" });
      }

      const student = await storage.createStudent({
        nickname,
        password,
        classCode,
        characterClass,
        gender,
        weapon: null,
        headgear: null,
        armor: null,
      });
      const { password: _, ...studentWithoutPassword } = student;
      res.json(studentWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/student/login", async (req, res) => {
    const { nickname, password } = req.body;
    let student = await storage.getStudentByNickname(nickname);
    
    // Auto-create student on first login if they don't exist
    // New students start with null characterClass and gender so they must go through character selection
    if (!student) {
      try {
        student = await storage.createStudent({
          nickname,
          password,
          characterClass: null,
          gender: null,
          weapon: null,
          headgear: null,
          armor: null,
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
    
    // Create initial job level for the selected class (starts at level 1 by default)
    const existingJobLevel = await storage.getStudentJobLevels(req.params.id);
    const hasJobLevel = existingJobLevel.some(jl => jl.jobClass === characterClass);
    if (!hasJobLevel) {
      await storage.createStudentJobLevel({
        studentId: req.params.id,
        jobClass: characterClass,
        level: 1,
        experience: 0,
      });
    }
    
    const { password: _, ...studentWithoutPassword } = student;
    res.json(studentWithoutPassword);
  });

  app.patch("/api/student/:id/equipment", async (req, res) => {
    const student = await storage.getStudent(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (!student.characterClass) return res.status(400).json({ error: "Student must select a character class first" });
    
    const updates = req.body;
    
    // Validate cross-class abilities
    if (updates.crossClassAbility1 !== undefined || updates.crossClassAbility2 !== undefined) {
      const jobLevels = await storage.getStudentJobLevels(req.params.id);
      const jobLevelMap = jobLevels.reduce((acc, jl) => {
        acc[jl.jobClass] = jl.level;
        return acc;
      }, {} as Record<CharacterClass, number>);
      
      const availableAbilities = getCrossClassAbilities(student.characterClass, jobLevelMap);
      const validAbilityIds = new Set(availableAbilities.map(a => a.id));
      
      if (updates.crossClassAbility1 && !validAbilityIds.has(updates.crossClassAbility1)) {
        return res.status(400).json({ error: "Invalid cross-class ability 1" });
      }
      if (updates.crossClassAbility2 && !validAbilityIds.has(updates.crossClassAbility2)) {
        return res.status(400).json({ error: "Invalid cross-class ability 2" });
      }
    }
    
    const updatedStudent = await storage.updateStudent(req.params.id, updates);
    if (!updatedStudent) return res.status(404).json({ error: "Student not found" });
    const { password: _, ...studentWithoutPassword } = updatedStudent;
    res.json(studentWithoutPassword);
  });

  app.get("/api/student/:id/available-fights", async (req, res) => {
    const student = await storage.getStudent(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const fights = await storage.getAllFights();
    const availableFights = fights.filter(f => f.classCode === student.classCode);
    res.json(availableFights);
  });

  app.post("/api/student/:id/claim-loot", async (req, res) => {
    const { itemId, fightId } = req.body;
    if (!itemId || !fightId) return res.status(400).json({ error: "Item ID and Fight ID required" });
    
    const student = await storage.getStudent(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    
    const fight = await storage.getFight(fightId);
    if (!fight) return res.status(404).json({ error: "Fight not found" });
    
    // Validate item is in the fight's loot table
    const lootTable = fight.lootTable || [];
    const validLoot = lootTable.find(item => item.itemId === itemId);
    if (!validLoot) return res.status(400).json({ error: "Invalid loot item for this fight" });
    
    // Atomically claim loot using conditional update
    const claimed = await storage.claimLootAtomically(fightId, req.params.id, itemId);
    if (!claimed) {
      return res.status(400).json({ error: "Loot already claimed from this fight or no combat record found" });
    }
    
    // Add item to inventory
    const currentInventory = student.inventory || [];
    const updatedInventory = [...currentInventory, itemId];
    
    const updatedStudent = await storage.updateStudent(req.params.id, { inventory: updatedInventory });
    if (!updatedStudent) return res.status(404).json({ error: "Student not found" });
    
    const { password: _, ...studentWithoutPassword } = updatedStudent;
    res.json(studentWithoutPassword);
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

  // Job progression endpoints
  app.get("/api/student/:studentId/job-levels", async (req, res) => {
    const jobLevels = await storage.getStudentJobLevels(req.params.studentId);
    res.json(jobLevels);
  });

  app.get("/api/student/:studentId/job-level/:jobClass", async (req, res) => {
    const jobLevel = await storage.getStudentJobLevel(
      req.params.studentId,
      req.params.jobClass as any
    );
    if (!jobLevel) {
      return res.json({ level: 1, experience: 0 }); // Default for new jobs
    }
    res.json(jobLevel);
  });

  app.post("/api/student/:studentId/award-xp", async (req, res) => {
    try {
      const { jobClass, xpAmount } = req.body;
      const result = await storage.awardXPToJob(
        req.params.studentId,
        jobClass,
        xpAmount
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/students/used-fight-codes/:classCode", async (req, res) => {
    const students = await storage.getStudentsWhoUsedFightCodes(req.params.classCode);
    // Remove password from response
    const studentsWithoutPasswords = students.map(({ password, ...student }) => student);
    res.json(studentsWithoutPasswords);
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time combat  
  // Use noServer: true to manually handle upgrades
  const wss = new WebSocketServer({ noServer: true });
  log("[WebSocket] Server created for combat connections", "websocket");

  // Handle ALL WebSocket upgrades (Replit deployment proxy strips /ws path)
  // This means request.url comes through as "/" instead of "/ws" in production
  // Trade-off: Vite HMR won't work in development, but combat WebSocket works in production
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    log(`[WebSocket] Handling upgrade request to ${pathname}`, "websocket");
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on("error", (error) => {
    log(`[WebSocket Server] Error: ${error}`, "websocket");
  });

  const combatTimers: Map<string, NodeJS.Timeout> = new Map();
  const inactivityTimers: Map<string, NodeJS.Timeout> = new Map();
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

  function resetInactivityTimer(fightId: string) {
    // Clear existing inactivity timer
    const existingTimer = inactivityTimers.get(fightId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new inactivity timer
    const timer = setTimeout(async () => {
      log(`[WebSocket] Fight ${fightId} ending due to 10 minutes of inactivity`, "websocket");
      
      // Clear combat timer if any
      const combatTimer = combatTimers.get(fightId);
      if (combatTimer) {
        clearTimeout(combatTimer);
        combatTimers.delete(fightId);
      }
      
      // Save combat stats
      await saveCombatStats(fightId);
      
      // End the fight
      broadcastToCombat(fightId, {
        type: "game_over",
        victory: false,
        message: "Fight ended due to inactivity (10 minutes)",
      });
      
      // Update combat session
      await storage.updateCombatSession(fightId, { currentPhase: "game_over" });
      
      // Disconnect all players after a short delay to ensure they receive the message
      setTimeout(() => {
        disconnectAllPlayers(fightId);
      }, 2000);
      
      // Clean up
      inactivityTimers.delete(fightId);
    }, INACTIVITY_TIMEOUT);
    
    inactivityTimers.set(fightId, timer);
  }

  function broadcastToCombat(fightId: string, message: any) {
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      if (ws.readyState === WebSocket.OPEN && (ws.fightId === fightId || ws.isHost)) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  // Broadcast batching to reduce message flood with many players
  const pendingBroadcasts: Map<string, NodeJS.Timeout> = new Map();
  const BROADCAST_DEBOUNCE_MS = 50; // Batch updates within 50ms window

  async function scheduleBroadcastUpdate(fightId: string) {
    // Cancel any pending broadcast for this fight
    const existingTimer = pendingBroadcasts.get(fightId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new broadcast after debounce delay
    const timer = setTimeout(async () => {
      try {
        const session = await storage.getCombatSession(fightId);
        if (session) {
          broadcastToCombat(fightId, { type: "combat_state", state: session });
        }
      } catch (error) {
        log(`[WebSocket] Error broadcasting batched update for fight ${fightId}: ${error}`, "websocket");
      } finally {
        pendingBroadcasts.delete(fightId);
      }
    }, BROADCAST_DEBOUNCE_MS);

    pendingBroadcasts.set(fightId, timer);
  }

  function disconnectAllPlayers(fightId: string) {
    // Close all WebSocket connections for this fight
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      if (ws.fightId === fightId && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Fight ended");
      }
    });
  }

  async function startQuestion(fightId: string) {
    const session = await storage.getCombatSession(fightId);
    const fight = await storage.getFight(fightId);
    if (!session || !fight) return;
    
    // Reset inactivity timer on new question
    resetInactivityTimer(fightId);

    // Loop questions: if we've reached the end, go back to the start
    if (session.currentQuestionIndex >= fight.questions.length) {
      await storage.updateCombatSession(fightId, { currentQuestionIndex: 0 });
      const updatedSession = await storage.getCombatSession(fightId);
      if (!updatedSession) return;
      session.currentQuestionIndex = 0;
    }

    // Use questionOrder array to get the actual question index (supports randomization)
    const actualQuestionIndex = session.questionOrder 
      ? session.questionOrder[session.currentQuestionIndex] 
      : session.currentQuestionIndex;
    const question = fight.questions[actualQuestionIndex];
    await storage.updateCombatSession(fightId, {
      currentPhase: "question",
      questionStartTime: Date.now(),
    });

    // Reset player states for new question (only for alive players)
    for (const [playerId, player] of Object.entries(session.players)) {
      // Skip dead players - they don't participate in questions
      if (player.isDead) continue;
      
      await storage.updatePlayerState(fightId, playerId, {
        hasAnswered: false,
        currentAnswer: undefined,
        isHealing: false,
        healTarget: undefined,
        blockTarget: undefined,
        isCreatingPotion: false,
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
    broadcastToCombat(fightId, { type: "phase_change", phase: "Tank Blocking & Healing" });
    
    // Process potion healing for herbalists
    for (const [playerId, player] of Object.entries(session.players)) {
      if (player.isDead) continue;
      
      if (player.isHealing && player.healTarget && player.characterClass === "herbalist" && player.potionCount > 0) {
        const target = session.players[player.healTarget];
        if (target && !target.isDead) {
          const healAmount = 1;
          await storage.updatePlayerState(fightId, player.healTarget, {
            health: Math.min(target.health + healAmount, target.maxHealth),
          });
          // Use up a potion
          await storage.updatePlayerState(fightId, playerId, {
            potionCount: player.potionCount - 1,
            healingDone: player.healingDone + healAmount,
          });
        }
      }
    }
    
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

        if (player.isCreatingPotion && player.characterClass === "herbalist") {
          // Herbalist chose to create a potion instead of dealing damage
          await storage.updatePlayerState(fightId, playerId, {
            potionCount: player.potionCount + 1,
            isCreatingPotion: false,
          });
        } else if (player.isHealing && player.healTarget && player.characterClass === "herbalist") {
          // Herbalist chose to heal - healing happens in tank_blocking phase (phase 2)
          // Don't deal damage if healing
        } else {
          // Deal damage to enemy
          let damage = 1;
          
          if (player.characterClass === "wizard") {
            // Wizard Fireball ability: Dynamic stats based on wizard level
            const wizardLevel = player.jobLevels.wizard || 0;
            const maxChargeRounds = getFireballMaxChargeRounds(wizardLevel);
            const damageBonus = getFireballDamageBonus(wizardLevel);
            const cooldownDuration = getFireballCooldown(wizardLevel);
            
            if (player.fireballCooldown > 0) {
              // On cooldown - do base damage only and decrement cooldown
              damage = 1 + damageBonus;
              await storage.updatePlayerState(fightId, playerId, {
                fireballCooldown: player.fireballCooldown - 1,
                isChargingFireball: false,
              });
            } else if (player.isChargingFireball) {
              // Wizard is charging fireball - automatically continue charging
              const newChargeRounds = player.fireballChargeRounds + 1;
              
              if (newChargeRounds < maxChargeRounds) {
                // Still charging: no damage while charging
                // Keep isChargingFireball true to auto-continue next round
                damage = 0;
                await storage.updatePlayerState(fightId, playerId, {
                  fireballChargeRounds: newChargeRounds,
                  isChargingFireball: true, // Keep charging
                });
              } else {
                // Fully charged: RELEASE! Deal 2x normal damage
                const baseDamage = 1 + damageBonus;
                damage = baseDamage * 2;
                await storage.updatePlayerState(fightId, playerId, {
                  fireballChargeRounds: 0,
                  fireballCooldown: cooldownDuration, // Level-based cooldown
                  isChargingFireball: false, // Stop charging after release
                });
              }
            } else {
              // Not charging - do base damage only
              damage = 1 + damageBonus;
            }
          } else if (player.characterClass === "scout") {
            // Scout builds combo points with correct answers
            // Get scout level to determine max combo points
            const scoutLevel = player.jobLevels?.scout || 0;
            const maxComboPoints = getHeadshotMaxComboPoints(scoutLevel);
            
            damage = 2; // Base damage
            const newComboPoints = player.streakCounter + 1;
            
            if (newComboPoints >= maxComboPoints) {
              // Headshot: consume all combo points for heavy damage
              damage = 6 + (newComboPoints - 3); // 6 base Headshot damage + bonus for extra points beyond 3
              await storage.updatePlayerState(fightId, playerId, { streakCounter: 0 });
            } else {
              await storage.updatePlayerState(fightId, playerId, { streakCounter: newComboPoints });
            }
          }

          if (session.enemies.length > 0) {
            // Update enemy health in memory (will save once at end of phase)
            const enemy = session.enemies[0];
            enemy.health = Math.max(0, enemy.health - damage);
            
            // Track damage dealt
            await storage.updatePlayerState(fightId, playerId, {
              damageDealt: player.damageDealt + damage,
            });
          }
        }
      } else {
        // Wrong answer - track incorrect answer
        await storage.updatePlayerState(fightId, playerId, {
          questionsIncorrect: player.questionsIncorrect + 1,
        });
        
        // Reset ability states on wrong answer (before checking block)
        const abilityUpdates: any = {
          streakCounter: 0, // Reset scout streak
        };
        
        // Reset wizard fireball charge and decrement cooldown
        if (player.characterClass === "wizard") {
          abilityUpdates.fireballChargeRounds = 0;
          abilityUpdates.isChargingFireball = false;
          if (player.fireballCooldown > 0) {
            abilityUpdates.fireballCooldown = player.fireballCooldown - 1;
          }
        }
        
        await storage.updatePlayerState(fightId, playerId, abilityUpdates);
        
        // Wrong answer - take damage (unless blocked by alive warrior)
        let blocked = false;
        for (const [, blocker] of Object.entries(session.players)) {
          if (blocker.blockTarget === playerId && blocker.characterClass === "warrior" && !blocker.isDead) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          const damageAmount = fight.baseEnemyDamage || 1;
          const newHealth = Math.max(0, player.health - damageAmount);
          const wasAlive = !player.isDead;
          const nowDead = newHealth === 0;
          
          await storage.updatePlayerState(fightId, playerId, {
            health: newHealth,
            isDead: nowDead,
            damageTaken: player.damageTaken + damageAmount,
            deaths: wasAlive && nowDead ? player.deaths + 1 : player.deaths,
          });
        }
      }
    }

    // Save enemy health changes once (batched instead of per-player)
    await storage.updateCombatSession(fightId, { enemies: session.enemies });

    const updatedSession = await storage.getCombatSession(fightId);
    broadcastToCombat(fightId, { type: "combat_state", state: updatedSession });

    // Auto-advance to enemy AI phase
    setTimeout(async () => {
      await enemyAIPhase(fightId);
    }, 2000);
  }

  async function enemyAIPhase(fightId: string) {
    const session = await storage.getCombatSession(fightId);
    const fight = await storage.getFight(fightId);
    if (!session || !fight) return;

    broadcastToCombat(fightId, { type: "phase_change", phase: "Enemy Turn" });

    // Default enemy AI: Attack player with highest threat
    // In the future, this will use fight.enemyScript for custom behavior
    
    for (const enemy of session.enemies) {
      if (enemy.health <= 0) continue; // Dead enemies don't attack
      
      // Find alive player with highest threat
      let highestThreat = 0;
      let targetId: string | null = null;
      
      for (const [playerId, player] of Object.entries(session.players)) {
        if (player.isDead) continue;
        if (player.threat > highestThreat) {
          highestThreat = player.threat;
          targetId = playerId;
        }
      }
      
      if (targetId) {
        const target = session.players[targetId];
        const damageAmount = (fight.baseEnemyDamage || 1) + 1; // baseEnemyDamage + 1
        const newHealth = Math.max(0, target.health - damageAmount);
        const wasAlive = !target.isDead;
        const nowDead = newHealth === 0;
        
        await storage.updatePlayerState(fightId, targetId, {
          health: newHealth,
          isDead: nowDead,
          damageTaken: target.damageTaken + damageAmount,
          deaths: wasAlive && nowDead ? target.deaths + 1 : target.deaths,
        });
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
      
      // Calculate and award XP for each player
      const victoryData: Record<string, any> = {};
      for (const player of Object.values(session.players)) {
        // Calculate XP based on combat performance
        const xpGained = calculateXP({
          questionsCorrect: player.questionsCorrect,
          questionsIncorrect: player.questionsIncorrect,
          damageBlocked: 0, // Warriors block damage but this isn't tracked currently
          healingDone: player.healingDone || 0,
          bonusDamage: Math.max(0, player.damageDealt - player.questionsCorrect), // Bonus damage above base
          baseFightXP: fight.baseXP || 10,
        });
        
        // Award XP to the player's current class
        const result = await storage.awardXPToJob(
          player.studentId,
          player.characterClass,
          xpGained
        );
        
        victoryData[player.studentId] = {
          xpGained,
          leveledUp: result.leveledUp,
          newLevel: result.newLevel,
          currentXP: result.jobLevel.experience,
        };
      }
      
      // Send individual victory messages to each player with their XP data
      wss.clients.forEach((client) => {
        const playerWs = client as ExtendedWebSocket;
        if (playerWs.readyState === WebSocket.OPEN && playerWs.fightId === fightId && playerWs.studentId) {
          const playerData = victoryData[playerWs.studentId];
          playerWs.send(JSON.stringify({
            type: "game_over",
            victory: true,
            message: "Victory! All enemies defeated!",
            xpGained: playerData?.xpGained || 0,
            leveledUp: playerData?.leveledUp || false,
            newLevel: playerData?.newLevel || 1,
            currentXP: playerData?.currentXP || 0,
            lootTable: fight.lootTable || [],
          }));
        } else if (playerWs.readyState === WebSocket.OPEN && (playerWs.fightId === fightId || playerWs.isHost)) {
          // Send basic victory message to host
          playerWs.send(JSON.stringify({
            type: "game_over",
            victory: true,
            message: "Victory! All enemies defeated!",
          }));
        }
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
    log("[WebSocket] New connection established", "websocket");
    
    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        log(`[WebSocket] Received message: ${message.type}`, "websocket");

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
          
          if (!student) {
            log(`[WebSocket] Join failed: Student not found (${message.studentId})`, "websocket");
            return;
          }
          if (!fightId) {
            log(`[WebSocket] Join failed: No fightId provided`, "websocket");
            return;
          }

          const fight = await storage.getFight(fightId);
          if (!fight) {
            log(`[WebSocket] Join failed: Fight not found (${fightId})`, "websocket");
            return;
          }

          log(`[WebSocket] Student ${student.nickname} joining fight ${fight.title}`, "websocket");

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
          log(`[WebSocket] Student ${student.nickname} successfully joined fight`, "websocket");
        } else if (message.type === "start_fight" && ws.isHost && ws.fightId) {
          await startQuestion(ws.fightId);
        } else if (message.type === "end_fight" && ws.isHost && ws.fightId) {
          // Clear any active timers
          const timer = combatTimers.get(ws.fightId);
          if (timer) {
            clearTimeout(timer);
            combatTimers.delete(ws.fightId);
          }
          
          // Clear inactivity timer
          const inactivityTimer = inactivityTimers.get(ws.fightId);
          if (inactivityTimer) {
            clearTimeout(inactivityTimer);
            inactivityTimers.delete(ws.fightId);
          }
          
          // Save combat stats before ending
          await saveCombatStats(ws.fightId);
          
          // End the fight - broadcast game_over to all players
          broadcastToCombat(ws.fightId, {
            type: "game_over",
            victory: false,
            message: "Fight ended by teacher",
          });
          
          // Update combat session to game_over phase
          await storage.updateCombatSession(ws.fightId, { currentPhase: "game_over" });
          
          // Disconnect all players after a short delay to ensure they receive the message
          const fightIdToClose = ws.fightId;
          setTimeout(() => {
            disconnectAllPlayers(fightIdToClose);
          }, 2000);
          
          log(`[WebSocket] Fight ${ws.fightId} ended by teacher`, "websocket");
        } else if (message.type === "answer" && ws.studentId && ws.fightId) {
          const session = await storage.getCombatSession(ws.fightId);
          if (!session) return;
          
          // Only allow alive players to answer
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring answer from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Reset inactivity timer on player action
          resetInactivityTimer(ws.fightId);
          
          await storage.updatePlayerState(ws.fightId, ws.studentId, {
            currentAnswer: message.answer,
            hasAnswered: true,
            isHealing: message.isHealing || false,
            healTarget: message.healTarget,
          });
          
          const updatedSession = await storage.getCombatSession(ws.fightId);
          if (!updatedSession) return;
          
          broadcastToCombat(ws.fightId, { type: "combat_state", state: updatedSession });

          // Check if all alive players have answered - if so, end question phase early
          const alivePlayers = Object.values(updatedSession.players).filter(p => !p.isDead);
          const allAnswered = alivePlayers.every(player => player.hasAnswered);
          
          if (allAnswered && alivePlayers.length > 0) {
            log(`[WebSocket] All ${alivePlayers.length} alive students answered - ending question phase early`, "websocket");
            
            // Clear the question timer
            const timer = combatTimers.get(ws.fightId);
            if (timer) {
              clearTimeout(timer);
              combatTimers.delete(ws.fightId);
            }
            
            // Immediately proceed to tank blocking phase
            await tankBlockingPhase(ws.fightId);
          }
        } else if (message.type === "block" && ws.studentId && ws.fightId) {
          const session = await storage.getCombatSession(ws.fightId);
          if (!session) return;
          
          // Only allow alive warriors to block
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring block from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Reset inactivity timer on player action
          resetInactivityTimer(ws.fightId);
          
          await storage.updatePlayerState(ws.fightId, ws.studentId, {
            blockTarget: message.targetId,
          });
          
          const updatedSession = await storage.getCombatSession(ws.fightId);
          broadcastToCombat(ws.fightId, { type: "combat_state", state: updatedSession });
        } else if (message.type === "heal" && ws.studentId && ws.fightId) {
          const session = await storage.getCombatSession(ws.fightId);
          if (!session) return;
          
          // Only allow alive herbalists to heal
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring heal from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Reset inactivity timer on player action
          resetInactivityTimer(ws.fightId);
          
          await storage.updatePlayerState(ws.fightId, ws.studentId, {
            isHealing: true,
            healTarget: message.targetId,
          });
          
          // Batch broadcast to reduce message flood
          scheduleBroadcastUpdate(ws.fightId);
        } else if (message.type === "create_potion" && ws.studentId && ws.fightId) {
          const session = await storage.getCombatSession(ws.fightId);
          if (!session) return;
          
          // Only allow alive herbalists to create potions
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring create_potion from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Herbalist choosing to create a potion instead of dealing damage
          await storage.updatePlayerState(ws.fightId, ws.studentId, {
            isCreatingPotion: true,
          });
          
          // Batch broadcast to reduce message flood
          scheduleBroadcastUpdate(ws.fightId);
        } else if (message.type === "charge_fireball" && ws.studentId && ws.fightId) {
          const session = await storage.getCombatSession(ws.fightId);
          if (!session) return;
          
          // Only allow alive wizards to charge fireballs
          const player = session.players[ws.studentId];
          if (!player || player.isDead || player.characterClass !== "wizard") {
            log(`[WebSocket] Ignoring charge_fireball from non-wizard/dead player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Wizard starting to charge a fireball
          await storage.updatePlayerState(ws.fightId, ws.studentId, {
            isChargingFireball: true,
          });
          
          // Batch broadcast to reduce message flood
          scheduleBroadcastUpdate(ws.fightId);
        }
      } catch (error) {
        log(`[WebSocket] Error: ${error}`, "websocket");
      }
    });

    ws.on("close", () => {
      // Cleanup on connection close
      if (ws.fightId && ws.studentId) {
        log(`[WebSocket] Student ${ws.studentId} disconnected from fight ${ws.fightId}`, "websocket");
      }
      if (ws.isHost && ws.fightId) {
        log(`[WebSocket] Host disconnected from fight ${ws.fightId}`, "websocket");
      }
    });
  });

  return httpServer;
}
