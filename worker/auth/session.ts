import { createOpaqueToken, decodeSignedToken, encodeSignedToken, hashToken } from "./crypto.ts";

export type ActorType = "teacher" | "student";

export interface SessionRecord {
  actorType: string;
  actorId: string;
  expiresAt: Date;
}

export interface SessionRepository {
  createSession(input: {
    tokenHash: string;
    actorType: ActorType;
    actorId: string;
    expiresAt: Date;
  }): Promise<void>;
  findActiveSession(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
}

export interface SessionConfig {
  cookieName: string;
  secret: string;
  ttlSeconds: number;
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export function serializeSessionCookie(name: string, value: string, ttlSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttlSeconds}`;
}

export function clearSessionCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function issueSession(
  repository: SessionRepository,
  config: SessionConfig,
  actorType: ActorType,
  actorId: string,
  now = new Date(),
): Promise<string> {
  const token = createOpaqueToken();
  await repository.createSession({
    tokenHash: await hashToken(token),
    actorType,
    actorId,
    expiresAt: new Date(now.getTime() + config.ttlSeconds * 1000),
  });
  return serializeSessionCookie(config.cookieName, await encodeSignedToken(token, config.secret), config.ttlSeconds);
}

export async function authenticateSession(
  request: Request,
  repository: SessionRepository,
  config: SessionConfig,
  expectedActorType?: ActorType,
  now = new Date(),
): Promise<SessionRecord | null> {
  const signed = cookieValue(request, config.cookieName);
  if (!signed) return null;
  const token = await decodeSignedToken(signed, config.secret);
  if (!token) return null;
  const session = await repository.findActiveSession(await hashToken(token), now);
  if (!session || (expectedActorType && session.actorType !== expectedActorType)) return null;
  return session;
}

export async function revokeRequestSession(
  request: Request,
  repository: SessionRepository,
  config: SessionConfig,
  now = new Date(),
): Promise<void> {
  const signed = cookieValue(request, config.cookieName);
  if (!signed) return;
  const token = await decodeSignedToken(signed, config.secret);
  if (token) await repository.revokeSession(await hashToken(token), now);
}
