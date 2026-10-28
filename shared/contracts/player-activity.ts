import { z } from 'zod';
export const ACTIVITY_SAMPLE_MS = 30_000;
export const ACTIVITY_IDLE_MS = 120_000;
export const ACTIVITY_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const activityPulseInput = z.object({ pulseId: z.string().uuid(), active: z.boolean() }).strict();
