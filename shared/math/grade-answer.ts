import { EXACT_MATH_LIMITS, exactRationalAnswerSchema, type ExactRationalAnswer, type MathGradeResult } from "../contracts/math-answers";
import { compareRationals, gcd, parseRational, RationalParseError, type Rational } from "./rational";

type NumericalDomain = {
  min?: { value: Rational; inclusive: boolean };
  max?: { value: Rational; inclusive: boolean };
  excluded: Rational[];
};

function inDomain(value: Rational, domain: NumericalDomain): boolean {
  if (domain.min) {
    const order = compareRationals(value, domain.min.value);
    if (order < 0 || (order === 0 && !domain.min.inclusive)) return false;
  }
  if (domain.max) {
    const order = compareRationals(value, domain.max.value);
    if (order > 0 || (order === 0 && !domain.max.inclusive)) return false;
  }
  return !domain.excluded.some(excluded => compareRationals(value, excluded) === 0);
}

function hasRequiredForm(source: string, form: ExactRationalAnswer["requiredForm"]): boolean {
  const text = source.trim();
  if (!form || form === "any") return true;
  if (form === "integer") return /^[+-]?[0-9]+$/.test(text);
  const fraction = /^([+-]?[0-9]+)\s*\/\s*([+-]?[0-9]+)$/.exec(text);
  if (!fraction) return false;
  if (form === "fraction") return true;
  const numerator = BigInt(fraction[1]), denominator = BigInt(fraction[2]);
  return denominator > 0n && gcd(numerator, denominator) === 1n;
}

/** Validate author input before evaluating a submission. Never change stored questions. */
export function gradeExactAnswer(submitted: string, answerContract: unknown): MathGradeResult {
  const parsed = exactRationalAnswerSchema.safeParse(answerContract);
  if (!parsed.success) return { status: "indeterminate", reason: "invalid_contract" };
  const contract = parsed.data;
  let expected: Rational;
  let domain: NumericalDomain;
  try {
    expected = parseRational(contract.expected);
    domain = {
      min: contract.domain?.min && { ...contract.domain.min, value: parseRational(contract.domain.min.value) },
      max: contract.domain?.max && { ...contract.domain.max, value: parseRational(contract.domain.max.value) },
      excluded: (contract.domain?.excluded || []).map(parseRational),
    };
    // This also rejects reversed/empty bounds and an excluded expected answer.
    if (!inDomain(expected, domain)) return { status: "indeterminate", reason: "invalid_contract" };
    if (contract.requiredForm === "integer" && expected.denominator !== 1n)
      return { status: "indeterminate", reason: "invalid_contract" };
    // A required literal form must be expressible within the same parser limits.
    if (contract.requiredForm && contract.requiredForm !== "any" &&
        [expected.numerator, expected.denominator].some(value => value.toString().replace("-", "").length > EXACT_MATH_LIMITS.literalDigits))
      return { status: "indeterminate", reason: "invalid_contract" };
  } catch (error) {
    if (!(error instanceof RationalParseError)) throw error;
    return { status: "indeterminate", reason: "invalid_contract" };
  }

  let actual: Rational;
  try { actual = parseRational(submitted); }
  catch (error) {
    if (!(error instanceof RationalParseError)) throw error;
    return error.reason === "unsupported_notation" || error.reason === "resource_limit"
      ? { status: "indeterminate", reason: error.reason }
      : { status: "incorrect", reason: error.reason };
  }
  if (!inDomain(actual, domain)) return { status: "incorrect", reason: "outside_domain" };
  if (compareRationals(actual, expected) !== 0) return { status: "incorrect", reason: "not_equal" };
  if (!hasRequiredForm(submitted, contract.requiredForm)) return { status: "incorrect", reason: "required_form" };
  return { status: "correct" };
}
