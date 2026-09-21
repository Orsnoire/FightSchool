import { z } from "zod";
import { authenticateSession, type SessionConfig } from "../auth/session.ts";
import type { IdentityRepository } from "../db/repository.ts";
import type { FightRecord } from "../db/schema.ts";

const questionSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  question: z.string().min(1).max(20_000),
  options: z.array(z.string().max(5_000)).max(20).optional(),
  correctAnswer: z.string().min(1).max(5_000),
  timeLimit: z.number().int().min(5).max(300),
});

const enemySchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  image: z.string().max(2_000),
  difficultyMultiplier: z.number().min(1).max(100).default(10),
});

const fightSchema = z.object({
  teacherId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  guildCode: z.string().max(100).optional().nullable(),
  questions: z.array(questionSchema).min(1).max(1_000),
  enemies: z.array(enemySchema).max(100).default([]),
  baseXP: z.number().int().min(1).max(100).default(10),
  baseEnemyDamage: z.number().int().min(1).max(10).default(1),
  enemyDisplayMode: z.enum(["simultaneous", "consecutive"]).default("consecutive"),
  lootTable: z.array(z.object({ itemId: z.string().min(1).max(200) })).max(500).default([]),
  randomizeQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(true),
});

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
    ...fight,
    createdAt: fight.createdAt.getTime(),
    updatedAt: fight.updatedAt.getTime(),
  };
}

async function readFight(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 1_048_576) throw new Error("REQUEST_TOO_LARGE");
  const raw = await request.text();
  if (raw.length > 1_048_576) throw new Error("REQUEST_TOO_LARGE");
  return fightSchema.parse(JSON.parse(raw));
}

export async function handleFights(
  request: Request,
  url: URL,
  repository: IdentityRepository,
  sessionConfig: SessionConfig,
): Promise<Response | null> {
  const session = await authenticateSession(request, repository, sessionConfig, "teacher");

  const teacherList = request.method === "GET" && url.pathname.match(/^\/api\/teacher\/([0-9a-f-]+)\/fights$/i);
  if (teacherList) {
    if (!session) return json({ error: "Authentication required" }, 401);
    if (!uuidSchema.safeParse(teacherList[1]).success) return json({ error: "Invalid teacher ID" }, 400);
    if (session.actorId !== teacherList[1]) return json({ error: "Forbidden" }, 403);
    return json((await repository.listTeacherFights(session.actorId)).map(publicFight));
  }

  const fightMatch = url.pathname.match(/^\/api\/fights\/([0-9a-f-]+)$/i);
  if (request.method === "GET" && fightMatch) {
    if (!session) return json({ error: "Authentication required" }, 401);
    if (!uuidSchema.safeParse(fightMatch[1]).success) return json({ error: "Invalid fight ID" }, 400);
    const fight = await repository.findFightById(fightMatch[1]);
    if (!fight) return json({ error: "Fight not found" }, 404);
    return fight.teacherId === session.actorId ? json(publicFight(fight)) : json({ error: "Forbidden" }, 403);
  }

  if (request.method === "POST" && url.pathname === "/api/fights") {
    if (!session) return json({ error: "Authentication required" }, 401);
    try {
      const input = await readFight(request);
      if (input.teacherId !== session.actorId) return json({ error: "Forbidden" }, 403);
      return json(publicFight(await repository.createFight(input)), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return json({ error: "Request body too large" }, 413);
      if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid fight" }, 400);
      return json({ error: "Unable to create fight" }, 500);
    }
  }

  if (request.method === "PATCH" && fightMatch) {
    if (!session) return json({ error: "Authentication required" }, 401);
    if (!uuidSchema.safeParse(fightMatch[1]).success) return json({ error: "Invalid fight ID" }, 400);
    try {
      const input = await readFight(request);
      if (input.teacherId !== session.actorId) return json({ error: "Forbidden" }, 403);
      const { teacherId: _, ...changes } = input;
      const fight = await repository.updateFight(fightMatch[1], session.actorId, changes);
      return fight ? json(publicFight(fight)) : json({ error: "Fight not found" }, 404);
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return json({ error: "Request body too large" }, 413);
      if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid fight" }, 400);
      return json({ error: "Unable to update fight" }, 500);
    }
  }

  if (request.method === "DELETE" && fightMatch) {
    if (!session) return json({ error: "Authentication required" }, 401);
    if (!uuidSchema.safeParse(fightMatch[1]).success) return json({ error: "Invalid fight ID" }, 400);
    return await repository.deleteFight(fightMatch[1], session.actorId)
      ? json({ success: true })
      : json({ error: "Fight not found" }, 404);
  }

  return null;
}
