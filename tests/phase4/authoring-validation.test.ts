import assert from "node:assert/strict";
import { test } from "node:test";
import Papa from "papaparse";
import { questionsFromCsvRows } from "../../client/src/features/fight-authoring/csv";
import { fightValidationMessages, questionImportValidationMessages } from "../../client/src/features/fight-authoring/validation";
import { insertFightSchema } from "../../shared/contracts/fights";
import { fight } from "./fixtures";

const question = { id: "q", type: "multiple_choice" as const, question: "Simplify x/x for nonzero x.", options: ["1", "x"], correctAnswer: "1", timeLimit: 90 };
const validFight = { ...fight, questions: [question], enemies: [{ ...fight.enemies[0], enemyType: "slime" as const }] };

test("oversized imported graphs reproduce the save rejection with actionable question numbers", () => {
  const graph = '<svg><desc>' + 'x'.repeat(25_000) + '</desc></svg>';
  const csv = Papa.unparse([
    { "Question Text": question.question, "Question Type": "MC", Answer1: "1", Answer2: "x", Timer: "90" },
    { "Question Text": graph, "Question Type": "MC", Answer1: "A", Answer2: "B", Timer: "120" },
  ]);
  const rows = Papa.parse<Record<string, string>>(csv, { header: true }).data;
  const imported = questionsFromCsvRows(rows);
  const before = structuredClone(imported);
  assert.equal(imported.length, 2, "the CSV dialect itself can parse both rows");
  assert.equal(insertFightSchema.safeParse({ ...validFight, questions: imported }).success, false);
  assert.deepEqual(questionImportValidationMessages(imported), ["Question 2: use at most 20,000 characters (including graph markup)."]);
  assert.deepEqual(fightValidationMessages({ ...validFight, questions: imported }), questionImportValidationMessages(imported));
  assert.deepEqual(imported, before, "validation must never truncate graphs or change answer identities");
});

test("content at the existing question and answer limits remains saveable", () => {
  const answer = "a".repeat(5_000);
  const atLimit = { ...question, question: "x".repeat(20_000), correctAnswer: answer, options: [answer, "B"] };
  assert.deepEqual(questionImportValidationMessages([atLimit]), []);
  assert.equal(insertFightSchema.safeParse({ ...validFight, questions: [atLimit] }).success, true);
  const tooLong = { ...atLimit, correctAnswer: answer + "a", options: [answer, answer + "b"] };
  const messages = questionImportValidationMessages([question, tooLong]);
  assert.ok(messages.includes("Question 2, answer option 2: use at most 5,000 characters."));
  assert.ok(messages.includes("Question 2, correct answer: use at most 5,000 characters."));
});

test("save feedback identifies missing questions, enemies and titles without weakening the shared contract", () => {
  assert.deepEqual(fightValidationMessages(validFight), []);
  const messages = fightValidationMessages({ ...validFight, title: "", questions: [], enemies: [] });
  assert.ok(messages.includes("Fight title is required."));
  assert.ok(messages.includes("Add at least one question."));
  assert.ok(messages.includes("Add at least one enemy."));
  const full = Array.from({ length: 1_000 }, (_, i) => ({ ...question, id: `q-${i}` }));
  assert.deepEqual(questionImportValidationMessages(full), []);
  assert.deepEqual(questionImportValidationMessages([...full, question]), ["Questions: use at most 1,000 entries."]);
});
