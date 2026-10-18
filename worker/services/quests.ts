import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { questInput } from "../../shared/quests";
import { EQUIPMENT_ITEMS } from "../../shared/schema";
import type { GameDatabase } from "../db/database";
import * as s from "../db/schema";
import { evaluateQuests, seedGuildQuests, seedPersonalQuests } from "../progression/quests";
import { GameError as ApiError } from "./errors";
const uuid = z.string().uuid();
// Routes authorize this guild and require the teacher role before mutations.
// Evaluation retains its event scope and the existing atomic reward procedures.
export function guildQuestService(db: GameDatabase, g: typeof s.guilds.$inferSelect, actorId: string) {
  const id = g.id;
  const validateQuest = async (body: unknown) => {
    const input = questInput.parse(body);
    if (g.isArchived)
      throw new ApiError('Archived guilds cannot award or change quests.', 409);
    if (input.studentId) {
      const [member] = await db.select().from(s.guildMemberships).where(and(eq(s.guildMemberships.guildId, id), eq(s.guildMemberships.studentId, input.studentId)));
      if (!member)
        throw new ApiError('Choose a member of this guild.');
    }
    const fightIds = [input.criteria.fightId, input.criteria.criteria1?.fightId, input.criteria.criteria2?.fightId, input.criteria.criteria3?.fightId].filter(Boolean) as string[];
    if (fightIds.length) {
      const assigned = await db.select({ id: s.fights.id }).from(s.guildFights).innerJoin(s.fights, eq(s.fights.id, s.guildFights.fightId)).where(and(eq(s.guildFights.guildId, id), eq(s.fights.teacherId, actorId), inArray(s.fights.id, fightIds)));
      if (fightIds.some(f => !assigned.some(a => a.id === f)))
        throw new ApiError('Choose a fight assigned to this guild.');
    }
    const itemId = input.rewards.equipmentItemId;
    if (itemId && !EQUIPMENT_ITEMS[itemId]) {
      uuid.parse(itemId);
      const [item] = await db.select().from(s.equipmentItems).where(eq(s.equipmentItems.id, itemId));
      if (item?.teacherId !== actorId)
        throw new ApiError('Forbidden reward', 403);
    }
    return { ...input, criteria: input.criteria as import("../../shared/schema").QuestCriteria };
  };
  return {
    async reconcile() {
      if (g.isArchived)
        throw new ApiError("Archived guilds are read-only.", 409);
      await seedGuildQuests(db, id);
      const members = await db.select({ id: s.guildMemberships.studentId }).from(s.guildMemberships).where(eq(s.guildMemberships.guildId, id));
      for (const member of members)
        await seedPersonalQuests(db, member.id, id);
      return evaluateQuests(db, id);
    },
    async create(body: unknown) {
      const input = await validateQuest(body);
      const { assignToAll, ...fields } = input;
      const recipients = assignToAll ? await db.select({ studentId: s.guildMemberships.studentId }).from(s.guildMemberships).where(eq(s.guildMemberships.guildId, id)) : [];
      if (assignToAll && !recipients.length)
        throw new ApiError('Add guild members before assigning personal quests.');
      const values = assignToAll ? recipients.map(r => ({ ...fields, studentId: r.studentId, guildId: id })) : [{ ...fields, guildId: id }];
      const created = await db.insert(s.quests).values(values).returning();
      await evaluateQuests(db, id, undefined, { kind: 'quests', questIds: created.map(q => q.id) });
      return created[0];
    },
    async findMutable(questId: string) {
      uuid.parse(questId);
      const [existing] = await db.select().from(s.quests).where(and(eq(s.quests.id, questId), eq(s.quests.guildId, id)));
      if (!existing)
        throw new ApiError("Quest not found", 404);
      if (g.isArchived)
        throw new ApiError("Archived guilds are read-only.", 409);
      return existing;
    },
    async archive(questId: string) {
      await db.update(s.quests).set({ isArchived: true }).where(and(eq(s.quests.id, questId), eq(s.quests.guildId, id)));
      return { success: true };
    },
    async update(existing: typeof s.quests.$inferSelect, body: Record<string, unknown>) {
      const where = and(eq(s.quests.id, existing.id), eq(s.quests.guildId, id));
      if (body.isCompleted === true) {
        if (existing.isArchived)
          throw new ApiError('Archived quests cannot be completed.', 409);
        await evaluateQuests(db, id, existing.id, { kind: "quests", questIds: [existing.id] });
        return (await db.select().from(s.quests).where(where))[0];
      }
      if (existing.isCompleted)
        throw new ApiError('Completed quests retain their original rewards. Create another quest.', 409);
      const input = await validateQuest({ ...existing, ...body, assignToAll: false, criteria: body.criteria || existing.criteria, rewards: body.rewards || existing.rewards });
      // Recipient/schedule identity cannot be changed after publication.
      if ((input.studentId || null) !== existing.studentId || input.questType !== existing.questType)
        throw new ApiError('Create a new quest to change its audience or schedule.', 409);
      await db.update(s.quests).set(input).where(where);
      await evaluateQuests(db, id, undefined, { kind: 'quests', questIds: [existing.id] });
      return (await db.select().from(s.quests).where(where))[0];
    },
  };
}
