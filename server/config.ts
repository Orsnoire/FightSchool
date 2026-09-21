export type RuntimeEnvironment = "development" | "test" | "production";

export interface RuntimeConfig {
  databaseUrl: string;
  environment: RuntimeEnvironment;
  isDeployed: boolean;
  isProduction: boolean;
  port: number;
  seedDevelopmentData: boolean;
  sessionSecret: string;
}

type Environment = Record<string, string | undefined>;

function requireValue(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(name + " must be set");
  }
  return value;
}

export function loadRuntimeConfig(env: Environment = process.env): RuntimeConfig {
  const environment = (env.NODE_ENV || "development") as RuntimeEnvironment;
  if (!(["development", "test", "production"] as string[]).includes(environment)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  const databaseUrl = requireValue(env, "DATABASE_URL");
  const isProduction = environment === "production";
  const sessionSecret = isProduction
    ? requireValue(env, "SESSION_SECRET")
    : env.SESSION_SECRET?.trim() || "development-only-session-secret";
  const port = Number.parseInt(env.PORT || "5000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const seedDevelopmentData = env.SEED_DEVELOPMENT_DATA === "1";
  if (isProduction && seedDevelopmentData) {
    throw new Error("SEED_DEVELOPMENT_DATA cannot be enabled in production");
  }

  return {
    databaseUrl,
    environment,
    isDeployed: env.REPLIT_DEPLOYMENT === "1",
    isProduction,
    port,
    seedDevelopmentData,
    sessionSecret,
  };
}
