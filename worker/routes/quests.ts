import type * as s from "../db/schema";
import { json, method } from "../http/game-response";
import { readJson } from "../http/json";
import { readQuestViews } from "../progression/quests";
import { guildQuestService } from "../services/quests";
import type { GameRouteContext } from "./game-context";
export async function handleGuildQuests(context: GameRouteContext, g: typeof s.guilds.$inferSelect, tail: string): Promise<Response | null> {
  const { request, db, actor, teacher, requireTeacher } = context;
  if (tail === "quests" && method(request, "GET")) {
    return json(await readQuestViews(db, g.id, teacher ? undefined : actor.actorId));
  }
  const quests = guildQuestService(db, g, actor.actorId);
  if (tail === "quests/reconcile" && method(request, "POST")) {
    requireTeacher();
    return json(await quests.reconcile());
  }
  if (tail === "quests" && method(request, "POST")) {
    requireTeacher();
    return json(await quests.create(await readJson(request)), 201);
  }
  const qm = tail.match(/^quests\/([^/]+)$/);
  if (qm) {
    requireTeacher();
    // Preserve not-found/archive checks before body parsing, including unsupported methods.
    const existing = await quests.findMutable(qm[1]);
    if (method(request, "DELETE"))
      return json(await quests.archive(existing.id));
    if (method(request, "PATCH")) {
      return json(await quests.update(existing, await readJson(request) as Record<string, unknown>));
    }
  }
  return null;
}
