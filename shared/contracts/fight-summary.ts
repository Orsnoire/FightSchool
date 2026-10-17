// List cards and assignment pickers must not fetch authoring question banks.
export interface FightSummary {
  id: string;
  teacherId: string;
  title: string;
  guildCode: string | null;
  encounterTier: number | null;
  questionCount: number;
  enemyCount: number;
  createdAt: number;
  updatedAt: number;
}
