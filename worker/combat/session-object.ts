import type { IdentityRepository } from "../db/repository.ts";
import type { FightRecord } from "../db/schema.ts";
import {
  addStudent,
  allLivingPlayersAnswered,
  applyAnswer,
  initialCombatState,
  startQuestion,
  scaleEncounter,
  advancePhase,
  selectAction,
  setReady,
  resurrectPlayer,
  removeStudent,
  deterministicShuffle,
  type CombatSnapshot,
} from "./engine.ts";
interface CombatEnv {
  DATABASE_URL: string;
}
interface SocketAttachment {
  actorId: string;
  role: "teacher" | "student" | "staging-smoke";
  sessionId: string;
  expiresAt?: number;
  tokenHash?: string;
  windowStart?: number;
  count?: number;
}
interface StoredRoom {
  fight: FightRecord;
  snapshot: CombatSnapshot;
  receipts: string[];
  results?: unknown[];
  resultsPersisted?: boolean;
}
const ROOM_KEY = "room";
export function publicSnapshot(snapshot: CombatSnapshot): CombatSnapshot {
  return {
    ...snapshot,
    players: Object.fromEntries(
      Object.entries(snapshot.players).map(([id, p]) => [
        id,
        {
          ...p,
          currentAnswer: null,
          lastAnswerCorrect: ["question", "actions", "waiting"].includes(
            snapshot.currentPhase,
          )
            ? undefined
            : p.lastAnswerCorrect,
        },
      ]),
    ),
  };
}
export class CombatSessionObject {
  private repository: IdentityRepository | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: CombatEnv,
  ) {}
  setRepository(repository: IdentityRepository) {
    this.repository = repository;
  }
  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => {});
    return next;
  }
  private send(ws: WebSocket, message: unknown) {
    try {
      ws.send(JSON.stringify(message));
    } catch {}
  }
  private broadcast(message: unknown) {
    for (const ws of this.state.getWebSockets()) this.send(ws, message);
  }
  private acknowledgeLeave(ws: WebSocket, actorId: string, sessionId: string, commandId: string) {
    for (const socket of new Set([ws, ...this.state.getWebSockets()])) {
      const attachment = socket.deserializeAttachment() as SocketAttachment;
      if (attachment.role !== "student" || attachment.actorId !== actorId) continue;
      this.send(socket, { type: "fight_left", sessionId, commandId });
      try { socket.close(1000, "Left fight"); } catch {}
    }
  }
  private async room() {
    const room = await this.state.storage.get<StoredRoom>(ROOM_KEY);
    if (!room || room.snapshot.schemaVersion === 2) return room;
    // Upgrade the unfinished phase-4 room in place. Existing answers and HP survive.
    const old: any = room.snapshot;
    let upgraded = initialCombatState(
      old.sessionId,
      room.fight,
      old.phaseStartTime,
    );
    for (const previous of Object.values(old.players) as any[]) {
      const student = await this.repository?.findStudentById(
        previous.studentId,
      );
      if (!student) continue;
      upgraded = addStudent(
        upgraded,
        student,
        await this.repository?.getCombatProfile?.(student),
      );
      const player = upgraded.players[student.id];
      Object.assign(player, {
        health: Math.min(previous.health, player.maxHealth),
        mp: Math.min(previous.mp, player.maxMp),
        hasAnswered: previous.hasAnswered,
        currentAnswer: previous.currentAnswer,
        lastAnswerCorrect: previous.lastAnswerCorrect,
        isDead: previous.isDead,
        threat: previous.threat,
      });
    }
    upgraded.currentPhase = old.currentPhase;
    upgraded.currentQuestionIndex = Math.min(
      old.currentQuestionIndex,
      room.fight.questions.length - 1,
    );
    upgraded.questionStartTime = old.questionStartTime;
    upgraded.phaseStartTime = old.phaseStartTime;
    upgraded.enemies = old.enemies.map((e: any) => ({ ...e, effects: [] }));
    if (old.currentPhase === "question")
      upgraded.phaseDeadline =
        (old.questionStartTime || Date.now()) +
        room.fight.questions[upgraded.currentQuestionIndex].timeLimit * 1000;
    if (old.currentPhase === "game_over") {
      upgraded.victory = false;
      upgraded.endReason =
        "Previous fight completed before the combat migration";
      room.resultsPersisted = true;
    }
    room.snapshot = upgraded;
    room.receipts = [];
    await this.save(room);
    await this.syncAlarm(room);
    return room;
  }
  private async save(room: StoredRoom) {
    await this.state.storage.put(ROOM_KEY, room);
  }
  private async syncAlarm(room: StoredRoom) {
    if (room.snapshot.phaseDeadline)
      await this.state.storage.setAlarm(room.snapshot.phaseDeadline);
    else if (
      room.snapshot.currentPhase === "game_over" &&
      !room.resultsPersisted
    )
      await this.state.storage.setAlarm(Date.now() + 5000);
    else await this.state.storage.deleteAlarm();
  }
  private snapshotMessage(room: StoredRoom) {
    const question = room.fight.questions[room.snapshot.currentQuestionIndex];
    const { correctAnswer: _, ...safe } = question;
    if (room.fight.shuffleOptions && safe.options)
      safe.options = deterministicShuffle(
        safe.options,
        `${room.snapshot.sessionId}:${room.snapshot.round}`,
      );
    return {
      type: "combat_state",
      state: publicSnapshot(room.snapshot),
      question: [
        "question",
        "actions",
        "abilities",
        "question_resolution",
        "enemy_ai",
      ].includes(room.snapshot.currentPhase)
        ? safe
        : null,
      serverTime: Date.now(),
      results: room.results?.map((r: any) => ({
        studentId: r.studentId,
        id: r.id,
        xpEarned: r.xpEarned,
        baseXp: r.baseXp,
        xpMultiplier: r.xpMultiplier,
        staminaFightNumber: r.staminaFightNumber,
        goldReward: r.goldReward,
        lootTable: r.lootTable,
      })),
    };
  }
  private async publish(room: StoredRoom) {
    this.broadcast(this.snapshotMessage(room));
    if (room.snapshot.currentPhase === "game_over")
      this.broadcast({
        type: "game_over",
        victory: room.snapshot.victory,
        message: room.snapshot.endReason,
        results: room.results,
      });
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname === "/ready" &&
      request.headers.get("x-questacademy-internal") === "1"
    )
      return Response.json({ status: "ready" });
    if (request.headers.get("x-questacademy-internal") !== "1")
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (url.pathname === "/throttle")
      return this.serialized(async () => {
        const now = Date.now();
        const bucket = (await this.state.storage.get<{
          start: number;
          count: number;
        }>("rate")) || { start: now, count: 0 };
        if (now - bucket.start > 60000) {
          bucket.start = now;
          bucket.count = 0;
        }
        bucket.count++;
        await this.state.storage.put("rate", bucket);
        return Response.json(
          {
            allowed:
              bucket.count <=
              Math.min(
                200,
                Number(request.headers.get("x-questacademy-rate-limit")) || 20,
              ),
          },
          {
            status:
              bucket.count <=
              Math.min(
                200,
                Number(request.headers.get("x-questacademy-rate-limit")) || 20,
              )
                ? 200
                : 429,
          },
        );
      });
    if (url.pathname === "/force-question")
      return this.serialized(async () => {
        const room = await this.room();
        if (!room)
          return Response.json({ error: "Room unavailable" }, { status: 404 });
        const live = await this.repository!.findLiveCombatSession(
          room.snapshot.sessionId,
        );
        if (live?.teacherId !== request.headers.get("x-questacademy-actor-id"))
          return Response.json({ error: "Forbidden" }, { status: 403 });
        if (
          room.snapshot.currentPhase === "waiting" ||
          room.snapshot.currentPhase === "game_over"
        )
          return Response.json(
            { error: "Fight is not active" },
            { status: 409 },
          );
        await this.advance(room);
        return Response.json({ success: true });
      });
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket")
      return Response.json(
        { error: "WebSocket upgrade required" },
        { status: 426 },
      );
    const actorId = request.headers.get("x-questacademy-actor-id"),
      role = request.headers.get("x-questacademy-role"),
      sessionId = request.headers.get("x-questacademy-session-id");
    if (
      !actorId ||
      !sessionId ||
      !["teacher", "student", "staging-smoke"].includes(role || "")
    )
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    const pair = new WebSocketPair();
    pair[1].serializeAttachment({
      actorId,
      role,
      sessionId,
      expiresAt:
        Number(request.headers.get("x-questacademy-expires-at")) || undefined,
      tokenHash: request.headers.get("x-questacademy-token-hash") || undefined,
    });
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    return this.serialized(async () => {
      let command: any;
      try {
        if (typeof message !== "string" || message.length > 16000)
          throw new Error("Text command up to 16KB required");
        const actor = ws.deserializeAttachment() as SocketAttachment;
        if (actor.expiresAt && actor.expiresAt < Date.now()) {
          ws.close(1008, "Session expired");
          return;
        }
        if (Date.now() - (actor.windowStart || 0) > 60000) {
          actor.windowStart = Date.now();
          actor.count = 0;
        }
        actor.count = (actor.count || 0) + 1;
        ws.serializeAttachment(actor);
        if (actor.count > 120)
          throw new Error("Too many commands; wait a minute");
        command = JSON.parse(message);
        if (actor.role === "staging-smoke") {
          if (command.type === "ping")
            this.send(ws, {
              type: "pong",
              commandId: command.commandId,
              role: "staging-smoke",
            });
          return;
        }
        if (!actor.tokenHash) {
          // Old socket attachments predate session revocation checks. A normal
          // reconnect authenticates their existing cookie and upgrades them.
          ws.close(1012, "Reconnect to verify session");
          return;
        }
        const session = await this.repository?.findActiveSession(actor.tokenHash, new Date());
        if (!session || session.actorId !== actor.actorId || session.actorType !== actor.role) {
          ws.close(1008, "Session expired or revoked");
          return;
        }
        if (
          typeof command.commandId !== "string" ||
          !/^[A-Za-z0-9_-]{8,100}$/.test(command.commandId)
        )
          throw new Error("Valid commandId required");
        if (!this.repository) throw new Error("Repository unavailable");
        const key = actor.actorId + ":" + command.commandId;
        let room = await this.room();
        if (command.type === "host") {
          if (actor.role !== "teacher")
            throw new Error("Teacher role required");
          const live = await this.repository.findLiveCombatSession(
            actor.sessionId,
          );
          if (
            !live ||
            live.teacherId !== actor.actorId ||
            live.status === "superseded"
          )
            throw new Error("Session unavailable");
          if (!room) {
            const fight = await this.repository.findFightById(live.fightId);
            if (!fight) throw new Error("Fight unavailable");
            if (fight.randomizeQuestions)
              fight.questions = deterministicShuffle(
                fight.questions,
                actor.sessionId,
              );
            room = {
              fight,
              snapshot: initialCombatState(actor.sessionId, fight),
              receipts: [],
            };
            await this.save(room);
          }
          this.send(ws, {
            type: "session_created",
            sessionId: actor.sessionId,
            state: publicSnapshot(room.snapshot),
          });
          this.send(ws, this.snapshotMessage(room));
          await this.syncAlarm(room);
          return;
        }
        if (!room && command.type === "join" && actor.role === "student") {
          const live = await this.repository.findLiveCombatSession(
            actor.sessionId,
          );
          if (live?.soloStudentId === actor.actorId) {
            const fight = await this.repository.findFightById(live.fightId);
            if (fight)
              room = {
                fight,
                snapshot: initialCombatState(actor.sessionId, fight),
                receipts: [],
              };
          }
        }
        if (!room) throw new Error("Host has not opened this session");
        room.receipts ||= [];
        if (command.type === "join") {
          if (actor.role !== "student")
            throw new Error("Student role required");
          const student = await this.repository.findStudentById(actor.actorId);
          if (!student) throw new Error("Student unavailable");
          room.snapshot = addStudent(
            room.snapshot,
            student,
            await this.repository.getCombatProfile?.(student),
          );
          const live = await this.repository.findLiveCombatSession(
            actor.sessionId,
          );
          if (
            live?.soloStudentId === actor.actorId &&
            room.snapshot.currentPhase === "waiting"
          ) {
            room.snapshot = startQuestion(
              scaleEncounter(room.snapshot, room.fight, true),
              Date.now(),
              room.fight.questions[0].timeLimit,
            );
            await this.repository.updateLiveCombatSessionStatus(
              actor.sessionId,
              "active",
            );
            await this.syncAlarm(room);
          }
          await this.save(room);
          await this.publish(room);
          return;
        }
        if (room.receipts.includes(key)) {
          if (command.type === "leave_fight" && actor.role === "student") {
            this.acknowledgeLeave(ws, actor.actorId, actor.sessionId, command.commandId);
            return;
          }
          this.send(ws, {
            type: "command_ack",
            commandId: command.commandId,
            revision: room.snapshot.revision,
          });
          this.send(ws, this.snapshotMessage(room));
          return;
        }
        if (command.type === "leave_fight") {
          if (actor.role !== "student") throw new Error("Student role required");
          // Identity comes from the authenticated socket, never a supplied target.
          // Completed rosters stay intact until their rewards have been persisted.
          room.snapshot = removeStudent(room.snapshot, actor.actorId);
          room.snapshot.revision++;
          room.receipts = [...room.receipts, key].slice(-512);
          await this.save(room);
          await this.syncAlarm(room);
          this.acknowledgeLeave(ws, actor.actorId, actor.sessionId, command.commandId);
          if (["question", "actions", "abilities"].includes(room.snapshot.currentPhase) && allLivingPlayersAnswered(room.snapshot))
            await this.advance(room);
          else if (room.snapshot.currentPhase === "game_over") await this.complete(room);
          else await this.publish(room);
          return;
        }
        if (room.snapshot.currentPhase === "game_over")
          throw new Error("Fight has ended");
        if (command.type === "start_fight") {
          if (actor.role !== "teacher")
            throw new Error("Teacher role required");
          if (room.snapshot.currentPhase !== "waiting")
            throw new Error("Fight already started");
          room.snapshot = startQuestion(
            scaleEncounter(room.snapshot, room.fight),
            Date.now(),
            room.fight.questions[0].timeLimit,
          );
          await this.repository.updateLiveCombatSessionStatus(
            actor.sessionId,
            "active",
          );
        } else if (command.type === "resurrect") {
          if (actor.role !== "teacher") throw new Error("Teacher role required");
          const live = await this.repository.findLiveCombatSession(actor.sessionId);
          if (live?.teacherId !== actor.actorId || live.status === "superseded")
            throw new Error("Only the host can resurrect players");
          if (command.round !== room.snapshot.round) throw new Error("Command belongs to another round");
          if (typeof command.targetId !== "string") throw new Error("Invalid player");
          room.snapshot = resurrectPlayer(room.snapshot, command.targetId);
        } else if (command.type === "end_fight") {
          if (actor.role !== "teacher")
            throw new Error("Teacher role required");
          room.snapshot = {
            ...room.snapshot,
            currentPhase: "game_over",
            victory: false,
            endReason: "Fight ended by teacher",
            phaseDeadline: null,
          };
        } else {
          if (actor.role !== "student" || !room.snapshot.players[actor.actorId])
            throw new Error("Student participant required");
          if (command.round !== room.snapshot.round)
            throw new Error("Command belongs to another round");
          if (
            room.snapshot.phaseDeadline &&
            Date.now() >= room.snapshot.phaseDeadline
          ) {
            await this.advance(room);
            throw new Error("Phase has ended");
          }
          if (command.type === "answer") {
            if (
              room.snapshot.questionStartTime &&
              Date.now() < room.snapshot.questionStartTime
            )
              throw new Error("Question is opening");
            if (
              typeof command.answer !== "string" ||
              command.answer.length > 5000 ||
              command.questionId !==
                room.fight.questions[room.snapshot.currentQuestionIndex].id
            )
              throw new Error("Invalid or stale answer");
            room.snapshot = applyAnswer(
              room.snapshot,
              actor.actorId,
              command.answer,
              room.fight.questions[room.snapshot.currentQuestionIndex],
            );
          } else if (command.type === "action") {
            if (
              typeof command.ability !== "string" ||
              typeof command.targetId !== "string"
            )
              throw new Error("Invalid action");
            room.snapshot = selectAction(
              room.snapshot,
              actor.actorId,
              command.ability,
              command.targetId,
            );
            if (command.ready === true)
              room.snapshot = setReady(room.snapshot, actor.actorId);
          } else if (command.type === "ready")
            room.snapshot = setReady(room.snapshot, actor.actorId);
          else throw new Error("Unsupported command");
        }
        room.snapshot.revision++;
        room.receipts.push(key);
        room.receipts = room.receipts.slice(-512);
        await this.save(room);
        await this.syncAlarm(room);
        this.send(ws, {
          type: "command_ack",
          commandId: command.commandId,
          revision: room.snapshot.revision,
        });
        if (
          ["question", "actions", "abilities"].includes(room.snapshot.currentPhase) &&
          allLivingPlayersAnswered(room.snapshot)
        )
          await this.advance(room);
        else if (room.snapshot.currentPhase === "game_over")
          await this.complete(room);
        else await this.publish(room);
      } catch (error) {
        this.send(ws, {
          type: "protocol_error",
          commandId: command?.commandId,
          error: error instanceof Error ? error.message : "Invalid command",
        });
      }
    });
  }
  private async complete(room: StoredRoom) {
    try {
      if (!room.resultsPersisted) {
        if (!this.repository?.persistResults)
          throw new Error("Result persistence unavailable");
        room.results = await this.repository.persistResults(
          room.snapshot,
          room.fight,
        );
        room.resultsPersisted = true;
        await this.save(room);
      }
      await this.syncAlarm(room);
      await this.publish(room);
    } catch (error) {
      await this.state.storage.setAlarm(Date.now() + 5000);
      this.broadcast({
        type: "result_pending",
        message:
          "Fight complete. Saving results; reconnect to see your rewards.",
      });
    }
  }
  private async advance(room: StoredRoom) {
    room.snapshot = advancePhase(room.snapshot, room.fight);
    await this.save(room);
    await this.syncAlarm(room);
    if (room.snapshot.currentPhase === "game_over") await this.complete(room);
    else await this.publish(room);
  }
  async alarm() {
    return this.serialized(async () => {
      const room = await this.room();
      if (!room) return;
      if (room.snapshot.currentPhase === "game_over") {
        await this.complete(room);
        return;
      }
      if (!room.snapshot.phaseDeadline) return;
      if (Date.now() < room.snapshot.phaseDeadline) {
        await this.syncAlarm(room);
        return;
      }
      await this.advance(room);
    });
  }
  webSocketError(ws: WebSocket) {
    ws.close(1011, "WebSocket error");
  }
}
