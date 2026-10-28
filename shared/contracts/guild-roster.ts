import type { CharacterClass } from '../schema';
export interface TeacherRosterMember {
  studentId: string;
  nickname: string;
  joinedAt: number;
  jobLevels: Record<CharacterClass, number>;
  totalAAsEarned: number;
}
