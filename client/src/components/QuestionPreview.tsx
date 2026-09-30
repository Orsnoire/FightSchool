import type { Question } from "@shared/schema";
import { RichContentRenderer } from "@/components/RichContentRenderer";

export function QuestionPreview({ question }: { question: Partial<Question> }) {
  const options = question.type === "true_false"
    ? ["True", "False"]
    : question.options?.filter((option) => option.trim());

  return (
    <div className="space-y-4 rounded-md border border-border bg-background p-4" data-testid="question-preview">
      <RichContentRenderer html={question.question || ""} className="text-lg" />
      {options && options.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-3 rounded-md border border-border p-3" data-testid={`preview-option-${index}`}>
              <span className="shrink-0 text-sm font-semibold">{String.fromCharCode(65 + index)}.</span>
              <RichContentRenderer html={option} className="min-w-0 flex-1" />
            </div>
          ))}
        </div>
      )}
      {question.type === "short_answer" && (
        <input disabled aria-label="Student answer preview" placeholder="Type your answer…" className="h-10 w-full rounded-md border border-border bg-background px-3" />
      )}
    </div>
  );
}
