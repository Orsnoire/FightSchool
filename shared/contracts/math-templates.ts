import { z } from "zod";
import type { ExactRationalAnswer } from "./math-answers";

export const exponentRuleSchema = z.enum(["product", "quotient", "power"]);
export type ExponentRule = z.infer<typeof exponentRuleSchema>;
const range = z.object({ min: z.number().int().min(-6).max(6), max: z.number().int().min(-6).max(6) }).strict()
  .refine(value => value.min <= value.max, "Minimum must not exceed maximum.");

/** Authoring only. No executable expressions, student IDs or fight references. */
export const mathPresetSchema = z.object({
  schemaVersion: z.literal(1),
  familyId: z.literal("integer-exponent"),
  familyVersion: z.literal(1),
  generatorVersion: z.literal(1),
  graderVersion: z.literal("exact-rational-v1"),
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(1_000),
  rule: exponentRuleSchema,
  m: range,
  n: range,
  includeIdentityCases: z.boolean(),
  resultSign: z.enum(["any", "positive", "negative"]),
}).strict();
export type MathPreset = z.infer<typeof mathPresetSchema>;

export const previewOptionsSchema = z.object({
  seed: z.number().int().min(0).max(0xffffffff),
  count: z.number().int().min(1).max(10),
}).strict();
export const mathPreviewRequestSchema = previewOptionsSchema.extend({ preset: mathPresetSchema }).strict();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const saveMathPresetSchema = z.object({
  mutationId: z.string().uuid(),
  expectedRevision: z.number().int().min(0).max(2_000_000_000),
  preset: mathPresetSchema,
  preview: previewOptionsSchema,
}).strict();
export const approveMathPresetSchema = z.object({
  mutationId: z.string().uuid(),
  expectedRevision: z.number().int().min(1).max(2_000_000_000),
  contentHash: hash,
  previewHash: hash,
  preview: previewOptionsSchema,
  confirmed: z.literal(true),
}).strict();

export interface MathVariant {
  id: string;
  parameters: { m: number; n: number };
  prompt: string;
  explanation: string;
  answerContract: ExactRationalAnswer;
}
export interface MathPreview {
  contentHash: string;
  previewHash: string;
  shuffleVersion: 1;
  seed: number;
  requestedCount: number;
  totalAvailable: number;
  variants: MathVariant[];
}
export interface MathRevision {
  templateId: string;
  revision: number;
  state: "draft" | "approved";
  preset: MathPreset;
  contentHash: string;
  preview: MathPreview;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}
export interface MathTemplateDetail {
  id: string;
  latestRevision: number;
  latestApprovedRevision: number | null;
  revision: MathRevision;
  supported: boolean;
}
export interface MathTemplateSummary {
  id: string;
  latestRevision: number;
  title: string;
  rule: ExponentRule;
  state: "draft" | "approved";
  updatedAt: string;
}
export interface MathRevisionSummary { revision: number; state: "draft" | "approved"; title: string; createdAt: string }
