import { eq, inArray, sql } from "drizzle-orm";
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
  totals: { correct: number; damage: number; healing: number },
  guildLevel: number,
): boolean {
  switch (c.type) {
    case "reach_job_level":
    case "unlock_ultimate":
      return (
        !!c.targetJob && (levels[c.targetJob] || 0) >= (c.targetLevel || 15)
      );
    case "unlock_cross_class":
      return (
        !!(c.targetClass || c.targetJob) &&
        getUnlockedJobs(levels as Record<CharacterClass, number>).includes(
          (c.targetClass || c.targetJob)!,
        )
      );
    case "guild_level":
      return guildLevel >= (c.targetAmount || 1);
    case "total_correct_answers":
      return totals.correct >= (c.targetAmount || 1);
    case "total_damage":
      return totals.damage >= (c.targetAmount || 1);
    case "total_healing":
      return totals.healing >= (c.targetAmount || 1);
    default:
      return false;
  }
}
export async function evaluateQuests(
  db: GameDatabase,
  guildId: string,
  manualQuestId?: string,
) {
  const [guild] = await db
    .select()
    .from(s.guilds)
    .where(eq(s.guilds.id, guildId));
  if (!guild) return;
  const quests = await db
    .select()
    .from(s.quests)
    .where(eq(s.quests.guildId, guildId));
  const results = await db
    .select()
    .from(s.combatResults)
    .where(eq(s.combatResults.guildId, guildId));
  const members = await db
    .select()
    .from(s.guildMemberships)
    .where(eq(s.guildMemberships.guildId, guildId));
  // Every Neon HTTP query consumes a Worker subrequest. Load job levels once
  // for the whole guild instead of once for each of its personal quests.
  const studentIds = [...new Set(quests.map(q => q.studentId).filter((id): id is string => !!id))];
  const jobs = studentIds.length
    ? await db.select().from(s.studentJobLevels).where(inArray(s.studentJobLevels.studentId, studentIds))
    : [];
  const levelsByStudent = new Map<string, Partial<Record<CharacterClass, number>>>();
  for (const job of jobs) {
    const levels = levelsByStudent.get(job.studentId) || {};
    levels[job.jobClass as CharacterClass] = job.level;
    levelsByStudent.set(job.studentId, levels);
  }
  const week = Math.floor(Date.now() / (7 * 86400000));
  const completedQuestIds: string[] = [];
  const completions = [];
  for (const quest of quests) {
    const relevant = results.filter(
      (r) =>
        (!quest.studentId || r.studentId === quest.studentId) &&
        (quest.questType !== "weekly" ||
          Math.floor(r.completedAt / (7 * 86400000)) === week),
    );
    const levels = quest.studentId ? levelsByStudent.get(quest.studentId) || {} : {};
    const totals = relevant.reduce(
      (n, r) => ({
        correct: n.correct + r.totals.questionsCorrect,
        damage: n.damage + r.totals.damageDealt,
        healing: n.healing + r.totals.healingDone,
      }),
      { correct: 0, damage: 0, healing: 0 },
    );
    let completed =
      (quest.isCompleted &&
        (quest.questType !== "weekly" || quest.completedWeek === week)) ||
      criterionSatisfied(quest.criteria, levels, totals, guild.level);
    if (quest.criteria.type === "custom" && !completed) {
      const criteria = [
        quest.criteria.criteria1,
        quest.criteria.criteria2,
        quest.criteria.criteria3,
      ].filter(Boolean) as CustomQuestCriterion[];
      completed =
        criteria.length > 0 &&
        criteria.every((c) => {
          const rows = relevant.filter(
            (r) =>
              r.victory &&
              (!c.fightId || r.fightId === c.fightId) &&
              (c.mode !== "solo" || r.isSoloMode) &&
              (c.mode !== "teacher" || !r.isSoloMode),
          );
          if (c.performanceType === "class_average") {
            const sessions = [...new Set(rows.map((r) => r.sessionId))];
            return sessions.some((session) => {
              const group = rows.filter((r) => r.sessionId === session);
              const answered = group.reduce(
                (n, r) => n + r.totals.questionsAnswered,
                0,
              );
              const correct = group.reduce(
                (n, r) => n + r.totals.questionsCorrect,
                0,
              );
              return (
                answered > 0 && (correct / answered) * 100 >= (c.accuracy || 0)
              );
            });
          }
          return rows.some(
            (r) =>
              r.totals.questionsAnswered > 0 &&
              (r.totals.questionsCorrect / r.totals.questionsAnswered) * 100 >=
                (c.accuracy || 0),
          );
        });
    }
    if (quest.id === manualQuestId) completed = true;
    if (!completed) continue;
    completedQuestIds.push(quest.id);
    const period = quest.questType === "weekly" ? String(week) : "once";
    const recipients = quest.studentId
      ? [quest.studentId]
      : members.map((m) => m.studentId);
    for (const studentId of recipients)
      completions.push(sql`(${quest.id}::uuid,${studentId}::uuid,${period}::text)`);
  }
  // A whole class can reach a milestone together. Batch transitions so neither
  // the number of students nor the number of completed quests exhausts fetches.
  if (completedQuestIds.length) await db.execute(sql`WITH completed AS (
 UPDATE quests SET is_completed=true, completed_at=${Date.now()}, completed_week=${week}
 WHERE id IN (${sql.join(completedQuestIds.map(id => sql`${id}::uuid`), sql`, `)})
 AND (is_completed=false OR (quest_type='weekly' AND completed_week IS DISTINCT FROM ${week})) RETURNING rewards)
 UPDATE guilds SET experience=experience+COALESCE((SELECT sum((rewards->>'guildXP')::integer) FROM completed),0),
 unlocked_tier=GREATEST(unlocked_tier,COALESCE((SELECT max((rewards->>'unlockTier')::integer) FROM completed),1)) WHERE id=${guildId}`);
  if (completions.length) await db.execute(sql`WITH completion AS (
 INSERT INTO quest_completions(quest_id,student_id,period) VALUES ${sql.join(completions, sql`, `)}
 ON CONFLICT(quest_id,student_id,period) DO NOTHING RETURNING quest_id,student_id),
 earned AS (SELECT completion.student_id, sum(COALESCE((quests.rewards->>'gold')::integer,0)) AS gold,
 jsonb_agg(quests.rewards->>'equipmentItemId') FILTER (WHERE quests.rewards->>'equipmentItemId' IS NOT NULL) AS items
 FROM completion JOIN quests ON quests.id=completion.quest_id GROUP BY completion.student_id)
 UPDATE students SET gold=students.gold+earned.gold,
 inventory=students.inventory || COALESCE((SELECT jsonb_agg(DISTINCT item)
 FROM jsonb_array_elements(COALESCE(earned.items,'[]'::jsonb)) AS items(item)
 WHERE NOT(students.inventory @> jsonb_build_array(item))), '[]'::jsonb)
 FROM earned WHERE students.id=earned.student_id`);
  const [current] = await db
    .select()
    .from(s.guilds)
    .where(eq(s.guilds.id, guildId));
  if (current) {
    const level = getGuildLevelFromXP(current.experience);
    await db
      .update(s.guilds)
      .set({
        level,
        unlockedTier: Math.max(
          current.unlockedTier,
          level >= 5 ? 10 : level >= 3 ? 5 : 1,
        ),
      })
      .where(eq(s.guilds.id, guildId));
  }
}
