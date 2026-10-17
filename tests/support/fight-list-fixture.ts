import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../../worker/db/schema.ts';
import { listTeacherFightSummaries } from '../../worker/db/fight-summaries.ts';
import { fight } from '../phase4/fixtures.ts';

const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function fightListFixture(count = 40, questions = 50) {
  const pg = new PGlite();
  const journal = JSON.parse(readFileSync('migrations/cloudflare/meta/_journal.json', 'utf8'));
  for (const { tag } of journal.entries) await pg.exec(readFileSync(`migrations/cloudflare/${tag}.sql`, 'utf8'));
  const db = drizzle(pg, { schema });
  const owner = id(1), other = id(2);
  await db.insert(schema.teachers).values([owner, other].map((teacherId, i) => ({
    id: teacherId, firstName: 'Fixture', lastName: String(i), email: `c07-${i}@example.invalid`,
    emailNormalized: `c07-${i}@example.invalid`, passwordHash: 'unused', guildCode: `C07FIX${i}`,
    billingAddress: 'Fixture', schoolDistrict: 'Fixture', school: 'Fixture', subject: 'Math', gradeLevel: '10',
  })));
  const bank = Array.from({ length: questions }, (_, n) => ({ ...fight.questions[0], id: `q${n}`,
    question: `<p>Question ${n}: explain the following expression and show your work.</p>` + '<p>Supporting classroom context.</p>'.repeat(5),
    correctAnswer: `\\frac{${n + 1}}{2}`, standards: ['CCSS.F-IF.1'],
  }));
  await db.insert(schema.fights).values(Array.from({ length: count + 2 }, (_, n) => ({
    ...fight, id: id(100 + n), teacherId: n === count + 1 ? other : owner,
    title: `Battle ${String(n).padStart(3, '0')}`, guildCode: n % 2 ? 'C07FIX' : null,
    encounterTier: n % 2 ? 2 : null, questions: n === 0 ? [] : bank,
    enemies: n === 0 ? [] : [{ ...fight.enemies[0], quantity: 5 }],
    isArchived: n === count, createdAt: new Date(1_700_000_000_000), updatedAt: new Date(1_700_000_000_000),
  })));
  await pg.exec('ANALYZE');
  const calls: Array<{ sql: string; params: any[]; rows: number; bytes: number }> = [];
  const query = pg.query.bind(pg);
  (pg as any).query = async (sql: string, params: any[] = [], options?: any) => {
    const result = await query(sql, params, options);
    calls.push({ sql, params, rows: result.rows.length, bytes: Buffer.byteLength(JSON.stringify(result.rows)) });
    return result;
  };
  const sessions = new Map();
  const repository: any = {
    createSession: async (s: any) => sessions.set(s.tokenHash, s),
    findActiveSession: async (hash: string) => sessions.get(hash) || null,
    listTeacherFightSummaries: (teacherId: string) => listTeacherFightSummaries(db as any, teacherId),
    // This is the pre-C07 repository query, still used by the compatible full view.
    listTeacherFights: (teacherId: string) => db.select().from(schema.fights)
      .where(and(eq(schema.fights.teacherId, teacherId), eq(schema.fights.isArchived, false)))
      .orderBy(desc(schema.fights.createdAt)),
    findFightById: async (fightId: string) => (await db.select().from(schema.fights).where(eq(schema.fights.id, fightId)))[0] || null,
  };
  return { pg, db, repository, calls, owner, other, count, questions, firstId: id(100), fullId: id(101) };
}
