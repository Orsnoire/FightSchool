import { z } from "zod";
const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
export const guildInput = z
  .object({
    name: text,
    description: z.string().max(3000).nullable().optional(),
  });
export const guildPatch = z
  .object({
    name: text.optional(),
    description: z.string().max(3000).nullable().optional(),
  });
export const guildProgressionInput = z
  .object({
    limitTier: z.number().int().min(1).max(4).optional(),
    experience: z.number().int().min(0).max(10000000).optional(),
    unlockedTier: z.number().int().min(1).max(10).optional(),
  });
export const guildSettingsInput = z
  .object({
    hiddenLeaderboardMetrics: z
      .array(z.enum([
        "damageDealt",
        "damageBlocked",
        "healingDone",
        "questionsCorrect",
        "accuracy",
        "xpEarned",
      ]))
      .max(8)
      .optional(),
    enableGroupQuests: z.boolean().optional(),
    enableChat: z.literal(false).optional(),
  });
export const guildMemberInput = z.object({ studentId: uuid });
export const guildAssignmentInput = z.object({ fightId: uuid });
export const guildSoloInput = z.object({ enabled: z.boolean() });
export type GuildInput = z.infer<typeof guildInput>;
export type GuildProgressionInput = z.infer<typeof guildProgressionInput>;

/** Discovery only: combat players, questions and answer keys are never included. */
export interface ActiveGuildSession {
  sessionId: string;
  fightId: string;
  title: string;
  status: 'waiting' | 'active';
  soloMode: boolean;
  isHost: boolean;
  hostNickname: string | null;
  createdAt: number;
}
