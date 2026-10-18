import { type Question } from "@shared/schema";



/** Existing teacher CSV dialect: first answer is correct; invalid rows are skipped. */
export function questionsFromCsvRows(rows: Record<string, string | undefined>[], createId = () => Date.now().toString() + Math.random()): Question[] {
  const parsedQuestions: Question[] = [];

  for (const row of rows) {
    // Case-insensitive field lookup helper
    const getField = (fieldName: string) => {
      const keys = Object.keys(row);
      const matchingKey = keys.find(k => k.toLowerCase() === fieldName.toLowerCase());
      return matchingKey ? row[matchingKey] : undefined;
    };

    const questionText = getField("question text")?.trim();
    const questionType = getField("question type")?.trim().toLowerCase();
    const timerValue = getField("timer") || getField("time limit") || getField("timelimit");
    const answer1 = getField("answer1")?.trim();
    const answer2 = getField("answer2")?.trim();
    const answer3 = getField("answer3")?.trim();
    const answer4 = getField("answer4")?.trim();

    if (!questionText || !questionType || !answer1) {
      continue;
    }

    // Parse timer value, default to 30 if invalid
    let timeLimit = 30;
    if (timerValue) {
      const parsed = parseInt(String(timerValue).trim());
      if (!isNaN(parsed) && parsed >= 5 && parsed <= 120) {
        timeLimit = parsed;
      }
    }

    const newQuestion: Question = {
      id: createId(),
      question: questionText,
      type: questionType === "true/false" || questionType === "true_false" || questionType === "tf" ? "true_false" :
        questionType === "short answer" || questionType === "short_answer" || questionType === "sa" ? "short_answer" :
          "multiple_choice",
      correctAnswer: answer1,
      timeLimit: timeLimit,
    };

    if (newQuestion.type === "multiple_choice") {
      const options = [answer1, answer2, answer3, answer4].filter((a): a is string => !!a);
      if (options.length < 2) {
        continue;
      }
      newQuestion.options = options;
    }

    parsedQuestions.push(newQuestion);
  }

  return parsedQuestions;
}
