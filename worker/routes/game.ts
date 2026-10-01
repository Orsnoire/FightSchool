import { mountainDay, nextMountainMidnight, xpMultiplier, STAMINA_TIME_ZONE } from "../../shared/combat/stamina.ts";
import { z } from "zod";
import { and, eq, inArray, desc, sql } from "drizzle-orm";
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
  seedGuildQuests,
  seedPersonalQuests,
} from "../progression/quests.ts";
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
const bounded = z.number().int().min(0).max(1000);
const itemSchema = z.object({
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
    "consumable",
  ]),
  quality: z.enum(["common", "rare", "epic", "legendary"]),
  tier: z.number().int().min(1).max(10).default(1),
  slot: z.enum(["weapon", "headgear", "armor"]),
  weaponType: z
    .enum([
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
const criterion = z.object({
  fightId: uuid.optional(),
  mode: z.enum(["solo", "teacher", "any"]).optional(),
  accuracy: z.number().min(0).max(100).optional(),
  performanceType: z.enum(["individual", "class_average"]).optional(),
});
const questSchema = z.object({
  title: text,
  description: z.string().max(5000),
  questType: z
    .enum(["personal", "guild", "weekly", "teacher_custom"])
    .default("teacher_custom"),
  criteria: z.object({
    type: z.enum([
      "reach_job_level",
      "unlock_cross_class",
      "unlock_ultimate",
      "guild_level",
      "total_correct_answers",
      "total_damage",
      "total_healing",
      "custom",
    ]),
    targetJob: z
      .enum(ALL_CHARACTER_CLASSES as [CharacterClass, ...CharacterClass[]])
      .optional(),
    targetClass: z
      .enum(ALL_CHARACTER_CLASSES as [CharacterClass, ...CharacterClass[]])
      .optional(),
    targetLevel: z.number().int().min(1).max(15).optional(),
    targetAmount: z.number().int().min(1).max(1000000).optional(),
    customDescription: z.string().max(2000).optional(),
    criteria1: criterion.optional(),
    criteria2: criterion.optional(),
    criteria3: criterion.optional(),
  }),
  rewards: z
    .object({
      gold: z.number().int().min(0).max(100000).optional(),
      guildXP: z.number().int().min(0).max(100000).optional(),
      unlockTier: z.number().int().min(1).max(10).optional(),
      equipmentItemId: uuid.optional(),
    })
    .default({}),
});
class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function json(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body, (_k, v) => (v instanceof Date ? v.getTime() : v)),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
export function safeStudent(student: s.StudentRecord) {
  const {
    passwordHash: _,
    nicknameNormalized: __,
    createdAt: ___,
    ...safe
  } = student;
  return safe;
}
const method = (r: Request, m: string) => r.method === m;
function safeFight(fight: any) {
  const { questions, ...safe } = fight;
  return { ...safe, questionCount: questions.length };
}
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
        .parse(await request.json());
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
        const input = z.object({ studentId: uuid }).parse(await request.json());
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
            .parse(await request.json());
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
        const input = z
          .object({
            experience: z.number().int().min(0).max(10000000).optional(),
            unlockedTier: z.number().int().min(1).max(10).optional(),
          })
          .parse(await request.json());
        return json(
          (
            await db
              .update(s.guilds)
              .set({
                ...input,
                ...(input.experience !== undefined
                  ? { level: getGuildLevelFromXP(input.experience) }
                  : {}),
              })
              .where(eq(s.guilds.id, id))
              .returning()
          )[0],
        );
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
            .parse(await request.json());
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
            .parse(await request.json());
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
            .parse(await request.json());
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
        await evaluateQuests(db, id);
        return json(
          await db
            .select()
            .from(s.quests)
            .where(
              and(
                eq(s.quests.guildId, id),
                teacher
                  ? sql`true`
                  : sql`(student_id IS NULL OR student_id=${actor.actorId})`,
              ),
            ),
        );
      }
      if (tail === "quests" && method(request, "POST")) {
        const input = questSchema.parse(await request.json());
        if (input.rewards.equipmentItemId) {
          const [item] = await db
            .select()
            .from(s.equipmentItems)
            .where(eq(s.equipmentItems.id, input.rewards.equipmentItemId));
          if (item?.teacherId !== actor.actorId)
            throw new ApiError("Forbidden reward", 403);
        }
        return json(
          (
            await db
              .insert(s.quests)
              .values({ ...input, guildId: id })
              .returning()
          )[0],
          201,
        );
      }
      const qm = tail.match(/^quests\/([^/]+)$/);
      if (qm) {
        uuid.parse(qm[1]);
        const where = and(eq(s.quests.id, qm[1]), eq(s.quests.guildId, id));
        if (method(request, "DELETE")) {
          await db.delete(s.quests).where(where);
          return json({ success: true });
        }
        if (method(request, "PATCH")) {
          const body = (await request.json()) as any;
          if (body.isCompleted === true) {
            await evaluateQuests(db, id, qm[1]);
            return json((await db.select().from(s.quests).where(where))[0]);
          }
          const input = questSchema.partial().parse(body);
          if (input.rewards?.equipmentItemId) {
            const [item] = await db
              .select()
              .from(s.equipmentItems)
              .where(eq(s.equipmentItems.id, input.rewards.equipmentItemId));
            if (item?.teacherId !== actor.actorId)
              throw new ApiError("Forbidden reward", 403);
          }
          return json(
            (await db.update(s.quests).set(input).where(where).returning())[0],
          );
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
        const rows = await db
          .select({
            studentId: s.combatResults.studentId,
            totals: s.combatResults.totals,
            xpEarned: s.combatResults.xpEarned,
          })
          .from(s.combatResults)
          .where(eq(s.combatResults.guildId, id));
        const grouped = new Map<string, number>();
        for (const r of rows)
          grouped.set(
            r.studentId,
            (grouped.get(r.studentId) || 0) +
              (metric === "xpEarned"
                ? r.xpEarned
                : metric === "accuracy"
                  ? (r.totals.questionsCorrect /
                      Math.max(1, r.totals.questionsAnswered)) *
                    100
                  : (r.totals as any)[metric] || 0),
          );
        const members = await db
          .select({
            id: s.students.id,
            nickname: s.students.nickname,
            characterClass: s.students.characterClass,
          })
          .from(s.guildMemberships)
          .innerJoin(
            s.students,
            eq(s.students.id, s.guildMemberships.studentId),
          )
          .where(eq(s.guildMemberships.guildId, id));
        return json(
          members
            .map((m) => ({
              ...m,
              studentId: m.id,
              value: grouped.get(m.id) || 0,
              totalDamageDealt: grouped.get(m.id) || 0,
              fightsCompleted: rows.filter((r) => r.studentId === m.id).length,
              [metric]: grouped.get(m.id) || 0,
            }))
            .sort((a, b) => b.value - a.value),
        );
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
      await evaluateQuests(db, g.id);
      const [current] = await db
        .select()
        .from(s.guilds)
        .where(eq(s.guilds.id, g.id));
      return json(
        (
          await db
            .select()
            .from(s.equipmentItems)
            .where(
              and(
                eq(s.equipmentItems.teacherId, g.teacherId),
                eq(s.equipmentItems.isPurchasable, true),
              ),
            )
        )
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
      const input = itemSchema.parse(await request.json());
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
      if (method(request, "PATCH"))
        return json(
          (
            await db
              .update(s.equipmentItems)
              .set(itemSchema.partial().parse(await request.json()))
              .where(eq(s.equipmentItems.id, item.id))
              .returning()
          )[0],
        );
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
        .map((id) => ({ ...EQUIPMENT_ITEMS[id], tier: 1, quality: "common" }));
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
        if (student.guildId) await evaluateQuests(db, student.guildId);
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
            weapon: z.string().max(100).nullable().optional(),
            headgear: z.string().max(100).nullable().optional(),
            armor: z.string().max(100).nullable().optional(),
            crossClassAbility1: z.string().max(100).nullable().optional(),
            crossClassAbility2: z.string().max(100).nullable().optional(),
          })
          .parse(await request.json());
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
          if (
            builtin?.classRestriction &&
            !builtin.classRestriction.includes(
              student.characterClass || "warrior",
            )
          )
            throw new ApiError("Item is not usable by this job");
          if (
            !item ||
            item.slot !== slot ||
            (!builtin && !student.inventory.includes(itemId))
          )
            throw new ApiError("Equipment is not owned or has the wrong slot");
          const tier = (item as any).tier || 1;
          const level = levels[student.characterClass || "warrior"] || 1;
          if (level < [1, 2, 4, 6, 8, 10, 11, 12, 13, 15][tier - 1])
            throw new ApiError("Job level is too low for this tier");
          if (
            slot === "weapon" &&
            item.weaponType &&
            !WEAPON_RESTRICTIONS[student.characterClass || "warrior"].includes(
              item.weaponType as any,
            )
          )
            throw new ApiError("Weapon is not usable by this job");
        }
        if (
          input.crossClassAbility1 &&
          input.crossClassAbility1 === input.crossClassAbility2
        )
          throw new ApiError("Choose different cross-class abilities");
        return json(
          safeStudent(
            (
              await db
                .update(s.students)
                .set(input)
                .where(eq(s.students.id, id))
                .returning()
            )[0],
          ),
        );
      }
      if (tail === "purchase-item" && method(request, "POST")) {
        const { itemId } = z
          .object({ itemId: uuid })
          .parse(await request.json());
        if (!student.guildId) throw new ApiError("Join a guild first");
        const g = await guild(student.guildId);
        const [item] = await db
          .select()
          .from(s.equipmentItems)
          .where(eq(s.equipmentItems.id, itemId));
        if (
          !item ||
          item.teacherId !== g.teacherId ||
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
            itemId: uuid.optional(),
          })
          .parse(await request.json());
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
    const stats = path.match(
      /^\/api\/combat-stats\/(fight|student|class)\/([^/]+)$/,
    );
    if (stats) {
      let rows: any[] = [];
      if (stats[1] === "student") {
        ownStudent(stats[2]);
        rows = await db
          .select()
          .from(s.combatResults)
          .where(eq(s.combatResults.studentId, stats[2]));
      } else if (stats[1] === "fight") {
        requireTeacher();
        const fight = await repository.findFightById(uuid.parse(stats[2]));
        if (fight?.teacherId !== actor.actorId)
          throw new ApiError("Forbidden", 403);
        rows = await db
          .select()
          .from(s.combatResults)
          .where(eq(s.combatResults.fightId, fight.id));
      } else {
        requireTeacher();
        const owner = await repository.findTeacherById(actor.actorId);
        if (owner?.guildCode === stats[2]) {
          rows = (
            await db
              .select({ result: s.combatResults })
              .from(s.combatResults)
              .innerJoin(s.fights, eq(s.fights.id, s.combatResults.fightId))
              .where(eq(s.fights.teacherId, actor.actorId))
          ).map((r) => r.result);
        } else {
          const gs = await db
            .select()
            .from(s.guilds)
            .where(
              and(
                eq(s.guilds.teacherId, actor.actorId),
                eq(s.guilds.code, stats[2]),
              ),
            );
          rows = gs.length
            ? await db
                .select()
                .from(s.combatResults)
                .where(
                  inArray(
                    s.combatResults.guildId,
                    gs.map((g) => g.id),
                  ),
                )
            : [];
        }
      }
      const names = rows.length
        ? await db
            .select({ id: s.students.id, nickname: s.students.nickname })
            .from(s.students)
            .where(
              inArray(
                s.students.id,
                rows.map((r) => r.studentId),
              ),
            )
        : [];
      return json(
        rows.map((r) => ({
          ...r,
          ...r.totals,
          nickname:
            names.find((n) => n.id === r.studentId)?.nickname || "Student",
          lootItemClaimed: r.rewardClaim,
        })),
      );
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
    return json({ error: "Route not found" }, 404);
  } catch (error) {
    if (error instanceof ApiError || error instanceof RewardError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return json({ error: "Invalid request" }, 400);
    console.error("game_api_failed", path);
    return json({ error: "Unable to complete request" }, 503);
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
  const results = await db
    .select({ loot: s.combatResults.lootTable })
    .from(s.combatResults)
    .where(eq(s.combatResults.studentId, id));
  return {
    teacherIds: guilds.map((g) => g.teacherId),
    itemIds: [
      ...(student?.inventory || []),
      ...results.flatMap((r) => r.loot.map((i) => i.itemId)),
    ],
  };
}
