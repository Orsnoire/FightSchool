import type { DbFight } from "../../shared/contracts/dto";
// Do not expose question answers in guild/available-fight listings.
export function safeFight<T extends {
  questions: DbFight["questions"];
}>(fight: T): Omit<T, "questions"> & {
  questionCount: number;
} {
  const { questions, ...safe } = fight;
  return { ...safe, questionCount: questions.length };
}
