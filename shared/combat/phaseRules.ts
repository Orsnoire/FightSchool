export type AnswerNormalization = "case-insensitive" | "trimmed";
function normalizeAnswer(value: string, mode: AnswerNormalization): string {
  const lower = value.toLocaleLowerCase("en-US");
  return mode === "trimmed" ? lower.trim().replace(/\s+/g, " ") : lower;
}

export function answersMatch(
  submitted: string,
  expected: string,
  mode: AnswerNormalization = "trimmed",
): boolean {
  return normalizeAnswer(submitted, mode) === normalizeAnswer(expected, mode);
}
