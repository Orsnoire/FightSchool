import { and, or, isNull, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "../db/schema";
import { GameError as ApiError } from "../services/errors";
import { json, method } from "../http/game-response";
import { readJson } from "../http/json";
import type { GameRouteContext } from "./game-context";

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
import { mountainDay, nextMountainMidnight, xpMultiplier, STAMINA_TIME_ZONE } from "../../shared/combat/stamina";
import { safeFight } from "../projections/fight";
import { handleStudentEquipment } from "./equipment";
import { handleStudentRewards } from "./rewards";

export async function handleStudentProgression(context: GameRouteContext): Promise<Response | null> {
  const { request, url, db, ownStudent } = context;
  const path = url.pathname;
  const sm = path.match(/^\/api\/student\/([^/]+)\/(.*)$/);
  if (sm) {
    const id = sm[1],
      tail = sm[2];
    ownStudent(id);
    const [student] = await db
      .select()
      .from(s.students)
      .where(eq(s.students.id, id));
    if (!student) throw new ApiError("Student not found", 404);
    if (tail === "guilds")
      return json(
        (
          await db
            .select({ guild: s.guilds })
            .from(s.guildMemberships)
            .innerJoin(s.guilds, eq(s.guilds.id, s.guildMemberships.guildId))
            .where(
              and(
                eq(s.guildMemberships.studentId, id),
                eq(s.guilds.isArchived, false),
              ),
            )
        ).map((r) => r.guild),
      );
    if (tail === "stamina" && method(request, "GET")) {
      const now = Date.now();
      const completedCombats = student.staminaDay === mountainDay(now) ? student.dailyCombats : 0;
      return json({ completedCombats, xpMultiplier: xpMultiplier(completedCombats),
        resetsAt: nextMountainMidnight(now), timeZone: STAMINA_TIME_ZONE });
    }
    if (tail === "currency") return json({ gold: student.gold });
    if (tail === "quests") {
      return json(
        await db.select().from(s.quests).where(eq(s.quests.studentId, id)),
      );
    }
    if (tail === "job-levels" || tail.startsWith("job-level/")) {
      const rows = await db
        .select()
        .from(s.studentJobLevels)
        .where(eq(s.studentJobLevels.studentId, id));
      return json(
        tail === "job-levels"
          ? rows
          : rows.find((r) => r.jobClass === tail.slice(10)) || null,
      );
    }
    if (tail === "available-fights") {
      const rows = await db
        .select({
          fight: s.fights,
          assignment: s.guildFights,
          guildName: s.guilds.name,
        })
        .from(s.guildMemberships)
        .innerJoin(s.guilds, eq(s.guilds.id, s.guildMemberships.guildId))
        .innerJoin(s.guildFights, eq(s.guildFights.guildId, s.guilds.id))
        .innerJoin(s.fights, eq(s.fights.id, s.guildFights.fightId))
        .where(
          and(
            eq(s.guildMemberships.studentId, id),
            eq(s.guilds.isArchived, false),
          ),
        );
      return json(
        rows.map((r) => ({
          ...safeFight(r.fight),
          soloModeEnabled: r.assignment.soloModeEnabled,
          guildName: r.guildName,
        })),
      );
    }
    const equipment = await handleStudentEquipment(context, student, tail);
    if (equipment) return equipment;
    return handleStudentRewards(context, id, tail);
  }
  return null;
}
