import { authenticateSession, type SessionConfig } from "../auth/session";
import type { GameDatabase } from "../db/database";
import type { IdentityRepository } from "../db/repository";
import { gameErrorResponse, json } from "../http/game-response";
import { gameAccess } from "../services/access";
import { handleEquipment } from "./equipment";
import { handleGuilds } from "./guilds";
import { handleReporting } from "./reporting";
import { handleStudentProgression } from "./student-progression";
export async function handleGame(request: Request, url: URL, repository: IdentityRepository, config: SessionConfig, database: GameDatabase): Promise<Response | null> {
  const path = url.pathname;
  if (!/^\/api\/(guilds|equipment-items|combat-stats|students\/used-fight-codes|student\/[0-9a-f-]+\/(activity|advancement|stamina|equipment|guilds|available-fights|purchase-item|claim-loot|claim-gold|job-level|award-xp|currency|quests)|teacher\/[0-9a-f-]+\/(guilds|equipment-items)|combat\/)/i.test(path))
    return null;
  const actor = await authenticateSession(request, repository, config);
  if (!actor)
    return json({ error: "Authentication required" }, 401);
  const context = { request, url, repository, db: database, ...gameAccess(database, actor) };
  try {
    for (const handler of [handleGuilds, handleEquipment, handleStudentProgression, handleReporting]) {
      const response = await handler(context);
      if (response)
        return response;
    }
    return json({ error: "Route not found" }, 404);
  }
  catch (error) {
    return gameErrorResponse(error);
  }
}
