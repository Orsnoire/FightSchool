import type { CombatPlayer, CombatSnapshot } from "./model";
import type { FightQuestion } from "../../worker/db/schema";
import { questionKey } from "../../worker/progression/question-key";

/** Server-only outbox. No submitted answers are broadcast or written to diagnostics. */
export interface QuestionAttempt {
  round: number;
  studentId: string;
  guildId: string | null;
  job: CombatPlayer["characterClass"];
  questionId: string;
  questionVersion: string;
  question: FightQuestion;
  outcome: "correct" | "incorrect" | "unanswered";
}
export function recordAttempt(
  state: CombatSnapshot,
  player: CombatPlayer,
  question: FightQuestion,
  submitted: boolean,
) {
  const attempts = (state.pendingAttempts ||= []);
  if (
    attempts.some(
      (a) => a.round === state.round && a.studentId === player.studentId,
    )
  )
    return;
  attempts.push({
    round: state.round,
    studentId: player.studentId,
    guildId: player.questGuildId || null,
    job: player.characterClass,
    questionId: question.id,
    questionVersion: questionKey(question),
    question: structuredClone(question),
    outcome: !submitted
      ? "unanswered"
      : player.lastAnswerCorrect
        ? "correct"
        : "incorrect",
  });
}
