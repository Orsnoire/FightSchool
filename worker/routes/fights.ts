import { readJson, bodyErrorResponse } from "../http/json";
import { insertFightSchema as fightSchema } from "../../shared/contracts/fights";
import { enemyTuning } from "../../shared/encounter-tiers";
import { z } from "zod";
import { authenticateSession, type SessionConfig } from "../auth/session.ts";
import type { IdentityRepository } from "../db/repository.ts";
import type { FightRecord } from "../db/schema.ts";

const uuidSchema = z.string().uuid();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function publicFight(fight: FightRecord) {
  return {
    id: fight.id,
    teacherId: fight.teacherId,
    title: fight.title,
    guildCode: fight.guildCode,
    encounterTier: fight.encounterTier,
    isArchived: fight.isArchived,
    questions: fight.questions,
    enemies: fight.enemies,
    baseXP: fight.baseXP,
    baseEnemyDamage: fight.baseEnemyDamage,
    enemyDisplayMode: fight.enemyDisplayMode,
    lootTable: fight.lootTable,
    randomizeQuestions: fight.randomizeQuestions,
    shuffleOptions: fight.shuffleOptions,
    createdAt: fight.createdAt.getTime(),
    updatedAt: fight.updatedAt.getTime(),
  };
}

async function readFight(request: Request) {
  const fight=fightSchema.parse(await readJson(request,1_048_576));
  if(fight.enemies.some(e=>e.quantity!==undefined)){
    fight.encounterTier ||= 1;
    fight.enemies=fight.enemies.map((e,i)=>({...e,quantity:e.quantity||1,wave:e.wave||(fight.enemyDisplayMode==="consecutive"?i+1:1),role:e.role||"normal"}));
  }
  if(fight.encounterTier){
    const tier=fight.encounterTier;
    fight.enemies=fight.enemies.map(e=>({...e,difficultyMultiplier:enemyTuning(tier,e.role!).difficultyMultiplier}));
    fight.baseEnemyDamage=enemyTuning(tier,'normal').baseEnemyDamage;
  }
  return fight;
}

export async function handleFights(
  request: Request,
  url: URL,
  repository: IdentityRepository,
  sessionConfig: SessionConfig,
): Promise<Response | null> {
  const session = await authenticateSession(
    request,
    repository,
    sessionConfig,
    "teacher",
  );

  const teacherList =
    request.method === "GET" &&
    url.pathname.match(/^\/api\/teacher\/([0-9a-f-]+)\/fights$/i);
  if (teacherList) {
    if (!session) return json({ error: "Authentication required" }, 401);
    if (!uuidSchema.safeParse(teacherList[1]).success)
      return json({ error: "Invalid teacher ID" }, 400);
    if (session.actorId !== teacherList[1])
      return json({ error: "Forbidden" }, 403);
    return json(
      (await repository.listTeacherFights(session.actorId)).map(publicFight),
    );
  }

  const fightMatch = url.pathname.match(/^\/api\/fights\/([0-9a-f-]+)$/i);
  if (request.method === "GET" && fightMatch) {
    if (!session) return json({ error: "Authentication required" }, 401);
    if (!uuidSchema.safeParse(fightMatch[1]).success)
      return json({ error: "Invalid fight ID" }, 400);
    const fight = await repository.findFightById(fightMatch[1]);
    if (!fight) return json({ error: "Fight not found" }, 404);
    return fight.teacherId === session.actorId
      ? json(publicFight(fight))
      : json({ error: "Forbidden" }, 403);
  }

  if (request.method === "POST" && url.pathname === "/api/fights") {
    if (!session) return json({ error: "Authentication required" }, 401);
    try {
      const input = await readFight(request);
      if (input.teacherId !== session.actorId)
        return json({ error: "Forbidden" }, 403);
      if (
        input.lootTable.length &&
        !(await repository.validateLoot?.(
          session.actorId,
          input.lootTable.map((item) => item.itemId),
        ))
      )
        return json({ error: "Loot must belong to this teacher" }, 403);
      return json(publicFight(await repository.createFight(input)), 201);
    } catch (error) {
      const bodyFailure=bodyErrorResponse(error);if(bodyFailure)return bodyFailure;
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE")
        return json({ error: "Request body too large" }, 413);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json({ error: "Invalid fight" }, 400);
      return json({ error: "Unable to create fight" }, 500);
    }
  }

  if (request.method === "PATCH" && fightMatch) {
    if (!session) return json({ error: "Authentication required" }, 401);
    if (!uuidSchema.safeParse(fightMatch[1]).success)
      return json({ error: "Invalid fight ID" }, 400);
    try {
      const input = await readFight(request);
      if (input.teacherId !== session.actorId)
        return json({ error: "Forbidden" }, 403);
      if (
        input.lootTable.length &&
        !(await repository.validateLoot?.(
          session.actorId,
          input.lootTable.map((item) => item.itemId),
        ))
      )
        return json({ error: "Loot must belong to this teacher" }, 403);
      const { teacherId: _, ...changes } = input;
      const fight = await repository.updateFight(
        fightMatch[1],
        session.actorId,
        changes,
      );
      return fight
        ? json(publicFight(fight))
        : json({ error: "Fight not found" }, 404);
    } catch (error) {
      const bodyFailure=bodyErrorResponse(error);if(bodyFailure)return bodyFailure;
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE")
        return json({ error: "Request body too large" }, 413);
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return json({ error: "Invalid fight" }, 400);
      return json({ error: "Unable to update fight" }, 500);
    }
  }

  if (request.method === "DELETE" && fightMatch) {
    if (!session) return json({ error: "Authentication required" }, 401);
    if (!uuidSchema.safeParse(fightMatch[1]).success)
      return json({ error: "Invalid fight ID" }, 400);
    return (await repository.deleteFight(fightMatch[1], session.actorId))
      ? json({ success: true })
      : json({ error: "Fight not found" }, 404);
  }

  return null;
}
