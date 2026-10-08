import type { FightQuestion } from "../db/schema";
/** Stable across question/answer shuffles; edits to the assessed content invalidate old mastery. Server only. */
export function questionKey(q: FightQuestion): string {
  const text = JSON.stringify([
    q.id,
    q.type,
    q.question,
    q.correctAnswer,
    [...(q.options || [])].sort(),
  ]);
  let a = 2166136261,
    b = 5381;
  for (const c of text) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619);
    b = Math.imul(b, 33) ^ c.charCodeAt(0);
  }
  return `${q.id}:${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`;
}
