import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, verifyPassword } from "./storage";
import { insertFightSchema, insertCombatStatSchema, insertEquipmentItemSchema, type Question, getStartingEquipment, type CharacterClass, type PlayerState, type LootItem, getPlayerCombatStats, calculatePhysicalDamage, calculateMagicalDamage, calculateRangedDamage, calculateHybridDamage, calculateDamageReduction, TANK_CLASSES, HEALER_CLASSES, type CombatState, type ResolutionFeedback, type PartyDamageData, type EnemyAIAttackData } from "@shared/schema";
import { log } from "./vite";
import { getCrossClassAbilities, getFireballCooldown, getFireballDamageBonus, getFireballMaxChargeRounds, getHeadshotMaxComboPoints, calculateXP, getTotalMechanicUpgrades, getHealingPower } from "@shared/jobSystem";
import { ULTIMATE_ABILITIES, calculateUltimateEffect } from "@shared/ultimateAbilities";
import { ABILITY_DISPLAYS } from "@shared/abilityUI";

interface ExtendedWebSocket extends WebSocket {
  studentId?: string;
  sessionId?: string; // Primary identifier for the combat session
  fightId?: string;   // Cached for quick access to fight data
  isHost?: boolean;
  isAlive?: boolean;  // For heartbeat tracking
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
    
    // Create session
    req.session.teacherId = teacher.id;
    req.session.teacherEmail = teacher.email;
    
    // Save session before responding to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Failed to create session" });
      }
      
      const { password: _, ...teacherWithoutPassword } = teacher;
      res.json({
        ...teacherWithoutPassword,
        sessionActive: true,
      });
    });
  });

  app.post("/api/teacher/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.json({ success: true, message: "Logged out successfully" });
    });
  });

  app.get("/api/teacher/check-session", async (req, res) => {
    if (!req.session.teacherId) {
      return res.status(401).json({ sessionActive: false });
    }
    
    // Verify teacher still exists
    const teacher = await storage.getTeacher(req.session.teacherId.toString());
    if (!teacher) {
      req.session.destroy(() => {});
      return res.status(401).json({ sessionActive: false });
    }
    
    const { password: _, ...teacherWithoutPassword } = teacher;
    res.json({
      ...teacherWithoutPassword,
      sessionActive: true,
    });
  });

  // Session authentication middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  };

  app.get("/api/teacher/:id", requireAuth, async (req, res) => {
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

  app.get("/api/teacher/:teacherId/fights", requireAuth, async (req, res) => {
    const fights = await storage.getFightsByTeacherId(req.params.teacherId);
    res.json(fights);
  });

  app.get("/api/fights/:id", async (req, res) => {
    const fight = await storage.getFight(req.params.id);
    if (!fight) return res.status(404).json({ error: "Fight not found" });
    res.json(fight);
  });

  app.post("/api/fights", requireAuth, async (req, res) => {
    try {
      const data = insertFightSchema.parse(req.body);
      const fight = await storage.createFight(data);
      res.json(fight);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/fights/:id", requireAuth, async (req, res) => {
    try {
      const data = insertFightSchema.parse(req.body);
      const fight = await storage.updateFight(req.params.id, data);
      if (!fight) return res.status(404).json({ error: "Fight not found" });
      res.json(fight);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/fights/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteFight(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Fight not found" });
    res.json({ success: true });
  });

  // Validate sessionId endpoint - used by students before joining
  app.get("/api/sessions/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const session = await storage.getCombatSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "Session not found or has ended" });
    }
    
    // Get the fight data for this session
    const fight = await storage.getFight(session.fightId);
    if (!fight) {
      return res.status(404).json({ error: "Fight configuration not found" });
    }
    
    res.json({ 
      sessionId: session.sessionId,
      fightId: session.fightId,
      title: fight.title,
      isActive: true
    });
  });

  // Find active fight by guild code (kept for backward compatibility if needed)
  app.get("/api/fights/active/:guildCode", async (req, res) => {
    const { guildCode } = req.params;
    const allFights = await storage.getAllFights();
    
    // Find fights with matching guild code
    const matchingFights = allFights.filter(f => f.guildCode === guildCode);
    
    if (matchingFights.length === 0) {
      return res.status(404).json({ error: "No fight found with this guild code" });
    }
    
    // Check which ones have active combat sessions (are being hosted)
    const activeFights = [];
    for (const fight of matchingFights) {
      const sessions = await storage.getCombatSessionsByFightId(fight.id);
      if (sessions.length > 0) {
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

  app.post("/api/equipment-items", requireAuth, async (req, res) => {
    try {
      const data = insertEquipmentItemSchema.parse(req.body);
      const item = await storage.createEquipmentItem(data);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/equipment-items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getEquipmentItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Equipment item not found" });
      
      const updated = await storage.updateEquipmentItem(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/equipment-items/:id", requireAuth, async (req, res) => {
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

  // Guild endpoints
  // Get all guilds for a teacher
  app.get("/api/teacher/:teacherId/guilds", async (req, res) => {
    try {
      const guilds = await storage.getGuildsByTeacher(req.params.teacherId);
      res.json(guilds);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get a specific guild
  app.get("/api/guilds/:id", async (req, res) => {
    try {
      const guild = await storage.getGuild(req.params.id);
      if (!guild) return res.status(404).json({ error: "Guild not found" });
      res.json(guild);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get guild by code (for students joining)
  app.get("/api/guilds/code/:code", async (req, res) => {
    try {
      const guild = await storage.getGuildByCode(req.params.code);
      if (!guild) return res.status(404).json({ error: "Guild not found" });
      res.json(guild);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new guild
  app.post("/api/guilds", requireAuth, async (req, res) => {
    try {
      const { teacherId, name, description } = req.body;
      if (!teacherId || !name) {
        return res.status(400).json({ error: "teacherId and name are required" });
      }

      const guild = await storage.createGuild({ teacherId, name, description });
      res.json(guild);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update guild
  app.patch("/api/guilds/:id", requireAuth, async (req, res) => {
    try {
      const guild = await storage.updateGuild(req.params.id, req.body);
      if (!guild) return res.status(404).json({ error: "Guild not found" });
      res.json(guild);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Archive guild
  app.post("/api/guilds/:id/archive", requireAuth, async (req, res) => {
    try {
      const guild = await storage.archiveGuild(req.params.id);
      if (!guild) return res.status(404).json({ error: "Guild not found" });
      res.json(guild);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Guild membership endpoints
  // Add member to guild (no auth required - students need to join guilds)
  app.post("/api/guilds/:guildId/members", async (req, res) => {
    try {
      const { studentId } = req.body;
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required" });
      }

      const membership = await storage.addMemberToGuild(req.params.guildId, studentId);
      res.json(membership);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Remove member from guild
  app.delete("/api/guilds/:guildId/members/:studentId", requireAuth, async (req, res) => {
    try {
      console.log(`[DELETE] Removing student ${req.params.studentId} from guild ${req.params.guildId}`);
      const removed = await storage.removeMemberFromGuild(req.params.guildId, req.params.studentId);
      console.log(`[DELETE] Removal result: ${removed}`);
      if (!removed) return res.status(404).json({ error: "Membership not found" });
      res.json({ success: true });
    } catch (error: any) {
      console.log(`[DELETE] Error removing member:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get guild members
  app.get("/api/guilds/:guildId/members", async (req, res) => {
    try {
      const members = await storage.getGuildMembers(req.params.guildId);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get student's guilds
  app.get("/api/student/:studentId/guilds", async (req, res) => {
    try {
      const guilds = await storage.getStudentGuilds(req.params.studentId);
      res.json(guilds);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Guild fight assignment endpoints
  // Assign fight to guild
  app.post("/api/guilds/:guildId/fights", requireAuth, async (req, res) => {
    try {
      const { fightId } = req.body;
      if (!fightId) {
        return res.status(400).json({ error: "fightId is required" });
      }

      const assignment = await storage.assignFightToGuild(req.params.guildId, fightId);
      res.json(assignment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Unassign fight from guild
  app.delete("/api/guilds/:guildId/fights/:fightId", requireAuth, async (req, res) => {
    try {
      const removed = await storage.unassignFightFromGuild(req.params.guildId, req.params.fightId);
      if (!removed) return res.status(404).json({ error: "Fight assignment not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle solo mode for guild fight
  app.patch("/api/guilds/:guildId/fights/:fightId/solo-mode", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }

      const updated = await storage.toggleGuildFightSoloMode(req.params.guildId, req.params.fightId, enabled);
      if (!updated) return res.status(404).json({ error: "Fight assignment not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get guild fights
  app.get("/api/guilds/:guildId/fights", async (req, res) => {
    try {
      const fights = await storage.getGuildFights(req.params.guildId);
      res.json(fights);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get active solo mode sessions for a guild
  app.get("/api/guilds/:guildId/active-sessions", async (req, res) => {
    try {
      const sessions = await storage.getActiveSoloSessionsByGuildId(req.params.guildId);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Guild settings endpoints
  // Get guild settings
  app.get("/api/guilds/:guildId/settings", async (req, res) => {
    try {
      const settings = await storage.getGuildSettings(req.params.guildId);
      if (!settings) return res.status(404).json({ error: "Guild settings not found" });
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update guild settings
  app.patch("/api/guilds/:guildId/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.updateGuildSettings(req.params.guildId, req.body);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Guild quest endpoints
  // Get guild quests
  app.get("/api/guilds/:guildId/quests", async (req, res) => {
    try {
      const quests = await storage.getGuildQuests(req.params.guildId);
      res.json(quests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create guild quest
  app.post("/api/guilds/:guildId/quests", requireAuth, async (req, res) => {
    try {
      const { title, description, criteria } = req.body;
      if (!title || !description || !criteria) {
        return res.status(400).json({ error: "title, description, and criteria are required" });
      }

      const quest = await storage.createGuildQuest({
        guildId: req.params.guildId,
        title,
        description,
        criteria,
      });
      res.json(quest);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update guild quest
  app.patch("/api/guilds/:guildId/quests/:questId", requireAuth, async (req, res) => {
    try {
      const quest = await storage.updateGuildQuest(req.params.questId, req.body);
      if (!quest) return res.status(404).json({ error: "Quest not found" });
      res.json(quest);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete guild quest
  app.delete("/api/guilds/:guildId/quests/:questId", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteGuildQuest(req.params.questId);
      if (!deleted) return res.status(404).json({ error: "Quest not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Guild leaderboard endpoint
  app.get("/api/guilds/:guildId/leaderboard", async (req, res) => {
    try {
      const metric = req.query.metric as string || 'damageDealt';
      const leaderboard = await storage.getGuildLeaderboard(req.params.guildId, metric);
      res.json(leaderboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
        guildCode: classCode, // Map classCode from request to guildCode in schema
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
    const availableFights = fights.filter(f => f.guildCode === student.guildCode);
    res.json(availableFights);
  });

  app.post("/api/student/:id/claim-loot", async (req, res) => {
    const { itemId, fightId } = req.body;
    
    // B3 FIX: Validate required fields
    if (!itemId || !fightId) {
      return res.status(400).json({ error: "Item ID and Fight ID are required" });
    }
    
    // B3 FIX: Validate student ID from params
    if (!req.params.id) {
      return res.status(400).json({ error: "Student ID is required" });
    }
    
    // B3 FIX: Fetch all data concurrently for better performance
    const [student, fight, equipmentItem] = await Promise.all([
      storage.getStudent(req.params.id),
      storage.getFight(fightId),
      storage.getEquipmentItem(itemId)
    ]);
    
    // B3 FIX: Validate student exists
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // B3 FIX: Validate fight exists
    if (!fight) {
      return res.status(404).json({ error: "Fight not found or has ended" });
    }
    
    // B3 FIX: Validate equipment item exists in database (asset validation)
    if (!equipmentItem) {
      return res.status(404).json({ error: "Equipment item does not exist" });
    }
    
    // B3 FIX: Validate item is in the fight's loot table
    const lootTable = fight.lootTable || [];
    const validLoot = lootTable.find((item: LootItem) => item.itemId === itemId);
    if (!validLoot) {
      return res.status(400).json({ error: "This item is not available as loot for this fight" });
    }
    
    // B3 FIX: Atomically claim loot using conditional update (idempotency check)
    const claimed = await storage.claimLootAtomically(fightId, req.params.id, itemId);
    if (!claimed) {
      return res.status(409).json({ 
        error: "Loot has already been claimed for this fight or you did not participate in this fight" 
      });
    }
    
    // B3 FIX: Add item to inventory with duplicate check
    const currentInventory = student.inventory || [];
    if (currentInventory.includes(itemId)) {
      // Item already in inventory (should not happen but safeguard)
      const { password: _, ...studentWithoutPassword } = student;
      return res.status(200).json(studentWithoutPassword); // Return success but don't add duplicate
    }
    
    const updatedInventory = [...currentInventory, itemId];
    
    const updatedStudent = await storage.updateStudent(req.params.id, { inventory: updatedInventory });
    if (!updatedStudent) {
      return res.status(500).json({ error: "Failed to update student inventory" });
    }
    
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

  // Force question endpoint for host emergency unstick
  app.post("/api/combat/:sessionId/force-question", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const session = await storage.getCombatSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      log(`[API] Force question requested for session ${sessionId}`, "server");
      
      // Clear any existing combat timer
      const timer = combatTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        combatTimers.delete(sessionId);
        log(`[API] Cleared existing timer for session ${sessionId}`, "server");
      }
      
      // Force start a new question phase
      await startQuestion(sessionId);
      
      res.json({ success: true, message: "Question phase forced" });
    } catch (error: any) {
      log(`[API] Error forcing question: ${error}`, "server");
      res.status(500).json({ error: error.message || "Failed to force question" });
    }
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

  // Object storage endpoints for question images
  const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
  
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      log(`[Object Storage] Error accessing object: ${error}`, "server");
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      log(`[Object Storage] Error generating upload URL: ${error}`, "server");
      res.status(500).json({ error: error.message || "Failed to generate upload URL" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time combat  
  // Use noServer: true to manually handle upgrades
  const wss = new WebSocketServer({ noServer: true });
  log("[WebSocket] Server created for combat connections", "websocket");

  // Handle WebSocket upgrades ONLY for /ws path
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    // ONLY handle our combat WebSocket path
    if (pathname === '/ws') {
      log(`[WebSocket] Handling upgrade request to ${pathname}`, "websocket");
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // All other paths (including Vite HMR) will be handled elsewhere or rejected
  });

  wss.on("error", (error) => {
    log(`[WebSocket Server] Error: ${error}`, "websocket");
  });

  // Maps use sessionId as key (not fightId) for unique session tracking
  const combatTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Performance instrumentation
  function logPhaseTiming(sessionId: string, phase: string, startTime: number) {
    const duration = Date.now() - startTime;
    const activeConnections = getActiveConnectionCount(sessionId);
    log(`[Perf] Session ${sessionId} - ${phase} took ${duration}ms (${activeConnections} connections, ${pendingBroadcasts.size} pending broadcasts)`, "performance");
  }
  
  function getActiveConnectionCount(sessionId?: string): number {
    let count = 0;
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      if (ws.readyState === WebSocket.OPEN) {
        if (sessionId && ws.sessionId === sessionId) {
          count++;
        } else if (!sessionId) {
          count++;
        }
      }
    });
    return count;
  }

  function broadcastToCombat(sessionId: string, message: any) {
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      // Only send to clients in THIS specific session
      // Multiple sessions for the same fight can exist simultaneously
      if (ws.readyState === WebSocket.OPEN && ws.sessionId === sessionId) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  function broadcastCombatLogEvent(
    sessionId: string,
    type: "damage" | "heal" | "block" | "death" | "phase_change" | "ability" | "info",
    message: string,
    options?: { playerName?: string; targetName?: string; value?: number }
  ) {
    const event = {
      type: "combat_log",
      event: {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type,
        message,
        playerName: options?.playerName,
        targetName: options?.targetName,
        value: options?.value,
      },
    };

    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      // Send to all players in this session (not just hosts)
      if (ws.readyState === WebSocket.OPEN && ws.sessionId === sessionId) {
        ws.send(JSON.stringify(event));
      }
    });
  }

  // Broadcast batching to reduce message flood with many players
  const pendingBroadcasts: Map<string, NodeJS.Timeout> = new Map();
  const BROADCAST_DEBOUNCE_MS = 50; // Batch updates within 50ms window

  async function scheduleBroadcastUpdate(sessionId: string) {
    // Cancel any pending broadcast for this session
    const existingTimer = pendingBroadcasts.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new broadcast after debounce delay
    const timer = setTimeout(async () => {
      try {
        const session = await storage.getCombatSession(sessionId);
        if (session) {
          broadcastToCombat(sessionId, { type: "combat_state", state: session });
        }
      } catch (error) {
        log(`[WebSocket] Error broadcasting batched update for session ${sessionId}: ${error}`, "websocket");
      } finally {
        pendingBroadcasts.delete(sessionId);
      }
    }, BROADCAST_DEBOUNCE_MS);

    pendingBroadcasts.set(sessionId, timer);
  }

  function disconnectAllPlayers(sessionId: string) {
    // Close all WebSocket connections for this session
    let closedCount = 0;
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      if (ws.sessionId === sessionId) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, "Session ended");
          closedCount++;
        }
        // Clear session association even if already closing/closed
        ws.sessionId = undefined;
        ws.fightId = undefined;
        ws.studentId = undefined;
        ws.isHost = false;
      }
    });
    log(`[Cleanup] Closed ${closedCount} WebSocket connections for session ${sessionId}`, "cleanup");
  }

  async function cleanupSession(sessionId: string) {
    log(`[Cleanup] Starting cleanup for session ${sessionId}`, "cleanup");
    
    // Clear all timers
    const combatTimer = combatTimers.get(sessionId);
    if (combatTimer) {
      clearTimeout(combatTimer);
      combatTimers.delete(sessionId);
      log(`[Cleanup] Cleared combat timer for session ${sessionId}`, "cleanup");
    }
    
    const broadcastTimer = pendingBroadcasts.get(sessionId);
    if (broadcastTimer) {
      clearTimeout(broadcastTimer);
      pendingBroadcasts.delete(sessionId);
      log(`[Cleanup] Cleared broadcast timer for session ${sessionId}`, "cleanup");
    }
    
    // Disconnect all players
    disconnectAllPlayers(sessionId);
    log(`[Cleanup] Disconnected all players for session ${sessionId}`, "cleanup");
    
    // Delete combat session from database to free memory
    try {
      await storage.deleteCombatSession(sessionId);
      log(`[Cleanup] Deleted combat session ${sessionId}`, "cleanup");
    } catch (error) {
      log(`[Cleanup] Failed to delete combat session ${sessionId}: ${error}`, "cleanup");
    }
    
    log(`[Cleanup] Completed cleanup for session ${sessionId}`, "cleanup");
  }

  async function startQuestion(sessionId: string) {
    const session = await storage.getCombatSession(sessionId);
    if (!session) return;
    
    const fight = await storage.getFight(session.fightId);
    if (!fight) return;
    
    // Calculate dynamic enemy HP on first question only
    if (session.currentQuestionIndex === 0) {
      const players = Object.values(session.players);
      
      // Calculate total player levels earned across all jobs
      let totalPlayerLevels = 0;
      for (const player of players) {
        // Sum all job levels for this player
        for (const jobClass in player.jobLevels) {
          totalPlayerLevels += player.jobLevels[jobClass as CharacterClass] || 0;
        }
      }
      
      // Base HP formula: playerCount × (2.5 + avgJobLevel × 0.4)
      // This makes difficultyMultiplier directly represent ~questions to survive at 70% accuracy
      const playerCount = Math.max(1, players.length); // Guard against empty sessions
      const avgJobLevel = totalPlayerLevels / playerCount;
      const baseHP = playerCount * (2.5 + avgJobLevel * 0.4);
      
      // Apply difficulty multiplier to each enemy and set their HP
      session.enemies = session.enemies.map(enemy => {
        // Get the enemy template from the fight to access difficultyMultiplier
        const enemyTemplate = fight.enemies.find(e => e.id === enemy.id);
        const difficultyMultiplier = enemyTemplate?.difficultyMultiplier || 10;
        
        // Calculate final HP: baseHP × difficultyMultiplier
        const calculatedHP = baseHP * difficultyMultiplier;
        
        return {
          ...enemy,
          health: calculatedHP,
          maxHealth: calculatedHP
        };
      });
      
      // Save the calculated enemy HP
      await storage.updateCombatSession(sessionId, { enemies: session.enemies });
      log(`[Combat] Calculated enemy HP: ${playerCount} players × (2.5 + ${avgJobLevel.toFixed(1)} avg level × 0.4) = ${baseHP.toFixed(1)} base HP`, "combat");
    }
    
    // Loop questions: if we've reached the end, go back to the start
    if (session.currentQuestionIndex >= fight.questions.length) {
      await storage.updateCombatSession(sessionId, { currentQuestionIndex: 0 });
      const updatedSession = await storage.getCombatSession(sessionId);
      if (!updatedSession) return;
      session.currentQuestionIndex = 0;
    }

    // Use questionOrder array to get the actual question index (supports randomization)
    const actualQuestionIndex = session.questionOrder 
      ? session.questionOrder[session.currentQuestionIndex] 
      : session.currentQuestionIndex;
    const question = fight.questions[actualQuestionIndex];
    
    // Safety check: ensure question exists
    if (!question) {
      log(`[Combat] ERROR: Question not found at index ${actualQuestionIndex} for fight ${session.fightId}`, "combat");
      return;
    }
    
    await storage.updateCombatSession(sessionId, {
      currentPhase: "question",
      questionStartTime: Date.now(),
    });

    // PERFORMANCE FIX (B1, B2): Reset player states in memory for new question
    for (const [playerId, player] of Object.entries(session.players)) {
      // Skip dead players - they don't participate in questions
      if (player.isDead) continue;
      
      player.hasAnswered = false;
      player.currentAnswer = undefined;
      player.answeredCurrentQuestionCorrectly = false; // Reset for new question
      player.hasSelectedAbility = false; // Reset ability selection for new question
      player.isHealing = false;
      player.healTarget = undefined;
      player.blockTarget = undefined;
      player.isCreatingPotion = false;
    }

    // Save ALL player resets at once - HUGE performance improvement
    await storage.updateCombatSession(sessionId, { players: session.players });

    // Determine if this is the first question or a subsequent one
    const phaseMessage = session.isFirstQuestionOfSession ? "Question" : "Next Question";
    broadcastToCombat(sessionId, { type: "phase_change", phase: phaseMessage });
    const questionPreview = question.question?.substring(0, 50) || "Question";
    broadcastCombatLogEvent(sessionId, "phase_change", `Question ${session.currentQuestionIndex + 1}: ${questionPreview}...`);
    broadcastToCombat(sessionId, { type: "question", question, shuffleOptions: fight.shuffleOptions });
    
    // Mark that we've shown the first question
    if (session.isFirstQuestionOfSession) {
      await storage.updateCombatSession(sessionId, { isFirstQuestionOfSession: false });
    }
    const updatedSession = await storage.getCombatSession(sessionId);
    broadcastToCombat(sessionId, { type: "combat_state", state: updatedSession });

    // Auto-advance after time limit
    const timer = setTimeout(async () => {
      await abilitiesPhase(sessionId);
    }, question.timeLimit * 1000);
    combatTimers.set(sessionId, timer);
  }

  // Track last activity time for abilities phase
  const abilitiesLastActivity: Map<string, number> = new Map();
  
  // Store healing feedback for question resolution phase
  const healingFeedbackMap: Map<string, Map<string, ResolutionFeedback[]>> = new Map();

  async function abilitiesPhase(sessionId: string) {
    const phaseStart = Date.now();
    const session = await storage.getCombatSession(sessionId);
    if (!session) return;

    // Validate answers BEFORE starting abilities phase to determine eligibility
    const fight = await storage.getFight(session.fightId);
    if (fight) {
      const actualQuestionIndex = session.questionOrder 
        ? session.questionOrder[session.currentQuestionIndex] 
        : session.currentQuestionIndex;
      const question = fight.questions[actualQuestionIndex];
      
      if (question) {
        // Check each player's answer and mark correctness
        for (const [playerId, player] of Object.entries(session.players)) {
          if (player.isDead) continue;
          
          // Only validate if they actually answered
          if (player.hasAnswered && player.currentAnswer) {
            const isCorrect = player.currentAnswer.toLowerCase() === question.correctAnswer.toLowerCase();
            player.answeredCurrentQuestionCorrectly = isCorrect;
            log(`[Abilities] Player ${player.nickname} answer validation: ${isCorrect ? "CORRECT" : "INCORRECT"}`, "combat");
          } else {
            // Didn't answer - not eligible for abilities
            player.answeredCurrentQuestionCorrectly = false;
            log(`[Abilities] Player ${player.nickname} did not answer - no abilities modal`, "combat");
          }
        }
        
        // Save answer validation results
        await storage.updateCombatSession(sessionId, { players: session.players });
      }
    }

    // Calculate threat leader (happens at end of Question Phase, before abilities)
    let highestThreat = 0;
    let threatLeaderId: string | undefined = undefined;
    for (const [playerId, player] of Object.entries(session.players)) {
      if (player.isDead) continue;
      if (player.threat > highestThreat) {
        highestThreat = player.threat;
        threatLeaderId = playerId;
      }
    }

    await storage.updateCombatSession(sessionId, { 
      currentPhase: "abilities",
      threatLeaderId: threatLeaderId
    });
    
    // Broadcast updated combat state so crown icon appears
    const sessionWithThreatLeader = await storage.getCombatSession(sessionId);
    broadcastToCombat(sessionId, { type: "combat_state", state: sessionWithThreatLeader });
    
    broadcastToCombat(sessionId, { type: "phase_change", phase: "Abilities Phase" });
    broadcastCombatLogEvent(sessionId, "phase_change", "Abilities Phase");
    
    // Initialize last activity time for this phase
    abilitiesLastActivity.set(sessionId, Date.now());
    
    // Broadcast timer updates every second
    const TOTAL_TIME = 12; // 12 seconds total - gives time for both ability selection and target selection
    const INACTIVITY_TIMEOUT = 12000; // 12 seconds of inactivity
    let timeRemaining = TOTAL_TIME;
    let phaseEnded = false; // Guard against duplicate processing
    let isCheckingSelections = false; // Guard against concurrent async checks
    
    // Broadcast initial timer immediately (showing 12 seconds)
    broadcastToCombat(sessionId, { 
      type: "phase_timer", 
      phase: "abilities",
      timeRemaining 
    });
    
    const timerInterval = setInterval(() => {
      if (phaseEnded) return; // Guard at start of interval
      
      timeRemaining--;
      
      // Broadcast time remaining to all clients
      broadcastToCombat(sessionId, { 
        type: "phase_timer", 
        phase: "abilities",
        timeRemaining 
      });
      
      // End phase when timer expires
      if (timeRemaining <= 0) {
        phaseEnded = true; // Set flag first to prevent concurrent execution
        clearInterval(timerInterval);
        const mainTimer = combatTimers.get(sessionId);
        if (mainTimer) {
          clearTimeout(mainTimer);
          combatTimers.delete(sessionId);
        }
        abilitiesLastActivity.delete(sessionId); // Clean up activity tracker
        log(`[Abilities] Session ${sessionId} ending - timer expired`, "combat");
        processAbilitySelections(sessionId); // Fire and forget, but phase is locked
        return;
      }
      
      // Check for early end conditions
      const currentTime = Date.now();
      const lastActivity = abilitiesLastActivity.get(sessionId) || phaseStart;
      const timeSinceActivity = currentTime - lastActivity;
      
      // End early if 12 seconds of inactivity
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        phaseEnded = true; // Set flag first to prevent concurrent execution
        clearInterval(timerInterval);
        const mainTimer = combatTimers.get(sessionId);
        if (mainTimer) {
          clearTimeout(mainTimer);
          combatTimers.delete(sessionId);
        }
        abilitiesLastActivity.delete(sessionId); // Clean up activity tracker
        log(`[Abilities] Session ${sessionId} ending early - 12 seconds of inactivity`, "combat");
        processAbilitySelections(sessionId); // Fire and forget, but phase is locked
        return;
      }
      
      // Check if all selections are complete (async operation in callback)
      // Use guard to prevent multiple concurrent checks
      if (isCheckingSelections) return;
      isCheckingSelections = true;
      
      storage.getCombatSession(sessionId).then(currentSession => {
        if (!currentSession || phaseEnded) {
          isCheckingSelections = false;
          return;
        }
        
        const allSelectionsComplete = checkAllSelectionsComplete(currentSession);
        if (allSelectionsComplete) {
          phaseEnded = true; // Set flag first to prevent concurrent execution
          clearInterval(timerInterval);
          const mainTimer = combatTimers.get(sessionId);
          if (mainTimer) {
            clearTimeout(mainTimer);
            combatTimers.delete(sessionId);
          }
          abilitiesLastActivity.delete(sessionId); // Clean up activity tracker
          log(`[Abilities] Session ${sessionId} ending early - all selections complete`, "combat");
          processAbilitySelections(sessionId); // Fire and forget, but phase is locked
        } else {
          isCheckingSelections = false; // Reset guard if selections not complete
        }
      }).catch(() => {
        isCheckingSelections = false; // Reset guard on error
      });
    }, 1000);
    
    // Main timer - end after 5 seconds (guard against duplicate processing)
    const mainTimer = setTimeout(() => {
      if (phaseEnded) return; // Already processed by interval
      phaseEnded = true;
      clearInterval(timerInterval);
      combatTimers.delete(sessionId);
      abilitiesLastActivity.delete(sessionId); // Clean up activity tracker
      log(`[Abilities] Session ${sessionId} ending - main timer fired`, "combat");
      processAbilitySelections(sessionId); // Fire and forget, but phase is locked
    }, TOTAL_TIME * 1000);
    
    combatTimers.set(sessionId, mainTimer);
  }
  
  function checkAllSelectionsComplete(session: CombatState): boolean {
    const alivePlayers = Object.values(session.players).filter(p => !p.isDead);
    
    // Check each player type separately
    const tanks = alivePlayers.filter(p => TANK_CLASSES.includes(p.characterClass));
    const healers = alivePlayers.filter(p => HEALER_CLASSES.includes(p.characterClass));
    const offensivePlayers = alivePlayers.filter(p => !TANK_CLASSES.includes(p.characterClass) && !HEALER_CLASSES.includes(p.characterClass));
    
    // Check if all tanks have made their block selection
    const tanksComplete = tanks.every(p => p.blockTarget !== undefined && p.blockTarget !== null);
    
    // Helper to check if a player's ability selection is complete
    const isAbilityComplete = (p: PlayerState): boolean => {
      if (!p.hasSelectedAbility) return false;
      if (!p.pendingAction) return false;
      
      const abilityDetails = ABILITY_DISPLAYS[p.pendingAction.abilityId];
      const requiresTarget = abilityDetails?.requiresTarget || abilityDetails?.opensHealingWindow;
      
      // If ability doesn't require a target, it's complete as soon as it's selected
      if (!requiresTarget) return true;
      
      // If it requires a target, check if target is provided
      return p.pendingAction.targetId !== undefined && p.pendingAction.targetId !== null;
    };
    
    // Check if all healers have made their heal selection or declined
    const healersComplete = healers.every(p => {
      // If they're healing, they must have a heal target
      if (p.isHealing) {
        return p.healTarget !== undefined && p.healTarget !== null;
      }
      // If not healing, check their ability selection
      return isAbilityComplete(p);
    });
    
    // Check if all offensive players have completed their ability selections
    const offensiveComplete = offensivePlayers.every(p => isAbilityComplete(p));
    
    // Log the completion status for debugging
    const totalPlayers = alivePlayers.length;
    const completedCount = alivePlayers.filter(p => {
      if (TANK_CLASSES.includes(p.characterClass)) {
        return p.blockTarget !== undefined && p.blockTarget !== null;
      } else if (HEALER_CLASSES.includes(p.characterClass)) {
        return p.isHealing ? (p.healTarget !== undefined && p.healTarget !== null) : isAbilityComplete(p);
      } else {
        return isAbilityComplete(p);
      }
    }).length;
    
    log(`[Abilities] Selection check: ${completedCount}/${totalPlayers} players complete (Tanks: ${tanksComplete}, Healers: ${healersComplete}, Offensive: ${offensiveComplete})`, "combat");
    
    return tanksComplete && healersComplete && offensiveComplete;
  }
  
  async function processAbilitySelections(sessionId: string) {
    const session = await storage.getCombatSession(sessionId);
    if (!session) return;
    
    // Initialize healing feedback for this session
    const sessionHealingFeedback = new Map<string, ResolutionFeedback[]>();
    healingFeedbackMap.set(sessionId, sessionHealingFeedback);
    
    // AUTO-TARGET LOGIC: Set default targets for players who didn't submit ability selections
    // Find the enemy with highest HP for default targeting
    const aliveEnemies = Object.values(session.enemies).filter(e => e.health > 0);
    const highestHpEnemy = aliveEnemies.reduce((highest, enemy) => 
      enemy.health > highest.health ? enemy : highest
    , aliveEnemies[0] || { id: "", health: 0 });
    
    // For each alive player without a complete pendingAction, assign a default target
    for (const [playerId, player] of Object.entries(session.players)) {
      if (player.isDead) continue;
      
      // Check if player has a complete pendingAction (with targetId)
      const hasCompleteAction = player.pendingAction?.targetId !== undefined && player.pendingAction?.targetId !== null;
      
      if (!hasCompleteAction && aliveEnemies.length > 0) {
        // Determine default target: lastTargetId if valid, otherwise highest HP enemy
        let defaultTargetId = highestHpEnemy.id;
        
        // Check if lastTargetId is still valid (enemy exists and is alive)
        if (player.lastTargetId) {
          const lastTarget = Object.values(session.enemies).find(e => e.id === player.lastTargetId);
          if (lastTarget && lastTarget.health > 0) {
            defaultTargetId = player.lastTargetId;
          }
        }
        
        // CRITICAL: If player has already selected an ability, preserve it and just add targetId
        // Otherwise, default to base_attack for players who didn't select anything
        if (player.pendingAction && player.pendingAction.abilityId) {
          // Preserve the existing ability selection, just add target
          // Only set targetType to "enemy" if it wasn't already set (to preserve healing/utility targetTypes)
          player.pendingAction = {
            ...player.pendingAction,
            targetId: defaultTargetId,
            targetType: player.pendingAction.targetType || "enemy",
          };
          log(`[Auto-Target] Player ${player.nickname} (${playerId}) auto-targeted ${defaultTargetId} for ability ${player.pendingAction.abilityId}`, "combat");
        } else {
          // No ability selected - use base attack
          player.pendingAction = {
            abilityId: "base_attack",
            targetId: defaultTargetId,
            targetType: "enemy",
          };
          log(`[Auto-Target] Player ${player.nickname} (${playerId}) auto-targeted ${defaultTargetId} for base attack`, "combat");
        }
      }
    }
    
    // Save auto-target changes
    await storage.updateCombatSession(sessionId, { players: session.players });
    
    // PERFORMANCE FIX (B1, B2): Process healing in memory (Herbalist, Priest, Paladin)
    for (const [playerId, player] of Object.entries(session.players)) {
      if (player.isDead) continue;
      
      // Herbalist potion healing
      if (player.isHealing && player.healTarget && player.characterClass === "herbalist" && player.potionCount > 0) {
        const target = session.players[player.healTarget];
        if (target && !target.isDead) {
          // Heal for MND
          const healAmount = player.mnd;
          const actualHeal = Math.min(healAmount, target.maxHealth - target.health);
          // Update target health in memory
          target.health = Math.min(target.health + healAmount, target.maxHealth);
          // Use up a potion (in memory)
          player.potionCount -= 1;
          player.healingDone += actualHeal;
          
          // AGGRO SYSTEM: Healing gains +2 aggro per healing point
          player.threat += actualHeal * 2;
          
          // Add healing feedback
          if (!sessionHealingFeedback.has(playerId)) {
            sessionHealingFeedback.set(playerId, []);
          }
          sessionHealingFeedback.get(playerId)!.push({
            type: "healed_player",
            healedPlayer: target.nickname,
            healedAmount: actualHeal,
          });
          
          // Combat log event for healing
          broadcastCombatLogEvent(sessionId, "heal", `${player.nickname} heals ${target.nickname} with a potion`, {
            playerName: player.nickname,
            targetName: target.nickname,
            value: actualHeal,
          });
        }
      }
      
      // Priest Mend spell healing (MND HP, 1 MP cost)
      if (player.isHealing && player.healTarget && player.characterClass === "priest" && player.mp >= 1) {
        const target = session.players[player.healTarget];
        if (target && !target.isDead) {
          const healAmount = player.mnd;
          const actualHeal = Math.min(healAmount, target.maxHealth - target.health);
          // Update target health in memory
          target.health = Math.min(target.health + healAmount, target.maxHealth);
          // Use 1 MP
          player.mp = Math.max(0, player.mp - 1);
          player.healingDone += actualHeal;
          
          // AGGRO SYSTEM: Healing gains +2 aggro per healing point
          player.threat += actualHeal * 2;
          
          // Add healing feedback
          if (!sessionHealingFeedback.has(playerId)) {
            sessionHealingFeedback.set(playerId, []);
          }
          sessionHealingFeedback.get(playerId)!.push({
            type: "healed_player",
            healedPlayer: target.nickname,
            healedAmount: actualHeal,
          });
          
          // Combat log event for healing
          broadcastCombatLogEvent(sessionId, "heal", `${player.nickname} casts Mend on ${target.nickname}`, {
            playerName: player.nickname,
            targetName: target.nickname,
            value: actualHeal,
          });
        }
      }
      
      // Paladin Healing Guard (blocks AND heals, 1 MP cost)
      if (player.isHealing && player.healTarget && player.characterClass === "paladin" && player.mp >= 1) {
        const target = session.players[player.healTarget];
        if (target && !target.isDead) {
          // Heal for VIT HP
          const healAmount = player.vit;
          const actualHeal = Math.min(healAmount, target.maxHealth - target.health);
          target.health = Math.min(target.health + healAmount, target.maxHealth);
          // Use 1 MP
          player.mp = Math.max(0, player.mp - 1);
          player.healingDone += actualHeal;
          
          // AGGRO SYSTEM: Healing gains +2 aggro per healing point
          player.threat += actualHeal * 2;
          
          // Add healing feedback
          if (!sessionHealingFeedback.has(playerId)) {
            sessionHealingFeedback.set(playerId, []);
          }
          sessionHealingFeedback.get(playerId)!.push({
            type: "healed_player",
            healedPlayer: target.nickname,
            healedAmount: actualHeal,
          });
          
          // Combat log event for healing
          broadcastCombatLogEvent(sessionId, "heal", `${player.nickname} uses Healing Guard on ${target.nickname}`, {
            playerName: player.nickname,
            targetName: target.nickname,
            value: actualHeal,
          });
        }
      }
    }
    
    // Save ALL player changes at once - HUGE performance improvement
    await storage.updateCombatSession(sessionId, { players: session.players });
    
    const updatedSession = await storage.getCombatSession(sessionId);
    broadcastToCombat(sessionId, { type: "combat_state", state: updatedSession });
    
    // Clean up abilities activity tracking
    abilitiesLastActivity.delete(sessionId);
    
    // Advance to next phase
    await questionResolutionPhase(sessionId);
  }

  async function questionResolutionPhase(sessionId: string) {
    const phaseStart = Date.now();
    const session = await storage.getCombatSession(sessionId);
    if (!session) return;
    
    const fight = await storage.getFight(session.fightId);
    if (!fight) return;

    // Calculate threat leader
    let highestThreat = 0;
    let threatLeaderId: string | null = null;
    for (const [playerId, player] of Object.entries(session.players)) {
      if (player.isDead) continue;
      if (player.threat > highestThreat) {
        highestThreat = player.threat;
        threatLeaderId = playerId;
      }
    }

    await storage.updateCombatSession(sessionId, { 
      currentPhase: "question_resolution",
      threatLeaderId: threatLeaderId ?? undefined
    });
    broadcastToCombat(sessionId, { type: "phase_change", phase: "Question Resolution" });
    broadcastCombatLogEvent(sessionId, "phase_change", "Question Resolution Phase");

    // Use questionOrder array to get the actual question index (supports randomization)
    const actualQuestionIndex = session.questionOrder 
      ? session.questionOrder[session.currentQuestionIndex] 
      : session.currentQuestionIndex;
    const question = fight.questions[actualQuestionIndex];

    // Feedback collection for students
    const playerFeedback = new Map<string, ResolutionFeedback[]>();
    const enemyDamageMap = new Map<string, number>();
    
    // Merge healing feedback from abilities phase
    const healingFeedback = healingFeedbackMap.get(sessionId);
    if (healingFeedback) {
      for (const [playerId, feedbackList] of Array.from(healingFeedback.entries())) {
        if (!playerFeedback.has(playerId)) {
          playerFeedback.set(playerId, []);
        }
        playerFeedback.get(playerId)!.push(...feedbackList);
      }
      // Clean up after merging
      healingFeedbackMap.delete(sessionId);
    }

    // PERFORMANCE FIX (B1, B2): Process all updates in memory, then save once
    
    // Process Hex DoT damage from Warlocks (ticks before player damage)
    for (const [playerId, player] of Object.entries(session.players)) {
      if (player.isDead || player.hexRoundsRemaining <= 0 || !player.hexedEnemyId) continue;
      
      // Find the hexed enemy
      const hexedEnemy = session.enemies.find(e => e.id === player.hexedEnemyId);
      if (hexedEnemy && hexedEnemy.health > 0) {
        // Deal hex damage
        const hexDamage = player.hexDamage;
        hexedEnemy.health = Math.max(0, hexedEnemy.health - hexDamage);
        player.damageDealt += hexDamage;
        
        log(`[Combat] ${player.nickname}'s Hex deals ${hexDamage} curse damage to ${hexedEnemy.name}`, "combat");
      }
      
      // Decrement hex rounds
      player.hexRoundsRemaining -= 1;
      if (player.hexRoundsRemaining <= 0) {
        player.hexedEnemyId = undefined;
        player.hexDamage = 0;
      }
    }
    
    // Process answers and deal damage
    for (const [playerId, player] of Object.entries(session.players)) {
      if (player.isDead) continue;

      // Determine if player answered correctly
      const hasAnswered = player.hasAnswered && player.currentAnswer;
      const isCorrect = hasAnswered && player.currentAnswer!.toLowerCase() === question.correctAnswer.toLowerCase();
      
      if (hasAnswered) {
        // Track question answered (in memory)
        player.questionsAnswered += 1;
        log(`[Combat] Player ${player.nickname} answered "${player.currentAnswer}" vs correct "${question.correctAnswer}" - ${isCorrect ? "CORRECT" : "INCORRECT"}`, "combat");
      } else {
        // Player didn't answer - treat as incorrect
        log(`[Combat] Player ${player.nickname} did not answer - treating as INCORRECT`, "combat");
      }

      if (isCorrect) {
        // Track correct answer (in memory)
        player.questionsCorrect += 1;

        if (player.isCreatingPotion && player.characterClass === "herbalist") {
          // Herbalist chose to create a potion instead of dealing damage (in memory)
          player.potionCount += 1;
          player.isCreatingPotion = false;
        } else if (player.isHealing && player.healTarget && player.characterClass === "herbalist") {
          // Herbalist chose to heal - healing happens in tank_blocking phase (phase 2)
          // Don't deal damage if healing
        } else {
          // Deal damage to enemy using new stat-based calculations
          let damage = 0;
          let mpCost = 0;
          let usedAbility = false;
          let abilityName = "";
          
          // CHECK FOR PENDING ABILITY FIRST - abilities selected during abilities phase
          if (player.pendingAction && player.pendingAction.abilityId && player.pendingAction.abilityId !== "base_attack") {
            usedAbility = true;
            const abilityId = player.pendingAction.abilityId;
            log(`[Abilities] Player ${player.nickname} using ability: ${abilityId}`, "combat");
            
            // Calculate damage based on specific ability
            switch (abilityId) {
              case "crushing_blow":
                // Warrior: Crushing Blow - Deals (ATK+STR)*1.5 massive damage, adds threat
                damage = Math.floor((player.atk + player.str) * 1.5);
                abilityName = "Crushing Blow";
                // +1 threat from all enemies (simplified: add extra threat)
                player.threat += session.enemies.length;
                break;
                
              case "aim":
                // Scout: Aim - (RTK+AGI)*2, costs 1 combo point
                if (player.comboPoints >= 1 && player.characterClass === "scout") {
                  damage = (player.rtk + player.agi) * 2;
                  player.comboPoints -= 1; // Consume 1 combo point
                  abilityName = "Aim";
                  // Scouts gain 1 combo point on correct answer (handled below after damage calc)
                } else {
                  // Not enough combo points - fall back to base damage
                  usedAbility = false;
                }
                break;
                
              case "headshot":
                // Scout: Headshot - RTK*ComboPoints*AGI, costs 3 combo points
                if (player.comboPoints >= 3 && player.characterClass === "scout") {
                  damage = player.rtk * player.comboPoints * player.agi;
                  player.comboPoints -= 3; // Consume 3 combo points
                  abilityName = "Headshot";
                  // Scouts gain 1 combo point on correct answer (handled below after damage calc)
                } else {
                  // Not enough combo points - fall back to base damage
                  usedAbility = false;
                }
                break;
                
              case "fireblast":
                // Wizard: Fireblast - INT*(MP spent)*3, costs all MP
                if (player.mp > 0) {
                  const mpSpent = player.mp;
                  damage = player.int * mpSpent * 3;
                  player.mp = 0;
                  abilityName = "Fireblast";
                } else {
                  // No MP - fall back to base damage
                  usedAbility = false;
                }
                break;
                
              default:
                // Unknown ability or not implemented yet - fall back to base damage
                usedAbility = false;
                break;
            }
          }
          
          // If no ability was used or ability failed, use class-based damage calculation
          if (!usedAbility) {
            if (player.characterClass === "wizard") {
            // Wizard: Magical damage using MAT + INT
            const wizardLevel = player.jobLevels.wizard || 0;
            const maxChargeRounds = getFireballMaxChargeRounds(wizardLevel);
            const cooldownDuration = getFireballCooldown(wizardLevel);
            
            if (player.fireballCooldown > 0) {
              // On cooldown - do base magical damage and decrement cooldown
              damage = calculateMagicalDamage(player.mat, player.int);
              mpCost = 2; // Base spell MP cost
              player.fireballCooldown -= 1;
              player.isChargingFireball = false;
            } else if (player.isChargingFireball) {
              // Wizard is charging fireball - automatically continue charging
              const newChargeRounds = player.fireballChargeRounds + 1;
              
              if (newChargeRounds < maxChargeRounds) {
                // Still charging: no damage while charging
                damage = 0;
                mpCost = 0;
                player.fireballChargeRounds = newChargeRounds;
                player.isChargingFireball = true;
              } else {
                // Fully charged: RELEASE! Deal 2x magical damage, costs 4 MP
                const baseDamage = calculateMagicalDamage(player.mat, player.int);
                damage = baseDamage * 2;
                mpCost = 4;
                player.fireballChargeRounds = 0;
                player.fireballCooldown = cooldownDuration;
                player.isChargingFireball = false;
              }
            } else {
              // Not charging - do base magical damage
              damage = calculateMagicalDamage(player.mat, player.int);
              mpCost = 2;
            }
            
            // Consume MP (if player has enough)
            if (player.mp >= mpCost) {
              player.mp = Math.max(0, player.mp - mpCost);
            } else {
              // Not enough MP - no damage
              damage = 0;
            }
          } else if (player.characterClass === "scout") {
            // Scout: Ranged damage using RTK + AGI
            damage = calculateRangedDamage(player.rtk, player.agi);
            // Combo points are gained below, outside the ability check
          } else if (player.characterClass === "warrior") {
            // Warrior: Physical damage using ATK + STR
            damage = calculatePhysicalDamage(player.atk, player.str, player.agi);
          } else if (player.characterClass === "herbalist") {
            // Herbalist: Hybrid damage using MAT + AGI + MND
            damage = calculateHybridDamage(player.mat, player.agi, player.mnd);
          } else if (player.characterClass === "warlock") {
            // Warlock: Magical damage using MAT + INT with Siphon self-heal and Hex DoT
            const warlockLevel = player.jobLevels.warlock || 0;
            const mechanicUpgrades = getTotalMechanicUpgrades(player.jobLevels);
            
            // Base magical damage
            damage = calculateMagicalDamage(player.mat, player.int);
            mpCost = 2; // Base spell MP cost
            
            // Siphon unlocks at level 4: heals for (INT/2 + siphonHealBonus) rounded up
            if (warlockLevel >= 4 && player.mp >= mpCost) {
              const siphonHealAmount = Math.ceil(player.int / 2 + (mechanicUpgrades.siphonHealBonus || 0));
              const healAmount = Math.min(siphonHealAmount, player.maxHealth - player.health);
              player.health = Math.min(player.maxHealth, player.health + healAmount);
              player.healingDone += healAmount;
            }
            
            // Hex is available at level 1+: applies DoT to target enemy
            // Hex damage = (INT - 1), Duration = (2 + hexDuration)
            if (warlockLevel >= 1 && session.enemies.length > 0) {
              const targetEnemy = session.enemies[0]; // Target first enemy
              const hexDamageValue = Math.max(1, player.int - 1); // Minimum 1 damage
              const hexDurationValue = 2 + (mechanicUpgrades.hexDuration || 0);
              
              // Apply or refresh hex on target
              player.hexedEnemyId = targetEnemy.id;
              player.hexDamage = hexDamageValue;
              player.hexRoundsRemaining = hexDurationValue;
            }
            
            // Consume MP (if player has enough)
            if (player.mp >= mpCost) {
              player.mp = Math.max(0, player.mp - mpCost);
            } else {
              // Not enough MP - no damage
              damage = 0;
            }
          } else if (player.characterClass === "priest") {
            // Priest: Can heal with Mend OR deal magical damage
            if (player.isHealing && player.healTarget) {
              // Priest chose to heal - healing happens in tank_blocking phase
              damage = 0;
            } else {
              // Deal magical damage using MAT + INT
              damage = calculateMagicalDamage(player.mat, player.int);
              mpCost = 1;
              
              // Consume MP (if player has enough)
              if (player.mp >= mpCost) {
                player.mp = Math.max(0, player.mp - mpCost);
              } else {
                // Not enough MP - no damage
                damage = 0;
              }
            }
          } else if (player.characterClass === "paladin") {
            // Paladin: Can use Healing Guard (heal+block) OR deal physical damage
            if (player.isHealing && player.healTarget) {
              // Paladin chose to heal - healing happens in tank_blocking phase
              damage = 0;
            } else {
              // Deal physical damage using ATK + STR
              damage = calculatePhysicalDamage(player.atk, player.str, player.agi);
              mpCost = 1;
              
              // Consume MP (if player has enough)
              if (player.mp >= mpCost) {
                player.mp = Math.max(0, player.mp - mpCost);
              } else {
                // Not enough MP - reduce damage by 50%
                damage = Math.floor(damage * 0.5);
              }
            }
          } else if (player.characterClass === "dark_knight") {
            // Dark Knight: Ruin Strike - ATK * (STR + VIT + INT) melee damage
            const statSum = player.str + player.vit + player.int;
            damage = Math.floor((player.atk * statSum) / 2);
            mpCost = 1; // Ruin Strike costs 1 MP
            
            // Consume MP (if player has enough)
            if (player.mp >= mpCost) {
              player.mp = Math.max(0, player.mp - mpCost);
            } else {
              // Not enough MP - use physical damage fallback
              damage = calculatePhysicalDamage(player.atk, player.str, player.agi);
            }
          } else if (player.characterClass === "blood_knight") {
            // Blood Knight: Crimson Slash - ATK * (VIT + STR)/2 melee damage with 50% lifesteal
            const statSum = player.vit + player.str;
            damage = Math.floor((player.atk * (statSum / 2)) / 2);
            mpCost = 1; // Crimson Slash costs 1 MP
            
            // Consume MP and apply lifesteal (if player has enough)
            if (player.mp >= mpCost) {
              player.mp = Math.max(0, player.mp - mpCost);
              
              // Lifesteal: heal for 50% of damage dealt
              const lifestealAmount = Math.floor(damage * 0.5);
              const healAmount = Math.min(lifestealAmount, player.maxHealth - player.health);
              player.health = Math.min(player.maxHealth, player.health + healAmount);
              player.healingDone += healAmount;
            } else {
              // Not enough MP - use physical damage fallback without lifesteal
              damage = calculatePhysicalDamage(player.atk, player.str, player.agi);
            }
          } else {
            // Other classes: use physical damage as default
            damage = calculatePhysicalDamage(player.atk, player.str, player.agi);
          }
          } // End of if (!usedAbility) block
          
          // SCOUT COMBO POINT SYSTEM: Always gain 1 combo point on correct answer (even if ability was used)
          if (player.characterClass === "scout") {
            const newComboPoints = Math.min(player.maxComboPoints, player.comboPoints + 1);
            player.comboPoints = newComboPoints;
            player.streakCounter = newComboPoints; // Keep in sync for backward compat
          }
          
          // HEALING MECHANIC: If player chose to heal, they deal no damage this turn
          // This covers single-target heals, AoE heals, and self-heals
          // Healing feedback will be shown when healing actually happens in the abilities phase
          if (player.isHealing) {
            damage = 0;
            player.lastActionDamage = 0;
          }

          if (session.enemies.length > 0 && damage > 0) {
            // Update enemy health in memory
            const enemy = session.enemies[0];
            const enemyName = enemy.name;
            enemy.health = Math.max(0, enemy.health - damage);
            
            // Track damage dealt (in memory)
            player.damageDealt += damage;
            player.lastActionDamage = damage; // Track for UI display
            
            // Track enemy damage for party summary
            const currentDamage = enemyDamageMap.get(enemy.id) || 0;
            enemyDamageMap.set(enemy.id, currentDamage + damage);
            
            // Add feedback for correct answer - use "correct_ability" if ability was used
            if (!playerFeedback.has(playerId)) {
              playerFeedback.set(playerId, []);
            }
            
            if (usedAbility) {
              log(`[Abilities] Player ${player.nickname} dealt ${damage} damage with ${abilityName} (feedback type: correct_ability)`, "combat");
            }
            
            playerFeedback.get(playerId)!.push({
              type: usedAbility ? "correct_ability" : "correct_damage",
              damage: damage,
              enemyName: enemyName,
              abilityName: usedAbility ? abilityName : undefined,
            });
            
            // AGGRO SYSTEM: Add threat based on damage dealt
            // Tank classes (warrior, knight, paladin, dark_knight) gain +3 aggro per damage
            // All other classes gain +1 aggro per damage
            const tankClasses = ["warrior", "knight", "paladin", "dark_knight"];
            const isTank = tankClasses.includes(player.characterClass);
            const aggroPerDamage = isTank ? 3 : 1;
            player.threat += damage * aggroPerDamage;
            
            // Combat log event for damage
            broadcastCombatLogEvent(sessionId, "damage", `${player.nickname} deals ${damage} damage to ${enemyName}`, {
              playerName: player.nickname,
              targetName: enemyName,
              value: damage,
            });
            
            // Check if enemy was defeated
            if (enemy.health === 0) {
              broadcastCombatLogEvent(sessionId, "death", `${enemyName} was defeated!`, {
                targetName: enemyName,
              });
            }
          }
          
          // Clear pending action after processing (whether ability succeeded or fell back to base damage)
          if (player.pendingAction && player.pendingAction.abilityId && player.pendingAction.abilityId !== "base_attack") {
            player.pendingAction = undefined;
          }
        }
      } else {
        // Wrong answer or no answer - track incorrect answer (in memory)
        player.questionsIncorrect += 1;
        
        // AGGRO SYSTEM: Wrong/no answer reduces threat by 3
        player.threat = Math.max(0, player.threat - 3);
        
        // Reset ability states on wrong/no answer (in memory)
        player.comboPoints = 0; // Reset scout combo points to 0
        player.streakCounter = 0; // Reset for backward compat
        player.lastActionDamage = 0; // No damage dealt on wrong/no answer
        
        // Reset wizard fireball charge and decrement cooldown (in memory)
        if (player.characterClass === "wizard") {
          player.fireballChargeRounds = 0;
          player.isChargingFireball = false;
          if (player.fireballCooldown > 0) {
            player.fireballCooldown -= 1;
          }
        }
        
        // Wrong/no answer - take damage (unless blocked by alive tank)
        let blocked = false;
        let blockerPlayer = null;
        for (const [blockerId, blocker] of Object.entries(session.players)) {
          const tankClasses = ["warrior", "knight", "paladin", "dark_knight"];
          if (blocker.blockTarget === playerId && tankClasses.includes(blocker.characterClass) && !blocker.isDead) {
            blocked = true;
            blockerPlayer = blocker;
            break;
          }
        }

        if (!blocked) {
          // Calculate damage with defense reduction
          const rawDamage = fight.baseEnemyDamage || 1;
          const damageReduction = calculateDamageReduction(player.def, player.vit);
          const damageAmount = Math.max(1, rawDamage - damageReduction); // Minimum 1 damage
          const defendedAmount = rawDamage - damageAmount;
          
          const newHealth = Math.max(0, player.health - damageAmount);
          const wasAlive = !player.isDead;
          const nowDead = newHealth === 0;
          
          // Update player health and death state (in memory)
          player.health = newHealth;
          player.isDead = nowDead;
          player.damageTaken += damageAmount;
          
          // Add feedback for incorrect answer - player took damage
          const enemyName = session.enemies.length > 0 ? session.enemies[0].name : "Enemy";
          if (!playerFeedback.has(playerId)) {
            playerFeedback.set(playerId, []);
          }
          playerFeedback.get(playerId)!.push({
            type: "incorrect_damage",
            damage: damageAmount,
            defendedAmount: defendedAmount,
            enemyName: enemyName,
          });
          
          if (wasAlive && nowDead) {
            player.deaths += 1;
            // Combat log event for player death
            broadcastCombatLogEvent(sessionId, "death", `${player.nickname} has been defeated!`, {
              playerName: player.nickname,
            });
          }
        } else if (blockerPlayer) {
          // AGGRO SYSTEM: Tank who successfully blocks gains +1 aggro per damage point blocked
          const damageAmount = fight.baseEnemyDamage || 1;
          blockerPlayer.damageBlocked += damageAmount;
          blockerPlayer.threat += damageAmount; // +1 aggro per damage blocked
          
          // Add feedback for tank who blocked
          const blockerId = Object.keys(session.players).find(id => session.players[id] === blockerPlayer);
          if (blockerId) {
            if (!playerFeedback.has(blockerId)) {
              playerFeedback.set(blockerId, []);
            }
            playerFeedback.get(blockerId)!.push({
              type: "blocked_for_player",
              blockedPlayer: player.nickname,
              blockedDamage: damageAmount,
            });
          }
          
          // Add feedback for player who got blocked
          if (!playerFeedback.has(playerId)) {
            playerFeedback.set(playerId, []);
          }
          playerFeedback.get(playerId)!.push({
            type: "got_blocked",
            blockingPlayer: blockerPlayer.nickname,
            blockedDamage: damageAmount,
          });
          
          // Combat log event for blocking
          broadcastCombatLogEvent(sessionId, "block", `${blockerPlayer.nickname} blocks damage for ${player.nickname}`, {
            playerName: blockerPlayer.nickname,
            targetName: player.nickname,
            value: damageAmount,
          });
        }
      }
    }

    // Handle consecutive enemy mode: remove defeated enemies
    if (fight.enemyDisplayMode === "consecutive" && session.enemies.length > 0) {
      if (session.enemies[0].health <= 0) {
        // Current enemy is dead, remove it
        session.enemies.shift();
        
        // Broadcast enemy defeat if there are more enemies
        if (session.enemies.length > 0) {
          broadcastToCombat(sessionId, { 
            type: "phase_change", 
            phase: `Enemy defeated! Next enemy: ${session.enemies[0].name}` 
          });
        }
      }
    }
    
    // Save ALL changes at once (enemies + all player states) - HUGE performance improvement
    await storage.updateCombatSession(sessionId, { 
      enemies: session.enemies,
      players: session.players 
    });

    const updatedSession = await storage.getCombatSession(sessionId);
    broadcastToCombat(sessionId, { type: "combat_state", state: updatedSession });
    
    // Send individual feedback to each student
    for (const [playerId, feedbackList] of Array.from(playerFeedback.entries())) {
      if (feedbackList.length > 0) {
        // Send to specific student only
        wss.clients.forEach((ws: ExtendedWebSocket) => {
          if (ws.readyState === WebSocket.OPEN && ws.sessionId === sessionId && ws.studentId === playerId) {
            ws.send(JSON.stringify({
              type: "resolution_feedback",
              feedback: feedbackList,
            }));
          }
        });
      }
    }
    
    // Calculate and send party damage summary
    const totalDamage = Array.from(enemyDamageMap.values()).reduce((sum, dmg) => sum + dmg, 0);
    const enemiesHit = session.enemies
      .filter(enemy => enemyDamageMap.has(enemy.id))
      .map(enemy => ({
        enemyId: enemy.id,
        enemyName: enemy.name,
        enemyImage: enemy.image,
        damageTaken: enemyDamageMap.get(enemy.id) || 0,
      }));
    
    if (totalDamage > 0) {
      const partyDamageData: PartyDamageData = {
        totalDamage,
        enemiesHit,
      };
      
      broadcastToCombat(sessionId, {
        type: "party_damage_summary",
        data: partyDamageData,
      });
    }
    
    logPhaseTiming(sessionId, "question_resolution", phaseStart);

    // Calculate dynamic phase duration based on modal count
    // Each modal needs 3 seconds for students to read and process
    let maxModalCount = 0;
    for (const feedbackList of Array.from(playerFeedback.values())) {
      maxModalCount = Math.max(maxModalCount, feedbackList.length);
    }
    
    // Add 1 modal for party damage summary if applicable
    if (totalDamage > 0) {
      maxModalCount += 1;
    }
    
    // Ensure at least 3 seconds, then 3 seconds per modal
    const resolutionDuration = Math.max(3000, maxModalCount * 3000);
    
    log(`[Combat] Question resolution phase will last ${resolutionDuration}ms (${maxModalCount} modals × 3s each)`, "combat");
    
    // Auto-advance to enemy AI phase after all modals have displayed
    setTimeout(async () => {
      await enemyAIPhase(sessionId);
    }, resolutionDuration);
  }

  async function enemyAIPhase(sessionId: string) {
    const phaseStart = Date.now();
    const session = await storage.getCombatSession(sessionId);
    if (!session) return;
    
    const fight = await storage.getFight(session.fightId);
    if (!fight) return;

    await storage.updateCombatSession(sessionId, { currentPhase: "enemy_ai" });
    broadcastToCombat(sessionId, { type: "phase_change", phase: "Enemy AI Phase" });
    broadcastCombatLogEvent(sessionId, "phase_change", "Enemy AI Phase - Enemies Attack!");

    // Collect enemy attack data for frontend display
    const enemyAttacks: EnemyAIAttackData[] = [];

    // Default enemy AI: Attack player with highest threat
    // PERFORMANCE FIX (B1, B2): Process all updates in memory, then save once
    
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
        const damageAmount = (fight.baseEnemyDamage || 1) + 1;
        
        // Check if target is being blocked by an alive tank
        let blocked = false;
        let blockerPlayer = null;
        for (const [blockerId, blocker] of Object.entries(session.players)) {
          if (blocker.blockTarget === targetId && TANK_CLASSES.includes(blocker.characterClass) && !blocker.isDead) {
            blocked = true;
            blockerPlayer = blocker;
            break;
          }
        }
        
        if (!blocked) {
          // Calculate damage with defense reduction
          const rawDamage = (fight.baseEnemyDamage || 1) + 1;
          const damageReduction = calculateDamageReduction(target.def, target.vit);
          const actualDamage = Math.max(1, rawDamage - damageReduction); // Minimum 1 damage
          const defendedAmount = rawDamage - actualDamage;
          
          const newHealth = Math.max(0, target.health - actualDamage);
          const wasAlive = !target.isDead;
          const nowDead = newHealth === 0;
          
          // Update player state in memory
          target.health = newHealth;
          target.isDead = nowDead;
          target.damageTaken += actualDamage;
          if (wasAlive && nowDead) {
            target.deaths += 1;
          }
          
          // Collect attack data for frontend display
          enemyAttacks.push({
            enemyName: enemy.name,
            enemyImage: enemy.image,
            enemyId: enemy.id,
            targetPlayer: target.nickname,
            damage: actualDamage,
            defendedAmount: defendedAmount,
            blocked: false,
          });
        } else if (blockerPlayer) {
          // Blocked! Tank absorbs damage and gains aggro
          blockerPlayer.damageBlocked += damageAmount;
          // AGGRO SYSTEM: Tank who successfully blocks gains +1 aggro per damage point blocked
          blockerPlayer.threat += damageAmount;
          
          // Collect attack data for frontend display (blocked)
          enemyAttacks.push({
            enemyName: enemy.name,
            enemyImage: enemy.image,
            enemyId: enemy.id,
            targetPlayer: target.nickname,
            damage: damageAmount,
            blocked: true,
            blockerName: blockerPlayer.nickname,
          });
        }
      }
    }

    // Save ALL player changes at once - HUGE performance improvement
    await storage.updateCombatSession(sessionId, { players: session.players });

    const updatedSession = await storage.getCombatSession(sessionId);
    broadcastToCombat(sessionId, { type: "combat_state", state: updatedSession });
    
    // Broadcast enemy AI attack data to students for modal display
    if (enemyAttacks.length > 0) {
      broadcastToCombat(sessionId, {
        type: "enemy_ai_attack",
        attacks: enemyAttacks,
        allEnemies: session.enemies.filter(e => e.health > 0).map(e => ({
          id: e.id,
          name: e.name,
          image: e.image,
        })),
      });
    }
    
    logPhaseTiming(sessionId, "enemy_ai", phaseStart);

    // Auto-advance to state check after all animations complete
    // Timing calculation:
    // - EnemyAIModal animation: 800ms
    // - Each CounterattackModal: 3000ms (3 seconds for students to read and process)
    // - Final cleanup delay: 1000ms
    // Total: 800 + (attacks * 3000) + 1000 = 1800 + (attacks * 3000)
    const enemyAnimationTime = 800;      // Enemy modal animation
    const counterattackTime = 3000;      // Per attack modal display (3 seconds each)
    const cleanupTime = 1000;            // Final delay
    const totalAnimationTime = enemyAnimationTime + (enemyAttacks.length * counterattackTime) + cleanupTime;
    const delayTime = enemyAttacks.length > 0 ? totalAnimationTime : 1000;
    
    log(`[Combat] Enemy AI phase will last ${delayTime}ms (800ms intro + ${enemyAttacks.length} attacks × 3s each + 1s cleanup)`, "combat");
    
    setTimeout(async () => {
      await stateCheckPhase(sessionId);
    }, delayTime);
  }

  async function saveCombatStats(sessionId: string) {
    const session = await storage.getCombatSession(sessionId);
    if (!session) return;

    for (const player of Object.values(session.players)) {
      await storage.createCombatStat({
        fightId: session.fightId,
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

  async function stateCheckPhase(sessionId: string) {
    const session = await storage.getCombatSession(sessionId);
    if (!session) return;
    
    const fight = await storage.getFight(session.fightId);
    if (!fight) return;

    await storage.updateCombatSession(sessionId, { currentPhase: "state_check" });

    // Check if all players dead
    const allPlayersDead = Object.values(session.players).every((p) => p.isDead);
    if (allPlayersDead) {
      await saveCombatStats(sessionId);
      
      // Increment fightCount for ultimate ability cooldown tracking (defeat case)
      for (const player of Object.values(session.players)) {
        player.fightCount = (player.fightCount || 0) + 1;
      }
      
      await storage.updateCombatSession(sessionId, { 
        currentPhase: "game_over",
        players: session.players 
      });
      
      broadcastToCombat(sessionId, {
        type: "game_over",
        victory: false,
        message: "All heroes have fallen...",
      });
      
      // Clean up after defeat
      setTimeout(async () => {
        try {
          await cleanupSession(sessionId);
        } catch (error) {
          log(`[Cleanup] Error during cleanup: ${error}`, "cleanup");
        }
      }, 2000);
      
      return;
    }

    // Check if all enemies dead
    const allEnemiesDead = session.enemies.every((e) => e.health <= 0);
    log(`[Victory Check] Session ${sessionId}: ${allEnemiesDead ? 'ALL ENEMIES DEFEATED' : 'Enemies still alive'} (Enemies: ${session.enemies.map(e => `${e.name} HP:${e.health}`).join(', ')})`, "combat");
    
    if (allEnemiesDead) {
      log(`[Victory] Triggering victory sequence for session ${sessionId} (Solo mode: ${session.soloModeEnabled})`, "combat");
      await saveCombatStats(sessionId);
      await storage.updateCombatSession(sessionId, { currentPhase: "game_over" });
      
      // Calculate and award XP for each player
      const victoryData: Record<string, any> = {};
      for (const player of Object.values(session.players)) {
        // Calculate XP based on combat performance using individual contribution formula
        // (damageDealt × 1 + healingDone × 2 + damageBlocked × 2) × questionsCorrect
        const individualContribution = 
          (player.damageDealt || 0) + 
          (player.healingDone || 0) * 2 + 
          (player.damageBlocked || 0) * 2;
        const rawXP = individualContribution * (player.questionsCorrect || 0);
        
        // Cap XP based on fight difficulty (20 XP at difficulty 1, 120 XP at difficulty 100)
        // Use the average difficulty multiplier from all enemies (default to 10 if missing)
        const avgDifficulty = fight.enemies.length > 0 
          ? fight.enemies.reduce((sum, e) => sum + (e.difficultyMultiplier || 10), 0) / fight.enemies.length
          : 10;
        // Clamp difficulty to valid range [1, 100]
        const clampedDifficulty = Math.max(1, Math.min(100, avgDifficulty));
        const xpCap = 20 + ((clampedDifficulty - 1) / 99) * 100;
        const xpGained = Math.min(rawXP, xpCap);
        
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
        
        // Increment fightCount for ultimate ability cooldown tracking
        player.fightCount = (player.fightCount || 0) + 1;
      }
      
      // Update session with incremented fightCounts
      await storage.updateCombatSession(sessionId, { players: session.players });

      // Guild XP distribution (skip if solo mode)
      if (!session.soloModeEnabled) {
        try {
          // Check which guilds this fight is assigned to
          const fightGuilds = await storage.getFightGuilds(session.fightId);
          
          if (fightGuilds.length > 0) {
            // For each player, award XP to guilds they belong to that have this fight assigned
            for (const player of Object.values(session.players)) {
              const student = await storage.getStudent(player.studentId);
              if (!student) continue;
              
              const studentGuilds = await storage.getStudentGuilds(player.studentId);
              
              // Find guilds where this fight is assigned AND the student is a member
              const eligibleGuilds = fightGuilds.filter(fightGuild => 
                studentGuilds.some(studentGuild => studentGuild.id === fightGuild.id)
              );
              
              // Award 100% of fight XP to each eligible guild
              const playerXP = victoryData[player.studentId]?.xpGained || 0;
              
              for (const guild of eligibleGuilds) {
                await storage.awardXPToGuild(guild.id, playerXP);
                log(`[Guild XP] Awarded ${playerXP} XP to guild ${guild.name} from student ${player.nickname}`, "guild");
              }
            }
          }
        } catch (error) {
          log(`[Guild XP] Error distributing guild XP: ${error}`, "guild");
        }
      }
      
      // Send individual victory messages to each player with their XP data
      let victoryMessagesSent = 0;
      wss.clients.forEach((client) => {
        const playerWs = client as ExtendedWebSocket;
        if (playerWs.readyState === WebSocket.OPEN && playerWs.sessionId === sessionId && playerWs.studentId) {
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
          victoryMessagesSent++;
          log(`[Victory] Sent detailed victory message to student ${playerWs.studentId} (XP: ${playerData?.xpGained || 0})`, "combat");
        } else if (playerWs.readyState === WebSocket.OPEN && (playerWs.sessionId === sessionId || playerWs.isHost)) {
          // Send basic victory message to host
          playerWs.send(JSON.stringify({
            type: "game_over",
            victory: true,
            message: "Victory! All enemies defeated!",
          }));
          victoryMessagesSent++;
          log(`[Victory] Sent basic victory message to ${playerWs.isHost ? 'host' : 'session member'}`, "combat");
        }
      });
      log(`[Victory] Total victory messages sent: ${victoryMessagesSent}`, "combat");
      
      // Clean up after victory (delayed to ensure messages are received)
      setTimeout(async () => {
        try {
          await cleanupSession(sessionId);
        } catch (error) {
          log(`[Cleanup] Error during cleanup: ${error}`, "cleanup");
        }
      }, 5000); // 5 second delay for loot claiming
      
      return;
    }

    // Continue to next question
    await storage.updateCombatSession(sessionId, {
      currentQuestionIndex: session.currentQuestionIndex + 1,
    });
    
    // Show "Next Question" modal to all students
    broadcastToCombat(sessionId, {
      type: "next_question",
      questionNumber: session.currentQuestionIndex + 2, // +2 because we already incremented and it's 0-indexed
    });
    
    // Delay to allow modal to display (2 seconds)
    setTimeout(async () => {
      await startQuestion(sessionId);
    }, 2000);
  }

  // Heartbeat system to detect dead connections
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as ExtendedWebSocket;
      
      if (ws.isAlive === false) {
        log(`[WebSocket] Terminating dead connection (sessionId: ${ws.sessionId})`, "websocket");
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(heartbeatTimer);
  });

  wss.on("connection", (ws: ExtendedWebSocket) => {
    log("[WebSocket] New connection established", "websocket");
    
    ws.isAlive = true;
    
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    
    ws.on("message", async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        log(`[WebSocket] Received message: ${message.type}`, "websocket");

        if (message.type === "host") {
          const fight = await storage.getFight(message.fightId);
          if (!fight) {
            log(`[WebSocket] Host connection failed: Fight ${message.fightId} not found`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "Fight not found" }));
            return;
          }
          
          // CRITICAL FIX: Check if host is trying to rejoin an existing session
          if (message.sessionId) {
            try {
              const existingSession = await storage.getCombatSession(message.sessionId);
              if (existingSession && existingSession.fightId === message.fightId) {
                log(`[WebSocket] Host rejoining existing session ${message.sessionId}`, "websocket");
                
                // Close any old host connections for this session
                wss.clients.forEach((client) => {
                  const existingWs = client as ExtendedWebSocket;
                  if (existingWs !== ws && existingWs.sessionId === message.sessionId && existingWs.isHost) {
                    log(`[WebSocket] Closing old host connection for session ${message.sessionId}`, "websocket");
                    existingWs.close(1000, "Host reconnected");
                  }
                });
                
                // Set connection properties
                ws.fightId = message.fightId;
                ws.sessionId = message.sessionId;
                ws.isHost = true;
                
                // Send existing session back to host
                ws.send(JSON.stringify({ 
                  type: "session_created", 
                  sessionId: existingSession.sessionId,
                  state: existingSession 
                }));
                log(`[WebSocket] Host successfully rejoined session ${message.sessionId}`, "websocket");
                return;
              } else {
                log(`[WebSocket] Session ${message.sessionId} not found or fight mismatch, creating new session`, "websocket");
              }
            } catch (error) {
              log(`[WebSocket] Error checking for existing session: ${error}, creating new session`, "websocket");
            }
          }
          
          // B1/B12 FIX: Clean up any existing host connections for this fight first
          // This prevents multiple host connections for the same fight
          wss.clients.forEach((client) => {
            const existingWs = client as ExtendedWebSocket;
            if (existingWs !== ws && existingWs.fightId === message.fightId && existingWs.isHost) {
              log(`[WebSocket] Closing old host connection for fight ${message.fightId}`, "websocket");
              existingWs.close(1000, "New host connection established");
            }
          });
          
          // Set connection properties
          ws.fightId = message.fightId;
          ws.isHost = true;
          
          // B1/B12/B9 FIX: ALWAYS cleanup existing fight state (timers, connections, DB session)
          // This ensures a clean slate even if session doesn't exist in DB but timers/connections do
          
          // Get existing sessions for this fight (use plural method - returns array)
          const existingSessions = await storage.getCombatSessionsByFightId(message.fightId);
          if (existingSessions.length > 0) {
            log(`[WebSocket] Found ${existingSessions.length} existing session(s) for fight ${message.fightId}, cleaning up`, "websocket");
          } else {
            log(`[WebSocket] No existing sessions for fight ${message.fightId}, creating fresh`, "websocket");
          }
          
          // Always cleanup to clear timers, connections, and DB state for all existing sessions
          for (const existingSession of existingSessions) {
            try {
              await cleanupSession(existingSession.sessionId);
            } catch (error) {
              log(`[WebSocket] Error cleaning up session ${existingSession.sessionId}: ${error}`, "websocket");
            }
          }
          
          // Brief delay to ensure cleanup completes
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Create fresh combat session (generates unique sessionId)
          const session = await storage.createCombatSession(message.fightId, fight);
          
          // Set both sessionId (primary) and fightId (cached) on the WebSocket
          ws.sessionId = session.sessionId;
          ws.fightId = session.fightId;
          
          // Send sessionId and combat state to host so they can display the code
          ws.send(JSON.stringify({ 
            type: "session_created", 
            sessionId: session.sessionId,
            state: session 
          }));
          log(`[WebSocket] Host created session ${session.sessionId} for fight ${message.fightId}`, "websocket");
        } else if (message.type === "host_solo") {
          // Student hosting a solo mode session
          const fight = await storage.getFight(message.fightId);
          if (!fight) {
            log(`[WebSocket] Solo host connection failed: Fight ${message.fightId} not found`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "Fight not found" }));
            return;
          }

          // Check if guildId is provided
          if (!message.guildId) {
            log(`[WebSocket] Solo mode failed: Guild ID not provided`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "Guild ID required for solo mode" }));
            return;
          }

          // Check if solo mode is enabled for this fight in this guild
          const guildFight = await storage.getGuildFight(message.guildId, message.fightId);
          if (!guildFight) {
            log(`[WebSocket] Solo mode failed: Fight ${message.fightId} not assigned to guild ${message.guildId}`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "Fight not found in guild" }));
            return;
          }

          if (!guildFight.soloModeEnabled) {
            log(`[WebSocket] Solo mode not enabled for fight ${message.fightId} in guild ${message.guildId}`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "Solo mode not enabled for this fight" }));
            return;
          }

          const student = await storage.getStudent(message.studentId);
          if (!student) {
            log(`[WebSocket] Solo host failed: Student not found (${message.studentId})`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "Student not found" }));
            return;
          }

          // Set connection properties for solo mode host
          ws.fightId = message.fightId;
          ws.isHost = true;
          ws.studentId = message.studentId; // Solo host is also a player

          // Clean up any existing solo sessions for this student
          const existingSessions = await storage.getCombatSessionsByFightId(message.fightId);
          const studentSoloSessions = existingSessions.filter(s => s.soloModeHostId === message.studentId);
          
          for (const existingSession of studentSoloSessions) {
            try {
              await cleanupSession(existingSession.sessionId);
            } catch (error) {
              log(`[WebSocket] Error cleaning up solo session ${existingSession.sessionId}: ${error}`, "websocket");
            }
          }

          await new Promise(resolve => setTimeout(resolve, 200));

          // Create solo mode combat session - enemies use their actual maxHP from fight template
          const session = await storage.createCombatSession(message.fightId, fight, {
            soloModeEnabled: true,
            soloModeHostId: message.studentId,
            soloModeAIEnabled: false,
            soloModeJoinersBlocked: false,
            guildId: message.guildId,
          });

          ws.sessionId = session.sessionId;

          // Auto-add the host as first player
          await storage.addPlayerToCombat(session.sessionId, student);

          const updatedSession = await storage.getCombatSession(session.sessionId);

          ws.send(JSON.stringify({
            type: "solo_session_created",
            sessionId: session.sessionId,
            state: updatedSession,
          }));
          log(`[WebSocket] Student ${student.nickname} created solo session ${session.sessionId} for fight ${message.fightId}`, "websocket");
        } else if (message.type === "solo_toggle_ai" && ws.isHost && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session || !session.soloModeEnabled) {
            log(`[WebSocket] Toggle AI failed: Not a solo mode session`, "websocket");
            return;
          }

          // AI can only be enabled if 5+ players
          const playerCount = Object.keys(session.players).length;
          const newAIState = message.enabled && playerCount >= 5;

          await storage.updateCombatSession(ws.sessionId, {
            soloModeAIEnabled: newAIState,
          });

          const updatedSession = await storage.getCombatSession(ws.sessionId);
          broadcastToCombat(ws.sessionId, { 
            type: "combat_state", 
            state: updatedSession 
          });

          log(`[WebSocket] Solo session ${ws.sessionId} AI ${newAIState ? 'enabled' : 'disabled'}`, "websocket");
        } else if (message.type === "solo_block_joiners" && ws.isHost && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session || !session.soloModeEnabled) {
            log(`[WebSocket] Block joiners failed: Not a solo mode session`, "websocket");
            return;
          }

          await storage.updateCombatSession(ws.sessionId, {
            soloModeJoinersBlocked: message.blocked,
          });

          const updatedSession = await storage.getCombatSession(ws.sessionId);
          broadcastToCombat(ws.sessionId, {
            type: "combat_state",
            state: updatedSession,
          });

          log(`[WebSocket] Solo session ${ws.sessionId} joiners ${message.blocked ? 'blocked' : 'allowed'}`, "websocket");
        } else if (message.type === "join") {
          const student = await storage.getStudent(message.studentId);
          const sessionId = message.sessionId;
          
          if (!student) {
            log(`[WebSocket] Join failed: Student not found (${message.studentId})`, "websocket");
            return;
          }
          if (!sessionId) {
            log(`[WebSocket] Join failed: No sessionId provided`, "websocket");
            return;
          }

          const session = await storage.getCombatSession(sessionId);
          if (!session) {
            log(`[WebSocket] Join failed: Session not found (${sessionId})`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "Session not found or has ended" }));
            return;
          }

          // Check solo mode joiner restrictions
          if (session.soloModeEnabled && session.soloModeJoinersBlocked) {
            log(`[WebSocket] Join blocked: Solo mode host has blocked new joiners`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "Host has blocked new players from joining" }));
            return;
          }

          const fight = await storage.getFight(session.fightId);
          if (!fight) {
            log(`[WebSocket] Join failed: Fight not found (${session.fightId})`, "websocket");
            return;
          }

          log(`[WebSocket] Student ${student.nickname} joining session ${sessionId} for fight ${fight.title}`, "websocket");

          // AUTO-ENROLL: Assign teacher's guildCode to student if they don't have one (skip for solo mode)
          if (!student.guildCode && !session.soloModeEnabled) {
            const teacher = await storage.getTeacher(fight.teacherId);
            if (teacher && teacher.guildCode) {
              await storage.updateStudent(student.id, { guildCode: teacher.guildCode });
              log(`[WebSocket] Auto-enrolled student ${student.nickname} into guild ${teacher.guildCode}`, "websocket");
            }
          }

          // CRITICAL FIX: Close any existing connections for this student in this session
          // This prevents connection explosion on reconnects/refreshes
          let closedOldConnections = 0;
          wss.clients.forEach((client) => {
            const existingWs = client as ExtendedWebSocket;
            // Close if same student+session but different WebSocket object
            if (existingWs !== ws && 
                existingWs.studentId === student.id && 
                existingWs.sessionId === sessionId &&
                (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING)) {
              existingWs.close(1000, "Student reconnected");
              closedOldConnections++;
            }
          });
          if (closedOldConnections > 0) {
            log(`[WebSocket] Closed ${closedOldConnections} old connection(s) for student ${student.nickname} in session ${sessionId}`, "websocket");
          }

          // Set both sessionId (primary) and fightId (cached) on the WebSocket
          ws.studentId = student.id;
          ws.sessionId = sessionId;
          ws.fightId = session.fightId;
          
          // Preserve isHost status if this student is the solo mode host
          if (session.soloModeEnabled && session.soloModeHostId === student.id) {
            ws.isHost = true;
            log(`[WebSocket] Solo mode host ${student.nickname} joined their own session ${sessionId}`, "websocket");
          }

          // Add player to combat if not already in
          if (!session.players[student.id]) {
            await storage.addPlayerToCombat(sessionId, student);
          }

          const updatedSession = await storage.getCombatSession(sessionId);
          broadcastToCombat(sessionId, { type: "combat_state", state: updatedSession });
          log(`[WebSocket] Student ${student.nickname} successfully joined session ${sessionId}`, "websocket");
        } else if (message.type === "start_fight" && ws.isHost) {
          // Accept sessionId from either WebSocket object or message payload
          const sessionId = ws.sessionId || message.sessionId;
          if (!sessionId) {
            log(`[WebSocket] Cannot start fight - no sessionId provided`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "No sessionId provided" }));
            return;
          }
          
          log(`[WebSocket] Host initiating fight start for session ${sessionId}`, "websocket");
          const session = await storage.getCombatSession(sessionId);
          if (!session) {
            log(`[WebSocket] Cannot start fight - no session found for ${sessionId}`, "websocket");
            ws.send(JSON.stringify({ type: "error", message: "No active session found" }));
            return;
          }
          if (session.currentPhase !== "waiting") {
            log(`[WebSocket] Session ${sessionId} already started (phase: ${session.currentPhase})`, "websocket");
            return;
          }
          await startQuestion(sessionId);
          log(`[WebSocket] Session ${sessionId} started successfully`, "websocket");
        } else if (message.type === "end_fight" && ws.isHost && ws.sessionId) {
          // Clear any active timers
          const timer = combatTimers.get(ws.sessionId);
          if (timer) {
            clearTimeout(timer);
            combatTimers.delete(ws.sessionId);
          }
          
          // Save combat stats before ending
          await saveCombatStats(ws.sessionId);
          
          // End the fight - broadcast game_over to all players
          broadcastToCombat(ws.sessionId, {
            type: "game_over",
            victory: false,
            message: "Fight ended by teacher",
          });
          
          // Also send explicit disconnect message to ensure players return to lobby
          broadcastToCombat(ws.sessionId, {
            type: "force_disconnect",
            message: "Returning to lobby...",
          });
          
          // Update combat session to game_over phase
          await storage.updateCombatSession(ws.sessionId, { currentPhase: "game_over" });
          
          // Clean up after teacher ends fight (giving time for messages to be received)
          const sessionIdToClose = ws.sessionId;
          setTimeout(async () => {
            try {
              await cleanupSession(sessionIdToClose);
            } catch (error) {
              log(`[Cleanup] Error during cleanup: ${error}`, "cleanup");
            }
          }, 3000);
          
          log(`[WebSocket] Session ${ws.sessionId} ended by teacher`, "websocket");
        } else if (message.type === "answer" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          // TIMER SUPREMACY: Ignore answers after question phase has ended
          if (session.currentPhase !== "question") {
            log(`[WebSocket] Ignoring late answer from ${ws.studentId} - phase already moved to ${session.currentPhase}`, "websocket");
            return;
          }
          
          // Only allow alive players to answer
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring answer from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          log(`[WebSocket] Student ${ws.studentId} submitted answer: "${message.answer}"`, "websocket");
          
          await storage.updatePlayerState(ws.sessionId, ws.studentId, {
            currentAnswer: message.answer,
            hasAnswered: true,
            isHealing: message.isHealing || false,
            healTarget: message.healTarget,
          });
          
          const updatedSession = await storage.getCombatSession(ws.sessionId);
          if (!updatedSession) return;
          
          broadcastToCombat(ws.sessionId, { type: "combat_state", state: updatedSession });

          // Check if all alive players have answered - if so, end question phase early
          const alivePlayers = Object.values(updatedSession.players).filter(p => !p.isDead);
          const allAnswered = alivePlayers.every(player => player.hasAnswered);
          
          if (allAnswered && alivePlayers.length > 0) {
            log(`[WebSocket] All ${alivePlayers.length} alive students answered - ending question phase early`, "websocket");
            
            // Clear the question timer
            const timer = combatTimers.get(ws.sessionId);
            if (timer) {
              clearTimeout(timer);
              combatTimers.delete(ws.sessionId);
            }
            
            // Immediately proceed to abilities phase
            await abilitiesPhase(ws.sessionId);
          }
        } else if (message.type === "block" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          // Only allow alive warriors to block
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring block from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Update abilities phase activity tracker
          if (session.currentPhase === "abilities") {
            abilitiesLastActivity.set(ws.sessionId, Date.now());
          }
          
          await storage.updatePlayerState(ws.sessionId, ws.studentId, {
            blockTarget: message.targetId,
          });
          
          const updatedSession = await storage.getCombatSession(ws.sessionId);
          broadcastToCombat(ws.sessionId, { type: "combat_state", state: updatedSession });
        } else if (message.type === "heal" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          // Only allow alive herbalists to heal
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring heal from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Update abilities phase activity tracker
          if (session.currentPhase === "abilities") {
            abilitiesLastActivity.set(ws.sessionId, Date.now());
          }
          
          await storage.updatePlayerState(ws.sessionId, ws.studentId, {
            isHealing: true,
            healTarget: message.targetId,
          });
          
          const updatedSession = await storage.getCombatSession(ws.sessionId);
          broadcastToCombat(ws.sessionId, { type: "combat_state", state: updatedSession });
        } else if (message.type === "decline_healing" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring decline_healing from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Update abilities phase activity tracker
          if (session.currentPhase === "abilities") {
            abilitiesLastActivity.set(ws.sessionId, Date.now());
          }
          
          // Clear healing state when player declines to heal
          await storage.updatePlayerState(ws.sessionId, ws.studentId, {
            isHealing: false,
            healTarget: undefined,
          });
          
          // Batch broadcast to reduce message flood
          scheduleBroadcastUpdate(ws.sessionId);
        } else if (message.type === "use_ability" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring use_ability from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Update abilities phase activity tracker
          if (session.currentPhase === "abilities") {
            abilitiesLastActivity.set(ws.sessionId, Date.now());
          }
          
          // Store pending action - preserve targetId if provided in message
          const abilityId = message.abilityId;
          const targetId = message.targetId;
          
          // Get ability details to determine type
          const abilityDetails = ABILITY_DISPLAYS[abilityId];
          const isHealingAbility = abilityDetails?.abilityClass?.includes("healing");
          
          // List of ally-targeted abilities (healing, blocking, buffs, shields)
          const ALLY_TARGETED_ABILITIES = [
            "warrior_block", "block_crossclass",
            "purify", "bless", "aegis",
            "shield_potion", "lay_on_hands",
            "healing_guard_ally_crossclass"
          ];
          
          // Determine targetType based on ability class and ID
          let targetType: "enemy" | "ally" | undefined = undefined;
          if (targetId !== undefined) {
            if (isHealingAbility || ALLY_TARGETED_ABILITIES.includes(abilityId)) {
              targetType = "ally";
            } else {
              targetType = "enemy";
            }
          }
          
          log(`[Abilities] Player ${player.nickname} selected ability: ${abilityId}${targetId ? ` with target ${targetId}` : ''}`, "combat");
          
          // Prepare update object
          const updateData: any = {
            pendingAction: {
              abilityId,
              targetId,
              targetType,
            },
            hasSelectedAbility: true,
          };
          
          // For healing abilities with a target, also set isHealing and healTarget
          if (isHealingAbility && targetId) {
            updateData.isHealing = true;
            updateData.healTarget = targetId;
            log(`[Abilities] Player ${player.nickname} set to heal target ${targetId}`, "combat");
          }
          
          await storage.updatePlayerState(ws.sessionId, ws.studentId, updateData);
          
          const updatedSession = await storage.getCombatSession(ws.sessionId);
          broadcastToCombat(ws.sessionId, { type: "combat_state", state: updatedSession });
        } else if (message.type === "base_damage_selected" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring base_damage_selected from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Update abilities phase activity tracker
          if (session.currentPhase === "abilities") {
            abilitiesLastActivity.set(ws.sessionId, Date.now());
          }
          
          // Mark that player has made their selection (choosing base damage)
          await storage.updatePlayerState(ws.sessionId, ws.studentId, {
            hasSelectedAbility: true,
          });
          
          const updatedSession = await storage.getCombatSession(ws.sessionId);
          broadcastToCombat(ws.sessionId, { type: "combat_state", state: updatedSession });
        } else if (message.type === "select_target" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          const player = session.players[ws.studentId];
          if (!player || player.isDead || !player.pendingAction) {
            log(`[WebSocket] Ignoring select_target from invalid state ${ws.studentId}`, "websocket");
            return;
          }
          
          // Update abilities phase activity tracker
          if (session.currentPhase === "abilities") {
            abilitiesLastActivity.set(ws.sessionId, Date.now());
          }
          
          // Complete the pending action with target
          await storage.updatePlayerState(ws.sessionId, ws.studentId, {
            pendingAction: {
              ...player.pendingAction,
              targetId: message.targetId,
              targetType: message.targetType,
            },
            lastTargetId: message.targetId, // Remember for auto-selection
          });
          
          const updatedSession = await storage.getCombatSession(ws.sessionId);
          broadcastToCombat(ws.sessionId, { type: "combat_state", state: updatedSession });
        } else if (message.type === "create_potion" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          // Only allow alive herbalists to create potions
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring create_potion from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Herbalist choosing to create a potion instead of dealing damage
          await storage.updatePlayerState(ws.sessionId, ws.studentId, {
            isCreatingPotion: true,
          });
          
          // Batch broadcast to reduce message flood
          scheduleBroadcastUpdate(ws.sessionId);
        } else if (message.type === "charge_fireball" && ws.studentId && ws.sessionId) {
          const session = await storage.getCombatSession(ws.sessionId);
          if (!session) return;
          
          // Only allow alive wizards to charge fireballs
          const player = session.players[ws.studentId];
          if (!player || player.isDead || player.characterClass !== "wizard") {
            log(`[WebSocket] Ignoring charge_fireball from non-wizard/dead player ${ws.studentId}`, "websocket");
            return;
          }
          
          // Wizard starting to charge a fireball
          await storage.updatePlayerState(ws.sessionId, ws.studentId, {
            isChargingFireball: true,
          });
          
          // Batch broadcast to reduce message flood
          scheduleBroadcastUpdate(ws.sessionId);
        } else if (message.type === "use_ultimate" && ws.studentId && ws.sessionId) {
          const sessionId = ws.sessionId; // Capture for closure
          const session = await storage.getCombatSession(sessionId);
          if (!session) return;
          
          // Only allow ultimates during question phase
          if (session.currentPhase !== "question") {
            log(`[WebSocket] Ignoring ultimate - not in question phase (current: ${session.currentPhase})`, "websocket");
            return;
          }
          
          const player = session.players[ws.studentId];
          if (!player || player.isDead) {
            log(`[WebSocket] Ignoring ultimate from dead/missing player ${ws.studentId}`, "websocket");
            return;
          }
          
          const ultimateId = message.ultimateId;
          const ultimate = Object.values(ULTIMATE_ABILITIES).find(u => u.id === ultimateId);
          
          if (!ultimate) {
            log(`[WebSocket] Unknown ultimate: ${ultimateId}`, "websocket");
            return;
          }
          
          // Check if player has this ultimate unlocked (level 15+ in corresponding job)
          const jobLevel = player.jobLevels[ultimate.jobClass] || 0;
          if (jobLevel < 15) {
            log(`[WebSocket] Player ${ws.studentId} doesn't have ${ultimate.jobClass} at level 15`, "websocket");
            return;
          }
          
          // Check cooldown
          const lastUsed = player.lastUltimatesUsed[ultimateId] || -999;
          const fightsAgo = player.fightCount - lastUsed;
          if (fightsAgo < ultimate.cooldown && lastUsed !== -999) {
            log(`[WebSocket] Ultimate ${ultimateId} on cooldown for player ${ws.studentId}`, "websocket");
            return;
          }
          
          log(`[WebSocket] Player ${ws.studentId} uses ultimate: ${ultimate.name}`, "websocket");
          
          // Pause combat and broadcast ultimate animation
          await storage.updateCombatSession(sessionId, { currentPhase: "waiting" });
          
          // Broadcast animation to all players
          broadcastToCombat(sessionId, {
            type: "ultimate_animation",
            playerName: player.nickname,
            ultimateName: ultimate.name,
            animationType: ultimate.animationType,
            currentClass: player.characterClass,
            currentGender: player.gender,
          });
          
          // Calculate and apply ultimate effects
          const effectValue = calculateUltimateEffect(ultimateId, {
            str: player.str,
            int: player.int,
            agi: player.agi,
            mnd: player.mnd,
            vit: player.vit,
            atk: player.atk,
            mat: player.mat,
            rtk: player.rtk,
            health: player.health,
            maxHealth: player.maxHealth,
          });
          
          // Apply effects based on ultimate type
          if (ultimate.effect.type === "damage") {
            // Deal damage to all enemies
            for (const enemy of session.enemies) {
              enemy.health = Math.max(0, enemy.health - effectValue);
            }
            player.damageDealt += effectValue;
            player.lastActionDamage = effectValue;
            
            // Some ultimates also heal (like soul_drain and natures_wrath)
            if (ultimateId === "soul_drain") {
              const healAmount = Math.floor(effectValue * 0.5);
              player.health = Math.min(player.maxHealth, player.health + healAmount);
              player.healingDone += healAmount;
            } else if (ultimateId === "natures_wrath") {
              const healAmount = Math.floor(effectValue * 0.25);
              // Heal all players
              for (const p of Object.values(session.players)) {
                if (!p.isDead) {
                  p.health = Math.min(p.maxHealth, p.health + healAmount);
                  p.healingDone += (p.studentId === player.studentId) ? healAmount * Object.keys(session.players).length : 0;
                }
              }
            } else if (ultimateId === "shadow_rend") {
              // Shadow rend costs 50% of current HP
              const hpCost = Math.floor(player.health * 0.5);
              player.health -= hpCost;
              player.damageTaken += hpCost;
            }
          } else if (ultimate.effect.type === "heal") {
            // Heal all players (paladin's holy_restoration)
            for (const p of Object.values(session.players)) {
              if (!p.isDead) {
                const healAmount = p.maxHealth - p.health;
                p.health = p.maxHealth;
                if (p.studentId === player.studentId) {
                  player.healingDone += healAmount;
                }
              }
            }
          }
          
          // Update cooldown
          player.lastUltimatesUsed[ultimateId] = player.fightCount;
          
          // Save session with updated state
          await storage.updateCombatSession(sessionId, {
            players: session.players,
            enemies: session.enemies,
          });
          
          // Broadcast updated state
          const updatedSession = await storage.getCombatSession(sessionId);
          broadcastToCombat(sessionId, { type: "combat_state", state: updatedSession });
          
          // Resume combat after animation (4 seconds)
          setTimeout(async () => {
            const currentSession = await storage.getCombatSession(sessionId);
            if (!currentSession) return;
            
            // Resume to previous phase (question or question_resolution)
            await storage.updateCombatSession(sessionId, { 
              currentPhase: session.currentQuestionIndex < 1 ? "question" : "question_resolution"
            });
            
            const resumedSession = await storage.getCombatSession(sessionId);
            broadcastToCombat(sessionId, { type: "combat_state", state: resumedSession });
          }, 4000);
        }
      } catch (error) {
        log(`[WebSocket] Error: ${error}`, "websocket");
      }
    });

    ws.on("close", async () => {
      // CRITICAL FIX: Proper cleanup on connection close
      
      // Handle host disconnection
      if (ws.isHost && ws.sessionId) {
        log(`[WebSocket] Host disconnected from session ${ws.sessionId}`, "websocket");
        
        // Clear timers for this session to prevent orphaned timers
        // But DON'T delete the session - allow host to rejoin
        const combatTimer = combatTimers.get(ws.sessionId);
        if (combatTimer) {
          clearTimeout(combatTimer);
          combatTimers.delete(ws.sessionId);
          log(`[WebSocket] Cleared combat timer for session ${ws.sessionId}`, "websocket");
        }
        
        const broadcastTimer = pendingBroadcasts.get(ws.sessionId);
        if (broadcastTimer) {
          clearTimeout(broadcastTimer);
          pendingBroadcasts.delete(ws.sessionId);
          log(`[WebSocket] Cleared broadcast timer for session ${ws.sessionId}`, "websocket");
        }
        
        // Session remains in DB so host can reconnect and rejoin
        log(`[WebSocket] Session ${ws.sessionId} preserved for potential host reconnection`, "websocket");
      }
      
      // Handle student disconnection
      if (ws.studentId && ws.sessionId) {
        log(`[WebSocket] Student ${ws.studentId} disconnected from session ${ws.sessionId}`, "websocket");
        
        // Mark player as disconnected in session state (without removing them)
        try {
          const session = await storage.getCombatSession(ws.sessionId);
          if (session && session.players[ws.studentId]) {
            // Note: We don't currently have an isDisconnected field, but we could add one
            // For now, just log it - students can rejoin using the same sessionId
            log(`[WebSocket] Student ${ws.studentId} can rejoin session ${ws.sessionId}`, "websocket");
          }
        } catch (error) {
          log(`[WebSocket] Error handling student disconnect: ${error}`, "websocket");
        }
      }
    });
  });

  return httpServer;
}
