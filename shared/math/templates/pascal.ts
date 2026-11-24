import type { Question } from "../../schema";
import { deterministicShuffle } from "../../shuffle";

export const QUIZ_TEMPLATE_IDS = ["pascal-row-v1", "binomial-coefficient-v1", "scaled-binomial-v1"] as const;
export type QuizTemplateId = typeof QUIZ_TEMPLATE_IDS[number];

export const PASCAL_TEMPLATES = [
  { id: "pascal-row-v1", title: "Pascal’s triangle entries", timeLimit: 30 },
  { id: "binomial-coefficient-v1", title: "Term coefficient in (x + y)ⁿ", timeLimit: 45 },
  { id: "scaled-binomial-v1", title: "Term coefficient in (ax + by)ⁿ", timeLimit: 60 },
] as const;

type Variant = Pick<Question, "question" | "type" | "options" | "correctAnswer">;
const inline = (latex: string) => `\\(${latex}\\)`;
const power = (variable: string, n: number) => n === 0 ? "" : n === 1 ? variable : `${variable}^{${n}}`;

const factor = (coefficient: number, variable: string) =>
  (Math.abs(coefficient) === 1 ? "" : String(Math.abs(coefficient))) + variable;

function buildPool(id: QuizTemplateId): Variant[] {
  const variants: Variant[] = [];
  let row = [1];
  function add(prompt: string, answer: number) {
    variants.push({ question: prompt + " Enter an integer.", type: "short_answer", correctAnswer: String(answer) });
  }
  for (let n = 1; n <= 8; n++) {
    row = [...row, 0].map((value, i) => value + (row[i - 1] || 0));
    for (let k = 1; k < n; k++) {
      if (id === "pascal-row-v1") {
        add(`In row ${n} of Pascal’s triangle, what is entry ${k + 1} from the left? The top is row 0 and the leftmost entry is entry 1.`, row[k]);
        continue;
      }
      const term = inline(power("x", n - k) + power("y", k));
      const prompt = (base: string) => `What is the coefficient of ${term} in the expansion of ${inline(`(${base})^{${n}}`)}?`;
      if (id === "binomial-coefficient-v1") {
        add(prompt("x+y"), row[k]);
      } else if (n <= 5) {
        for (const a of [1, 2, 3]) for (const b of [-3, -2, -1, 1, 2, 3]) {
          if (a === 1 && Math.abs(b) === 1) continue;
          const base = factor(a, "x") + (b < 0 ? "-" : "+") + factor(b, "y");
          add(prompt(base), row[k] * a ** (n - k) * b ** k);
        }
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
