import assert from 'node:assert/strict';
import { test } from 'node:test';
import Papa from 'papaparse';
import { questionsFromCsvRows } from '../../client/src/features/fight-authoring/csv.ts';

test('teacher CSV preserves quoted rich content, answer ordering and accepted aliases', () => {
  const csv = 'QUESTION TEXT,Question Type,Time Limit,answer1,answer2,answer3,answer4\n' +
    '"<p>Comma, and a\nsecond line: \\(x^2\\)</p>",MC,5,first,second,,fourth\n' +
    'Statement,true/false,120,false,,,\n' +
    'Expression,SA,999,x^2,,,\n';
  const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
  let id = 0;
  const result = questionsFromCsvRows(rows, () => `csv-${++id}`);
  assert.deepEqual(result, [
    { id: 'csv-1', question: '<p>Comma, and a\nsecond line: \\(x^2\\)</p>', type: 'multiple_choice', correctAnswer: 'first', timeLimit: 5, options: ['first', 'second', 'fourth'] },
    { id: 'csv-2', question: 'Statement', type: 'true_false', correctAnswer: 'false', timeLimit: 120 },
    { id: 'csv-3', question: 'Expression', type: 'short_answer', correctAnswer: 'x^2', timeLimit: 30 },
  ]);
});

test('teacher CSV skips incomplete rows without discarding valid neighbors or changing timer defaults', () => {
  const row = { 'question text': 'Q', 'question type': 'multiple_choice', answer1: ' A ', answer2: ' B ' };
  const source = [row, { ...row, answer2: '' }, { ...row, 'question text': ' ' }, { ...row, 'question type': '' }, { ...row, answer1: '' },
    { ...row, 'question type': 'short_answer', timer: '4' }, { ...row, 'question type': 'tf', timelimit: '45' },
    { ...row, 'question type': 'unknown', timer: 'invalid' }];
  const before = structuredClone(source);
  const result = questionsFromCsvRows(source, () => 'fixture-id');
  assert.equal(result.length, 4);
  assert.deepEqual(result.map(q => [q.type, q.timeLimit, q.correctAnswer]), [
    ['multiple_choice', 30, 'A'], ['short_answer', 30, 'A'], ['true_false', 45, 'A'], ['multiple_choice', 30, 'A'],
  ]);
  assert.deepEqual(source, before, 'conversion never mutates uploaded rows');
});
