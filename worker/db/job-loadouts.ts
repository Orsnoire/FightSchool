import { and, eq, inArray, sql } from 'drizzle-orm';
import { EQUIPMENT_SLOTS } from '../../shared/equipment-slots';
import { captureLoadout, restoreLoadout } from '../../shared/job-loadouts';
import { EQUIPMENT_ITEMS, type CharacterClass } from '../../shared/schema';
import type { GameDatabase } from './game-repository';
import * as s from './schema';

export class LoadoutConflict extends Error {}
/** One conditional row update saves the outgoing job and activates the incoming one atomically. */
export async function switchStudentJob(db: Pick<GameDatabase, 'select' | 'update' | 'insert'>,
  id: string, job: CharacterClass, gender: s.StudentRecord['gender']) {
  const [previous] = await db.select().from(s.students).where(eq(s.students.id, id));
  if (!previous) return null;
  const switching = previous.characterClass !== job;
  const remembered = {...previous.jobLoadouts};
  let loadout = captureLoadout(previous);
  if (switching) {
    if (previous.characterClass) remembered[previous.characterClass] = loadout;
    const jobs = await db.select().from(s.studentJobLevels).where(eq(s.studentJobLevels.studentId, id));
    const levels = Object.fromEntries(jobs.map(row => [row.jobClass, row.level]));
    const saved = remembered[job];
    const customIds = EQUIPMENT_SLOTS.map(slot => saved?.[slot]).filter((value): value is string =>
      !!value && !EQUIPMENT_ITEMS[value] && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value));
    const custom = customIds.length ? await db.select().from(s.equipmentItems).where(inArray(s.equipmentItems.id, customIds)) : [];
    loadout = restoreLoadout(job, saved, [...previous.inventory,
      ...EQUIPMENT_SLOTS.map(slot => previous[slot]).filter((value): value is string => !!value)],
      levels, Object.fromEntries(custom.map(item => [item.id, item])));
  }
  const [updated] = await db.update(s.students).set({
    ...loadout, characterClass: job, gender, jobLoadouts: remembered,
    loadoutRevision: sql`${s.students.loadoutRevision} + 1`,
    inventory: sql`(SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb) FROM jsonb_array_elements(${s.students.inventory} || ${JSON.stringify(EQUIPMENT_SLOTS.map(slot => previous[slot]).filter(Boolean))}::jsonb))`,
  }).where(and(eq(s.students.id, id), eq(s.students.loadoutRevision, previous.loadoutRevision))).returning();
  if (!updated) throw new LoadoutConflict('Your loadout changed. Refresh and try again.');
  await db.insert(s.studentJobLevels).values({studentId:id, jobClass:job}).onConflictDoNothing();
  return updated;
}
