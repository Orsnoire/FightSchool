import { EXACT_MATH_LIMITS as LIMIT } from "../contracts/math-answers";

export type Rational = Readonly<{ numerator: bigint; denominator: bigint }>;
type ParseFailure = "malformed_expression" | "undefined_value" | "unsupported_notation" | "resource_limit";
export class RationalParseError extends Error {
  constructor(public readonly reason: ParseFailure) { super(reason); }
}

const abs = (n: bigint) => n < 0n ? -n : n;
export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a); b = abs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function bounded(n: bigint): bigint {
  if (abs(n).toString(2).length > LIMIT.integerBits) throw new RationalParseError("resource_limit");
  return n;
}

function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n) throw new RationalParseError("undefined_value");
  bounded(numerator); bounded(denominator);
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

export function compareRationals(a: Rational, b: Rational): -1 | 0 | 1 {
  // Each operand is bounded; comparison products are at most twice that size.
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

/** No eval, floating point, implicit multiplication, powers, functions or variables. */
export function parseRational(source: string): Rational {
  if (source.length > LIMIT.characters) throw new RationalParseError("resource_limit");
  // Tokenize the whole input before evaluation; never accept a valid prefix.
  const tokens: string[] = [];
  const scanner = /\s+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)|[()+*/-]/y;
  let offset = 0;
  while (offset < source.length) {
    scanner.lastIndex = offset;
    const match = scanner.exec(source);
    if (!match) {
      throw new RationalParseError(source[offset] === "." ? "malformed_expression" : "unsupported_notation");
    }
    offset = scanner.lastIndex;
    if (!/^\s+$/.test(match[0])) tokens.push(match[0]);
    if (tokens.length > LIMIT.tokens) throw new RationalParseError("resource_limit");
  }
  // Recognizable conventions outside v1 are not evidence of a wrong answer.
  if (/^[+-]?[0-9]+\s+[0-9]+\s*\/\s*[0-9]+$/.test(source.trim()) ||
      tokens.some((token, i) =>
        (token === "*" && tokens[i + 1] === "*") ||
        ((token === ")" || /^[0-9.]/.test(token)) && tokens[i + 1] === "(") ||
        (token === ")" && /^[0-9.]/.test(tokens[i + 1] || ""))))
    throw new RationalParseError("unsupported_notation");
  let index = 0;
  const fail = (): never => { throw new RationalParseError("malformed_expression"); };
  function primary(depth: number): Rational {
    if (depth > LIMIT.depth) throw new RationalParseError("resource_limit");
    const token = tokens[index++];
    if (token === "+" || token === "-") {
      const value = primary(depth + 1);
      return token === "-" ? { ...value, numerator: -value.numerator } : value;
    }
    if (token === "(") {
      const value = sum(depth + 1);
      if (tokens[index++] !== ")") fail();
      return value;
    }
    if (!token || !/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(token)) return fail();
    const [whole, fraction = ""] = token.split(".");
    if (whole.length + fraction.length > LIMIT.literalDigits) throw new RationalParseError("resource_limit");
    return rational(BigInt((whole || "0") + fraction), 10n ** BigInt(fraction.length));
  }
  function product(depth: number): Rational {
    let value = primary(depth);
    while (tokens[index] === "*" || tokens[index] === "/") {
      const op = tokens[index++];
      const rhs = primary(depth);
      value = op === "*"
        ? rational(value.numerator * rhs.numerator, value.denominator * rhs.denominator)
        : rational(value.numerator * rhs.denominator, value.denominator * rhs.numerator);
    }
    return value;
  }
  function sum(depth: number): Rational {
    let value = product(depth);
    while (tokens[index] === "+" || tokens[index] === "-") {
      const op = tokens[index++];
      const rhs = product(depth);
      value = rational(
        value.numerator * rhs.denominator + (op === "+" ? 1n : -1n) * rhs.numerator * value.denominator,
        value.denominator * rhs.denominator,
      );
    }
    return value;
  }
  const result = sum(0);
  if (index !== tokens.length) fail();
  return result;
}
