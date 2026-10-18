import { and, or, isNull, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "../db/schema";
import { GameError as ApiError } from "../services/errors";
import { json, method } from "../http/game-response";
import { readJson } from "../http/json";
import type { GameRouteContext } from "./game-context";

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
import { questInput } from "../../shared/quests";
import { EQUIPMENT_ITEMS } from "../../shared/schema";
import { readQuestViews, seedGuildQuests, seedPersonalQuests, evaluateQuests } from "../progression/quests";

export async function handleGuildQuests(context: GameRouteContext, g: typeof s.guilds.$inferSelect, tail: string): Promise<Response | null> {
  const { request, db, actor, teacher, requireTeacher } = context;
  const id = g.id;
  if (tail === "quests" && method(request, "GET")) {
    return json(await readQuestViews(db,id,teacher?undefined:actor.actorId));
  }
  if(tail==='quests/reconcile'&&method(request,'POST')){
    requireTeacher();
    if(g.isArchived)throw new ApiError('Archived guilds are read-only.',409);
    await seedGuildQuests(db,id);
    const members=await db.select({id:s.guildMemberships.studentId}).from(s.guildMemberships).where(eq(s.guildMemberships.guildId,id));
    for(const member of members)await seedPersonalQuests(db,member.id,id);
    return json(await evaluateQuests(db,id));
  }
  const validateQuest = async (body:unknown) => {
    const input=questInput.parse(body);
    if(g.isArchived)throw new ApiError('Archived guilds cannot award or change quests.',409);
    if(input.studentId){const [member]=await db.select().from(s.guildMemberships).where(and(eq(s.guildMemberships.guildId,id),eq(s.guildMemberships.studentId,input.studentId)));if(!member)throw new ApiError('Choose a member of this guild.');}
    const fightIds=[input.criteria.fightId,input.criteria.criteria1?.fightId,input.criteria.criteria2?.fightId,input.criteria.criteria3?.fightId].filter(Boolean) as string[];
    if(fightIds.length){const assigned=await db.select({id:s.fights.id}).from(s.guildFights).innerJoin(s.fights,eq(s.fights.id,s.guildFights.fightId)).where(and(eq(s.guildFights.guildId,id),eq(s.fights.teacherId,actor.actorId),inArray(s.fights.id,fightIds)));if(fightIds.some(f=>!assigned.some(a=>a.id===f)))throw new ApiError('Choose a fight assigned to this guild.');}
    const itemId=input.rewards.equipmentItemId;
    if(itemId&&!EQUIPMENT_ITEMS[itemId]){uuid.parse(itemId);const [item]=await db.select().from(s.equipmentItems).where(eq(s.equipmentItems.id,itemId));if(item?.teacherId!==actor.actorId)throw new ApiError('Forbidden reward',403);}
    return {...input,criteria:input.criteria as import("../../shared/schema").QuestCriteria};
  };
  if (tail === 'quests' && method(request,'POST')) {
    requireTeacher();const input=await validateQuest(await readJson(request));
    const {assignToAll,...fields}=input;
    const recipients=assignToAll?await db.select({studentId:s.guildMemberships.studentId}).from(s.guildMemberships).where(eq(s.guildMemberships.guildId,id)):[];
    if(assignToAll&&!recipients.length)throw new ApiError('Add guild members before assigning personal quests.');
    const values=assignToAll?recipients.map(r=>({...fields,studentId:r.studentId,guildId:id})): [{...fields,guildId:id}];
    const created=await db.insert(s.quests).values(values).returning();
    await evaluateQuests(db,id,undefined,{kind:'quests',questIds:created.map(q=>q.id)});return json(created[0],201);
  }
  const qm=tail.match(/^quests\/([^/]+)$/);
  if(qm){
    requireTeacher();uuid.parse(qm[1]);
    const where=and(eq(s.quests.id,qm[1]),eq(s.quests.guildId,id));
    const [existing]=await db.select().from(s.quests).where(where);
    if(!existing)throw new ApiError('Quest not found',404);
    if(g.isArchived)throw new ApiError('Archived guilds are read-only.',409);
    if(method(request,'DELETE')){await db.update(s.quests).set({isArchived:true}).where(where);return json({success:true});}
    if(method(request,'PATCH')){
      const body=await readJson(request) as Record<string,unknown>;
      if(body.isCompleted===true){
        if(existing.isArchived)throw new ApiError('Archived quests cannot be completed.',409);
        await evaluateQuests(db,id,qm[1],{kind:"quests",questIds:[qm[1]]});return json((await db.select().from(s.quests).where(where))[0]);
      }
      if(existing.isCompleted)throw new ApiError('Completed quests retain their original rewards. Create another quest.',409);
      const input=await validateQuest({...existing,...body,assignToAll:false,criteria:body.criteria||existing.criteria,rewards:body.rewards||existing.rewards});
      // Recipient/schedule identity cannot be changed after publication.
      if((input.studentId||null)!==existing.studentId||input.questType!==existing.questType)throw new ApiError('Create a new quest to change its audience or schedule.',409);
      await db.update(s.quests).set(input).where(where);
      await evaluateQuests(db,id,undefined,{kind:'quests',questIds:[qm[1]]});
      return json((await db.select().from(s.quests).where(where))[0]);
    }
  }
  return null;
}
