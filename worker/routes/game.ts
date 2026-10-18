import { GameError as ApiError } from "../services/errors";
import { json, method, gameErrorResponse } from "../http/game-response";
import { gameAccess } from "../services/access";
import { safeStudent } from "../projections/student";
import { safeFight } from "../projections/fight";
import { handleReporting } from "./reporting";
import { paletteSchema, equipmentVisualSchema, validVisualSlot } from "../../shared/avatar/visuals";
import { readJson } from "../http/json";
import { questInput } from "../../shared/quests";
import { EQUIPMENT_SLOTS, ownedEquipment } from "../../shared/equipment-catalog.ts";
import { equipmentIdSchema } from "../../shared/equipment-id.ts";
import { builtinShopItems, builtinShopItem } from "../../shared/equipment-shop.ts";
import { armorClassificationError, equipmentExclusion, handConflict, equipmentRequiredLevel } from "../../shared/equipment-rules.ts";
import { mountainDay, nextMountainMidnight, xpMultiplier, STAMINA_TIME_ZONE } from "../../shared/combat/stamina.ts";
import { z } from "zod";
import { and, or, isNull, eq, inArray, desc, sql } from "drizzle-orm";
import { authenticateSession, type SessionConfig } from "../auth/session.ts";
import type { IdentityRepository } from "../db/repository.ts";
import {
  gameDatabase,
  claimReward,
  RewardError,
  type GameDatabase,
} from "../db/game-repository.ts";
import * as s from "../db/schema.ts";
import {
  ALL_CHARACTER_CLASSES,
  EQUIPMENT_ITEMS,
  WEAPON_RESTRICTIONS,
  calculateTierPrice,
  getGuildLevelFromXP,
  type CharacterClass,
} from "../../shared/schema.ts";
import {
  getUnlockedJobs,
  getCrossClassAbilities,
  calculateNewLevel,
} from "../../shared/jobSystem.ts";
import {
  evaluateQuests,
  readQuestViews,
  seedGuildQuests,
  seedPersonalQuests,
} from "../progression/quests.ts";
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
const bounded = z.number().int().min(0).max(1000);
const itemSchema = z.object({
  visual: equipmentVisualSchema.nullable().optional(),
  name: text,
  iconUrl: z.string().max(2000).nullable().optional(),
  itemType: z.enum([
    "sword",
    "wand",
    "bow",
    "staff",
    "herbs",
    "two-handed-sword",
    "fist",
    "claws",
    "harp",
    "spoon",
    "light_armor",
    "leather_armor",
    "armor",
    "helmet",
    "cap",
    "hat",
    "consumable", "spellbook", "shield", "potion", "quiver", "bracers", "gloves", "leggings", "boots",
  ]),
  quality: z.enum(["common", "rare", "epic", "legendary"]),
  tier: z.number().int().min(1).max(10).default(1),
  slot: z.enum(EQUIPMENT_SLOTS),
  armorCategory: z.enum(["heavy_armor", "leather_armor", "light_armor"]).nullable().optional(),
  offhandType: z.enum(["shield", "potion", "quiver", "spellbook"]).nullable().optional(),
  weaponType: z
    .enum([
      "wand",
      "sword",
      "staff",
      "bow",
      "herbs",
      "two-handed-sword",
      "fist",
      "claws",
      "harp",
      "spoon",
    ])
    .nullable()
    .optional(),
  stats: z
    .object({
      str: bounded.optional(),
      int: bounded.optional(),
      agi: bounded.optional(),
      mnd: bounded.optional(),
      vit: bounded.optional(),
      def: bounded.optional(),
      atk: bounded.optional(),
      mat: bounded.optional(),
      rtk: bounded.optional(),
    })
    .default({}),
  shopPrice: z.number().int().min(1).max(1000000).nullable().optional(),
  isPurchasable: z.boolean().default(true),
});
export async function handleGame(
  request: Request,
  url: URL,
  repository: IdentityRepository,
  config: SessionConfig,
  database: GameDatabase,
): Promise<Response | null> {
  const path = url.pathname;
  if (
    !/^\/api\/(guilds|equipment-items|combat-stats|students\/used-fight-codes|student\/[0-9a-f-]+\/(stamina|equipment|guilds|available-fights|purchase-item|claim-loot|claim-gold|job-level|award-xp|currency|quests)|teacher\/[0-9a-f-]+\/(guilds|equipment-items)|combat\/)/i.test(
      path,
    )
  )
    return null;
  const actor = await authenticateSession(request, repository, config);
  if (!actor) return json({ error: "Authentication required" }, 401);
  const db = database;
  const context = { request, url, repository, db, ...gameAccess(db, actor) };
  const { teacher, ownStudent, requireTeacher, guild } = context;
  try {
    const teacherList = path.match(
      /^\/api\/teacher\/([^/]+)\/(guilds|equipment-items)$/,
    );
    if (teacherList) {
      requireTeacher();
      if (teacherList[1] !== actor.actorId)
        throw new ApiError("Forbidden", 403);
      return json(
        teacherList[2] === "guilds"
          ? await db
              .select()
              .from(s.guilds)
              .where(eq(s.guilds.teacherId, actor.actorId))
          : await db
              .select()
              .from(s.equipmentItems)
              .where(eq(s.equipmentItems.teacherId, actor.actorId)),
      );
    }
    const joinLookup = path.match(/^\/api\/guilds\/code\/([A-Za-z0-9]{6})$/);
    if (joinLookup && method(request, "GET")) {
      const [g] = await db
        .select()
        .from(s.guilds)
        .where(
          and(
            eq(s.guilds.code, joinLookup[1].toUpperCase()),
            eq(s.guilds.isArchived, false),
          ),
        );
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
      const input = z
        .object({
          name: text,
          description: z.string().max(3000).nullable().optional(),
        })
        .parse(await readJson(request));
      const [g] = await db
        .insert(s.guilds)
        .values({
          ...input,
          teacherId: actor.actorId,
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
      return json(g, 201);
    }
    const gm = path.match(/^\/api\/guilds\/([^/]+)(?:\/(.*))?$/);
    if (gm) {
      const id = gm[1],
        tail = gm[2] || "";
      if (tail === "members" && method(request, "POST")) {
        if (teacher)
          throw new ApiError("Students join using their own accounts", 403);
        const input = z.object({ studentId: uuid }).parse(await readJson(request));
        ownStudent(input.studentId);
        const [g] = await db
          .select()
          .from(s.guilds)
          .where(
            and(
              eq(s.guilds.id, uuid.parse(id)),
              eq(s.guilds.isArchived, false),
            ),
          );
        if (!g) throw new ApiError("Guild not found", 404);
        const [member] = await db
          .insert(s.guildMemberships)
          .values({ guildId: id, studentId: actor.actorId })
          .onConflictDoNothing()
          .returning();
        await db
          .update(s.students)
          .set({ guildId: id, guildCode: g.code })
          .where(eq(s.students.id, actor.actorId));
        await seedPersonalQuests(db, actor.actorId, id);
        await evaluateQuests(db,id,undefined,{kind:'membership',studentIds:[actor.actorId]});
        return json(member || { guildId: id, studentId: actor.actorId });
      }
      const g = await guild(
        id,
        !method(request, "GET") && !tail.startsWith("members/"),
      );
      if (!tail) {
        if (method(request, "GET")) return json(g);
        if (method(request, "PATCH")) {
          const input = z
            .object({
              name: text.optional(),
              description: z.string().max(3000).nullable().optional(),
            })
            .parse(await readJson(request));
          return json(
            (
              await db
                .update(s.guilds)
                .set(input)
                .where(eq(s.guilds.id, id))
                .returning()
            )[0],
          );
        }
      }
      if (tail === "archive" && method(request, "POST"))
        return json(
          (
            await db
              .update(s.guilds)
              .set({ isArchived: true })
              .where(eq(s.guilds.id, id))
              .returning()
          )[0],
        );
      if (tail === "progression" && method(request, "PATCH")) {
        if(g.isArchived)throw new ApiError("Archived guilds are read-only.",409);
        const input = z
          .object({
            limitTier: z.number().int().min(1).max(4).optional(),
            experience: z.number().int().min(0).max(10000000).optional(),
            unlockedTier: z.number().int().min(1).max(10).optional(),
          })
          .parse(await readJson(request));
        await db.update(s.guilds).set({...input,...(input.experience!==undefined?{level:getGuildLevelFromXP(input.experience)}:{})}).where(eq(s.guilds.id,id));
        await evaluateQuests(db,id,undefined,{kind:'guild'});
        return json((await db.select().from(s.guilds).where(eq(s.guilds.id,id)))[0]);
      }
      if (tail === "members" && method(request, "GET")) {
        const members = await db
          .select({
            student: s.students,
            joinedAt: s.guildMemberships.joinedAt,
          })
          .from(s.guildMemberships)
          .innerJoin(
            s.students,
            eq(s.students.id, s.guildMemberships.studentId),
          )
          .where(eq(s.guildMemberships.guildId, id));
        return json(
          members.map((m) => ({
            ...safeStudent(m.student),
            studentId: m.student.id,
            joinedAt: m.joinedAt,
          })),
        );
      }
      const leave = tail.match(/^members\/([^/]+)$/);
      if (leave && method(request, "DELETE")) {
        if (!teacher && leave[1] !== actor.actorId)
          throw new ApiError("Forbidden", 403);
        await db
          .delete(s.guildMemberships)
          .where(
            and(
              eq(s.guildMemberships.guildId, id),
              eq(s.guildMemberships.studentId, uuid.parse(leave[1])),
            ),
          );
        await db
          .update(s.students)
          .set({ guildId: null, guildCode: null })
          .where(and(eq(s.students.id, leave[1]), eq(s.students.guildId, id)));
        await evaluateQuests(db,id,undefined,{kind:'guild'});
        return json({ success: true });
      }
      if (tail === "settings") {
        if (method(request, "GET"))
          return json(
            (
              await db
                .select()
                .from(s.guildSettings)
                .where(eq(s.guildSettings.guildId, id))
            )[0] || {
              guildId: id,
              hiddenLeaderboardMetrics: [],
              enableGroupQuests: true,
              enableChat: false,
            },
          );
        if (method(request, "PATCH")) {
          const input = z
            .object({
              hiddenLeaderboardMetrics: z
                .array(
                  z.enum([
                    "damageDealt",
                    "damageBlocked",
                    "healingDone",
                    "questionsCorrect",
                    "accuracy",
                    "xpEarned",
                  ]),
                )
                .max(8)
                .optional(),
              enableGroupQuests: z.boolean().optional(),
              enableChat: z.literal(false).optional(),
            })
            .parse(await readJson(request));
          return json(
            (
              await db
                .insert(s.guildSettings)
                .values({ guildId: id, ...input })
                .onConflictDoUpdate({
                  target: s.guildSettings.guildId,
                  set: { ...input, updatedAt: Date.now() },
                })
                .returning()
            )[0],
          );
        }
      }
      if (tail === "fights") {
        if (method(request, "GET")) {
          const rows = await db
            .select({ fight: s.fights, assignment: s.guildFights })
            .from(s.guildFights)
            .innerJoin(s.fights, eq(s.fights.id, s.guildFights.fightId))
            .where(eq(s.guildFights.guildId, id));
          return json(
            rows.map((r) => ({
              ...safeFight(r.fight),
              ...r.assignment,
              id: r.fight.id,
            })),
          );
        }
        if (method(request, "POST")) {
          const { fightId } = z
            .object({ fightId: uuid })
            .parse(await readJson(request));
          const fight = await repository.findFightById(fightId);
          if (fight?.teacherId !== actor.actorId)
            throw new ApiError("Forbidden", 403);
          return json(
            (
              await db
                .insert(s.guildFights)
                .values({ guildId: id, fightId })
                .onConflictDoNothing()
                .returning()
            )[0] || { guildId: id, fightId },
          );
        }
      }
      const assignment = tail.match(/^fights\/([^/]+)(?:\/(solo-mode))?$/);
      if (assignment) {
        uuid.parse(assignment[1]);
        const where = and(
          eq(s.guildFights.guildId, id),
          eq(s.guildFights.fightId, assignment[1]),
        );
        if (method(request, "DELETE")) {
          await db.delete(s.guildFights).where(where);
          return json({ success: true });
        }
        if (method(request, "PATCH") && assignment[2]) {
          const { enabled } = z
            .object({ enabled: z.boolean() })
            .parse(await readJson(request));
          return json(
            (
              await db
                .update(s.guildFights)
                .set({ soloModeEnabled: enabled })
                .where(where)
                .returning()
            )[0],
          );
        }
      }
      if (tail === "active-sessions") {
        const rows = await db
          .select({ session: s.liveCombatSessions, fight: s.fights })
          .from(s.guildFights)
          .innerJoin(s.fights, eq(s.fights.id, s.guildFights.fightId))
          .innerJoin(
            s.liveCombatSessions,
            eq(s.liveCombatSessions.fightId, s.fights.id),
          )
          .where(
            and(
              eq(s.guildFights.guildId, id),
              or(eq(s.liveCombatSessions.guildId, id), isNull(s.liveCombatSessions.guildId)),
              ...(teacher ? [] : [or(isNull(s.liveCombatSessions.soloStudentId), eq(s.liveCombatSessions.soloStudentId, actor.actorId))]),
              inArray(s.liveCombatSessions.status, ["waiting", "active"]),
            ),
          );
        return json(
          rows.map((r) => ({
            ...r.session,
            title: r.fight.title,
            soloMode: !!r.session.soloStudentId,
          })),
        );
      }
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
      if (tail === "leaderboard") {
        const metric = url.searchParams.get("metric") || "damageDealt";
        if (
          ![
            "damageDealt",
            "damageBlocked",
            "healingDone",
            "questionsCorrect",
            "xpEarned",
            "accuracy",
          ].includes(metric)
        )
          throw new ApiError("Invalid metric");
        const [settings] = await db
          .select()
          .from(s.guildSettings)
          .where(eq(s.guildSettings.guildId, id));
        if (!teacher && settings?.hiddenLeaderboardMetrics?.includes(metric))
          return json([]);
        const column=metric==='accuracy'?'questionsCorrect':metric;
        const value=metric==='xpEarned'?sql`r.xp_earned::double precision`:sql`COALESCE((r.totals->>${column})::double precision,0)`;
        const aggregate=await db.execute(sql`SELECT student_id,sum(${value}) AS value,
          sum(COALESCE((r.totals->>'questionsAnswered')::double precision,0)) AS answered,count(*)::integer AS fights
          FROM combat_results r WHERE guild_id=${id}::uuid GROUP BY student_id`);
        const grouped=new Map(aggregate.rows.map(r=>[String(r.student_id),r]));
        const members=await db.select({id:s.students.id,nickname:s.students.nickname,characterClass:s.students.characterClass})
          .from(s.guildMemberships).innerJoin(s.students,eq(s.students.id,s.guildMemberships.studentId)).where(eq(s.guildMemberships.guildId,id));
        return json(members.map(m=>{
          const total=grouped.get(m.id);
          const value=metric==='accuracy'?(Number(total?.answered)?100*Number(total?.value)/Number(total?.answered):0):Number(total?.value||0);
          return {...m,studentId:m.id,value,totalDamageDealt:value,fightsCompleted:Number(total?.fights||0),[metric]:value};
        }).sort((a,b)=>b.value-a.value));
      }
    }
    if (path === "/api/equipment-items/shop") {
      const id = url.searchParams.get("studentId") || actor.actorId;
      ownStudent(id);
      const [student] = await db
        .select()
        .from(s.students)
        .where(eq(s.students.id, id));
      if (!student?.guildId) return json([]);
      const g = await guild(student.guildId);
      const current = g;
      return json(
        [
          ...builtinShopItems(),
          ...await db
            .select()
            .from(s.equipmentItems)
            .where(
              and(
                eq(s.equipmentItems.teacherId, g.teacherId),
                eq(s.equipmentItems.isPurchasable, true),
              ),
            )
        ]
          .filter((item) => item.tier <= current.unlockedTier)
          .map((item) => ({
            ...item,
            shopPrice:
              item.shopPrice || calculateTierPrice(item.tier, item.quality),
          })),
      );
    }
    if (path === "/api/equipment-items" && method(request, "POST")) {
      requireTeacher();
      const input = itemSchema.parse(await readJson(request));
      if (!validVisualSlot(input.visual,input.slot)) throw new ApiError("Base sprite must match the equipment slot");
      const classificationError = armorClassificationError(input);
      if (classificationError) throw new ApiError(classificationError);
      return json(
        (
          await db
            .insert(s.equipmentItems)
            .values({ ...input, teacherId: actor.actorId })
            .returning()
        )[0],
        201,
      );
    }
    const im = path.match(/^\/api\/equipment-items\/([^/]+)$/);
    if (im && im[1] !== "shop") {
      const [item] = await db
        .select()
        .from(s.equipmentItems)
        .where(eq(s.equipmentItems.id, uuid.parse(im[1])));
      if (!item) throw new ApiError("Item not found", 404);
      if (teacher && item.teacherId !== actor.actorId)
        throw new ApiError("Forbidden", 403);
      if (!teacher) {
        const permitted = await studentItemIds(db, actor.actorId);
        if (
          !permitted.teacherIds.includes(item.teacherId) &&
          !permitted.itemIds.includes(item.id)
        )
          throw new ApiError("Forbidden", 403);
      }
      if (method(request, "GET")) return json(item);
      requireTeacher();
      if (method(request, "PATCH")) {
        const input = itemSchema.partial().parse(await readJson(request));
if (!validVisualSlot(input.visual===undefined?item.visual:input.visual,input.slot||item.slot)) throw new ApiError("Base sprite must match the equipment slot");
        // Older unspecified armor can receive unrelated edits without changing its category.
        if ('slot' in input || 'itemType' in input || 'armorCategory' in input || item.armorCategory) {
          const classificationError = armorClassificationError({...item,...input});
          if (classificationError) throw new ApiError(classificationError);
        }
        return json(
          (
            await db
              .update(s.equipmentItems)
              .set(input)
              .where(eq(s.equipmentItems.id, item.id))
              .returning()
          )[0],
        );
      }
      if (method(request, "DELETE")) {
        await db
          .delete(s.equipmentItems)
          .where(eq(s.equipmentItems.id, item.id));
        return json({ success: true });
      }
    }
    if (path === "/api/equipment-items" && method(request, "GET")) {
      const ids = (url.searchParams.get("ids") || "")
        .split(",")
        .filter(Boolean);
      if (ids.length > 100) throw new ApiError("Too many items");
      const builtin = ids
        .filter((id) => EQUIPMENT_ITEMS[id])
        .map((id) => ({ ...EQUIPMENT_ITEMS[id], tier: EQUIPMENT_ITEMS[id].tier ?? 1, quality: "common" }));
      const custom = ids.filter((id) => !EQUIPMENT_ITEMS[id]);
      custom.forEach((id) => uuid.parse(id));
      if (!custom.length) return json(builtin);
      let rows = await db
        .select()
        .from(s.equipmentItems)
        .where(inArray(s.equipmentItems.id, custom));
      if (teacher) rows = rows.filter((i) => i.teacherId === actor.actorId);
      else {
        const allowed = await studentItemIds(db, actor.actorId);
        rows = rows.filter(
          (i) =>
            allowed.itemIds.includes(i.id) ||
            allowed.teacherIds.includes(i.teacherId),
        );
      }
      return json([...builtin, ...rows]);
    }
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
      if (tail === "equipment" && method(request, "PATCH")) {
        const input = z
          .object({
            ...Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, z.string().max(100).nullable().optional()])) as Record<typeof EQUIPMENT_SLOTS[number], z.ZodOptional<z.ZodNullable<z.ZodString>>>,
            crossClassAbility1: z.string().max(100).nullable().optional(),
            crossClassAbility2: z.string().max(100).nullable().optional(),
          })
          .parse(await readJson(request));
        const jobs = await db
          .select()
          .from(s.studentJobLevels)
          .where(eq(s.studentJobLevels.studentId, id));
        const levels = Object.fromEntries(
          jobs.map((j) => [j.jobClass, j.level]),
        );
        const cross = getCrossClassAbilities(
          student.characterClass || "warrior",
          levels as Record<CharacterClass, number>,
        );
        for (const [slot, itemId] of Object.entries(input)) {
          if (!itemId) continue;
          if (slot.startsWith("crossClass")) {
            if (!cross.some((a) => a.id === itemId))
              throw new ApiError("Cross-class ability not unlocked");
            continue;
          }
          const builtin = EQUIPMENT_ITEMS[itemId];
          const [custom] = builtin
            ? []
            : await db
                .select()
                .from(s.equipmentItems)
                .where(eq(s.equipmentItems.id, uuid.parse(itemId)));
          const item = builtin || custom;
          if (item) {
            const exclusion = equipmentExclusion(student.characterClass || 'warrior', item);
            if (exclusion) throw new ApiError(exclusion);
          }
          if (
            !item ||
            item.slot !== slot ||
            !ownedEquipment([...student.inventory, ...EQUIPMENT_SLOTS.map(slot => student[slot]).filter((id): id is string => !!id)]).includes(itemId)
          )
            throw new ApiError("Equipment is not owned or has the wrong slot");
          const tier = item.tier ?? 1;
          const level = levels[student.characterClass || "warrior"] || 1;
          if (level < equipmentRequiredLevel(tier))
            throw new ApiError("Job level is too low for this tier");

        }
        if ('weapon' in input || 'offhand' in input) {
          const nextWeapon = 'weapon' in input ? input.weapon : student.weapon;
          const nextOffhand = 'offhand' in input ? input.offhand : student.offhand;
          const resolveItem = async (id:string|null|undefined) => !id ? null : EQUIPMENT_ITEMS[id] || (await db.select().from(s.equipmentItems).where(eq(s.equipmentItems.id, uuid.parse(id))))[0] || null;
          const weapon = await resolveItem(nextWeapon), offhand = await resolveItem(nextOffhand);
          if (handConflict(weapon, offhand)) throw new ApiError('The weapon and off-hand item are incompatible. Change or remove both together.');
        }
        const nextAbilities = {...student, ...input};
        if (nextAbilities.crossClassAbility1 && nextAbilities.crossClassAbility1 === nextAbilities.crossClassAbility2)
          throw new ApiError("Choose different cross-class abilities");
        const [updated] = await db.update(s.students).set({...input, loadoutRevision: sql`${s.students.loadoutRevision} + 1`}).where(and(
          eq(s.students.id,id),
          eq(s.students.loadoutRevision, student.loadoutRevision),
          sql`${s.students.characterClass} IS NOT DISTINCT FROM ${student.characterClass}`,
          ...EQUIPMENT_SLOTS.map(slot => sql`${s.students[slot]} IS NOT DISTINCT FROM ${student[slot]}`),
        )).returning();
        if (!updated) throw new ApiError('Your equipment changed. Refresh and try again.',409);
        return json(safeStudent(updated));
      }
      if (tail === "purchase-item" && method(request, "POST")) {
        const { itemId } = z
          .object({ itemId: equipmentIdSchema })
          .parse(await readJson(request));
        if (!student.guildId) throw new ApiError("Join a guild first");
        const g = await guild(student.guildId);
        const builtin = builtinShopItem(itemId);
        const [custom] = uuid.safeParse(itemId).success ? await db
          .select()
          .from(s.equipmentItems)
          .where(eq(s.equipmentItems.id, itemId)) : [];
        const item = builtin || (custom?.teacherId === g.teacherId ? custom : undefined);
        if (
          !item ||
          !item.isPurchasable ||
          item.tier > g.unlockedTier
        )
          throw new ApiError("Item is unavailable");
        const price =
          item.shopPrice || calculateTierPrice(item.tier, item.quality);
        const rows = await db
          .update(s.students)
          .set({
            gold: sql`${s.students.gold}-${price}`,
            inventory: sql`${s.students.inventory} || ${JSON.stringify([item.id])}::jsonb`,
          })
          .where(
            and(
              eq(s.students.id, id),
              sql`${s.students.gold}>=${price}`,
              sql`NOT(${s.students.inventory} @> ${JSON.stringify([item.id])}::jsonb)`,
            ),
          )
          .returning();
        if (!rows.length)
          throw new ApiError("Not enough gold or item already owned", 409);
        return json(safeStudent(rows[0]));
      }
      if (
        ["claim-loot", "claim-gold"].includes(tail) &&
        method(request, "POST")
      ) {
        const input = z
          .object({
            fightId: uuid,
            resultId: uuid.optional(),
            itemId: equipmentIdSchema.optional(),
          })
          .parse(await readJson(request));
        if (tail === "claim-loot" && !input.itemId)
          throw new ApiError("Choose an item");
        return json(
          await claimReward(
            db,
            id,
            input.fightId,
            tail === "claim-loot" ? input.itemId! : null,
            input.resultId,
          ),
        );
      }
      if (tail === "award-xp")
        throw new ApiError("XP is awarded from server combat results", 403);
    }
    const reporting = await handleReporting(context);
    if (reporting) return reporting;
    return json({ error: "Route not found" }, 404);
  } catch (error) {
    return gameErrorResponse(error);
  }
}
async function studentItemIds(db: GameDatabase, id: string) {
  const [student] = await db
    .select()
    .from(s.students)
    .where(eq(s.students.id, id));
  const guilds = await db
    .select({ teacherId: s.guilds.teacherId })
    .from(s.guildMemberships)
    .innerJoin(s.guilds, eq(s.guilds.id, s.guildMemberships.guildId))
    .where(eq(s.guildMemberships.studentId, id));
  const loot = await db.execute(sql`SELECT DISTINCT item->>'itemId' AS id
    FROM combat_results r CROSS JOIN LATERAL jsonb_array_elements(r.loot_table) item
    WHERE r.student_id=${id}::uuid AND item->>'itemId' IS NOT NULL`);
  return {
    teacherIds: guilds.map((g) => g.teacherId),
    itemIds: [
      ...(student?.inventory || []),
      ...loot.rows.map(r => String(r.id)),
    ],
  };
}
