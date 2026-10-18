import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { combatHistory, studentCombatSummary, type HistoryScope } from "../db/combat-history";
import { sessionReport } from "../reporting/session-report";
import * as s from "../db/schema";
import { GameError as ApiError } from "../services/errors";
import { json, method } from "../http/game-response";
import type { GameRouteContext } from "./game-context";

const uuid = z.string().uuid();
export async function handleReporting(context: GameRouteContext): Promise<Response | null> {
  const { request, url, db, repository, actor, ownStudent, requireTeacher } = context;
  const path = url.pathname;
  if (path === "/api/combat-stats/report" && method(request,"GET")) {
    requireTeacher();
    return json(await sessionReport(db, actor.actorId, url.searchParams));
  }
  const summary=path.match(/^\/api\/combat-stats\/student\/([^/]+)\/summary$/);
  if(summary){ownStudent(summary[1]);return json(await studentCombatSummary(db,summary[1]));}
  const stats=path.match(/^\/api\/combat-stats\/(fight|student|class)\/([^/]+)$/);
  if(stats){
    let scope:HistoryScope;
    if(stats[1]==='student'){ownStudent(stats[2]);scope={studentId:stats[2]};}
    else if(stats[1]==='fight'){
      requireTeacher();const fight=await repository.findFightById(uuid.parse(stats[2]));
      if(fight?.teacherId!==actor.actorId)throw new ApiError('Forbidden',403);
      scope={fightId:fight.id};
    }else{
      requireTeacher();const owner=await repository.findTeacherById(actor.actorId);
      if(owner?.guildCode===stats[2])scope={teacherId:actor.actorId};
      else{
        const guilds=await db.select({id:s.guilds.id}).from(s.guilds).where(and(eq(s.guilds.teacherId,actor.actorId),eq(s.guilds.code,stats[2])));
        scope={guildIds:guilds.map(g=>g.id)};
      }
    }
    const page=await combatHistory(db,scope,url.searchParams);
    const response=json(page.rows);
    if(page.nextCursor)response.headers.set('X-Next-Cursor',page.nextCursor);
    return response;
  }
  if (path === "/api/combat-stats" && method(request, "POST"))
    throw new ApiError("Statistics are recorded by the combat server", 403);
  const used = path.match(/^\/api\/students\/used-fight-codes\/([^/]+)$/);
  if (used) {
    requireTeacher();
    const gs = await db
      .select()
      .from(s.guilds)
      .where(
        and(
          eq(s.guilds.teacherId, actor.actorId),
          eq(s.guilds.code, used[1]),
        ),
      );
    const rows = gs.length
      ? await db
          .select({
            studentId: s.combatResults.studentId,
            fightId: s.combatResults.fightId,
            sessionId: s.combatResults.sessionId,
          })
          .from(s.combatResults)
          .where(
            inArray(
              s.combatResults.guildId,
              gs.map((g) => g.id),
            ),
          )
      : [];
    return json(rows);
  }
  return null;
}
