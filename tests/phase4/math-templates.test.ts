import assert from "node:assert/strict";
import { test } from "node:test";
import { mathPresetSchema } from "../../shared/contracts/math-templates";
import { canonicalPreset, defaultMathPreset, exponentPool, previewMathTemplate } from "../../shared/math/templates/exponents";
import { gradeExactAnswer } from "../../shared/math/grade-answer";

type Fraction = [bigint, bigint];
// Independent oracle: repeated integer multiplication, with exact reciprocals.
function power([n, d]: Fraction, e: number): Fraction {
  let result: Fraction = [1n, 1n];
  for (let i = 0; i < Math.abs(e); i++) result = [result[0] * n, result[1] * d];
  return e < 0 ? [result[1], result[0]] : result;
}
const equal = (a: Fraction, b: Fraction) => a[0] * b[1] === b[0] * a[1];

test("all 507 exponent cases agree with independent exact rational identities and have unique integer answers", () => {
  for (const rule of ["product", "quotient", "power"] as const) for (let m = -6; m <= 6; m++) for (let n = -6; n <= 6; n++) {
    const p = { ...defaultMathPreset(rule), m: { min: m, max: m }, n: { min: n, max: n }, includeIdentityCases: true };
    const [v] = exponentPool(p);
    assert.equal(exponentPool(p).length, 1);
    assert.deepEqual(v.parameters, { m, n });
    assert.match(v.prompt, /for every \\\(x > 0\\\)/);
    for (const base of [2n, 3n, 5n]) {
      const a = power([base, 1n], m), b = power([base, 1n], n);
      const left: Fraction = rule === "product" ? [a[0] * b[0], a[1] * b[1]] : rule === "quotient" ? [a[0] * b[1], a[1] * b[0]] : power(a, n);
      let solutions = 0;
      for (let k = -36; k <= 36; k++) if (equal(left, power([base, 1n], k))) {
        solutions++;
        assert.equal(v.answerContract.expected, String(k));
      }
      assert.equal(solutions, 1);
    }
    assert.deepEqual(gradeExactAnswer(v.answerContract.expected, v.answerContract), { status: "correct" });
    assert.deepEqual(gradeExactAnswer(String(Number(v.answerContract.expected) + 1), v.answerContract), { status: "incorrect", reason: "not_equal" });
  }
});

test("range, sign and identity controls preserve the intended skill and report empty spaces", () => {
  for (const rule of ["product", "quotient", "power"] as const) for (const resultSign of ["any", "positive", "negative"] as const) {
    const p = { ...defaultMathPreset(rule), m: { min: -6, max: 6 }, n: { min: -4, max: 5 }, resultSign };
    const pool = exponentPool(p);
    for (const v of pool) {
      assert.ok(v.parameters.m >= -6 && v.parameters.m <= 6 && v.parameters.n >= -4 && v.parameters.n <= 5);
      assert.ok(![0, 1].includes(v.parameters.m) && ![0, 1].includes(v.parameters.n));
      const k = Number(v.answerContract.expected); assert.notEqual(k, 0);
      if (resultSign === "positive") assert.ok(k > 0);
      if (resultSign === "negative") assert.ok(k < 0);
    }
    assert.equal(new Set(pool.map(v => v.prompt)).size, pool.length);
  }
  assert.throws(() => exponentPool({ ...defaultMathPreset(), resultSign: "negative" }), /No valid variants/);
  assert.throws(() => exponentPool({ ...defaultMathPreset("quotient"), m: { min: 2, max: 2 }, n: { min: 2, max: 2 } }), /No valid variants/);
  assert.equal(exponentPool(defaultMathPreset()).length, 15, "product swaps are deduplicated");
  assert.equal(exponentPool(defaultMathPreset("quotient")).length, 20);
});

test("strict contracts reject unsupported versions, arbitrary expressions, malformed ranges and resource excess", async () => {
  const p = defaultMathPreset();
  for (const candidate of [ { ...p, generatorVersion: 2 }, { ...p, familyId: "rational" }, { ...p, formula: "process.exit()" },
    { ...p, title: " " }, { ...p, m: { min: -7, max: 6 } }, { ...p, n: { min: 4, max: 2 } },
    { ...p, n: { min: 1.5, max: 3 } }, { ...p, note: "x".repeat(1001) }, { ...p, requiredForm: "any" } ]) assert.equal(mathPresetSchema.safeParse(candidate).success, false);
  for (const extra of [{ seed: -1, count: 5 }, { seed: 2 ** 32, count: 5 }, { seed: 1, count: 11 }, { seed: 1, count: 0 }])
    await assert.rejects(previewMathTemplate({ preset: p, ...extra }));
});

test("preview freezes all provenance and answers; deterministic shuffle is independent of Math.random", async () => {
  const p = defaultMathPreset();
  const before = structuredClone(p);
  const random = Math.random;
  Math.random = () => { throw new Error("Combat/global random must not be used"); };
  try {
    const a = await previewMathTemplate({ preset: p, seed: 0, count: 5 });
    assert.deepEqual(await previewMathTemplate({ preset: p, seed: 0, count: 5 }), a);
    const b = await previewMathTemplate({ preset: p, seed: 1, count: 5 });
    assert.notDeepEqual(a.variants, b.variants); assert.equal(a.contentHash, b.contentHash); assert.notEqual(a.previewHash, b.previewHash);
    assert.equal(new Set(a.variants.map(v => v.id)).size, 5);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
    assert.deepEqual(p, before);
    const changed = await previewMathTemplate({ preset: { ...p, note: "Reviewed for Math 3" }, seed: 0, count: 5 });
    assert.notEqual(a.contentHash, changed.contentHash);
    const reversed = Object.fromEntries(Object.entries(p).reverse());
    assert.deepEqual(canonicalPreset(reversed), p);
    assert.equal((await previewMathTemplate({ preset: reversed, seed: 0, count: 5 })).contentHash, a.contentHash);
    const tiny = await previewMathTemplate({ preset: { ...p, m: { min: 2, max: 2 }, n: { min: 3, max: 3 } }, seed: 9, count: 10 });
    assert.equal(tiny.totalAvailable, 1); assert.equal(tiny.variants.length, 1); assert.equal(tiny.requestedCount, 10);
  } finally { Math.random = random; }
});

test("integer-answer previews retain deployed required-form and indeterminate outcomes", () => {
  const [v] = exponentPool({ ...defaultMathPreset(), m: { min: 3, max: 3 }, n: { min: 5, max: 5 } });
  for (const answer of ["8", "+8", " 08 "]) assert.equal(gradeExactAnswer(answer, v.answerContract).status, "correct");
  for (const answer of ["8.0", "16/2", "4+4"]) assert.deepEqual(gradeExactAnswer(answer, v.answerContract), { status: "incorrect", reason: "required_form" });
  for (const answer of ["x^8", "2^3", "\\frac{16}{2}"]) assert.deepEqual(gradeExactAnswer(answer, v.answerContract), { status: "indeterminate", reason: "unsupported_notation" });
});
