import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/crypto.ts";
import {
  authenticateSession,
  clearSessionCookie,
  issueSession,
  revokeRequestSession,
  type SessionConfig,
} from "../auth/session.ts";
import type { IdentityRepository } from "../db/repository.ts";
import type { StudentRecord } from "../db/schema.ts";

const loginSchema = z.object({
  nickname: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(200),
});
const characterSchema = z.object({
  characterClass: z.enum(["warrior", "wizard", "scout", "herbalist"]),
  gender: z.enum(["A", "B"]),
});

function json(body: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function publicStudent(student: StudentRecord) {
  return {
    id: student.id,
    nickname: student.nickname,
    characterClass: student.characterClass,
    gender: student.gender,
    weapon: null,
    headgear: null,
    armor: null,
    inventory: [],
    gold: 0,
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
      const input = loginSchema.parse(await request.json());
      const nicknameNormalized = input.nickname.toLocaleLowerCase("en-US");
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
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return json({ error: "Invalid student login" }, 400);
      }
      return json({ error: "Unable to sign in" }, 500);
    }
  }

  if (request.method === "POST" && url.pathname === "/api/student/logout") {
    await revokeRequestSession(request, repository, sessionConfig);
    return json({ success: true }, 200, clearSessionCookie(sessionConfig.cookieName));
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
      const input = characterSchema.parse(await request.json());
      const student = await repository.updateStudentCharacter(session.actorId, input.characterClass, input.gender);
      return student ? json(publicStudent(student)) : json({ error: "Student not found" }, 404);
    } catch (error) {
      return error instanceof z.ZodError || error instanceof SyntaxError
        ? json({ error: "Invalid character" }, 400)
        : json({ error: "Unable to update character" }, 500);
    }
  }

  return null;
}
