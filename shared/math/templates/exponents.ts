import { mathPresetSchema, mathPreviewRequestSchema, type MathPreset, type MathPreview, type MathVariant, type ExponentRule } from "../../contracts/math-templates";
import { gradeExactAnswer } from "../grade-answer";

export const EXPONENT_CATALOG = [
  { rule: "product", name: "Product of powers", description: "Add exponents when multiplying powers with the same base.", keywords: "exponents indices multiplication multiply same base", skill: "Product rule" },
  { rule: "quotient", name: "Quotient of powers", description: "Subtract exponents when dividing powers with the same base.", keywords: "exponents indices division divide negative reciprocal", skill: "Quotient rule" },
  { rule: "power", name: "Power of a power", description: "Multiply exponents for a power raised to another power.", keywords: "exponents indices nested repeated power", skill: "Power rule" },
] as const;

export function defaultMathPreset(rule: ExponentRule = "product"): MathPreset {
  return { schemaVersion: 1, familyId: "integer-exponent", familyVersion: 1, generatorVersion: 1, graderVersion: "exact-rational-v1",
    title: EXPONENT_CATALOG.find(item => item.rule === rule)!.name, note: "", rule,
    m: { min: 2, max: 6 }, n: { min: 2, max: 6 }, includeIdentityCases: false, resultSign: "any" };
}

/** Fixed key order is part of schema v1's content-hash format. */
export function canonicalPreset(input: unknown): MathPreset {
  const p = mathPresetSchema.parse(input);
  return { schemaVersion: p.schemaVersion, familyId: p.familyId, familyVersion: p.familyVersion, generatorVersion: p.generatorVersion,
    graderVersion: p.graderVersion, title: p.title, note: p.note, rule: p.rule,
    m: { min: p.m.min, max: p.m.max }, n: { min: p.n.min, max: p.n.max }, includeIdentityCases: p.includeIdentityCases, resultSign: p.resultSign };
}

export class MathAuthoringError extends Error {}

/** Exhaustively enumerate this bounded family, independently of combat randomness. */
export function exponentPool(input: unknown): MathVariant[] {
  const p = canonicalPreset(input);
  const seen = new Set<string>();
  const variants: MathVariant[] = [];
  for (let m = p.m.min; m <= p.m.max; m++) for (let n = p.n.min; n <= p.n.max; n++) {
    const k = p.rule === "product" ? m + n : p.rule === "quotient" ? m - n : m * n;
    if (!p.includeIdentityCases && (m === 0 || m === 1 || n === 0 || n === 1 || k === 0)) continue;
    if (p.resultSign === "positive" && k <= 0 || p.resultSign === "negative" && k >= 0) continue;
    const key = p.rule === "product" ? [m, n].sort((a, b) => a - b).join(":") : `${m}:${n}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const expression = p.rule === "product" ? `x^{${m}} \\cdot x^{${n}}` : p.rule === "quotient" ? `\\frac{x^{${m}}}{x^{${n}}}` : `\\left(x^{${m}}\\right)^{${n}}`;
    const operation = p.rule === "product" ? "+" : p.rule === "quotient" ? "-" : "*";
    const answerContract = { version: 1, kind: "exact_rational", expected: String(k), requiredForm: "integer" } as const;
    if (gradeExactAnswer(String(k), answerContract).status !== "correct") throw new MathAuthoringError("Generated answer failed validation.");
    variants.push({ id: `${p.rule}:${m}:${n}`, parameters: { m, n },
      prompt: `Find the integer k so \\(${expression} = x^k\\) for every \\(x > 0\\). Enter k only.`,
      explanation: `${EXPONENT_CATALOG.find(item => item.rule === p.rule)!.description} k = (${m}) ${operation} (${n}) = ${k}.`, answerContract });
  }
  if (!variants.length) throw new MathAuthoringError("No valid variants match these settings. Widen the ranges, change the result sign, or include identity cases.");
  return variants;
}

export async function mathHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}

/** Pinned 32-bit LCG + Fisher-Yates (shuffle v1). Not cryptographic randomness. */
export async function previewMathTemplate(input: unknown): Promise<MathPreview> {
  const request = mathPreviewRequestSchema.parse(input);
  const preset = canonicalPreset(request.preset);
  const pool = exponentPool(preset);
  let state = request.seed;
  for (let i = pool.length - 1; i > 0; i--) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const j = Math.floor((state / 0x100000000) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const contentHash = await mathHash(preset);
  const body = { contentHash, shuffleVersion: 1 as const, seed: request.seed, requestedCount: request.count,
    totalAvailable: pool.length, variants: pool.slice(0, request.count) };
  return { ...body, previewHash: await mathHash(body) };
}
