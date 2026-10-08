import {
  questProgress,
  type QuestContext,
  type QuestEvidence,
  type QuestProgress,
} from "../../shared/quests";
import { questionKey } from "./question-key";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { GameDatabase } from "../db/game-repository.ts";
import * as s from "../db/schema.ts";
import { JOB_TREE, getUnlockedJobs } from "../../shared/jobSystem.ts";
import {
  ALL_CHARACTER_CLASSES,
  getGuildLevelFromXP,
  type CharacterClass,
  type QuestCriteria,
  type CustomQuestCriterion,
} from "../../shared/schema.ts";
async function seed(
  db: GameDatabase,
  values: (typeof s.quests.$inferInsert)[],
) {
  if (values.length)
    await db.insert(s.quests).values(values).onConflictDoNothing();
}
export async function seedGuildQuests(db: GameDatabase, guildId: string) {
  await seed(db, [
    ...Array.from({ length: 9 }, (_, i) => ({
      guildId,
      title: `Shop tier ${i + 2}`,
      description: `Answer ${(i + 1) * 100} questions correctly together.`,
      questType: "guild" as const,
      criteria: {
        type: "total_correct_answers" as const,
        targetAmount: (i + 1) * 100,
      },
      rewards: { unlockTier: i + 2, guildXP: 25 * (i + 1) },
      isSeeded: true,
    })),
    {
      guildId,
      title: "Weekly accuracy",
      description:
        "Complete a group fight with at least 70% accuracy this week.",
      questType: "weekly",
      criteria: {
        type: "custom",
        criteria1: {
          mode: "teacher",
          accuracy: 70,
          performanceType: "class_average",
        },
      },
      rewards: { guildXP: 100 },
      isSeeded: true,
    },
    {
      guildId,
      title: "Weekly teamwork",
      description:
        "Complete a group fight with everyone answering correctly this week.",
      questType: "weekly",
      criteria: {
        type: "custom",
        criteria1: {
          mode: "teacher",
          accuracy: 100,
          performanceType: "class_average",
        },
      },
      rewards: { guildXP: 150 },
      isSeeded: true,
    },
  ]);
}
export async function seedPersonalQuests(
  db: GameDatabase,
  studentId: string,
  guildId: string,
) {
  await seed(
    db,
    ALL_CHARACTER_CLASSES.flatMap((job) => [
      ...(JOB_TREE[job].unlockRequirements
        ? [
            {
              guildId,
              studentId,
              questType: "personal" as const,
              title: `Unlock ${JOB_TREE[job].name}`,
              description: `Meet the requirements to unlock ${JOB_TREE[job].name}.`,
              criteria: { type: "unlock_job" as const, targetJob: job },
              rewards: { gold: 100 },
              isSeeded: true,
            },
          ]
        : []),
      {
        guildId,
        studentId,
        questType: "personal" as const,
        title: `${JOB_TREE[job].name} cross-class license`,
        description: `Unlock the first cross-class ability from ${JOB_TREE[job].name}.`,
        criteria: { type: "unlock_license" as const, targetJob: job },
        rewards: { gold: 100 },
        isSeeded: true,
      },
      ...[4, 8, 10].map((level) => ({
        guildId,
        studentId,
        questType: "personal" as const,
        title: `${JOB_TREE[job].name} level ${level}`,
        description: `Reach level ${level} as ${JOB_TREE[job].name}.`,
        criteria: {
          type: "reach_job_level" as const,
          targetJob: job,
          targetLevel: level,
        },
        rewards: { gold: level * 50 },
        isSeeded: true,
      })),
      {
        guildId,
        studentId,
        questType: "personal" as const,
        title: `${JOB_TREE[job].name} ultimate`,
        description: `Reach level 15 as ${JOB_TREE[job].name} and discover your ultimate.`,
        criteria: {
          type: "unlock_ultimate" as const,
          targetJob: job,
          targetLevel: 15,
        },
        rewards: { gold: 1500 },
        isSeeded: true,
      },
    ]),
  );
}
export function criterionSatisfied(
  c: QuestCriteria,
  levels: Partial<Record<CharacterClass, number>>,
  totals: QuestContext["totals"],
  guildLevel: number,
): boolean {
  return questProgress(c, {
    levels,
    totals,
    guildLevel,
    limitTier: 4,
    members: [],
    unlockedJobs: [],
    evidence: [],
  }).complete;
}
export type QuestView = typeof s.quests.$inferSelect & {
  progress: QuestProgress;
};
/** Read evidence once for a class; deterministic criteria are shared with tests and presentation. */
export async function evaluateQuests(
  db: GameDatabase,
  guildId: string,
  manualQuestId?: string,
): Promise<QuestView[]> {
  const [guild] = await db
    .select()
    .from(s.guilds)
    .where(eq(s.guilds.id, guildId));
  if (!guild) return [];
  const quests = await db
    .select()
    .from(s.quests)
    .where(eq(s.quests.guildId, guildId));
  const members = await db
    .select()
    .from(s.guildMemberships)
    .where(eq(s.guildMemberships.guildId, guildId));
  const ids = members.map((m) => m.studentId);
  const jobs = ids.length
    ? await db
        .select()
        .from(s.studentJobLevels)
        .where(inArray(s.studentJobLevels.studentId, ids))
    : [];
  const students = ids.length
    ? await db
        .select({ id: s.students.id, grantedJobs: s.students.grantedJobs })
        .from(s.students)
        .where(inArray(s.students.id, ids))
    : [];
  const results = await db
    .select()
    .from(s.combatResults)
    .where(eq(s.combatResults.guildId, guildId));
  const evidenceRows = await db.execute(
    sql`SELECT * FROM quest_fight_evidence WHERE guild_id=${guildId}`,
  );
  const evidence: QuestEvidence[] = evidenceRows.rows.map((r: any) => ({
    studentId: r.student_id,
    sessionId: r.session_id,
    fightId: r.fight_id,
    isSoloMode: r.is_solo_mode,
    victory: r.victory,
    answered: r.answered,
    correct: r.correct,
    correctKeys: r.correct_keys,
    bankKeys: r.bank_keys,
    updatedAt: Number(r.updated_at),
  }));
  // Historical aggregates may prove accuracy/clear goals, but never invented per-question mastery.
  const seen = new Set(evidence.map((r) => r.sessionId + ":" + r.studentId));
  for (const r of results)
    if (!seen.has(r.sessionId + ":" + r.studentId))
      evidence.push({
        studentId: r.studentId,
        sessionId: r.sessionId,
        fightId: r.fightId,
        isSoloMode: r.isSoloMode,
        victory: r.victory,
        answered: r.totals.questionsAnswered,
        correct: r.totals.questionsCorrect,
        correctKeys: [],
        bankKeys: [],
        updatedAt: r.completedAt,
      });
  const fights = await db
    .select({ id: s.fights.id, questions: s.fights.questions })
    .from(s.fights)
    .where(eq(s.fights.teacherId, guild.teacherId));
  const banks = new Map(
    fights.map((f) => [f.id, f.questions.map(questionKey)]),
  );
  const levels = (id: string) =>
    Object.fromEntries(
      jobs.filter((j) => j.studentId === id).map((j) => [j.jobClass, j.level]),
    ) as Partial<Record<CharacterClass, number>>;
  const week = Math.floor(Date.now() / (7 * 86400000));
  const awards: Array<{ id: string; period: string; recipients: string[] }> =
    [];
  const views = quests.map((q) => {
    const eligible = results.filter(
      (r) =>
        (!q.studentId || q.studentId === r.studentId) &&
        (q.questType !== "weekly" ||
          Math.floor(r.completedAt / (7 * 86400000)) === week),
    );
    const context: QuestContext = {
      levels: q.studentId ? levels(q.studentId) : {},
      unlockedJobs:
        students.find((s) => s.id === q.studentId)?.grantedJobs || [],
      members: ids.map((id) => ({ levels: levels(id) })),
      limitTier: guild.limitTier,
      guildLevel: guild.level,
      totals: eligible.reduce(
        (a, r) => ({
          correct: a.correct + r.totals.questionsCorrect,
          damage: a.damage + r.totals.damageDealt,
          healing: a.healing + r.totals.healingDone,
        }),
        { correct: 0, damage: 0, healing: 0 },
      ),
      evidence: evidence.filter(
        (r) =>
          (!q.studentId || q.studentId === r.studentId) &&
          (q.questType !== "weekly" ||
            Math.floor(r.updatedAt / (7 * 86400000)) === week),
      ),
      bankKeys: q.criteria.fightId ? banks.get(q.criteria.fightId) : undefined,
    };
    let p = questProgress(q.criteria, context);
    // Guild job/license milestones mean any current member achieves the objective.
    if (
      !q.studentId &&
      [
        "unlock_job",
        "unlock_cross_class",
        "unlock_license",
        "reach_job_level",
        "unlock_ultimate",
      ].includes(q.criteria.type)
    ) {
      const options = ids.map((id) =>
        questProgress(q.criteria, {
          ...context,
          levels: levels(id),
          unlockedJobs: students.find((s) => s.id === id)?.grantedJobs || [],
        }),
      );
      p = options.sort((a, b) => b.current - a.current)[0] || p;
    }
    const already =
      q.isCompleted && (q.questType !== "weekly" || q.completedWeek === week);
    const complete = already || p.complete || q.id === manualQuestId;
    const activeRecipient = !q.studentId || ids.includes(q.studentId);
    if (complete && !guild.isArchived && !q.isArchived && activeRecipient)
      awards.push({
        id: q.id,
        period: q.questType === "weekly" ? String(week) : "once",
        recipients: q.studentId ? [q.studentId] : ids,
      });
    return {
      ...q,
      isCompleted:
        already ||
        (!guild.isArchived && !q.isArchived && activeRecipient && complete),
      progress: { ...p, complete: already || p.complete },
    };
  });
  if (awards.length) {
    await db.execute(
      sql`SELECT award_quest_batch(${guildId}::uuid,${JSON.stringify(awards)}::jsonb)`,
    );
    const [updated] = await db
      .select()
      .from(s.guilds)
      .where(eq(s.guilds.id, guildId));
    await db
      .update(s.guilds)
      .set({ level: getGuildLevelFromXP(updated.experience) })
      .where(eq(s.guilds.id, guildId));
  }
  return views;
}
