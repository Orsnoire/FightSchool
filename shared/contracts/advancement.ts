import { z } from 'zod';
import { AA_CATALOG_VERSION, type AARanks, type AAUpgrade, type aaWallet } from '../aa';
import type { AvatarAppearance } from '../avatar/appearance';

export const aaPurchaseInput = z.object({
  requestId: z.string().uuid(), upgradeId: z.string().max(100),
  rank: z.number().int().min(1).max(10), catalogVersion: z.literal(AA_CATALOG_VERSION),
}).strict();
export const aaCustomizationInput = z.object({
  requestId: z.string().uuid(), catalogVersion: z.literal(AA_CATALOG_VERSION),
  revision: z.number().int().nonnegative(),
  characterName: z.string().trim().min(1).max(80),
  appearance: z.object({ modelId: z.string().max(100), hairColorId: z.string().max(100),
    eyeColorId: z.string().max(100), skinColorId: z.string().max(100) }).strict(),
}).strict();
export type AAPurchaseInput = z.infer<typeof aaPurchaseInput>;
export type AACustomizationInput = z.infer<typeof aaCustomizationInput>;
export interface AASummary {
  catalogVersion: number;
  wallet: ReturnType<typeof aaWallet>;
  ranks: AARanks;
  revision: number;
  catalog: readonly AAUpgrade[];
  characterName: string;
  appearance: AvatarAppearance | null;
}
export interface AAPurchaseReceipt {
  requestId: string; upgradeId: string; rank: number; cost: number; revision: number;
}
