import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import * as s from '../../worker/db/schema';
import { advancementSummary, purchaseAdvancement } from '../../worker/services/advancement';
import { createStudentAvatar } from '../../worker/db/avatar-repository';
import { initialAppearance } from '../../shared/avatar/appearance';
import { issueSession, type SessionRecord } from '../../worker/auth/session';
import { handleGame } from '../../worker/routes/game';
import type { IdentityRepository } from '../../worker/db/repository';
import { student } from './fixtures';

test('AA migration, atomic spending, appearance updates and HTTP ownership preserve earned progression', async t => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema: s });
  const gameDb = db as any;
  const journal = JSON.parse(readFileSync(new URL('../../migrations/cloudflare/meta/_journal.json', import.meta.url), 'utf8'));
  try {
    for (const { tag } of journal.entries.filter((x: any) => !x.tag.includes('alternate_advancement')))
      await pg.exec(readFileSync(new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url), 'utf8'));
    // Seed an actual pre-AA row so the migration cannot pass by only testing new users.
    const id = student().id;
    await pg.query(`INSERT INTO students(id,nickname,nickname_normalized,password_hash,character_class,gender,aa_experience,xp_remainder,cross_class_ability_1,cross_class_ability_2)
      VALUES($1,'Original login','original login','never valid','warrior','A',125,0.625,'first','second')`, [id]);
    await pg.exec(readFileSync(new URL('../../migrations/cloudflare/0018_alternate_advancement.sql', import.meta.url), 'utf8'));
    const current = async () => (await db.select().from(s.students).where(eq(s.students.id, id)))[0];
    const buy = (upgradeId: string, rank = 1, requestId = crypto.randomUUID()) => ({ upgradeId, rank, requestId, catalogVersion: 1 as const });

    await t.test('bank and legacy slots migrate without re-awarding or losing fractional XP', async () => {
      const row = await current();
      assert.equal(row.aaExperience, 125); assert.equal(row.xpRemainder, 0.625);
      assert.deepEqual(row.crossClassAbilities, ['first', 'second']);
      const summary = await advancementSummary(gameDb, row);
      assert.deepEqual(summary.wallet, { total: 2, spent: 0, available: 2, xpTowardNext: 5, xpPerPoint: 60 });
      await advancementSummary(gameDb, row);
      assert.equal((await db.select().from(s.aaPurchases)).length, 0, 'GET is read-only');
    });
    await t.test('simultaneous purchases cannot overspend; lost responses replay once', async () => {
      const first = buy('stat:str'), second = buy('stat:int');
      const results = await Promise.allSettled([purchaseAdvancement(gameDb, id, first), purchaseAdvancement(gameDb, id, second)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      const winner = results[0].status === 'fulfilled' ? first : second;
      const row = await current(); assert.equal(row.aaPointsSpent, 2); assert.equal(row.aaExperience, 125);
      const receipt = await purchaseAdvancement(gameDb, id, winner);
      assert.equal(receipt.cost, 2); assert.equal((await current()).aaPointsSpent, 2);
      await assert.rejects(purchaseAdvancement(gameDb, id, { ...winner, upgradeId: 'health' }), /different purchase/);
      assert.equal((await db.select().from(s.aaPurchases)).length, 1);
      await assert.rejects(purchaseAdvancement(gameDb, id, buy(winner.upgradeId, 3)), /Rank changed/);
      await assert.rejects(purchaseAdvancement(gameDb, id, buy('dodging', 5)), /Unknown/);
      await assert.rejects(purchaseAdvancement(gameDb, id, buy('armor:light_armor:hands')), /Unknown/);
    });
    await t.test('appearance and debit commit together; no-op/cancel cannot charge; login identity is stable', async () => {
      await db.update(s.students).set({ aaExperience: 1200 }).where(eq(s.students.id, id));
      const appearance = initialAppearance(null, 'human-male-v1', () => 0);
      await createStudentAvatar(gameDb, id, appearance.modelId, appearance);
      const input = { requestId: crypto.randomUUID(), catalogVersion: 1 as const, revision: (await current()).aaRevision,
        characterName: 'New character', appearance: { ...appearance, modelId: 'human-female-v1' } };
      const before = await current();
      const receipt = await purchaseAdvancement(gameDb, id, input);
      const after = await current();
      assert.equal(after.aaPointsSpent, before.aaPointsSpent + 5);
      assert.equal(after.characterName, 'New character'); assert.equal(after.gender, 'B');
      assert.equal(after.nickname, 'Original login'); assert.equal(after.nicknameNormalized, 'original login');
      assert.deepEqual(await purchaseAdvancement(gameDb, id, input), receipt);
      assert.equal((await current()).aaPointsSpent, after.aaPointsSpent);
      const noChange = await purchaseAdvancement(gameDb, id, { ...input, requestId: crypto.randomUUID(), revision: after.aaRevision });
      assert.equal(noChange.cost, 0); assert.equal(noChange.revision, after.aaRevision);
      await assert.rejects(purchaseAdvancement(gameDb, id, { ...input, requestId: crypto.randomUUID(), characterName: 'Stale' }), /character changed/);
      await assert.rejects(purchaseAdvancement(gameDb, id, { ...input, requestId: crypto.randomUUID(), revision: after.aaRevision,
        appearance: { ...input.appearance, hairColorId: 'invalid' } }), /Invalid avatar/);
      assert.equal((await current()).characterName, 'New character');
      assert.equal((await current()).aaPointsSpent, after.aaPointsSpent);
    });
    await t.test('legacy and ordered slot writes stay coherent without dropping extra slots', async () => {
      await db.update(s.students).set({ crossClassAbilities: ['a', 'b', 'c', 'd', 'e'] }).where(eq(s.students.id, id));
      assert.equal((await current()).crossClassAbility1, 'a');
      await db.update(s.students).set({ crossClassAbility1: 'legacy', crossClassAbility2: null }).where(eq(s.students.id, id));
      assert.deepEqual((await current()).crossClassAbilities, ['legacy', null, 'c', 'd', 'e']);
    });
    await t.test('HTTP routes enforce session ownership, schema, methods and server prices', async () => {
      const sessions = new Map<string, SessionRecord>();
      const repository = { createSession: async (r: SessionRecord & { tokenHash: string }) => { sessions.set(r.tokenHash, r); },
        findActiveSession: async (key: string) => sessions.get(key) || null } as IdentityRepository;
      const config = { cookieName: 'aa_test', secret: 'isolated-aa-test-secret-not-deployed', ttlSeconds: 300 };
      const own = (await issueSession(repository, config, 'student', id)).split(';')[0];
      const other = (await issueSession(repository, config, 'student', crypto.randomUUID())).split(';')[0];
      const call = async (tail: string, method = 'GET', cookie = own, body?: unknown) => {
        const url = new URL(`https://qa.example/api/student/${id}/advancement${tail}`);
        return (await handleGame(new Request(url, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}) }), url, repository, config, gameDb))!;
      };
      assert.equal((await call('', 'GET', '')).status, 401);
      assert.equal((await call('', 'GET', other)).status, 403);
      assert.equal((await call('', 'GET')).status, 200);
      assert.equal((await call('/purchase', 'GET')).status, 405);
      assert.equal((await call('/purchase', 'POST', own, { ...buy('health'), cost: 0 })).status, 400);
      const input = buy('health');
      const receipt = await (await call('/purchase', 'POST', own, input)).json() as any;
      assert.equal(receipt.cost, 2);
      assert.deepEqual(await (await call('/purchase', 'POST', own, input)).json(), receipt);
    });
  } finally { await pg.close(); }
});
