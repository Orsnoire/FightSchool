import { createIdentityRepository, verifyDatabase } from "./db/repository.ts";
import { handleTeacherAuth } from "./routes/teacher-auth.ts";

interface Env {
  ASSETS: Fetcher;
  COMBAT_SESSIONS: DurableObjectNamespace;
  ENVIRONMENT: string;
  PUBLIC_ORIGIN: string;
  DATABASE_URL: string;
  PASSWORD_PEPPER: string;
  SESSION_SECRET: string;
  SESSION_COOKIE_NAME: string;
  SESSION_TTL_SECONDS: string;
  STAGING_AUTH_TOKEN: string;
}

interface SocketAttachment {
  connectedAt: string;
  role: "staging-smoke";
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
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function hasStagingAuthorization(request: Request, env: Env): boolean {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || !env.STAGING_AUTH_TOKEN) return false;
  return constantTimeEqual(authorization.slice(7), env.STAGING_AUTH_TOKEN);
}

function validSessionId(sessionId: string | null): sessionId is string {
  return sessionId !== null && /^[A-Za-z0-9_-]{1,64}$/.test(sessionId);
}

async function handleReady(env: Env, currentRequestId: string): Promise<Response> {
  try {
    if (
      !env.DATABASE_URL
      || !env.PASSWORD_PEPPER
      || env.PASSWORD_PEPPER.length < 32
      || !env.SESSION_SECRET
      || env.SESSION_SECRET.length < 32
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
    return json({ status: "ready", environment: env.ENVIRONMENT }, 200, currentRequestId);
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
  if (!hasStagingAuthorization(request, env)) {
    return json({ error: "Unauthorized" }, 401, currentRequestId);
  }

  const sessionId = url.searchParams.get("sessionId");
  if (!validSessionId(sessionId)) {
    return json({ error: "Invalid sessionId" }, 400, currentRequestId);
  }

  const id = env.COMBAT_SESSIONS.idFromName(sessionId);
  return env.COMBAT_SESSIONS.get(id).fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const currentRequestId = requestId(request);

    if (url.pathname === "/api/health/live") {
      return json({ status: "ok", environment: env.ENVIRONMENT }, 200, currentRequestId);
    }
    if (url.pathname === "/api/health/ready") {
      return handleReady(env, currentRequestId);
    }
    if (url.pathname.startsWith("/api/teacher/")) {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        if (request.headers.get("origin") !== env.PUBLIC_ORIGIN) {
          return json({ error: "Forbidden origin" }, 403, currentRequestId);
        }
      }
      if (
        !env.DATABASE_URL
        || !env.PASSWORD_PEPPER
        || env.PASSWORD_PEPPER.length < 32
        || !env.SESSION_SECRET
        || env.SESSION_SECRET.length < 32
      ) {
        return json({ error: "Identity service unavailable" }, 503, currentRequestId);
      }
      const ttlSeconds = Number(env.SESSION_TTL_SECONDS);
      if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 300) {
        return json({ error: "Identity service unavailable" }, 503, currentRequestId);
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
        return json({ error: "Identity service unavailable" }, 503, currentRequestId);
      }
    }
    if (url.pathname === "/ws") {
      return handleWebSocket(request, env, url, currentRequestId);
    }
    if (url.pathname === "/objects" || url.pathname.startsWith("/objects/")) {
      return json({ error: "Object storage is not enabled" }, 501, currentRequestId);
    }
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return json({ error: "API route not found" }, 404, currentRequestId);
    }

    return env.ASSETS.fetch(request);
  },
};

export class CombatSession {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname === "/ready"
      && request.headers.get("x-questacademy-internal") === "1"
    ) {
      return json({ status: "ready" });
    }

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "WebSocket upgrade required" }, 426);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const attachment: SocketAttachment = {
      connectedAt: new Date().toISOString(),
      role: "staging-smoke",
    };
    server.serializeAttachment(attachment);
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") {
      webSocket.send(JSON.stringify({ type: "protocol_error", error: "Text messages only" }));
      return;
    }

    try {
      const command = JSON.parse(message) as { type?: unknown; commandId?: unknown };
      if (command.type !== "ping" || typeof command.commandId !== "string") {
        webSocket.send(JSON.stringify({ type: "protocol_error", error: "Unsupported command" }));
        return;
      }
      const attachment = webSocket.deserializeAttachment() as SocketAttachment | null;
      webSocket.send(JSON.stringify({
        type: "pong",
        commandId: command.commandId,
        role: attachment?.role || "unknown",
      }));
    } catch {
      webSocket.send(JSON.stringify({ type: "protocol_error", error: "Invalid JSON" }));
    }
  }

  webSocketError(webSocket: WebSocket) {
    webSocket.close(1011, "WebSocket error");
  }
}
