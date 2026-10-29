import { studentCanAccessSession } from "../services/combat-access";
import { maintenanceResponse, releaseState, resumeRoomClocks, type ReleaseEnv } from '../release/maintenance';
import type { StoredRoom } from "./room-state";
import { recoverRoom } from "./room-recovery";
import { saveRoom, completeRoom, roomAlarmAt } from "./room-persistence";
import { publicResults, snapshotMessage } from "./room-messages";
import { acknowledgePlayback, rendererKey } from "./playback-gate";
import { isResolution } from "../../shared/combat/presentation";
import { CombatRuleError } from "../../shared/combat/errors";
import { diagnostic } from "../diagnostics";
import type { CombatCommand } from "../../shared/contracts/combat";
import { assertCommandText, decodeCommandText, parseCombatCommand, applyStudentCommand } from "./commands";
import { publicSnapshot } from "./public-snapshot";
export { publicSnapshot } from "./public-snapshot";
import { handleCombatSessions } from "../routes/combat-sessions.ts";
import { instanceLoot } from "../../shared/combat/instance-loot";
import type { IdentityRepository } from "../db/repository.ts";
import { addStudent, removeStudent } from "./participants";
import { allLivingPlayersAnswered } from "./choices";
import { initialCombatState, startQuestion, scaleEncounter } from "./encounter-setup";
import { advancePhase } from "./phases";
import { resurrectPlayer, eliminateEnemy, nextWave, endFight } from "./host-controls";
import { deterministicShuffle } from "./random";
interface CombatEnv extends ReleaseEnv {
  DATABASE_URL: string;
  SESSION_COOKIE_NAME?: string;
  SESSION_SECRET?: string;
  SESSION_TTL_SECONDS?: string;
}
interface SocketAttachment {
  actorId: string;
  role: "teacher" | "student" | "staging-smoke";
  sessionId: string;
  requestId?: string;
  expiresAt?: number;
  tokenHash?: string;
  windowStart?: number;
  count?: number;
}
const ROOM_KEY = "room";
export class CombatSessionObject {
  private repository: IdentityRepository | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  // Volatile delivery hints only: hibernation/reconnect always permits a full send.
  private delivered = new WeakMap<WebSocket, { state?: string; end?: string }>();
  private commandCosts: { repositoryCalls:number; repositoryMs:number; storageReads:number; storageReadMs:number; checkpointCount:number; checkpointMs:number } | null = null;
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: CombatEnv,
  ) {}
  setRepository(repository: IdentityRepository) {
    this.repository = new Proxy(repository, {
      get: (target, key) => {
        const value = Reflect.get(target, key);
        if (typeof value !== "function") return value;
        return async (...args:unknown[]) => {
          const costs=this.commandCosts, started=performance.now();
          if(costs)costs.repositoryCalls++;
          try { return await value.apply(target,args); }
          finally { if(costs)costs.repositoryMs+=performance.now()-started; }
        };
      },
    });
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
  private sendEncoded(ws:WebSocket, encoded:string):boolean {
    try { ws.send(encoded); return true; } catch { return false; }
  }
  private broadcast(message: unknown) {
    const encoded=JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) this.sendEncoded(ws, encoded);
  }
  private acknowledgeLeave(ws: WebSocket, actorId: string, sessionId: string, commandId: string) {
    for (const socket of new Set([ws, ...this.state.getWebSockets()])) {
      const attachment = socket.deserializeAttachment() as SocketAttachment;
      if (attachment.role !== "student" || attachment.actorId !== actorId) continue;
      this.send(socket, { type: "fight_left", sessionId, commandId });
      try { socket.close(1000, "Left fight"); } catch {}
    }
  }
  private notifyStudent(actorId: string, message: unknown, close = false) {
    for (const socket of this.state.getWebSockets()) {
      const actor = socket.deserializeAttachment() as SocketAttachment;
      if (actor.role !== "student" || actor.actorId !== actorId) continue;
      this.send(socket, message);
      if (close) try { socket.close(1000, "Fight membership changed"); } catch {}
    }
  }
  private async room() {

    const readStarted=performance.now(), costs=this.commandCosts;
    let room:StoredRoom|undefined;
    try { room=await this.state.storage.get<StoredRoom>(ROOM_KEY); }
    finally { if(costs){costs.storageReads++;costs.storageReadMs+=performance.now()-readStarted;} }
    if (!room) return room;
    if (resumeRoomClocks(room, releaseState(this.env).windows)) {
      await this.checkpoint(room);
      await this.syncAlarm(room);
    }
    return recoverRoom(room, {
      repository: this.repository, save: room => this.save(room), syncAlarm: room => this.syncAlarm(room),
    });
  }
  private async checkpoint(room: StoredRoom) {
    const startedAt=performance.now();
    try { await this.state.storage.put(ROOM_KEY, room); }
    catch(error) { diagnostic({event:'combat_checkpoint',roomId:room.snapshot.sessionId,revision:room.snapshot.revision,durationMs:performance.now()-startedAt,outcome:'failed'});throw error; }
    finally { if(this.commandCosts){this.commandCosts.checkpointCount++;this.commandCosts.checkpointMs+=performance.now()-startedAt;} }
    diagnostic({event:'combat_checkpoint',roomId:room.snapshot.sessionId,revision:room.snapshot.revision,durationMs:performance.now()-startedAt,outcome:'ok'});
  }
  private activeRenderers(room:StoredRoom) {
    return [...new Set(this.state.getWebSockets().filter(ws=>ws.readyState!==3).flatMap(ws=>{
      const a=ws.deserializeAttachment() as SocketAttachment;
      if(a.sessionId!==room.snapshot.sessionId || (a.expiresAt&&a.expiresAt<Date.now()))return [];
      if(a.role==='teacher'&&a.actorId===room.fight.teacherId || a.role==='student'&&room.snapshot.players[a.actorId])return [rendererKey(a.role,a.actorId)];
      return [];
    }))];
  }
  private async save(room: StoredRoom, flushReporting = false) {
    return saveRoom(room, {
      repository: this.repository, checkpoint: room => this.checkpoint(room),
      checkpointed: room.fight.campaignContext ? room => this.publish(room) : undefined,
      syncAlarm: room => this.syncAlarm(room), activeRenderers: room => this.activeRenderers(room),
    }, flushReporting);
  }
  private async syncAlarm(room: StoredRoom) {
    const deadline = roomAlarmAt(room);
    if (deadline !== null) await this.state.storage.setAlarm(deadline);
    else await this.state.storage.deleteAlarm();
  }
  private async publish(room: StoredRoom) {
    if (room.snapshot.currentPhase === "game_over") for (const [id, request] of Object.entries(room.removals || {})) {
      if (request.requestedAt) this.notifyStudent(id, { type: "join_status", status: "ended", sessionId: room.snapshot.sessionId }, true);
    }
    const started=performance.now();
    const projectedState = publicSnapshot(room.snapshot, room.fight);
    const encodedByRole=new Map<string,{signature:string;encoded:string;bytes:number}>();
    const end=room.snapshot.currentPhase==='game_over'
      ? JSON.stringify({type:'game_over',victory:room.snapshot.victory,message:room.snapshot.endReason,results:publicResults(room)}) : undefined;
    const endBytes=end ? new TextEncoder().encode(end).byteLength : 0;
    let messages=0,bytes=0,skipped=0,failures=0;
    for (const ws of this.state.getWebSockets()) {
      const actor = ws.deserializeAttachment() as SocketAttachment;
      if (actor.role !== "teacher" && (actor.role !== "student" || (!room.snapshot.players[actor.actorId] && !room.snapshot.pendingPlayers?.[actor.actorId]))) {
        this.delivered.delete(ws);continue;
      }
      let payload=encodedByRole.get(actor.role);
      if(!payload){
        // Timestamp alone is not a state change. Encode the full public content
        // once per role, including same-revision moderation/result updates.
        const message=snapshotMessage(room,actor.role,projectedState);
        const signature=JSON.stringify({...message,serverTime:undefined});
        const encoded=signature.slice(0,-1)+',"serverTime":'+Date.now()+'}';
        payload={signature,encoded,bytes:new TextEncoder().encode(encoded).byteLength};
        encodedByRole.set(actor.role,payload);
      }
      const previous=this.delivered.get(ws)||{};
      if(previous.state!==payload.signature){
        if(this.sendEncoded(ws,payload.encoded)){previous.state=payload.signature;messages++;bytes+=payload.bytes;}else failures++;
      }else skipped++;
      if(end && previous.end!==end){
        if(this.sendEncoded(ws,end)){previous.end=end;messages++;bytes+=endBytes;}else failures++;
      }
      this.delivered.set(ws,previous);
    }
    diagnostic({event:'combat_publish',roomId:room.snapshot.sessionId,revision:room.snapshot.revision,
      durationMs:performance.now()-started,encodedMessages:encodedByRole.size+(end?1:0),messages,bytes,skipped,failures,outcome:failures?'failed':'ok'});
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/release-probe' && this.env.RELEASE_PROBE &&
      request.headers.get('x-questacademy-release-probe') === this.env.RELEASE_PROBE) {
      return this.serialized(async () => {
        const room = await this.state.storage.get<StoredRoom>(ROOM_KEY);
        const bytes = new TextEncoder().encode(JSON.stringify(room ?? null));
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
        return Response.json({ ...releaseState(this.env), source: this.env.RELEASE_SHA, digest });
      });
    }
    if (releaseState(this.env).paused) return maintenanceResponse();
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
    if (request.method === "POST" && /^\/api\/fights\/[0-9a-f-]+\/sessions$/i.test(url.pathname))
      return this.serialized(async () => (await handleCombatSessions(request, url, this.repository!, {
        cookieName: this.env.SESSION_COOKIE_NAME!, secret: this.env.SESSION_SECRET!,
        ttlSeconds: Number(this.env.SESSION_TTL_SECONDS),
      }, this.env.DATABASE_URL))!);
    if (request.method === "POST" && url.pathname === "/end")
      return this.serialized(async () => {
        const sessionId = request.headers.get("x-questacademy-session-id") || "";
        const live = await this.repository!.findLiveCombatSession(sessionId);
        if (!live || live.teacherId !== request.headers.get("x-questacademy-actor-id") || live.soloStudentId)
          return Response.json({ error: "Forbidden" }, { status: 403 });
        if (live.status === "superseded") return Response.json({ error: "Session unavailable" }, { status: 409 });
        const room = await this.room();
        if (!room) {
          // A launch can be abandoned before its first host socket opens.
          if (live.status !== "waiting" && live.status !== "completed")
            return Response.json({ error: "Active room unavailable; try again" }, { status: 503 });
          await this.repository!.updateLiveCombatSessionStatus(sessionId, "completed");
          return Response.json({ success: true });
        }
        if (room.snapshot.currentPhase !== "game_over") {
          room.snapshot = { ...endFight(room.snapshot),
            revision: room.snapshot.revision + 1 };
          await this.save(room);
        }
        await this.complete(room);
        return Response.json({ success: !!room.resultsPersisted }, { status: room.resultsPersisted ? 200 : 503 });
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
      requestId: request.headers.get("x-request-id") || undefined,
      tokenHash: request.headers.get("x-questacademy-token-hash") || undefined,
    });
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (releaseState(this.env).paused) {
      this.send(ws, { type: 'error', message: 'QuestAcademy is being updated. Please reconnect shortly.' });
      try { ws.close(1012, 'Service update'); } catch {}
      return;
    }
    const queuedAt=performance.now();
    const requestId=crypto.randomUUID();
    return this.serialized(async () => {
      const startedAt=performance.now();
      const context=ws.deserializeAttachment() as SocketAttachment;
      let room:StoredRoom|undefined;
      let outcome:'ok'|'rejected'|'failed'='ok';
      let command: CombatCommand | undefined;
      const costs={repositoryCalls:0,repositoryMs:0,storageReads:0,storageReadMs:0,checkpointCount:0,checkpointMs:0};
      this.commandCosts=costs;
      try {
        assertCommandText(message);
        const actor = ws.deserializeAttachment() as SocketAttachment;
        if (actor.expiresAt && actor.expiresAt < Date.now()) {
          outcome="rejected";
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
          throw new CombatRuleError("Too many commands; wait a minute");
        const rawCommand = decodeCommandText(message);
        if (actor.role === "staging-smoke") {
          if (rawCommand && typeof rawCommand === "object" && "type" in rawCommand && rawCommand.type === "ping")
            this.send(ws, {
              type: "pong",
              commandId: "commandId" in rawCommand && typeof rawCommand.commandId === "string" ? rawCommand.commandId.slice(0,100) : undefined,
              role: "staging-smoke",
            });
          return;
        }
        if (!actor.tokenHash) {
          // Old socket attachments predate session revocation checks. A normal
          // reconnect authenticates their existing cookie and upgrades them.
          outcome="rejected";
          ws.close(1012, "Reconnect to verify session");
          return;
        }
        const session = await this.repository?.findActiveSession(actor.tokenHash, new Date());
        if (!session || session.actorId !== actor.actorId || session.actorType !== actor.role) {
          outcome="rejected";
          ws.close(1008, "Session expired or revoked");
          return;
        }
        command = parseCombatCommand(rawCommand);
        if (!this.repository) throw new CombatRuleError("Repository unavailable");
        const key = actor.actorId + ":" + command.commandId;
        room = await this.room();
        if (command.type === "host") {
          if (actor.role !== "teacher")
            throw new CombatRuleError("Teacher role required");
          const live = await this.repository.findLiveCombatSession(
            actor.sessionId,
          );
          if (
            !live ||
            live.teacherId !== actor.actorId ||
            live.status === "superseded"
          )
            throw new CombatRuleError("Session unavailable");
          if (!room && live.status === "completed") throw new CombatRuleError("Fight has ended");
          if (!room) {
            const fight = this.repository.findCombatFight ? await this.repository.findCombatFight(actor.sessionId, live.fightId) : await this.repository.findFightById(live.fightId);
            if (!fight) throw new CombatRuleError("Fight unavailable");
            if (!fight.campaignContext) fight.lootTable = instanceLoot(fight.lootTable, actor.sessionId);
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
          const projectedState = publicSnapshot(room.snapshot, room.fight);
          this.send(ws, {
            type: "session_created",
            sessionId: actor.sessionId,
            state: projectedState,
          });
          this.send(ws, snapshotMessage(room, actor.role, projectedState));
          await this.syncAlarm(room);
          return;
        }
        if (!room && command.type === "join" && actor.role === "student") {
          const live = await this.repository.findLiveCombatSession(
            actor.sessionId,
          );
          if (live?.soloStudentId && ["waiting", "active"].includes(live.status) && await studentCanAccessSession(this.repository, live, actor.actorId)) {
            const fight = this.repository.findCombatFight ? await this.repository.findCombatFight(actor.sessionId, live.fightId) : await this.repository.findFightById(live.fightId);
            if (fight) {
              if (!fight.campaignContext) fight.lootTable = instanceLoot(fight.lootTable, actor.sessionId);
              if(fight.randomizeQuestions)fight.questions=deterministicShuffle(fight.questions,actor.sessionId);
              room = {
                fight,
                snapshot: initialCombatState(actor.sessionId, fight),
                receipts: [],
              };
            }
          }
        }
        if (!room) throw new CombatRuleError("Host has not opened this session");
        room.receipts ||= [];
        if (command.type === "leave_fight" && actor.role !== "student") throw new CombatRuleError("Student role required");
        if (actor.role === "teacher") {
          const live = await this.repository.findLiveCombatSession(actor.sessionId);
          if (live?.teacherId !== actor.actorId || live.status === "superseded") throw new CombatRuleError("Only the host can manage this fight");
        }
        if (command.type === "join") {
          if (actor.role !== "student")
            throw new CombatRuleError("Student role required");
          if (room.snapshot.currentPhase === "game_over" && !room.snapshot.players[actor.actorId] && !room.snapshot.pendingPlayers?.[actor.actorId]) throw new CombatRuleError("Fight has ended");
          const live = await this.repository.findLiveCombatSession(actor.sessionId);
          if (live && !(await studentCanAccessSession(this.repository, live, actor.actorId)))
            throw new CombatRuleError("Join the hosting guild before entering this fight.");
          if (live?.soloStudentId && room.snapshot.soloHostId !== live.soloStudentId) {
            room.snapshot.soloHostId = live.soloStudentId;
            await this.save(room);
          }
          const removal = room.removals?.[actor.actorId];
          if (removal) {
            if (removal.blocked) {
              this.send(ws, { type: "join_status", status: "blocked", sessionId: actor.sessionId });
              return;
            }
            if (!removal.requestedAt && removal.deniedAt && Date.now() - removal.deniedAt < 30000) {
              this.send(ws, { type: "join_status", status: "denied", sessionId: actor.sessionId });
              return;
            }
            if (!removal.requestedAt) {
              removal.requestedAt = Date.now();
              room.snapshot.revision++;
              await this.save(room);
            }
            this.send(ws, { type: "join_status", status: "pending", sessionId: actor.sessionId });
            await this.publish(room);
            return;
          }
          const established=room.snapshot.players[actor.actorId] || room.snapshot.pendingPlayers?.[actor.actorId];
          if(established && room.snapshot.currentPhase!=="waiting") {
            this.send(ws,snapshotMessage(room,actor.role));
            return;
          }
          // Waiting solo rooms may still need their automatic start below.
          // Established lobby participants retain their frozen entry profile.
          const student = established ? null : await this.repository.findStudentById(actor.actorId);
          if (!established) {
            if (!student) throw new CombatRuleError("Student unavailable");
            room.snapshot = addStudent(room.snapshot, student, await this.repository.getCombatProfile?.(student,live || actor.sessionId));
          }
          if(established && !live?.soloStudentId) {
            this.send(ws,snapshotMessage(room,actor.role));return;
          }
          if (
            live?.soloStudentId &&
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
            if (room.snapshot.currentPhase === "game_over" && !room.resultsPersisted) await this.complete(room);
            this.acknowledgeLeave(ws, actor.actorId, actor.sessionId, command.commandId);
            return;
          }
          this.send(ws, {
            type: "command_ack",
            commandId: command.commandId,
            revision: room.snapshot.revision,
          });
          this.send(ws, snapshotMessage(room, actor.role));
          return;
        }
        if (command.type === "leave_fight") {
          if (actor.role !== "student") throw new CombatRuleError("Student role required");
          // Identity comes from the authenticated socket, never a supplied target.
          // Completed rosters stay intact until their rewards have been persisted.
          const live = await this.repository.findLiveCombatSession(actor.sessionId);
          const soloHostExit = live?.soloStudentId === actor.actorId &&
            !!room.snapshot.players[actor.actorId] && room.snapshot.currentPhase !== "waiting";
          room.snapshot = soloHostExit
            ? endFight(room.snapshot, "Solo fight ended by student")
            : removeStudent(room.snapshot, actor.actorId);
          if (room.removals?.[actor.actorId]) room.removals[actor.actorId].requestedAt = undefined;
          room.snapshot.revision++;
          room.receipts = [...room.receipts, key].slice(-512);
          await this.save(room);
          await this.syncAlarm(room);
          // Save earned solo results before dashboard navigation; failed SQL remains
          // in the durable completion outbox and retries without a second award.
          if (soloHostExit) await this.complete(room);
          this.acknowledgeLeave(ws, actor.actorId, actor.sessionId, command.commandId);
          if (soloHostExit) return;
          if (["question", "actions", "abilities"].includes(room.snapshot.currentPhase) && allLivingPlayersAnswered(room.snapshot))
            await this.advance(room);
          else if (room.snapshot.currentPhase === "game_over") await this.complete(room);
          else if(!await this.finishPlayback(room)) await this.publish(room);
          return;
        }
        if(command.type === 'playback_complete') {
          if(actor.role==='student'&&!room.snapshot.players[actor.actorId])throw new CombatRuleError('Student participant required');
          // Late acknowledgements are harmless after overrides, reconnect or phase advancement.
          if(room.playbackGate && command.round===room.snapshot.round && command.batchId===room.snapshot.playback?.id) {
            acknowledgePlayback(room.playbackGate,command.batchId,rendererKey(actor.role,actor.actorId));
            await this.checkpoint(room);
          }
          this.send(ws,{type:'command_ack',commandId:command.commandId,revision:room.snapshot.revision});
          await this.finishPlayback(room);
          return;
        }
        if (room.snapshot.currentPhase === "game_over")
          throw new CombatRuleError("Fight has ended");
        if (command.type === "remove_player" || command.type === "review_rejoin") {
          if (actor.role !== "teacher") throw new CombatRuleError("Teacher role required");
          const id = command.targetId;
          if (typeof id !== "string") throw new CombatRuleError("Invalid player");
          if (command.type === "remove_player") {
            const player = room.snapshot.players[id] || room.snapshot.pendingPlayers?.[id];
            if (!player) throw new CombatRuleError("Player is not in this fight");
            room.snapshot = removeStudent(room.snapshot, id);
            (room.removals ||= {})[id] = { nickname: player.nickname, blocked: false };
          } else {
            const removal = room.removals?.[id];
            if (!removal?.requestedAt || removal.blocked) throw new CombatRuleError("Rejoin request is no longer pending");
            if (!["allow", "deny", "block"].includes(command.decision)) throw new CombatRuleError("Invalid decision");
            if (command.decision === "allow") {
              const student = await this.repository.findStudentById(id);
              if (!student) throw new CombatRuleError("Student unavailable");
              room.snapshot = addStudent(room.snapshot, student);
              delete room.removals![id];
            } else {
              removal.requestedAt = undefined;
              removal.deniedAt = Date.now();
              removal.blocked = command.decision === "block";
            }
          }
        } else if (command.type === "start_fight") {
          if (actor.role !== "teacher")
            throw new CombatRuleError("Teacher role required");
          if (room.snapshot.currentPhase !== "waiting")
            throw new CombatRuleError("Fight already started");
          room.snapshot = startQuestion(
            scaleEncounter(room.snapshot, room.fight),
            Date.now(),
            room.fight.questions[0].timeLimit,
          );
          await this.repository.updateLiveCombatSessionStatus(
            actor.sessionId,
            "active",
          );
        } else if (command.type === "next_wave") {
          if (actor.role !== "teacher") throw new CombatRuleError("Teacher role required");
          if (command.round !== room.snapshot.round) throw new CombatRuleError("Command belongs to another round");
          if (command.phase !== room.snapshot.currentPhase) throw new CombatRuleError("Phase has changed; try again");
          room.snapshot = nextWave(room.snapshot, room.fight);
        } else if (command.type === "eliminate_enemy") {
          if (actor.role !== "teacher") throw new CombatRuleError("Teacher role required");
          if (command.round !== room.snapshot.round) throw new CombatRuleError("Command belongs to another round");
          if (typeof command.targetId !== "string" || command.targetId.length > 220) throw new CombatRuleError("Invalid enemy");
          room.snapshot = eliminateEnemy(room.snapshot, command.targetId);
          delete room.snapshot.playback;
        } else if (command.type === "resurrect") {
          if (actor.role !== "teacher") throw new CombatRuleError("Teacher role required");
          const live = await this.repository.findLiveCombatSession(actor.sessionId);
          if (live?.teacherId !== actor.actorId || live.status === "superseded")
            throw new CombatRuleError("Only the host can resurrect players");
          if (command.round !== room.snapshot.round) throw new CombatRuleError("Command belongs to another round");
          if (typeof command.targetId !== "string") throw new CombatRuleError("Invalid player");
          room.snapshot = resurrectPlayer(room.snapshot, command.targetId);
          delete room.snapshot.playback;
        } else if (command.type === "end_fight") {
          if (actor.role !== "teacher")
            throw new CombatRuleError("Teacher role required");
          room.snapshot = endFight(room.snapshot);
        } else {
          if (actor.role !== "student" || !room.snapshot.players[actor.actorId])
            throw new CombatRuleError("Student participant required");
          if (command.round !== room.snapshot.round)
            throw new CombatRuleError("Command belongs to another round");
          if (
            room.snapshot.phaseDeadline &&
            Date.now() >= room.snapshot.phaseDeadline
          ) {
            await this.advance(room);
            throw new CombatRuleError("Phase has ended");
          }
          room.snapshot = applyStudentCommand(room.snapshot, room.fight, actor.actorId, command, Date.now());
        }
        room.snapshot.revision++;
        room.receipts.push(key);
        room.receipts = room.receipts.slice(-512);
        await this.save(room);
        await this.syncAlarm(room);
        // Persist membership and moderation before acknowledging or closing any socket.
        if (command.type === "remove_player") this.notifyStudent(command.targetId, { type: "fight_removed", sessionId: actor.sessionId }, true);
        if (command.type === "review_rejoin" && command.decision !== "allow") this.notifyStudent(command.targetId,
          { type: "join_status", status: command.decision === "block" ? "blocked" : "denied", sessionId: actor.sessionId }, true);
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
        else if(!await this.finishPlayback(room)) await this.publish(room);
      } catch (error) {
        outcome=error instanceof CombatRuleError?"rejected":"failed";
        this.send(ws, {
          type: "protocol_error",
          commandId: command?.commandId,
          error: error instanceof CombatRuleError ? error.message : "Unable to process command",
        });
      } finally {
        diagnostic({event:'combat_command',requestId:context.requestId||requestId,roomId:context.sessionId,revision:room?.snapshot.revision,queueMs:startedAt-queuedAt,durationMs:performance.now()-startedAt,...costs,outcome});
        this.commandCosts=null;
      }
    });
  }
  private async complete(room: StoredRoom) {
    return completeRoom(room, {
      repository: this.repository, save: room => this.save(room), syncAlarm: room => this.syncAlarm(room),
      publish: room => this.publish(room), scheduleRetry: () => this.state.storage.setAlarm(Date.now() + 5000),
      broadcast: message => this.broadcast(message),
    });
  }
  private async finishPlayback(room:StoredRoom):Promise<boolean> {
    if(!isResolution(room.snapshot.currentPhase))return false;
    // A legacy room retains its old deadline until it next resolves a new batch.
    if(!room.snapshot.playback && room.snapshot.phaseDeadline)return false;
    const gate=room.playbackGate;
    if(gate) {
      const active=new Set(this.activeRenderers(room));
      gate.pending=gate.pending.filter(key=>active.has(key));
      if(gate.pending.length && Date.now()<gate.recoveryAt && room.snapshot.playback?.eventIds.length)return false;
    }
    await this.advance(room);return true;
  }
  async webSocketClose(ws:WebSocket) {
    if (releaseState(this.env).paused) return;
    return this.serialized(async()=>{
      const room=await this.room();if(!room?.playbackGate)return;
      const a=ws.deserializeAttachment() as SocketAttachment,key=rendererKey(a.role,a.actorId);
      const another=this.state.getWebSockets().some(other=>other!==ws&&other.readyState!==3&&rendererKey((other.deserializeAttachment() as SocketAttachment).role,(other.deserializeAttachment() as SocketAttachment).actorId)===key);
      if(!another)room.playbackGate.pending=room.playbackGate.pending.filter(x=>x!==key);
      await this.checkpoint(room);await this.finishPlayback(room);
    });
  }
  private async advance(room: StoredRoom) {
    room.snapshot = advancePhase(room.snapshot, room.fight);
    // Disabled players have no choice to submit. Do not strand a disabled party
    // behind either selection clock; mixed parties still wait for their choices.
    while (["actions", "abilities"].includes(room.snapshot.currentPhase) && allLivingPlayersAnswered(room.snapshot))
      room.snapshot = advancePhase(room.snapshot, room.fight);
    await this.save(room);
    await this.syncAlarm(room);
    if (room.snapshot.currentPhase === "game_over") await this.complete(room);
    else if(!await this.finishPlayback(room)) await this.publish(room);
  }
  async alarm() {
    if (releaseState(this.env).paused) {
      await this.state.storage.setAlarm(Date.now() + 30000);
      return;
    }
    return this.serialized(async () => {
      const room = await this.room();
      if (!room) return;
      if(room.evidencePending||room.reportingPending){await this.save(room,true);await this.syncAlarm(room);}
      if (room.snapshot.currentPhase === "game_over") {
        await this.complete(room);
        return;
      }
      if (await this.finishPlayback(room)) return;
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
