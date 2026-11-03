import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeExactAnswer } from "../../shared/math/grade-answer";
import { parseRational } from "../../shared/math/rational";
import { answersMatch } from "../../shared/combat/phaseRules";
import { questionSchema } from "../../shared/contracts/fights";
import { applyAnswer } from "../../worker/combat/choices";
import { handleFights } from "../../worker/routes/fights";
import { issueSession } from "../../worker/auth/session";
import { fight, started, student } from "./fixtures";

const contract = (expected: string, options = {}) => ({ version: 1, kind: "exact_rational", expected, ...options });
const correct = { status: "correct" };
const incorrect = (reason: string) => ({ status: "incorrect", reason });
const indeterminate = (reason: string) => ({ status: "indeterminate", reason });

test("exact fractions, signs, decimals and arithmetic compare without floating point", () => {
  for (const [expected, submitted] of [
    ["1/3", "2/6"], ["1/2", ".5"], ["0.3", "0.1 + 0.2"],
    ["-3/4", "3/-4"], ["3/4", "-3/-4"], ["0", "-0.000"],
    ["7/6", "1/2 + 2/3"], ["-5", "-(2 + 3)"], ["1/8", "1/2/4"],
    ["14", "2+3*4"], ["20", "(2+3)*4"], ["1.25", "5./4"],
    ["9007199254740993", "9007199254740992 + 1"],
  ]) assert.deepEqual(gradeExactAnswer(submitted, contract(expected)), correct, `${submitted} = ${expected}`);
});

test("close-looking values and rounding do not receive approximate credit", () => {
  for (const [expected, submitted] of [
    ["1/3", "0.3333333333333333"], ["9007199254740993", "9007199254740992"],
    ["1/2", "1/3"], ["1/10", "0.10000000000000001"], ["2", "-2"],
  ]) assert.deepEqual(gradeExactAnswer(submitted, contract(expected)), incorrect("not_equal"));
});

test("finite fraction grid agrees with independent integer cross-products", () => {
  // 5,082 comparisons cover zero, negative denominators, scaled equivalences and inequalities.
  for (let a = -5; a <= 5; a++) for (let b = 1; b <= 7; b++) {
    for (let c = -5; c <= 5; c++) for (let d = 1; d <= 6; d++) {
      assert.deepEqual(gradeExactAnswer(`${c}/${d}`, contract(`${a}/${b}`)), a * d === c * b ? correct : incorrect("not_equal"));
    }
    assert.deepEqual(gradeExactAnswer(`${-a * 7}/${-b * 7}`, contract(`${a}/${b}`)), correct);
  }
});

test("malformed supported syntax is rejected without accepting prefixes or joining digits", () => {
  for (const submitted of ["", "  ", "1+", "(1/2", "1/2)", "1//2", "1..2", ".", "1 2", "()", "*2", "1+*2"])
    assert.deepEqual(gradeExactAnswer(submitted, contract("1/2")), incorrect("malformed_expression"), submitted);
});

test("undefined arithmetic cannot disappear through cancellation or zero multiplication", () => {
  for (const submitted of ["1/0", "0/0", "0*(1/0)", "1/(2-2)", "(1/0)-(1/0)"])
    assert.deepEqual(gradeExactAnswer(submitted, contract("0")), incorrect("undefined_value"), submitted);
});

test("symbolic, scientific, LaTeX, units and executable text are indeterminate", () => {
  for (const submitted of ["x/x", "sqrt(4)", "2^3", "2**3", "2(3)", "(2)(3)", "(2)3", "1 1/2", "1e3", "\\frac{1}{2}", "50%", "1,000", "2 cm", "½", "−1", "Infinity", "NaN", "globalThis.process.exit()", "1/0+x"])
    assert.deepEqual(gradeExactAnswer(submitted, contract("1")), indeterminate("unsupported_notation"), submitted);
});

test("required form is checked separately from equivalence", () => {
  for (const submitted of ["2/4", "0.5", "1/(1+1)", "-1/-2", "(1/2)"])
    assert.deepEqual(gradeExactAnswer(submitted, contract("1/2", { requiredForm: "reduced_fraction" })), incorrect("required_form"));
  for (const submitted of ["1/2", " +1 / 2 "])
    assert.deepEqual(gradeExactAnswer(submitted, contract("0.5", { requiredForm: "reduced_fraction" })), correct);
  assert.deepEqual(gradeExactAnswer("-3/4", contract("-.75", { requiredForm: "reduced_fraction" })), correct);
  assert.deepEqual(gradeExactAnswer("0/1", contract("0", { requiredForm: "reduced_fraction" })), correct);
  assert.deepEqual(gradeExactAnswer("0/2", contract("0", { requiredForm: "reduced_fraction" })), incorrect("required_form"));
  assert.deepEqual(gradeExactAnswer("-2/-4", contract(".5", { requiredForm: "fraction" })), correct);
  assert.deepEqual(gradeExactAnswer(".5", contract(".5", { requiredForm: "fraction" })), incorrect("required_form"));
  assert.deepEqual(gradeExactAnswer("+2", contract("4/2", { requiredForm: "integer" })), correct);
  for (const submitted of ["2.0", "4/2", "1+1"])
    assert.deepEqual(gradeExactAnswer(submitted, contract("2", { requiredForm: "integer" })), incorrect("required_form"));
});

test("numerical domain checks compare rational bounds and exclusions exactly", () => {
  const answer = contract("1/2", { domain: { min: { value: "1/3", inclusive: false }, max: { value: "2/3", inclusive: true }, excluded: ["3/5"] } });
  assert.deepEqual(gradeExactAnswer("2/4", answer), correct);
  for (const submitted of ["2/6", "0.3333333333333333", "0.6", "6/10", "1"])
    assert.deepEqual(gradeExactAnswer(submitted, answer), incorrect("outside_domain"));
  assert.deepEqual(gradeExactAnswer("4/6", answer), incorrect("not_equal"));
  assert.deepEqual(gradeExactAnswer("2/6", contract("1/3", { domain: { min: { value: "1/3", inclusive: true }, max: { value: "1/3", inclusive: true } } })), correct);
  assert.deepEqual(gradeExactAnswer("-1", contract("0", { domain: { max: { value: "0", inclusive: true } } })), incorrect("not_equal"));
});

test("invalid or unsupported contracts never count as learner errors", () => {
  for (const answer of [
    null, {}, contract("1", { version: 2 }), contract("1", { kind: "symbolic" }),
    contract("1", { tolerance: .01 }), contract("1", { requiredForm: "factored" }),
    contract("1/0"), contract("x/x"), contract("1+"), contract("1".repeat(101)),
    contract("1/2", { requiredForm: "integer" }),
    contract("9".repeat(100) + "*2", { requiredForm: "integer" }),
    contract("1/(" + "9".repeat(100) + "*2)", { requiredForm: "reduced_fraction" }),
    contract("1", { domain: { excluded: ["2/2"] } }),
    contract("1", { domain: { min: { value: "1", inclusive: false } } }),
    contract("1", { domain: { min: { value: "2", inclusive: true }, max: { value: "0", inclusive: true } } }),
    contract("1", { domain: { max: { value: "x", inclusive: true } } }),
    contract("1", { domain: { min: { value: "0" } } }),
    contract("1", { domain: { excluded: Array(33).fill("0") } }),
    contract("1", { domain: { variable: "x", excluded: ["0"] } }),
  ]) assert.deepEqual(gradeExactAnswer("wrong", answer), indeterminate("invalid_contract"));
});

test("length, token, literal, recursion and intermediate integer limits are indeterminate", () => {
  for (const submitted of [
    "1" + " ".repeat(512), "1".repeat(101), "1+".repeat(128) + "1",
    "(".repeat(33) + "1" + ")".repeat(33), "-".repeat(33) + "1",
    Array(4).fill("9".repeat(100)).join("*"),
  ]) assert.deepEqual(gradeExactAnswer(submitted, contract("1")), indeterminate("resource_limit"));
  assert.deepEqual(gradeExactAnswer("(".repeat(32) + "1" + ")".repeat(32), contract("1")), correct);
  assert.deepEqual(gradeExactAnswer("1" + " ".repeat(511), contract("1")), correct);
  assert.deepEqual(parseRational("9".repeat(100)), { numerator: BigInt("9".repeat(100)), denominator: 1n });
});

test("grading is deterministic, JSON-safe and does not mutate its contract", () => {
  const answer = contract("1/2", { domain: { excluded: ["0"] } });
  const before = structuredClone(answer);
  for (let i = 0; i < 10; i++) assert.deepEqual(JSON.parse(JSON.stringify(gradeExactAnswer("2/4", answer))), correct);
  assert.deepEqual(answer, before);
});

test("fixed-question schema, text matching and combat answer recording retain their behavior", () => {
  assert.deepEqual(questionSchema.parse(fight.questions[0]), fight.questions[0]);
  assert.equal(answersMatch("  HELLO   World  ", "hello world"), true);
  assert.equal(answersMatch(" A ", "a", "case-insensitive"), false);
  assert.equal(answersMatch("A", "a", "case-insensitive"), true);
  assert.equal(answersMatch("1/2", "2/4"), false);
  assert.equal(answersMatch("x+x", "2x"), false);
  const initial = started(), before = structuredClone(initial);
  for (const [answer, expected] of [[" 4 ", true], ["8/2", false], ["wrong", false]] as const) {
    const result = applyAnswer(initial, student().id, answer, fight.questions[0]);
    assert.equal(result.players[student().id].lastAnswerCorrect, expected);
    assert.equal(result.players[student().id].hasAnswered, true);
    assert.equal(result.players[student().id].currentAnswer, answer);
  }
  assert.deepEqual(initial, before);
});

async function previewFixture() {
  const sessions = new Map();
  const config = { cookieName: "math_test", secret: "test-only-math-secret-01234567890123456789", ttlSeconds: 3600 };
  const repository: any = {
    createSession: async (value: any) => { sessions.set(value.tokenHash, value); },
    findActiveSession: async (key: string) => sessions.get(key) || null,
  };
  const teacher = await issueSession(repository, config, "teacher", fight.teacherId);
  const studentCookie = await issueSession(repository, config, "student", student().id);
  // Every other repository operation, including writes, fails if attempted.
  const guarded = new Proxy(repository, { get(target, name) {
    if (!(name in target)) throw new Error(`Unexpected repository access: ${String(name)}`);
    return target[name];
  } });
  const call = (raw: string, cookie = teacher) => {
    const url = new URL("https://qa.example/api/fights/math/grade-preview");
    return handleFights(new Request(url, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: raw }), url, guarded, config);
  };
  return { call, teacher, studentCookie };
}

test("preview authenticates teachers and exposes all grading outcomes without persistence", async () => {
  const { call, studentCookie } = await previewFixture();
  const raw = JSON.stringify({ answerContract: contract("1/2"), submitted: "2/4" });
  assert.equal((await call(raw, ""))!.status, 401);
  assert.equal((await call(raw, studentCookie))!.status, 401);
  assert.equal((await call(raw, "math_test=forged"))!.status, 401);
  for (const [submitted, result] of [["2/4", correct], ["1/3", incorrect("not_equal")], ["1+", incorrect("malformed_expression")], ["x", indeterminate("unsupported_notation")]] as const) {
    const response = (await call(JSON.stringify({ answerContract: contract("1/2"), submitted })))!;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), result);
  }
});

test("preview rejects invalid envelopes, JSON and oversized bodies and preserves indeterminate", async () => {
  const { call } = await previewFixture();
  for (const raw of ["{", "null", JSON.stringify({ answerContract: contract("1"), submitted: 1 }), JSON.stringify({ answerContract: contract("1"), submitted: "1", extra: true })])
    assert.equal((await call(raw))!.status, 400);
  assert.equal((await call(JSON.stringify({ answerContract: contract("1"), submitted: "x".repeat(33_000) })))!.status, 413);
  const invalid = (await call(JSON.stringify({ answerContract: contract("1", { version: 2 }), submitted: "1" })))!;
  assert.deepEqual(await invalid.json(), indeterminate("invalid_contract"));
  const bounded = (await call(JSON.stringify({ answerContract: contract("1"), submitted: "1".repeat(513) })))!;
  assert.deepEqual(await bounded.json(), indeterminate("resource_limit"));
});
