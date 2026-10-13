import type { CombatPhase, CombatPlayer } from "./model";

export const ANSWER_FEEDBACK_MS = 4000;
export type AnswerOutcome = "correct" | "incorrect" | "unanswered";
export function answersRevealed(phase: CombatPhase): boolean {
  return ["answer_feedback", "actions", "abilities", "question_resolution", "enemy_ai"].includes(phase);
}
export function answerOutcome(p: CombatPlayer): AnswerOutcome | undefined {
  if (!p.hasAnswered) return undefined;
  return p.lastAnswerCorrect ? "correct" : p.currentAnswer?.trim() ? "incorrect" : "unanswered";
}
