import { gameDatabase } from "../db/game-repository.ts";
import { and, eq } from "drizzle-orm";
import {
  guilds,
  guildFights,
  guildMemberships,
  liveCombatSessions,
} from "../db/schema.ts";
import { authenticateSession, type SessionConfig } from "../auth/session.ts";
import type { IdentityRepository } from "../db/repository.ts";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function newSessionId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (value) => CODE_ALPHABET[value % CODE_ALPHABET.length],
  ).join("");
}

export async function handleCombatSessions(
  request: Request,
  url: URL,
  repository: IdentityRepository,
  sessionConfig: SessionConfig,
  databaseUrl?: string,
): Promise<Response | null> {
  const soloMatch = url.pathname.match(
    /^\/api\/fights\/([0-9a-f-]+)\/solo-sessions$/i,
  );
  if (request.method === "POST" && soloMatch && databaseUrl) {
    const actor = await authenticateSession(
      request,
      repository,
      sessionConfig,
      "student",
    );
    if (!actor) return json({ error: "Authentication required" }, 401);
    const db = gameDatabase(databaseUrl);
    const input = (await request.json()) as { guildId?: string };
    if (!input.guildId || !/^[0-9a-f-]{36}$/i.test(input.guildId))
      return json({ error: "Guild required" }, 400);
    const [assignment] = await db
      .select({ teacherId: guilds.teacherId, limitTier:guilds.limitTier })
      .from(guildFights)
      .innerJoin(guilds, eq(guilds.id, guildFights.guildId))
      .innerJoin(guildMemberships, eq(guildMemberships.guildId, guilds.id))
      .where(
        and(
          eq(guildFights.fightId, soloMatch[1]),
          eq(guildFights.guildId, input.guildId),
          eq(guildFights.soloModeEnabled, true),
          eq(guilds.isArchived, false),
          eq(guildMemberships.studentId, actor.actorId),
        ),
      );
    if (!assignment) return json({ error: "Solo fight is unavailable" }, 403);
    const [room] = await db
      .insert(liveCombatSessions)
      .values({
        sessionId: newSessionId(),
        fightId: soloMatch[1],
        teacherId: assignment.teacherId,
        soloStudentId: actor.actorId,
        guildId: input.guildId,
        guildLimitTier:assignment.limitTier,
      })
      .returning();
    return json({ sessionId: room.sessionId }, 201);
  }
  const guildLookup=url.pathname.match(/^\/api\/fights\/([0-9a-f-]+)\/host-guilds$/i);
  if(request.method==='GET'&&guildLookup&&databaseUrl){
    const actor=await authenticateSession(request,repository,sessionConfig,'teacher');
    if(!actor)return json({error:'Authentication required'},401);
    const fight=await repository.findFightById(guildLookup[1]);
    if(!fight||fight.teacherId!==actor.actorId)return json({error:'Forbidden'},403);
    return json(await gameDatabase(databaseUrl).select({id:guilds.id,name:guilds.name,limitTier:guilds.limitTier}).from(guildFights).innerJoin(guilds,eq(guilds.id,guildFights.guildId)).where(and(eq(guildFights.fightId,fight.id),eq(guilds.teacherId,actor.actorId),eq(guilds.isArchived,false))));
  }
  const createMatch = url.pathname.match(
    /^\/api\/fights\/([0-9a-f-]+)\/sessions$/i,
  );
  if (request.method === "POST" && createMatch) {
    const actor = await authenticateSession(
      request,
      repository,
      sessionConfig,
      "teacher",
    );
    if (!actor) return json({ error: "Authentication required" }, 401);
    const fight = await repository.findFightById(createMatch[1]);
    if (!fight) return json({ error: "Fight not found" }, 404);
    if (fight.teacherId !== actor.actorId)
      return json({ error: "Forbidden" }, 403);
    let guildId:string|null=null;
    let guildLimitTier:number|null=null;
    if(databaseUrl){
      let input:{guildId?:string}={};
      const body=await request.text();
      try{input=body?JSON.parse(body):{};}catch{return json({error:'Invalid request'},400);}
      const assigned=await gameDatabase(databaseUrl).select({id:guilds.id,limitTier:guilds.limitTier}).from(guildFights).innerJoin(guilds,eq(guilds.id,guildFights.guildId)).where(and(eq(guildFights.fightId,fight.id),eq(guilds.teacherId,actor.actorId),eq(guilds.isArchived,false)));
      if(input.guildId&&!assigned.some(g=>g.id===input.guildId))return json({error:'Choose an active guild assigned to this fight.'},403);
      if(!input.guildId&&assigned.length>1)return json({error:'Choose the hosting guild.'},409);
      guildId=input.guildId||assigned[0]?.id||null;
      guildLimitTier=assigned.find(g=>g.id===guildId)?.limitTier||null;
    }
    const existing = await repository.findOpenLiveCombatSessionForFight(
      fight.id,
      actor.actorId,
    );
    if (existing) {
      if(databaseUrl&&(existing.guildId||null)!==guildId)return json({error:"This fight already has an open room for another guild. End that room first."},409);
      return json({
        sessionId: existing.sessionId,
        fightId: existing.fightId,
        status: existing.status,
      });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const room = await repository.createLiveCombatSession({
          sessionId: newSessionId(),
          fightId: fight.id,
          teacherId: actor.actorId,
          ...(databaseUrl?{guildId,guildLimitTier}:{}),
        });
        return json(
          {
            sessionId: room.sessionId,
            fightId: room.fightId,
            status: room.status,
          },
          201,
        );
      } catch {
        if (attempt === 4)
          return json({ error: "Unable to allocate session code" }, 503);
      }
    }
  }

  const lookupMatch = url.pathname.match(/^\/api\/sessions\/([A-Z2-9]{6})$/);
  if (request.method === "GET" && lookupMatch) {
    const actor = await authenticateSession(
      request,
      repository,
      sessionConfig,
      "student",
    );
    if (!actor) return json({ error: "Authentication required" }, 401);
    const room = await repository.findLiveCombatSession(lookupMatch[1]);
    if (!room || !["waiting", "active"].includes(room.status)) {
      return json({ error: "Session not found or has ended" }, 404);
    }
    return json({
      sessionId: room.sessionId,
      fightId: room.fightId,
      status: room.status,
    });
  }

  return null;
}
