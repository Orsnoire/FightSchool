import { and, or, isNull, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import * as s from "../db/schema";
import { GameError as ApiError } from "../services/errors";
import { json, method } from "../http/game-response";
import { readJson } from "../http/json";
import type { GameRouteContext } from "./game-context";

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
import { equipmentIdSchema } from "../../shared/equipment-id";
import { claimReward } from "../db/game-repository";

export async function handleStudentRewards(context: GameRouteContext, studentId: string, tail: string): Promise<Response | null> {
  const { request, db } = context;
  const id = studentId;
  if (
    ["claim-loot", "claim-gold"].includes(tail) &&
    method(request, "POST")
  ) {
    const input = z
      .object({
        fightId: uuid,
        resultId: uuid.optional(),
        itemId: equipmentIdSchema.optional(),
      })
      .parse(await readJson(request));
    if (tail === "claim-loot" && !input.itemId)
      throw new ApiError("Choose an item");
    return json(
      await claimReward(
        db,
        id,
        input.fightId,
        tail === "claim-loot" ? input.itemId! : null,
        input.resultId,
      ),
    );
  }
  if (tail === "award-xp")
    throw new ApiError("XP is awarded from server combat results", 403);
  return null;
}
