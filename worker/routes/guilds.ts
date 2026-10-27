import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { guildAssignmentInput, guildInput, guildMemberInput, guildPatch, guildProgressionInput, guildSettingsInput, guildSoloInput } from "../../shared/contracts/guilds";
import * as s from "../db/schema";
import { json, method } from "../http/game-response";
import { readJson } from "../http/json";
import { safeFight } from "../projections/fight";
import { safeStudent } from "../projections/student";
import { guildLeaderboard } from "../reporting/leaderboard";
import { GameError as ApiError } from "../services/errors";
import { createGuild, joinGuild, removeGuildMember, updateGuildProgression } from "../services/guilds";
import type { GameRouteContext } from "./game-context";
import { handleGuildQuests } from "./quests";
const uuid = z.string().uuid();
export async function handleGuilds(context: GameRouteContext): Promise<Response | null> {
  const { request, url, db, repository, actor, teacher, ownStudent, requireTeacher, guild } = context;
  const path = url.pathname;
  const teacherList = path.match(/^\/api\/teacher\/([^/]+)\/guilds$/);
  if (teacherList) {
    requireTeacher();
    if (teacherList[1] !== actor.actorId)
      throw new ApiError("Forbidden", 403);
    return json(await db.select().from(s.guilds).where(eq(s.guilds.teacherId, actor.actorId)));
  }
  const joinLookup = path.match(/^\/api\/guilds\/code\/([A-Za-z0-9]{6})$/);
  if (joinLookup && method(request, "GET")) {
    const [g] = await db
      .select()
      .from(s.guilds)
      .where(and(eq(s.guilds.code, joinLookup[1].toUpperCase()), eq(s.guilds.isArchived, false)));
    return g
      ? json({
        id: g.id,
        name: g.name,
        code: g.code,
        description: g.description,
      })
      : json({ error: "Guild not found" }, 404);
  }
  if (path === "/api/guilds" && method(request, "POST")) {
    requireTeacher();
    const input = guildInput.parse(await readJson(request));
    return json(await createGuild(db, actor.actorId, input), 201);
  }
  const gm = path.match(/^\/api\/guilds\/([^/]+)(?:\/(.*))?$/);
  if (gm) {
    const id = gm[1], tail = gm[2] || "";
    if (tail === "members" && method(request, "POST")) {
      if (teacher)
        throw new ApiError("Students join using their own accounts", 403);
      const input = guildMemberInput.parse(await readJson(request));
      ownStudent(input.studentId);
      return json(await joinGuild(db, id, actor.actorId));
    }
    const g = await guild(id, !method(request, "GET") && !tail.startsWith("members/"));
    if (!tail) {
      if (method(request, "GET"))
        return json(g);
      if (method(request, "PATCH")) {
        const input = guildPatch.parse(await readJson(request));
        return json((await db
          .update(s.guilds)
          .set(input)
          .where(eq(s.guilds.id, id))
          .returning())[0]);
      }
    }
    if (tail === "archive" && method(request, "POST"))
      return json((await db
        .update(s.guilds)
        .set({ isArchived: true })
        .where(eq(s.guilds.id, id))
        .returning())[0]);
    if (tail === "progression" && method(request, "PATCH")) {
      if (g.isArchived)
        throw new ApiError("Archived guilds are read-only.", 409);
      const input = guildProgressionInput.parse(await readJson(request));
      return json(await updateGuildProgression(db, id, input));
    }
    if (tail === "members" && method(request, "GET")) {
      const members = await db
        .select({
          student: s.students,
          joinedAt: s.guildMemberships.joinedAt,
        })
        .from(s.guildMemberships)
        .innerJoin(s.students, eq(s.students.id, s.guildMemberships.studentId))
        .where(eq(s.guildMemberships.guildId, id));
      return json(members.map((m) => ({
        ...safeStudent(m.student),
        studentId: m.student.id,
        joinedAt: m.joinedAt,
      })));
    }
    const leave = tail.match(/^members\/([^/]+)$/);
    if (leave && method(request, "DELETE")) {
      if (!teacher && leave[1] !== actor.actorId)
        throw new ApiError("Forbidden", 403);
      await removeGuildMember(db, id, leave[1]);
      return json({ success: true });
    }
    if (tail === "settings") {
      if (method(request, "GET"))
        return json((await db
          .select()
          .from(s.guildSettings)
          .where(eq(s.guildSettings.guildId, id)))[0] || {
          guildId: id,
          hiddenLeaderboardMetrics: [],
          enableGroupQuests: true,
          enableChat: false,
        });
      if (method(request, "PATCH")) {
        const input = guildSettingsInput.parse(await readJson(request));
        return json((await db
          .insert(s.guildSettings)
          .values({ guildId: id, ...input })
          .onConflictDoUpdate({
            target: s.guildSettings.guildId,
            set: { ...input, updatedAt: Date.now() },
          })
          .returning())[0]);
      }
    }
    if (tail === "fights") {
      if (method(request, "GET")) {
        const rows = await db
          .select({ fight: s.fights, assignment: s.guildFights })
          .from(s.guildFights)
          .innerJoin(s.fights, eq(s.fights.id, s.guildFights.fightId))
          .where(eq(s.guildFights.guildId, id));
        return json(rows.map((r) => ({
          ...safeFight(r.fight),
          ...r.assignment,
          id: r.fight.id,
        })));
      }
      if (method(request, "POST")) {
        const { fightId } = guildAssignmentInput.parse(await readJson(request));
        const fight = await repository.findFightById(fightId);
        if (fight?.teacherId !== actor.actorId)
          throw new ApiError("Forbidden", 403);
        return json((await db
          .insert(s.guildFights)
          .values({ guildId: id, fightId })
          .onConflictDoNothing()
          .returning())[0] || { guildId: id, fightId });
      }
    }
    const assignment = tail.match(/^fights\/([^/]+)(?:\/(solo-mode))?$/);
    if (assignment) {
      uuid.parse(assignment[1]);
      const where = and(eq(s.guildFights.guildId, id), eq(s.guildFights.fightId, assignment[1]));
      if (method(request, "DELETE")) {
        await db.delete(s.guildFights).where(where);
        return json({ success: true });
      }
      if (method(request, "PATCH") && assignment[2]) {
        const { enabled } = guildSoloInput.parse(await readJson(request));
        return json((await db
          .update(s.guildFights)
          .set({ soloModeEnabled: enabled })
          .where(where)
          .returning())[0]);
      }
    }
    if (tail === "active-sessions" && method(request, "GET")) {
      if (g.isArchived) return json([]);
      const rows = await db
        .select({sessionId:s.liveCombatSessions.sessionId, fightId:s.fights.id, title:s.fights.title,
          status:s.liveCombatSessions.status, soloStudentId:s.liveCombatSessions.soloStudentId,
          hostNickname:s.students.nickname, createdAt:s.liveCombatSessions.createdAt})
        .from(s.guildFights)
        .innerJoin(s.fights, eq(s.fights.id, s.guildFights.fightId))
        .innerJoin(s.liveCombatSessions, eq(s.liveCombatSessions.fightId, s.fights.id))
        .leftJoin(s.students, eq(s.students.id, s.liveCombatSessions.soloStudentId))
        .leftJoin(s.campaignEncounters, eq(s.campaignEncounters.sessionId, s.liveCombatSessions.sessionId))
        .where(and(eq(s.guildFights.guildId, id), eq(s.liveCombatSessions.teacherId,g.teacherId),
          isNull(s.campaignEncounters.sessionId),
          or(eq(s.liveCombatSessions.guildId, id), isNull(s.liveCombatSessions.guildId)),
          ...(teacher ? [] : [or(eq(s.liveCombatSessions.guildId,id), isNull(s.liveCombatSessions.soloStudentId), eq(s.liveCombatSessions.soloStudentId, actor.actorId))]),
          inArray(s.liveCombatSessions.status, ["waiting", "active"])))
        .orderBy(desc(s.liveCombatSessions.createdAt),desc(s.liveCombatSessions.sessionId));
      return json(rows.map(({soloStudentId,...row}) => ({
        ...row, soloMode: !!soloStudentId, isHost: soloStudentId === actor.actorId,
      })));
    }
    const quests = await handleGuildQuests(context, g, tail);
    if (quests)
      return quests;
    if (tail === "leaderboard")
      return json(await guildLeaderboard(db, id, teacher, url.searchParams.get("metric") || "damageDealt"));
  }
  return null;
}
