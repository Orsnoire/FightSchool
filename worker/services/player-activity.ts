import { sql } from 'drizzle-orm';
import { ACTIVITY_SAMPLE_MS, ACTIVITY_WEEK_MS } from '../../shared/contracts/player-activity';
import type { GameDatabase } from '../db/database';

/** Only the authenticated student can call this. Client clocks/durations are never accepted.
 * A pulse samples the last completed 30-second bucket; PK deduplicates devices/tabs.
 */
export async function recordPlayerActivity(db: GameDatabase, studentId: string, pulse: {pulseId: string; active: boolean}, now = Date.now()) {
  const start = Math.floor(now / ACTIVITY_SAMPLE_MS) * ACTIVITY_SAMPLE_MS - ACTIVITY_SAMPLE_MS;
  await db.execute(sql`WITH tracking AS (
    INSERT INTO student_activity_tracking(student_id,started_at) VALUES(${studentId}::uuid,${now}::bigint)
    ON CONFLICT DO NOTHING
  ), prune AS (
    DELETE FROM student_activity_samples WHERE student_id=${studentId}::uuid
      AND bucket_start < ${now - ACTIVITY_WEEK_MS - 86400000}::bigint
  ) INSERT INTO student_activity_samples(student_id,bucket_start,pulse_id)
    SELECT ${studentId}::uuid,${start}::bigint,${pulse.pulseId}::uuid WHERE ${pulse.active}
    ON CONFLICT DO NOTHING`);
}
