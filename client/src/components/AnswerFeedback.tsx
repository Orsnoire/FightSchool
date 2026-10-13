import type { AnswerOutcome } from "@shared/combat/answer-feedback";
import { RichContentRenderer } from "./RichContentRenderer";

export function AnswerFeedback({ correctAnswer, outcome }: { correctAnswer?: string; outcome?: AnswerOutcome }) {
  return <section className="space-y-4" aria-label="Answer feedback">
    {outcome && <p role="status" className={`text-2xl font-bold ${outcome === "correct" ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
      {outcome === "correct" ? "Correct!" : outcome === "incorrect" ? "Incorrect" : "No answer submitted"}
    </p>}
    <div className="rounded-xl border bg-muted/50 p-4">
      <p className="mb-2 text-sm font-semibold">Correct answer</p>
      {correctAnswer !== undefined ? <RichContentRenderer html={correctAnswer} /> : <p>Loading answer…</p>}
    </div>
    <p className="text-sm text-muted-foreground">Combat choices begin next.</p>
  </section>;
}
