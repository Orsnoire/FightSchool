import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { GuildInput, GuildProgressionInput } from "../../shared/contracts/guilds";
import { getGuildLevelFromXP } from "../../shared/schema";
import type { GameDatabase } from "../db/database";
import * as s from "../db/schema";
import { evaluateQuests, seedGuildQuests, seedPersonalQuests } from "../progression/quests";
import { GameError as ApiError } from "./errors";
const uuid = z.string().uuid();
export async function createGuild(db: GameDatabase, teacherId: string, input: GuildInput) {
  const [g] = await db
    .insert(s.guilds)
    .values({
      ...input,
      teacherId: teacherId,
      code: crypto
        .randomUUID()
        .replaceAll("-", "")
        .slice(0, 6)
        .toUpperCase(),
    })
    .returning();
  await db
    .insert(s.guildSettings)
    .values({ guildId: g.id })
    .onConflictDoNothing();
  await seedGuildQuests(db, g.id);
  return g;
}
export async function joinGuild(db: GameDatabase, id: string, studentId: string) {
  const [g] = await db
    .select()
    .from(s.guilds)
    .where(and(eq(s.guilds.id, uuid.parse(id)), eq(s.guilds.isArchived, false)));
  if (!g)
    throw new ApiError("Guild not found", 404);
  const [member] = await db
    .insert(s.guildMemberships)
    .values({ guildId: id, studentId: studentId })
    .onConflictDoNothing()
    .returning();
  await db
    .update(s.students)
    .set({ guildId: id, guildCode: g.code })
    .where(eq(s.students.id, studentId));
  await seedPersonalQuests(db, studentId, id);
  await evaluateQuests(db, id, undefined, { kind: 'membership', studentIds: [studentId] });
  return member || { guildId: id, studentId };
}
export async function updateGuildProgression(db: GameDatabase, id: string, input: GuildProgressionInput) {
  await db.update(s.guilds).set({ ...input, ...(input.experience !== undefined ? { level: getGuildLevelFromXP(input.experience) } : {}) }).where(eq(s.guilds.id, id));
  await evaluateQuests(db, id, undefined, { kind: 'guild' });
  return (await db.select().from(s.guilds).where(eq(s.guilds.id, id)))[0];
}
export async function removeGuildMember(db: GameDatabase, id: string, studentId: string) {
  await db
    .delete(s.guildMemberships)
    .where(and(eq(s.guildMemberships.guildId, id), eq(s.guildMemberships.studentId, uuid.parse(studentId))));
  await db
    .update(s.students)
    .set({ guildId: null, guildCode: null })
    .where(and(eq(s.students.id, studentId), eq(s.students.guildId, id)));
  await evaluateQuests(db, id, undefined, { kind: 'guild' });
}
