import { z } from "zod";
import { GameError } from "../services/errors";
import { RewardError } from "../services/rewards";
import { bodyErrorResponse } from "./json";
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, (_k, v) => (v instanceof Date ? v.getTime() : v)), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
export function gameErrorResponse(error: unknown): Response {
  const bodyFailure = bodyErrorResponse(error);
  if (bodyFailure)
    return bodyFailure;
  if (error instanceof GameError || error instanceof RewardError)
    return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return json({ error: "Invalid request" }, 400);
  return json({ error: "Unable to complete request" }, 503);
}
export const method = (request: Request, expected: string) => request.method === expected;
