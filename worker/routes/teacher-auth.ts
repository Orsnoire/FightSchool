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
import type { TeacherRecord } from "../db/schema.ts";

const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  billingAddress: z.string().trim().min(1).max(500),
  schoolDistrict: z.string().trim().min(1).max(200),
  school: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(200),
  gradeLevel: z.string().trim().min(1).max(100),
}).strict();

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

function response(body: unknown, status = 200, cookie?: string): Response {
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

function publicTeacher(teacher: TeacherRecord) {
  return {
    id: teacher.id,
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    email: teacher.email,
    guildCode: teacher.guildCode,
    billingAddress: teacher.billingAddress,
    schoolDistrict: teacher.schoolDistrict,
    school: teacher.school,
    subject: teacher.subject,
    gradeLevel: teacher.gradeLevel,
    createdAt: teacher.createdAt.getTime(),
  };
}

function randomGuildCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export interface TeacherAuthContext {
  repository: IdentityRepository;
  session: SessionConfig;
}

export async function handleTeacherAuth(
  request: Request,
  url: URL,
  context: TeacherAuthContext,
): Promise<Response | null> {
  if (request.method === "POST" && url.pathname === "/api/teacher/signup") {
    try {
      const input = signupSchema.parse(await readJson(request));
      const emailNormalized = input.email.toLowerCase();
      if (await context.repository.findTeacherByEmail(emailNormalized)) {
        return response({ error: "Email already registered" }, 409);
      }
      const { password, ...profile } = input;
      const teacher = await context.repository.createTeacher({
        ...profile,
        email: emailNormalized,
        emailNormalized,
        passwordHash: await hashPassword(password),
        guildCode: randomGuildCode(),
      });
      const cookie = await issueSession(context.repository, context.session, "teacher", teacher.id);
      return response({ ...publicTeacher(teacher), sessionActive: true }, 201, cookie);
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
        return response({ error: "Request body too large" }, 413);
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return response({ error: "Invalid signup request" }, 400);
      }
      return response({ error: "Unable to create account" }, 500);
    }
  }

  if (request.method === "POST" && url.pathname === "/api/teacher/login") {
    try {
      const input = loginSchema.parse(await readJson(request));
      const teacher = await context.repository.findTeacherByEmail(input.email.toLowerCase());
      if (!teacher) {
        await hashPassword(input.password);
        return response({ error: "Invalid credentials" }, 401);
      }
      if (!await verifyPassword(input.password, teacher.passwordHash)) {
        return response({ error: "Invalid credentials" }, 401);
      }
      const cookie = await issueSession(context.repository, context.session, "teacher", teacher.id);
      return response({ ...publicTeacher(teacher), sessionActive: true }, 200, cookie);
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
        return response({ error: "Request body too large" }, 413);
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return response({ error: "Invalid login request" }, 400);
      }
      return response({ error: "Unable to log in" }, 500);
    }
  }

  if (request.method === "POST" && url.pathname === "/api/teacher/logout") {
    await revokeRequestSession(request, context.repository, context.session);
    return response({ success: true, message: "Logged out successfully" }, 200, clearSessionCookie(context.session.cookieName));
  }

  if (request.method === "GET" && url.pathname === "/api/teacher/check-session") {
    const session = await authenticateSession(request, context.repository, context.session, "teacher");
    if (!session) return response({ sessionActive: false }, 401);
    const teacher = await context.repository.findTeacherById(session.actorId);
    if (!teacher) return response({ sessionActive: false }, 401, clearSessionCookie(context.session.cookieName));
    return response({ ...publicTeacher(teacher), sessionActive: true });
  }

  const teacherMatch = request.method === "GET" && url.pathname.match(/^\/api\/teacher\/([0-9a-f-]+)$/i);
  if (teacherMatch) {
    const session = await authenticateSession(request, context.repository, context.session, "teacher");
    if (!session) return response({ error: "Authentication required" }, 401);
    if (session.actorId !== teacherMatch[1]) return response({ error: "Forbidden" }, 403);
    const teacher = await context.repository.findTeacherById(session.actorId);
    return teacher ? response(publicTeacher(teacher)) : response({ error: "Teacher not found" }, 404);
  }

  return null;
}
