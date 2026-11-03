import { z } from "zod";

/** Version 1 is a numerical answer contract, not a symbolic-expression contract. */
export const EXACT_MATH_LIMITS = Object.freeze({
  characters: 512,
  tokens: 256,
  depth: 32,
  literalDigits: 100,
  integerBits: 1024,
  exclusions: 32,
});

const expression = z.string().min(1).max(EXACT_MATH_LIMITS.characters);
const endpoint = z.object({ value: expression, inclusive: z.boolean() }).strict();

export const exactRationalAnswerSchema = z.object({
  version: z.literal(1),
  kind: z.literal("exact_rational"),
  expected: expression,
  requiredForm: z.enum(["any", "integer", "fraction", "reduced_fraction"]).optional(),
  // Restrictions on the submitted numerical value, never inferred variable domains.
  domain: z.object({
    min: endpoint.optional(),
    max: endpoint.optional(),
    excluded: z.array(expression).max(EXACT_MATH_LIMITS.exclusions).optional(),
  }).strict().optional(),
}).strict();

export type ExactRationalAnswer = z.infer<typeof exactRationalAnswerSchema>;

/** Indeterminate must not be coerced to a learner's incorrect result. */
export type MathGradeResult =
  | { status: "correct" }
  | { status: "incorrect"; reason: "not_equal" | "required_form" | "outside_domain" | "malformed_expression" | "undefined_value" }
  | { status: "indeterminate"; reason: "invalid_contract" | "unsupported_notation" | "resource_limit" };
