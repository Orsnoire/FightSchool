import type { IdentityRepository } from "../db/repository.ts";
import type { FightQuestion, FightRecord } from "../db/schema.ts";
import {
  addStudent,
  advanceAfterQuestion,
  allLivingPlayersAnswered,
  applyAnswer,
  initialCombatState,
  startQuestion,
  type CombatSnapshot,
} from "./engine.ts";

interface CombatEnv {
  DATABASE_URL: string;
}

interface SocketAttachment {
  actorId: string;
  role: "teacher" | "student" | "staging-smoke";
  sessionId: string;
}

interface StoredRoom {
  fight: FightRecord;
  snapshot: CombatSnapshot;
}

const ROOM_KEY = "room";
const COMMAND_PREFIX = "command:";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
  });
}

function publicQuestion(question: FightQuestion) {
  const { correctAnswer: _, ...safe } = question;
  return safe;
}

function publicSnapshot(snapshot: CombatSnapshot): CombatSnapshot {
  return {
    ...snapshot,
    players: Object.fromEntries(Object.entries(snapshot.players).map(([id, player]) => [
      id,
      { ...player, currentAnswer: null, lastAnswerCorrect: undefined },
    ])),
  };
}

export class CombatSessionObject {
  private repository: IdentityRepository | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: CombatEnv,
  ) {}

  setRepository(repository: IdentityRepository) {
    this.repository = repository;
  }

  private broadcast(message: unknown) {
    const body = JSON.stringify(message);
    for (const socket of this.state.getWebSockets()) {
      try { socket.send(body); } catch { /* stale hibernated socket */ }
    }
  }

  private async room(): Promise<StoredRoom | undefined> {
    return this.state.storage.get<StoredRoom>(ROOM_KEY);
  }

  private async save(room: StoredRoom): Promise<void> {
    await this.state.storage.put(ROOM_KEY, room);
  }

  private async scheduleQuestion(room: StoredRoom): Promise<void> {
    const question = room.fight.questions[room.snapshot.currentQuestionIndex];
    await this.state.storage.setAlarm(Date.now() + question.timeLimit * 1000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ready" && request.headers.get("x-questacademy-internal") === "1") {
      return json({ status: "ready" });
    }
    if (
      request.headers.get("x-questacademy-internal") !== "1"
      || request.headers.get("upgrade")?.toLowerCase() !== "websocket"
    ) return json({ error: "WebSocket upgrade required" }, 426);

    const actorId = request.headers.get("x-questacademy-actor-id");
    const role = request.headers.get("x-questacademy-role");
    const sessionId = request.headers.get("x-questacademy-session-id");
    if (!actorId || !sessionId || !["teacher", "student", "staging-smoke"].includes(role || "")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.serializeAttachment({
      actorId,
      role: role as SocketAttachment["role"],
      sessionId,
    } satisfies SocketAttachment);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") {
      webSocket.send(JSON.stringify({ type: "protocol_error", error: "Text messages only" }));
      return;
    }
    const attachment = webSocket.deserializeAttachment() as SocketAttachment;
    try {
      const command = JSON.parse(message) as {
        type?: string;
        commandId?: string;
        answer?: string;
      };
      if (attachment.role === "staging-smoke" && command.type === "ping" && typeof command.commandId === "string") {
        webSocket.send(JSON.stringify({ type: "pong", commandId: command.commandId, role: "staging-smoke" }));
        return;
      }
      if (!command.commandId || !/^[A-Za-z0-9_-]{8,100}$/.test(command.commandId)) {
        webSocket.send(JSON.stringify({ type: "protocol_error", error: "Valid commandId required" }));
        return;
      }
      const idempotencyKey = COMMAND_PREFIX + attachment.actorId + ":" + command.commandId;
      if (await this.state.storage.get(idempotencyKey)) return;
      await this.state.storage.put(idempotencyKey, true);

      if (!this.repository) throw new Error("Repository unavailable");
      let room = await this.room();
      if (command.type === "host") {
        if (attachment.role !== "teacher") throw new Error("Teacher role required");
        const live = await this.repository.findLiveCombatSession(attachment.sessionId);
        if (!live || live.teacherId !== attachment.actorId || live.status === "superseded") {
          throw new Error("Session unavailable");
        }
        if (!room) {
          const fight = await this.repository.findFightById(live.fightId);
          if (!fight) throw new Error("Fight unavailable");
          room = { fight, snapshot: initialCombatState(attachment.sessionId, fight) };
          await this.save(room);
        }
        webSocket.send(JSON.stringify({
          type: "session_created",
          sessionId: attachment.sessionId,
          state: publicSnapshot(room.snapshot),
        }));
        return;
      }

      if (!room) throw new Error("Host has not opened this session");
      if (command.type === "join") {
        if (attachment.role !== "student") throw new Error("Student role required");
        const student = await this.repository.findStudentById(attachment.actorId);
        if (!student) throw new Error("Student unavailable");
        room.snapshot = addStudent(room.snapshot, student);
        await this.save(room);
        this.broadcast({ type: "combat_state", state: publicSnapshot(room.snapshot) });
        if (room.snapshot.currentPhase === "question") {
          const question = room.fight.questions[room.snapshot.currentQuestionIndex];
          webSocket.send(JSON.stringify({
            type: "question",
            question: publicQuestion(question),
            shuffleOptions: room.fight.shuffleOptions,
          }));
        }
        return;
      }

      if (command.type === "start_fight") {
        if (attachment.role !== "teacher") throw new Error("Teacher role required");
        room.snapshot = startQuestion(room.snapshot);
        await this.repository.updateLiveCombatSessionStatus(attachment.sessionId, "active");
        await this.save(room);
        await this.scheduleQuestion(room);
        this.broadcast({ type: "combat_state", state: publicSnapshot(room.snapshot) });
        this.broadcast({
          type: "question",
          question: publicQuestion(room.fight.questions[room.snapshot.currentQuestionIndex]),
          shuffleOptions: room.fight.shuffleOptions,
        });
        return;
      }

      if (command.type === "answer") {
        if (attachment.role !== "student" || typeof command.answer !== "string" || command.answer.length > 5_000) {
          throw new Error("Invalid answer");
        }
        const question = room.fight.questions[room.snapshot.currentQuestionIndex];
        room.snapshot = applyAnswer(room.snapshot, attachment.actorId, command.answer, question);
        await this.save(room);
        this.broadcast({ type: "combat_state", state: publicSnapshot(room.snapshot) });
        if (allLivingPlayersAnswered(room.snapshot)) await this.advance(room);
        return;
      }

      if (command.type === "end_fight") {
        if (attachment.role !== "teacher") throw new Error("Teacher role required");
        room.snapshot = { ...room.snapshot, currentPhase: "game_over", phaseStartTime: Date.now() };
        await this.save(room);
        await this.state.storage.deleteAlarm();
        await this.repository.updateLiveCombatSessionStatus(attachment.sessionId, "completed");
        this.broadcast({ type: "game_over", victory: false, message: "Fight ended by teacher" });
        return;
      }
      throw new Error("Unsupported command");
    } catch (error) {
      webSocket.send(JSON.stringify({
        type: "protocol_error",
        error: error instanceof Error ? error.message : "Invalid command",
      }));
    }
  }

  private async advance(room: StoredRoom) {
    room.snapshot = advanceAfterQuestion(room.snapshot, room.fight.questions);
    await this.save(room);
    if (room.snapshot.currentPhase === "game_over") {
      if (this.repository) await this.repository.updateLiveCombatSessionStatus(room.snapshot.sessionId, "completed");
      this.broadcast({ type: "combat_state", state: publicSnapshot(room.snapshot) });
      this.broadcast({ type: "game_over", victory: true, message: "Fight complete" });
      return;
    }
    await this.scheduleQuestion(room);
    this.broadcast({ type: "combat_state", state: publicSnapshot(room.snapshot) });
    this.broadcast({
      type: "question",
      question: publicQuestion(room.fight.questions[room.snapshot.currentQuestionIndex]),
      shuffleOptions: room.fight.shuffleOptions,
    });
  }

  async alarm() {
    const room = await this.room();
    if (room?.snapshot.currentPhase === "question") await this.advance(room);
  }

  webSocketError(webSocket: WebSocket) {
    webSocket.close(1011, "WebSocket error");
  }
}
