import type { Question } from "../../schema";
import { deterministicShuffle } from "../../shuffle";

export const QUIZ_TEMPLATE_IDS = ["pascal-row-v1", "binomial-coefficient-v1", "scaled-binomial-v1", "binomial-expansion-v1"] as const;
export type QuizTemplateId = typeof QUIZ_TEMPLATE_IDS[number];

export const PASCAL_TEMPLATES = [
  { id: "pascal-row-v1", title: "Complete a Pascal row", timeLimit: 30 },
  { id: "binomial-coefficient-v1", title: "Find a binomial coefficient", timeLimit: 45 },
  { id: "scaled-binomial-v1", title: "Find a coefficient in (x ± a)ⁿ", timeLimit: 60 },
  { id: "binomial-expansion-v1", title: "Choose the full expansion", timeLimit: 60 },
] as const;

type Variant = Pick<Question, "question" | "type" | "options" | "correctAnswer">;
const inline = (latex: string) => `\\(${latex}\\)`;
const power = (variable: string, n: number) => n === 0 ? "" : n === 1 ? variable : `${variable}^{${n}}`;

function polynomial(coefficients: number[]) {
  return coefficients.map((c, i) => {
    const x = power("x", coefficients.length - 1 - i);
    const sign = c < 0 ? "-" : i ? "+" : "";
    return sign + (Math.abs(c) === 1 && x ? "" : Math.abs(c)) + x;
  }).join("");
}

function buildPool(id: QuizTemplateId): Variant[] {
  const variants: Variant[] = [];
  let row = [1];
  const integer = (prompt: string, answer: number) => variants.push({
    question: prompt + " Enter an integer.", type: "short_answer", correctAnswer: String(answer),
  });
  for (let n = 1; n <= 8; n++) {
    row = [...row, 0].map((value, i) => value + (row[i - 1] || 0));
    if (n < 2) continue;
    for (let k = 1; k < n; k++) {
      if (id === "pascal-row-v1") {
        const sequence = row.map((value, i) => i === k ? "\\square" : value).join(",\\;");
        integer(`Fill the blank in row ${n} of Pascal’s triangle (top row = 0). ${inline(sequence)}`, row[k]);
      } else if (id === "binomial-coefficient-v1") {
        for (const sign of ["+", "-"]) {
          const term = power("x", n - k) + power("y", k);
          integer(`What is the coefficient of ${inline(term)} in ${inline(`(x${sign}y)^{${n}}`)}?`, row[k] * (sign === "-" ? (-1) ** k : 1));
        }
      }
    }
    if (n > 5) continue;
    for (const a of [-3, -2, -1, 1, 2, 3]) {
      const expression = inline(`(x${a > 0 ? "+" : ""}${a})^{${n}}`);
      const coefficients = row.map((value, k) => value * a ** k);
      if (id === "scaled-binomial-v1" && Math.abs(a) > 1) {
        for (let k = 1; k < n; k++)
          integer(`What is the coefficient of ${inline(power("x", n - k))} in ${expression}?`, coefficients[k]);
      } else if (id === "binomial-expansion-v1") {
        const correctAnswer = inline(polynomial(coefficients));
        const choices = [
          correctAnswer,
          inline(polynomial(coefficients.map((c, k) => k === 1 ? -c : c))),
          inline(polynomial(coefficients.map((c, k) => k === n ? -c : c))),
          inline(polynomial(coefficients.map((c, k) => k === 1 ? a : c))),
        ];
        variants.push({ type: "multiple_choice", question: `Which polynomial is the expansion of ${expression}?`,
          options: deterministicShuffle(choices, `choices:${n}:${a}`), correctAnswer });
      }
    }
  }
  return variants;
}

const pools = new Map<QuizTemplateId, Variant[]>();
export function pascalVariants(id: QuizTemplateId): readonly Variant[] {
  if (!pools.has(id)) pools.set(id, buildPool(id));
  return pools.get(id)!;
}

export interface SelectedTemplate { id: QuizTemplateId; timeLimit: number }
export function selectedTemplates(questions: Question[]): SelectedTemplate[] {
  const selected = new Map<QuizTemplateId, SelectedTemplate>();
  for (const q of questions) {
    if (q.quizTemplate && !selected.has(q.quizTemplate)) selected.set(q.quizTemplate, { id: q.quizTemplate, timeLimit: q.timeLimit });
  }
  return [...selected.values()];
}

/** Each persisted slot is a playable example and contributes one timer to the target. */
export function planQuiz(fixed: Question[], templates: SelectedTemplate[], targetRounds: number): Question[] {
  if (!templates.length) return fixed;
  const count = Math.max(templates.length, targetRounds - fixed.length);
  const slots = Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    const occurrence = Math.floor(index / templates.length);
    const pool = pascalVariants(template.id);
    return { ...pool[occurrence % pool.length], id: `quiz:${template.id}:${occurrence + 1}`,
      quizTemplate: template.id, timeLimit: template.timeLimit };
  });
  return [...fixed, ...slots];
}

/** Draw without replacement within each family's finite pool. The room stores the results. */
export function drawQuizQuestions(questions: Question[], salt: string): Question[] {
  const decks = new Map<QuizTemplateId, Variant[]>();
  const draws = new Map<QuizTemplateId, number>();
  return questions.map(q => {
    const id = q.quizTemplate;
    if (!id) return q;
    let deck = decks.get(id);
    const drawn = draws.get(id) || 0;
    if (!deck?.length) {
      deck = deterministicShuffle([...pascalVariants(id)], `${salt}:${id}:${drawn}`);
      decks.set(id, deck);
    }
    draws.set(id, drawn + 1);
    return { ...deck.pop()!, id: q.id, quizTemplate: id, timeLimit: q.timeLimit };
  });
}
