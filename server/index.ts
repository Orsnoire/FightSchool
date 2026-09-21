import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { loadRuntimeConfig } from "./config";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import { log, serveStatic, setupVite } from "./vite";

const config = loadRuntimeConfig();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

if (config.isDeployed) {
  app.set("trust proxy", 1);
}

app.use((req, res, next) => {
  const incomingRequestId = req.get("x-request-id");
  const requestId = incomingRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

app.get("/api/health/live", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health/ready", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});

const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  conString: config.databaseUrl,
  createTableIfMissing: true,
  tableName: "teacher_sessions",
});

app.use(session({
  store: sessionStore,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 60 * 60 * 1000,
    httpOnly: true,
    secure: config.isDeployed || config.isProduction,
    sameSite: "lax",
    path: "/",
  },
}));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      log(JSON.stringify({
        event: "http_request",
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }));
    }
  });
  next();
});

async function seedDevelopmentData() {
  await storage.seedDefaultEquipment();
  await storage.seedDefaultTeacher();
  await storage.seedTestStudent();
  await storage.seedTestFight();
  await storage.seedTestGuild();
  await storage.seedTestCombatSession();
  log("Development seed data created");
}

async function start() {
  if (config.seedDevelopmentData) {
    await seedDevelopmentData();
  }

  const server = await registerRoutes(app);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const error = err as { message?: string; stack?: string; status?: number; statusCode?: number };
    const status = error.status || error.statusCode || 500;
    console.error("[Express Error Handler]", {
      requestId: res.locals.requestId,
      status,
      message: error.message || "Internal Server Error",
      stack: error.stack,
      path: req.path,
      method: req.method,
    });
    const message = status >= 500 && config.isProduction
      ? "Internal Server Error"
      : error.message || "Internal Server Error";
    res.status(status).json({ message, requestId: res.locals.requestId });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen({ port: config.port, host: "0.0.0.0", reusePort: true }, () => {
    log("serving on port " + config.port);
  });
}

start().catch((error) => {
  console.error("Fatal startup error", error);
  process.exit(1);
});
