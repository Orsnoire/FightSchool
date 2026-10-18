import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { SessionRecord } from "../auth/session";
import type { GameDatabase } from "../db/game-repository";
import * as s from "../db/schema";
import { GameError as ApiError } from "./errors";

const uuid = z.string().uuid();
export type GameActor = Pick<SessionRecord, "actorId" | "actorType">;

// Explicit capabilities shared by the domain routes, bound to this request's identity.
export function gameAccess(db: GameDatabase, actor: GameActor) {
  const teacher = actor.actorType === "teacher";
  const ownStudent = (id: string) => {
    uuid.parse(id);
    if (teacher || actor.actorId !== id) throw new ApiError("Forbidden", 403);
  };
  const requireTeacher = () => {
    if (!teacher) throw new ApiError("Teacher role required", 403);
  };
  const guild = async (id: string, write = false) => {
    uuid.parse(id);
    const [g] = await db.select().from(s.guilds).where(eq(s.guilds.id, id));
    if (!g) throw new ApiError("Guild not found", 404);
    if (teacher) {
      if (g.teacherId !== actor.actorId) throw new ApiError("Forbidden", 403);
    } else {
      if (write) throw new ApiError("Teacher role required", 403);
      const [member] = await db
        .select()
        .from(s.guildMemberships)
        .where(
          and(
            eq(s.guildMemberships.guildId, id),
            eq(s.guildMemberships.studentId, actor.actorId),
          ),
        );
      if (!member) throw new ApiError("Forbidden", 403);
    }
    return g;
  };
  return { actor, teacher, ownStudent, requireTeacher, guild };
}
export type GameAccess = ReturnType<typeof gameAccess>;
