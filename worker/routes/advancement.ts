import { aaCustomizationInput, aaPurchaseInput } from '../../shared/contracts/advancement';
import type { StudentRecord } from '../db/schema';
import { json } from '../http/game-response';
import { readJson } from '../http/json';
import { advancementSummary, purchaseAdvancement } from '../services/advancement';
import type { GameRouteContext } from './game-context';

export async function handleAdvancement(context: GameRouteContext, student: StudentRecord, tail: string) {
  if (!['advancement', 'advancement/purchase', 'advancement/customize'].includes(tail)) return null;
  const { request, db } = context;
  if (tail === 'advancement' && request.method === 'GET') return json(await advancementSummary(db, student));
  if (tail !== 'advancement' && request.method === 'POST') {
    const input = (tail.endsWith('/customize') ? aaCustomizationInput : aaPurchaseInput).parse(await readJson(request));
    return json(await purchaseAdvancement(db, student.id, input));
  }
  return json({ error: 'Method not allowed' }, 405);
}
