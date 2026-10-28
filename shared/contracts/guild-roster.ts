import type { CharacterClass } from '../schema';
export interface TeacherRosterMember {
  studentId: string;
  nickname: string;
  joinedAt: number;
  jobLevels: Record<CharacterClass, number>;
  totalAAsEarned: number;
  weeklyActiveHours: number | null;
  activityTrackedSince: number | null;
  activityHistoryPartial: boolean;
  dailyAccuracy: number | null;
  dailyCorrect: number;
  dailyAttempts: number;
  dailyFights: number;
  dailyLegacyFights: number;
}
