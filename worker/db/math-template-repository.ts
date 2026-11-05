import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { MathPreset, MathPreview, MathTemplateDetail, MathTemplateSummary, MathRevisionSummary } from "../../shared/contracts/math-templates";
import { mathPresetSchema } from "../../shared/contracts/math-templates";
import type { GameDatabase } from "./database";
import { mathTemplates as templates, mathTemplateRevisions as revisions } from "./schema";

export class MathTemplateConflict extends Error {}
type RevisionRow = typeof revisions.$inferSelect;
type Write = { mutationId: string; requestHash: string; preset: MathPreset; preview: MathPreview; state: "draft" | "approved" };
const date = (value: Date) => value.toISOString();

/** Writes use one atomic SQL statement: Neon HTTP requires no interactive transaction. */
export function mathTemplateRepository(db: GameDatabase) {
  async function get(owner: string, id: string, revision?: number): Promise<MathTemplateDetail | null> {
    const [row] = await db.select({ template: templates, revision: revisions,
      approved: sql<number | null>`(SELECT max(revision) FROM math_template_revisions WHERE template_id = ${templates.id} AND state = 'approved')`.mapWith(Number),
    }).from(templates).innerJoin(revisions, and(eq(revisions.templateId, templates.id),
      revision === undefined ? eq(revisions.revision, templates.latestRevision) : eq(revisions.revision, revision)))
      .where(and(eq(templates.id, id), eq(templates.teacherId, owner)));
    if (!row) return null;
    const r = row.revision;
    return { id, latestRevision: row.template.latestRevision, latestApprovedRevision: row.approved,
      supported: mathPresetSchema.safeParse(r.preset).success,
      revision: { templateId: id, revision: r.revision, state: r.state, preset: r.preset, contentHash: r.contentHash,
        preview: r.preview, approvedBy: r.approvedBy, approvedAt: r.approvedAt ? date(r.approvedAt) : null, createdAt: date(r.createdAt) } };
  }
  async function replay(owner: string, id: string, mutationId: string, requestHash: string) {
    const [row] = await db.select({ revision: revisions.revision, hash: revisions.requestHash }).from(revisions)
      .innerJoin(templates, eq(templates.id, revisions.templateId))
      .where(and(eq(templates.teacherId, owner), eq(templates.id, id), eq(revisions.mutationId, mutationId)));
    if (!row) return null;
    if (row.hash !== requestHash) throw new MathTemplateConflict("This retry key was already used for different changes.");
    return get(owner, id, row.revision);
  }
  async function create(owner: string, write: Write) {
    const id = crypto.randomUUID();
    // Header + initial revision either both commit or both roll back.
    await db.execute(sql`WITH created AS (
      INSERT INTO math_templates (id, teacher_id, create_key, latest_revision)
      VALUES (${id}::uuid, ${owner}::uuid, ${write.mutationId}::uuid, 1)
      ON CONFLICT (teacher_id, create_key) DO NOTHING RETURNING id
    ) INSERT INTO math_template_revisions
      (template_id, revision, mutation_id, request_hash, preset, content_hash, preview, state)
      SELECT id, 1, ${write.mutationId}::uuid, ${write.requestHash}, ${JSON.stringify(write.preset)}::jsonb,
        ${write.preview.contentHash}, ${JSON.stringify(write.preview)}::jsonb, 'draft' FROM created`);
    const [head] = await db.select({ id: templates.id }).from(templates)
      .where(and(eq(templates.teacherId, owner), eq(templates.createKey, write.mutationId)));
    if (!head) throw new Error("Template creation did not persist.");
    return (await replay(owner, head.id, write.mutationId, write.requestHash))!;
  }
  async function append(owner: string, id: string, expected: number, write: Write) {
    const prior = await replay(owner, id, write.mutationId, write.requestHash);
    if (prior) return prior;
    try {
      await db.execute(sql`WITH advanced AS (
        UPDATE math_templates SET latest_revision = latest_revision + 1, updated_at = now()
        WHERE id = ${id}::uuid AND teacher_id = ${owner}::uuid AND latest_revision = ${expected}
        RETURNING id, latest_revision
      ) INSERT INTO math_template_revisions
        (template_id, revision, mutation_id, request_hash, preset, content_hash, preview, state, approved_by, approved_at)
        SELECT id, latest_revision, ${write.mutationId}::uuid, ${write.requestHash}, ${JSON.stringify(write.preset)}::jsonb,
          ${write.preview.contentHash}, ${JSON.stringify(write.preview)}::jsonb, ${write.state},
          ${write.state === "approved" ? owner : null}::uuid, CASE WHEN ${write.state} = 'approved' THEN now() ELSE NULL END
        FROM advanced`);
    } catch (error) {
      // A concurrent identical mutation with a different expected head may reach
      // the unique constraint. The whole statement rolls back; recover only an
      // exact committed receipt, never swallow a database failure.
      const committed = await replay(owner, id, write.mutationId, write.requestHash);
      if (committed) return committed;
      throw error;
    }
    const saved = await replay(owner, id, write.mutationId, write.requestHash);
    if (!saved) throw new MathTemplateConflict("A newer revision exists. Your draft is preserved; reopen the latest version before saving.");
    return saved;
  }
  async function list(owner: string, filters: { q: string; rule?: string; state?: string; offset: number }): Promise<MathTemplateSummary[]> {
    const q = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = await db.select({ id: templates.id, latestRevision: templates.latestRevision, preset: revisions.preset,
      state: revisions.state, updatedAt: templates.updatedAt }).from(templates)
      .innerJoin(revisions, and(eq(revisions.templateId, templates.id), eq(revisions.revision, templates.latestRevision)))
      .where(and(eq(templates.teacherId, owner), sql`${revisions.preset}->>'title' ILIKE ${q}`,
        filters.rule ? sql`${revisions.preset}->>'rule' = ${filters.rule}` : undefined,
        filters.state ? eq(revisions.state, filters.state as RevisionRow["state"]) : undefined))
      .orderBy(desc(templates.updatedAt), templates.id).limit(50).offset(filters.offset);
    return rows.map(r => ({ id: r.id, latestRevision: r.latestRevision, title: r.preset.title, rule: r.preset.rule, state: r.state, updatedAt: date(r.updatedAt) }));
  }
  async function history(owner: string, id: string, before: number): Promise<MathRevisionSummary[]> {
    const rows = await db.select({ revision: revisions.revision, state: revisions.state, preset: revisions.preset, createdAt: revisions.createdAt })
      .from(revisions).innerJoin(templates, eq(revisions.templateId, templates.id))
      .where(and(eq(templates.id, id), eq(templates.teacherId, owner), lt(revisions.revision, before)))
      .orderBy(desc(revisions.revision)).limit(50);
    return rows.map(r => ({ revision: r.revision, state: r.state, title: r.preset.title, createdAt: date(r.createdAt) }));
  }
  return { get, create, append, replay, list, history };
}
