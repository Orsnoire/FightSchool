import { fightQuestionsSchema, insertFightSchema } from "@shared/contracts/fights";
import type { ZodIssue } from "zod";

/** Describe schema errors without exposing submitted question/answer contents. */
function describeIssue(issue: ZodIssue): string {
  const [field, index, part, option] = issue.path;
  const labels: Record<string, string> = {
    title: "Fight title", teacherId: "Teacher session", guildCode: "Guild code",
    questions: "Questions", enemies: "Enemies", lootTable: "Loot",
    baseXP: "Base XP", baseEnemyDamage: "Enemy damage", encounterTier: "Fight tier",
  };
  let label = labels[String(field)] || "Fight settings";
  if ((field === "questions" || field === "enemies") && typeof index === "number") {
    label = `${field === "questions" ? "Question" : "Enemy"} ${index + 1}`;
    if (part === "correctAnswer") label += ", correct answer";
    else if (part === "options") label += typeof option === "number" ? `, answer option ${option + 1}` : ", answer options";
    else if (part === "timeLimit") label += ", timer";
    else if (part === "name") label += ", name";
  }
  if (issue.code === "too_big" && issue.type === "string") {
    const graphHint = field === "questions" && part === "question" ? " (including graph markup)" : "";
    return `${label}: use at most ${Number(issue.maximum).toLocaleString("en-US")} characters${graphHint}.`;
  }
  if (issue.code === "too_small" && issue.type === "string" && issue.minimum === 1)
    return `${label} is required.`;
  if (issue.code === "too_small" && issue.type === "array" && issue.path.length === 1) {
    if (field === "questions") return "Add at least one question.";
    if (field === "enemies") return "Add at least one enemy.";
  }
  if (issue.code === "too_big" && issue.type === "array")
    return `${label}: use at most ${Number(issue.maximum).toLocaleString("en-US")} entries.`;
  return `${label}: ${issue.message}`;
}

export function fightValidationMessages(value: unknown): string[] {
  const result = insertFightSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map(describeIssue);
}

export function questionImportValidationMessages(value: unknown): string[] {
  const result = fightQuestionsSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map(issue =>
    describeIssue({ ...issue, path: ["questions", ...issue.path] }));
}

export function validationSummary(messages: string[]): string {
  const more = messages.length > 3 ? ` ${messages.length - 3} more issues need attention.` : "";
  return messages.slice(0, 3).join(" ") + more;
}
