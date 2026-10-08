import { z } from "zod";
import {
  ALL_CHARACTER_CLASSES,
  type CharacterClass,
  type QuestCriteria,
  type QuestReward,
} from "./schema";
import { JOB_TREE, getUnlockedJobs } from "./jobSystem";

export const LIMIT_CAPS = [4, 8, 10, 15] as const;
export const limitLevel = (tier: number) =>
  LIMIT_CAPS[Math.max(0, Math.min(3, tier - 1))];
export const effectiveLevels = (
  levels: Partial<Record<CharacterClass, number>>,
  tier: number,
) =>
  Object.fromEntries(
    Object.entries(levels).map(([job, level]) => [
      job,
      Math.min(level!, limitLevel(tier)),
    ]),
  ) as Partial<Record<CharacterClass, number>>;
export const QUEST_OBJECTIVES = {
  manual: "Teacher-confirmed objective",
  fight_accuracy: "% correct on a quiz fight",
  class_at_cap: "% of class with a level-capped job",
  unlock_job: "Unlock a job",
  unlock_license: "Unlock a cross-class ability",
  solo_fights: "Win X solo fights",
  perfect_clear: "100% accuracy clear",
  master_bank: "Answer every question correctly (across attempts)",
  try_solo: "Try a specific fight solo",
  reach_job_level: "Reach a job level",
  total_correct_answers: "Answer X questions correctly",
} as const;
export type ObjectiveType = keyof typeof QUEST_OBJECTIVES;
const job = z.enum(
  ALL_CHARACTER_CLASSES as [CharacterClass, ...CharacterClass[]],
);
const legacyCriterion = z.object({
  fightId: z.string().uuid().optional(),
  mode: z.enum(["solo", "teacher", "any"]).optional(),
  accuracy: z.number().min(0).max(100).optional(),
  performanceType: z.enum(["individual", "class_average"]).optional(),
});
export const questInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    questType: z
      .enum(["personal", "guild", "weekly", "teacher_custom"])
      .default("teacher_custom"),
    studentId: z.string().uuid().nullable().optional(),
    assignToAll: z.boolean().optional(),
    criteria: z.object({
      type: z.enum([
        ...Object.keys(QUEST_OBJECTIVES),
        "unlock_cross_class",
        "unlock_ultimate",
        "guild_level",
        "total_damage",
        "total_healing",
        "custom",
      ] as unknown as [string, ...string[]]),
      targetJob: job.optional(),
      targetClass: job.optional(),
      targetLevel: z.number().int().min(1).max(15).optional(),
      targetAmount: z.number().int().min(1).max(1000000).optional(),
      fightId: z.string().uuid().optional(),
      accuracy: z.number().min(1).max(100).optional(),
      percentage: z.number().min(1).max(100).optional(),
      mode: z.enum(["solo", "teacher", "any"]).optional(),
      performanceType: z.enum(["individual", "class_average"]).optional(),
      customDescription: z.string().max(2000).optional(),
      criteria1: legacyCriterion.optional(),
      criteria2: legacyCriterion.optional(),
      criteria3: legacyCriterion.optional(),
    }),
    rewards: z
      .object({
        gold: z.number().int().min(0).max(100000).optional(),
        guildXP: z.number().int().min(0).max(100000).optional(),
        unlockTier: z.number().int().min(1).max(10).optional(),
        equipmentItemId: z.string().min(1).optional(),
        limitBreak: z.number().int().min(2).max(4).optional(),
        unlockJob: job.optional(),
      })
      .default({}),
  })
  .superRefine((q, ctx) => {
    const problem = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    const c = q.criteria;
    if (
      ["fight_accuracy", "master_bank", "try_solo"].includes(c.type) &&
      !c.fightId
    )
      problem("Choose a fight.");
    if (
      [
        "unlock_job",
        "unlock_cross_class",
        "unlock_license",
        "unlock_ultimate",
        "reach_job_level",
      ].includes(c.type) &&
      !c.targetJob &&
      !c.targetClass
    )
      problem("Choose a job.");
    if (c.type === "fight_accuracy" && !c.accuracy)
      problem("Choose the required accuracy.");
    if (
      c.type === "class_at_cap" &&
      (!c.percentage || q.studentId || q.questType === "personal")
    )
      problem("Class percentage requires a guild quest and a percentage.");
    if (c.type === "reach_job_level" && !c.targetLevel)
      problem("Choose a job level.");
    if (c.type === "solo_fights" && !c.targetAmount)
      problem("Choose the number of solo victories.");
    if ((q.questType === "personal") !== !!(q.studentId || q.assignToAll))
      problem(
        "Personal quests require a student; guild quests must not select a student.",
      );
    if (
      q.rewards.limitBreak &&
      (q.studentId || q.assignToAll || q.questType !== "guild")
    )
      problem("Limit breaks are rewards for one-time guild quests only.");
  });

export interface QuestEvidence {
  studentId: string;
  sessionId: string;
  fightId: string;
  isSoloMode: boolean;
  victory: boolean;
  answered: number;
  correct: number;
  correctKeys: string[];
  bankKeys: string[];
  updatedAt: number;
}
export interface QuestContext {
  levels: Partial<Record<CharacterClass, number>>;
  unlockedJobs: CharacterClass[];
  members: Array<{ levels: Partial<Record<CharacterClass, number>> }>;
  limitTier: number;
  guildLevel: number;
  totals: { correct: number; damage: number; healing: number };
  evidence: QuestEvidence[];
  bankKeys?: string[];
}
export interface QuestProgress {
  current: number;
  target: number;
  complete: boolean;
  label: string;
}
const progress = (
  current: number,
  target: number,
  label: string,
): QuestProgress => ({
  current,
  target,
  complete: target > 0 && current >= target,
  label,
});
export function questProgress(
  c: QuestCriteria,
  x: QuestContext,
): QuestProgress {
  const targetJob = c.targetJob || c.targetClass;
  const rows = x.evidence.filter(
    (r) =>
      (!c.fightId || r.fightId === c.fightId) &&
      (c.mode !== "solo" || r.isSoloMode) &&
      (c.mode !== "teacher" || !r.isSoloMode),
  );
  switch (c.type) {
    case "reach_job_level":
    case "unlock_ultimate":
      return progress(
        targetJob ? x.levels[targetJob] || 0 : 0,
        c.targetLevel || 15,
        "Job level",
      );
    case "unlock_job":
    case "unlock_cross_class":
      return progress(
        targetJob &&
          getUnlockedJobs(
            x.levels as Record<CharacterClass, number>,
            x.unlockedJobs,
          ).includes(targetJob)
          ? 1
          : 0,
        1,
        "Job unlocked",
      );
    case "unlock_license": {
      const unlock = targetJob
        ? Object.entries(JOB_TREE[targetJob].levelRewards).find(([, r]) =>
            r.abilities?.some((a) => a.isCrossClass),
          )
        : undefined;
      return progress(
        targetJob ? x.levels[targetJob] || 0 : 0,
        unlock ? Number(unlock[0]) : 15,
        "Cross-class ability level",
      );
    }
    case "class_at_cap":
      return progress(
        x.members.length
          ? (100 *
              x.members.filter((m) =>
                Object.values(m.levels).some(
                  (l) => l! >= limitLevel(x.limitTier),
                ),
              ).length) /
              x.members.length
          : 0,
        c.percentage || 100,
        "% of current members at cap",
      );
    case "solo_fights":
      return progress(
        new Set(
          rows.filter((r) => r.isSoloMode && r.victory).map((r) => r.sessionId),
        ).size,
        c.targetAmount || 1,
        "Solo victories",
      );
    case "try_solo":
      return progress(
        rows.some((r) => r.isSoloMode && r.answered > 0) ? 1 : 0,
        1,
        "Solo attempt (one resolved question)",
      );
    case "fight_accuracy":
    case "perfect_clear": {
      const eligible = rows.filter((r) => r.victory && r.answered > 0);
      let best = 0;
      if (c.performanceType === "class_average")
        for (const id of new Set(eligible.map((r) => r.sessionId))) {
          const group = eligible.filter((r) => r.sessionId === id);
          best = Math.max(
            best,
            (100 * group.reduce((n, r) => n + r.correct, 0)) /
              group.reduce((n, r) => n + r.answered, 0),
          );
        }
      else
        best = Math.max(
          0,
          ...eligible.map((r) => (100 * r.correct) / r.answered),
        );
      return progress(
        best,
        c.type === "perfect_clear" ? 100 : c.accuracy || 100,
        "% correct in a victorious clear",
      );
    }
    case "master_bank": {
      const keys = new Set(rows.flatMap((r) => r.correctKeys));
      const bank = [...new Set(x.bankKeys || [])];
      return progress(
        bank.filter((k) => keys.has(k)).length,
        bank.length,
        "Unique questions mastered",
      );
    }
    case "guild_level":
      return progress(x.guildLevel, c.targetAmount || 1, "Guild level");
    case "total_correct_answers":
      return progress(x.totals.correct, c.targetAmount || 1, "Correct answers");
    case "total_damage":
      return progress(x.totals.damage, c.targetAmount || 1, "Damage");
    case "total_healing":
      return progress(x.totals.healing, c.targetAmount || 1, "Healing");
    case "custom": {
      const criteria = [c.criteria1, c.criteria2, c.criteria3].filter(Boolean);
      const complete =
        criteria.length > 0 &&
        criteria.every(
          (k) => questProgress({ type: "fight_accuracy", ...k }, x).complete,
        );
      return progress(complete ? 1 : 0, 1, "Teacher objective");
    }
    default:
      return progress(0, 1, "Awaiting teacher confirmation");
  }
}
export function rewardLabels(r: QuestReward | null | undefined): string[] {
  if (!r) return [];
  return [
    r.gold ? `${r.gold} gold` : null,
    r.guildXP ? `${r.guildXP} guild XP` : null,
    r.unlockTier ? `Shop tier ${r.unlockTier}` : null,
    r.equipmentItemId ? "Equipment item" : null,
    r.limitBreak
      ? `Limit tier ${r.limitBreak} · level ${limitLevel(r.limitBreak)}`
      : null,
    r.unlockJob
      ? `Unlock ${JOB_TREE[r.unlockJob].name} (prerequisites waived)`
      : null,
  ].filter(Boolean) as string[];
}
