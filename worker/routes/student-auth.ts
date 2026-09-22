import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/crypto.ts";
import { authenticateSession, issueSession, type SessionConfig } from "../auth/session.ts";
import type { IdentityRepository } from "../db/repository.ts";
import type { StudentRecord } from "../db/schema.ts";

const loginSchema = z.object({
  nickname: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(128),
}).strict();

const characterSchema = z.object({
  characterClass: z.enum(["warrior", "wizard", "scout", "herbalist"]),
  gender: z.enum(["A", "B"]),
}).strict();

function json(body: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 16_384) throw new Error("REQUEST_TOO_LARGE");
  const raw = await request.text();
  if (raw.length > 16_384) throw new Error("REQUEST_TOO_LARGE");
  return JSON.parse(raw);
}

export function publicStudent(student: StudentRecord) {
  return {
    id: student.id,
    nickname: student.nickname,
    characterClass: student.characterClass,
    gender: student.gender,
    guildCode: student.guildCode,
    createdAt: student.createdAt.getTime(),
  };
}

export async function handleStudentAuth(
  request: Request,
  url: URL,
  repository: IdentityRepository,
  passwordPepper: string,
  sessionConfig: SessionConfig,
): Promise<Response | null> {
  if (request.method === "POST" && url.pathname === "/api/student/login") {
    try {
      const input = loginSchema.parse(await readJson(request));
      const nicknameNormalized = input.nickname.toLowerCase();
      let student = await repository.findStudentByNickname(nicknameNormalized);
      if (student) {
        if (!await verifyPassword(input.password, student.passwordHash, passwordPepper)) {
          return json({ error: "Invalid credentials" }, 401);
        }
      } else {
        student = await repository.createStudent({
          nickname: input.nickname,
          nicknameNormalized,
          passwordHash: await hashPassword(input.password, passwordPepper),
        });
      }
      const cookie = await issueSession(repository, sessionConfig, "student", student.id);
      return json(publicStudent(student), 200, cookie);
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
        return json({ error: "Request body too large" }, 413);
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return json({ error: "Invalid login request" }, 400);
      }
      return json({ error: "Unable to log in" }, 500);
    }
  }

  const studentMatch = url.pathname.match(/^\/api\/student\/([0-9a-f-]+)$/i);
  if (request.method === "GET" && studentMatch) {
    const session = await authenticateSession(request, repository, sessionConfig, "student");
    if (!session) return json({ error: "Authentication required" }, 401);
    if (session.actorId !== studentMatch[1]) return json({ error: "Forbidden" }, 403);
    const student = await repository.findStudentById(session.actorId);
    return student ? json(publicStudent(student)) : json({ error: "Student not found" }, 404);
  }

  const characterMatch = url.pathname.match(/^\/api\/student\/([0-9a-f-]+)\/character$/i);
  if (request.method === "PATCH" && characterMatch) {
    const session = await authenticateSession(request, repository, sessionConfig, "student");
    if (!session) return json({ error: "Authentication required" }, 401);
    if (session.actorId !== characterMatch[1]) return json({ error: "Forbidden" }, 403);
    try {
      const input = characterSchema.parse(await readJson(request));
      const student = await repository.updateStudentCharacter(session.actorId, input);
      return student ? json(publicStudent(student)) : json({ error: "Student not found" }, 404);
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return json({ error: "Invalid character" }, 400);
      }
      return json({ error: "Unable to save character" }, 500);
    }
  }

  return null;
}
