import { gameDatabase } from "./db/game-repository.ts";
import { handleAvatar } from "./routes/avatars.ts";
import { handleGame } from "./routes/game.ts";
import { handleObjects } from "./routes/objects.ts";
import { createIdentityRepository, verifyDatabase } from "./db/repository.ts";
import { handleTeacherAuth } from "./routes/teacher-auth.ts";
import { handleFights } from "./routes/fights.ts";
import { authenticateSession, type SessionConfig } from "./auth/session.ts";
import { handleStudentAuth } from "./routes/student-auth.ts";
import { handleCombatSessions } from "./routes/combat-sessions.ts";
import { CombatSessionObject } from "./combat/session-object.ts";

import { isAllowedOrigin } from "./auth/origin.ts";

interface Env {
  OBJECTS?: R2Bucket;
  ASSETS: Fetcher;
  COMBAT_SESSIONS: DurableObjectNamespace;
  ENVIRONMENT: string;
  PUBLIC_ORIGIN: string;
  ADDITIONAL_PUBLIC_ORIGINS?: string;
  DATABASE_URL: string;
  PASSWORD_PEPPER: string;
  SESSION_SECRET: string;
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_SECONDS: string;
  STAGING_AUTH_TOKEN: string;
}

const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200, requestId?: string): Response {
  const headers = new Headers(JSON_HEADERS);
  if (requestId) headers.set("X-Request-Id", requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

function requestId(request: Request): string {
  const incoming = request.headers.get("x-request-id");
  return incoming && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming)
    ? incoming
    : crypto.randomUUID();
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function hasStagingAuthorization(request: Request, env: Env): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !env.STAGING_AUTH_TOKEN)
    return false;
  return constantTimeEqual(authorization.slice(7), env.STAGING_AUTH_TOKEN);
}

function validSessionId(sessionId: string | null): sessionId is string {
  return sessionId !== null && /^[A-Za-z0-9_-]{1,64}$/.test(sessionId);
}

async function handleReady(
  env: Env,
  currentRequestId: string,
): Promise<Response> {
  try {
    if (
      !env.DATABASE_URL ||
      !env.PASSWORD_PEPPER ||
      env.PASSWORD_PEPPER.length < 32 ||
      !env.SESSION_SECRET ||
      env.SESSION_SECRET.length < 32
    ) {
      throw new Error("Identity configuration is unavailable");
    }
    const id = env.COMBAT_SESSIONS.idFromName("__readiness__");
    const stub = env.COMBAT_SESSIONS.get(id);
    const [response] = await Promise.all([
      stub.fetch("https://combat-session.internal/ready", {
        headers: { "x-questacademy-internal": "1" },
      }),
      verifyDatabase(env.DATABASE_URL),
    ]);
    if (!response.ok) throw new Error("Durable Object readiness failed");
    return json(
      { status: "ready", environment: env.ENVIRONMENT },
      200,
      currentRequestId,
    );
  } catch {
    return json({ status: "not_ready" }, 503, currentRequestId);
  }
}

async function handleWebSocket(
  request: Request,
  env: Env,
  url: URL,
  currentRequestId: string,
): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return json({ error: "WebSocket upgrade required" }, 426, currentRequestId);
  }
  if (
    !hasStagingAuthorization(request, env) &&
    !isAllowedOrigin(request.headers.get("origin"), env)
  ) {
    return json({ error: "Forbidden origin" }, 403, currentRequestId);
  }
  const sessionId = url.searchParams.get("sessionId");
  if (!validSessionId(sessionId)) {
    return json({ error: "Invalid sessionId" }, 400, currentRequestId);
  }

  const headers = new Headers(request.headers);
  headers.set("x-questacademy-internal", "1");
  headers.set("x-questacademy-session-id", sessionId);
  if (hasStagingAuthorization(request, env)) {
    headers.set("x-questacademy-actor-id", "staging-smoke");
    headers.set("x-questacademy-role", "staging-smoke");
  } else {
    const repository = createIdentityRepository(env.DATABASE_URL);
    const sessionConfig: SessionConfig = {
      cookieName: env.SESSION_COOKIE_NAME,
      secret: env.SESSION_SECRET,
      ttlSeconds: Number(env.SESSION_TTL_SECONDS),
    };
    const actor = await authenticateSession(request, repository, sessionConfig);
    if (!actor) return json({ error: "Unauthorized" }, 401, currentRequestId);
    const room = await repository.findLiveCombatSession(sessionId);
    if (!room || !["waiting", "active", "completed"].includes(room.status)) {
      return json(
        { error: "Session not found or has ended" },
        404,
        currentRequestId,
      );
    }
    if (
      room.soloStudentId &&
      actor.actorType === "student" &&
      actor.actorId !== room.soloStudentId
    )
      return json({ error: "Forbidden" }, 403, currentRequestId);
    if (actor.actorType === "teacher" && actor.actorId !== room.teacherId) {
      return json({ error: "Forbidden" }, 403, currentRequestId);
    }
    if (actor.actorType !== "teacher" && actor.actorType !== "student") {
      return json({ error: "Unauthorized" }, 401, currentRequestId);
    }
    headers.set("x-questacademy-actor-id", actor.actorId);
    headers.set("x-questacademy-role", actor.actorType);
    headers.set("x-questacademy-token-hash", actor.tokenHash!);
    headers.set("x-questacademy-expires-at", String(actor.expiresAt.getTime()));
  }
  const id = env.COMBAT_SESSIONS.idFromName(sessionId);
  return env.COMBAT_SESSIONS.get(id).fetch(new Request(request, { headers }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const currentRequestId = requestId(request);

    if (url.pathname === "/api/health/live") {
      return json(
        { status: "ok", environment: env.ENVIRONMENT },
        200,
        currentRequestId,
      );
    }
    if (url.pathname === "/api/health/ready") {
      return handleReady(env, currentRequestId);
    }
    if (
      (url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/objects/")) &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) &&
      !isAllowedOrigin(request.headers.get("origin"), env)
    ) {
      return json({ error: "Forbidden origin" }, 403, currentRequestId);
    }
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/objects/")
    ) {
      try {
        const repository = createIdentityRepository(env.DATABASE_URL);
        const config = {
          cookieName: env.SESSION_COOKIE_NAME,
          secret: env.SESSION_SECRET,
          ttlSeconds: Number(env.SESSION_TTL_SECONDS),
        };
        const force = url.pathname.match(
          /^\/api\/combat\/([A-Za-z0-9_-]{1,64})\/(force-question|end)$/,
        );
        if (force && request.method === "POST") {
          const actor = await authenticateSession(
            request,
            repository,
            config,
            "teacher",
          );
          if (!actor)
            return json(
              { error: "Authentication required" },
              401,
              currentRequestId,
            );
          const live = await repository.findLiveCombatSession(force[1]);
          if (live?.teacherId !== actor.actorId || (force[2] === "end" && live.soloStudentId))
            return json({ error: "Forbidden" }, 403, currentRequestId);
          return env.COMBAT_SESSIONS.get(
            env.COMBAT_SESSIONS.idFromName(force[1]),
          ).fetch(`https://combat-session.internal/${force[2]}`, {
            method: "POST",
            headers: {
              "x-questacademy-internal": "1",
              "x-questacademy-actor-id": actor.actorId,
              "x-questacademy-session-id": force[1],
            },
          });
        }
        const response =
          (await handleAvatar(request, url, repository, config, gameDatabase(env.DATABASE_URL))) ||
          (await handleObjects(request, url, env, repository, config)) ||
          (await handleGame(
            request,
            url,
            repository,
            config,
            gameDatabase(env.DATABASE_URL),
          ));
        if (response) {
          response.headers.set("X-Request-Id", currentRequestId);
          return response;
        }
      } catch {
        return json({ error: "Service unavailable" }, 503, currentRequestId);
      }
    }
    if (
      request.method === "POST" &&
      [
        "/api/student/login",
        "/api/teacher/login",
        "/api/teacher/signup",
      ].includes(url.pathname)
    ) {
      const ip = request.headers.get("cf-connecting-ip") || "local";
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(ip + url.pathname),
      );
      const key = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const response = await env.COMBAT_SESSIONS.get(
        env.COMBAT_SESSIONS.idFromName("rate:" + key),
      ).fetch("https://combat-session.internal/throttle", {
        headers: {
          "x-questacademy-internal": "1",
          "x-questacademy-rate-limit":
            url.pathname === "/api/student/login" ? "200" : "20",
        },
      });
      if (!response.ok)
        return new Response(
          JSON.stringify({
            error: "Too many attempts. Try again in a minute.",
          }),
          { status: 429, headers: { ...JSON_HEADERS, "Retry-After": "60" } },
        );
    }
    if (url.pathname.startsWith("/api/teacher/")) {
      if (
        !env.DATABASE_URL ||
        !env.PASSWORD_PEPPER ||
        env.PASSWORD_PEPPER.length < 32 ||
        !env.SESSION_SECRET ||
        env.SESSION_SECRET.length < 32
      ) {
        return json(
          { error: "Identity service unavailable" },
          503,
          currentRequestId,
        );
      }
      const ttlSeconds = Number(env.SESSION_TTL_SECONDS);
      if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 300) {
        return json(
          { error: "Identity service unavailable" },
          503,
          currentRequestId,
        );
      }
      try {
        const authResponse = await handleTeacherAuth(request, url, {
          repository: createIdentityRepository(env.DATABASE_URL),
          passwordPepper: env.PASSWORD_PEPPER,
          session: {
            cookieName: env.SESSION_COOKIE_NAME,
            secret: env.SESSION_SECRET,
            ttlSeconds,
          },
        });
        if (authResponse) {
          authResponse.headers.set("X-Request-Id", currentRequestId);
          return authResponse;
        }
      } catch {
        return json(
          { error: "Identity service unavailable" },
          503,
          currentRequestId,
        );
      }
    }
    if (url.pathname.startsWith("/api/student/")) {
      if (
        !env.DATABASE_URL ||
        !env.PASSWORD_PEPPER ||
        env.PASSWORD_PEPPER.length < 32 ||
        !env.SESSION_SECRET ||
        env.SESSION_SECRET.length < 32
      )
        return json(
          { error: "Identity service unavailable" },
          503,
          currentRequestId,
        );
      try {
        const ttlSeconds = Number(env.SESSION_TTL_SECONDS);
        const studentResponse = await handleStudentAuth(
          request,
          url,
          createIdentityRepository(env.DATABASE_URL),
          env.PASSWORD_PEPPER,
          {
            cookieName: env.SESSION_COOKIE_NAME,
            secret: env.SESSION_SECRET,
            ttlSeconds,
          },
        );
        if (studentResponse) {
          studentResponse.headers.set("X-Request-Id", currentRequestId);
          return studentResponse;
        }
      } catch {
        return json(
          { error: "Identity service unavailable" },
          503,
          currentRequestId,
        );
      }
    }
    if (
      url.pathname === "/api/fights" ||
      url.pathname.startsWith("/api/fights/") ||
      /^\/api\/teacher\/[0-9a-f-]+\/fights$/i.test(url.pathname)
    ) {
      if (
        !env.DATABASE_URL ||
        !env.SESSION_SECRET ||
        env.SESSION_SECRET.length < 32
      ) {
        return json(
          { error: "Identity service unavailable" },
          503,
          currentRequestId,
        );
      }
      try {
        const ttlSeconds = Number(env.SESSION_TTL_SECONDS);
        const repository = createIdentityRepository(env.DATABASE_URL);
        const sessionConfig = {
          cookieName: env.SESSION_COOKIE_NAME,
          secret: env.SESSION_SECRET,
          ttlSeconds,
        };
        // One coordinator per fight serializes launches across tabs and retries.
        const launch = url.pathname.match(/^\/api\/fights\/([0-9a-f-]+)\/sessions$/i);
        if (request.method === "POST" && launch) {
          const actor = await authenticateSession(request, repository, sessionConfig, "teacher");
          if (!actor) return json({ error: "Authentication required" }, 401);
          const fight = await repository.findFightById(launch[1]);
          if (fight?.teacherId !== actor.actorId) return json({ error: "Forbidden" }, 403);
          const headers = new Headers(request.headers);
          headers.set("x-questacademy-internal", "1");
          return env.COMBAT_SESSIONS.get(env.COMBAT_SESSIONS.idFromName(`host:${fight.id}`))
            .fetch(new Request(request, { headers }));
        }
        const combatResponse = await handleCombatSessions(
          request,
          url,
          repository,
          sessionConfig,
          env.DATABASE_URL,
        );
        if (combatResponse) {
          combatResponse.headers.set("X-Request-Id", currentRequestId);
          return combatResponse;
        }
        const fightResponse = await handleFights(
          request,
          url,
          repository,
          sessionConfig,
        );
        if (fightResponse) {
          fightResponse.headers.set("X-Request-Id", currentRequestId);
          return fightResponse;
        }
      } catch {
        return json(
          { error: "Fight service unavailable" },
          503,
          currentRequestId,
        );
      }
    }
    if (url.pathname.startsWith("/api/sessions/")) {
      try {
        const sessionResponse = await handleCombatSessions(
          request,
          url,
          createIdentityRepository(env.DATABASE_URL),
          {
            cookieName: env.SESSION_COOKIE_NAME,
            secret: env.SESSION_SECRET,
            ttlSeconds: Number(env.SESSION_TTL_SECONDS),
          },
        );
        if (sessionResponse) {
          sessionResponse.headers.set("X-Request-Id", currentRequestId);
          return sessionResponse;
        }
      } catch {
        return json(
          { error: "Combat service unavailable" },
          503,
          currentRequestId,
        );
      }
    }
    if (url.pathname === "/ws") {
      return handleWebSocket(request, env, url, currentRequestId);
    }
    if (url.pathname === "/objects" || url.pathname.startsWith("/objects/")) {
      return json(
        { error: "Object storage is not enabled" },
        501,
        currentRequestId,
      );
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return json({ error: "API route not found" }, 404, currentRequestId);
    }

    return env.ASSETS.fetch(request);
  },
};

export class CombatSession extends CombatSessionObject {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.setRepository(createIdentityRepository(env.DATABASE_URL));
  }
}
