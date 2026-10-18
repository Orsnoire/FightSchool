import { z } from "zod";
import { equipmentIdSchema } from "../equipment-id";
const uuid = z.string().uuid();
export const rewardClaimInput = z
  .object({
    fightId: uuid,
    resultId: uuid.optional(),
    itemId: equipmentIdSchema.optional(),
  });
export type RewardClaimInput = z.infer<typeof rewardClaimInput>;
