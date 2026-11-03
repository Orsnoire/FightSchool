import { z } from "zod";
import { gradeExactAnswer } from "../../shared/math/grade-answer";
import { readJson, bodyErrorResponse } from "../http/json";

const previewSchema = z.object({
  answerContract: z.unknown(),
  submitted: z.string().max(5_000),
}).strict();

/** Called only after the fights route authenticates a teacher. No persistence. */
export async function previewMathGrade(request: Request): Promise<Response> {
  try {
    const input = previewSchema.safeParse(await readJson(request, 32_768));
    if (!input.success) return Response.json({ error: "Invalid grading preview" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const result = gradeExactAnswer(input.data.submitted, input.data.answerContract);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = bodyErrorResponse(error);
    if (failure) return failure;
    throw error;
  }
}
