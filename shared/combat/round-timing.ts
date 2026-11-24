import { ANSWER_FEEDBACK_MS } from "./answer-feedback";

export const QUESTION_LEAD_IN_MS = 3_000;
export const ACTION_WINDOW_MS = 20_000;
export const ABILITY_WINDOW_MS = 20_000;
export const ROUND_ALLOWANCE_SECONDS = 30;

export function estimatedQuizSeconds(questions: readonly { timeLimit: number }[]): number {
  const timedPhases = (QUESTION_LEAD_IN_MS + ANSWER_FEEDBACK_MS + ACTION_WINDOW_MS + ABILITY_WINDOW_MS) / 1000;
  return questions.reduce((sum, question) => sum + question.timeLimit + timedPhases + ROUND_ALLOWANCE_SECONDS, 0);
}
