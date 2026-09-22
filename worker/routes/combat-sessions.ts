import { authenticateSession, type SessionConfig } from "../auth/session.ts";
import type { IdentityRepository } from "../db/repository.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
  });
}

function newSessionId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}

export async function handleCombatSessions(
  request: Request,
  url: URL,
  repository: IdentityRepository,
  sessionConfig: SessionConfig,
): Promise<Response | null> {
  const createMatch = url.pathname.match(/^\/api\/fights\/([0-9a-f-]+)\/sessions$/i);
  if (request.method === "POST" && createMatch) {
    const actor = await authenticateSession(request, repository, sessionConfig, "teacher");
    if (!actor) return json({ error: "Authentication required" }, 401);
    const fight = await repository.findFightById(createMatch[1]);
    if (!fight) return json({ error: "Fight not found" }, 404);
    if (fight.teacherId !== actor.actorId) return json({ error: "Forbidden" }, 403);
    const existing = await repository.findOpenLiveCombatSessionForFight(fight.id, actor.actorId);
    if (existing) {
      return json({ sessionId: existing.sessionId, fightId: existing.fightId, status: existing.status });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const room = await repository.createLiveCombatSession({
          sessionId: newSessionId(),
          fightId: fight.id,
          teacherId: actor.actorId,
        });
        return json({ sessionId: room.sessionId, fightId: room.fightId, status: room.status }, 201);
      } catch {
        if (attempt === 4) return json({ error: "Unable to allocate session code" }, 503);
      }
    }
  }

  const lookupMatch = url.pathname.match(/^\/api\/sessions\/([A-Z2-9]{6})$/);
  if (request.method === "GET" && lookupMatch) {
    const actor = await authenticateSession(request, repository, sessionConfig, "student");
    if (!actor) return json({ error: "Authentication required" }, 401);
    const room = await repository.findLiveCombatSession(lookupMatch[1]);
    if (!room || !["waiting", "active"].includes(room.status)) {
      return json({ error: "Session not found or has ended" }, 404);
    }
    return json({ sessionId: room.sessionId, fightId: room.fightId, status: room.status });
  }

  return null;
}
