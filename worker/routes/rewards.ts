import { rewardClaimInput } from "../../shared/contracts/rewards";
import { json, method } from "../http/game-response";
import { readJson } from "../http/json";
import { GameError as ApiError } from "../services/errors";
import { claimReward } from "../services/rewards";
import type { GameRouteContext } from "./game-context";
export async function handleStudentRewards(context: GameRouteContext, studentId: string, tail: string): Promise<Response | null> {
  const { request, db } = context;
  const id = studentId;
  if (["claim-loot", "claim-gold"].includes(tail) &&
    method(request, "POST")) {
    const input = rewardClaimInput.parse(await readJson(request));
    if (tail === "claim-loot" && !input.itemId)
      throw new ApiError("Choose an item");
    return json(await claimReward(db, id, input.fightId, tail === "claim-loot" ? input.itemId! : null, input.resultId));
  }
  if (tail === "award-xp")
    throw new ApiError("XP is awarded from server combat results", 403);
  return null;
}
