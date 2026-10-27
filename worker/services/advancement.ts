import { sql } from 'drizzle-orm';
import { AA_CATALOG, AA_CATALOG_VERSION, AA_XP_PER_POINT, aaUpgrade, aaWallet } from '../../shared/aa';
import type { AACustomizationInput, AAPurchaseInput, AAPurchaseReceipt, AASummary } from '../../shared/contracts/advancement';
import { validAppearance } from '../../shared/avatar/appearance';
import { getStudentAvatar } from '../db/avatar-repository';
import type { GameDatabase } from '../db/database';
import type { StudentRecord } from '../db/schema';
import { GameError } from './errors';

export async function advancementSummary(db: GameDatabase, student: StudentRecord): Promise<AASummary> {
  const avatar = await getStudentAvatar(db, student.id);
  const appearance = avatar && { modelId: avatar.modelId, hairColorId: avatar.hairColorId, eyeColorId: avatar.eyeColorId, skinColorId: avatar.skinColorId };
  return { catalogVersion: AA_CATALOG_VERSION, catalog: AA_CATALOG,
    wallet: aaWallet(student.aaExperience, student.aaPointsSpent), ranks: student.aaRanks,
    revision: student.aaRevision, characterName: student.characterName || student.nickname,
    appearance: validAppearance(appearance) ? appearance : null };
}
/** One database statement owns the lock, debit, grant and receipt; HTTP transactions cannot span requests. */
export async function purchaseAdvancement(db: GameDatabase, studentId: string, input: AAPurchaseInput | AACustomizationInput): Promise<AAPurchaseReceipt> {
  const customization = 'appearance' in input;
  const upgrade = aaUpgrade(customization ? 'recustomization' : input.upgradeId);
  const rank = customization ? 1 : input.rank;
  if (!upgrade || rank > upgrade.costs.length || (!customization && upgrade.kind === 'cosmetic'))
    throw new GameError('Unknown upgrade or rank');
  if (customization && !validAppearance(input.appearance)) throw new GameError('Invalid avatar selection');
  const cost = upgrade.costs[rank - 1];
  const result = await db.execute(sql`SELECT purchase_aa(${studentId}::uuid, ${input.requestId}::uuid,
    ${upgrade.id}, ${rank}, ${cost}, ${AA_CATALOG_VERSION}, ${AA_XP_PER_POINT}, ${JSON.stringify(input)}::jsonb) AS result`);
  // Both Neon HTTP and the migrated PGlite test adapter expose rows.
  const row = result.rows[0] as { result: AAPurchaseReceipt | { error: string; status: number } };
  if ('error' in row.result) throw new GameError(row.result.error, row.result.status);
  return row.result;
}
