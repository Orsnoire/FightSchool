import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Trust Replit's proxy for secure cookies in deployed environment
if (process.env.REPLIT_DEPLOYMENT === '1') {
  app.set('trust proxy', 1);
}

// Configure PostgreSQL session store
const PgSession = connectPgSimple(session);
const sessionStore = new PgSession({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: true,
  tableName: 'teacher_sessions',
});

// Detect if running in deployed environment
const isDeployed = process.env.REPLIT_DEPLOYMENT === '1';

// Configure session middleware with 60-minute rolling timeout
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset maxAge on every request
  cookie: {
    maxAge: 60 * 60 * 1000, // 60 minutes
    httpOnly: true, // Prevent XSS attacks
    secure: isDeployed, // HTTPS only in deployed environment
    sameSite: isDeployed ? 'none' : 'lax', // 'none' for deployed cross-site, 'lax' for dev
  },
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Seed default data on server startup
  await storage.seedDefaultEquipment();
  await storage.seedDefaultTeacher();
  log("Default equipment items and teacher account seeded");

  // Seed test data for quick feature testing
  await storage.seedTestStudent();
  await storage.seedTestFight();
  await storage.seedTestGuild();
  await storage.seedTestCombatSession();
  log("Test student, fight, guild, and combat session seeded for feature testing");

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the full error with stack trace for debugging
    console.error("[Express Error Handler]", {
      status,
      message,
      stack: err.stack,
      path: _req.path,
      method: _req.method
    });

    res.status(status).json({ message });
    // Do NOT throw - let the process continue serving requests
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
