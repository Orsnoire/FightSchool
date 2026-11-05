import { z } from "zod";
import { approveMathPresetSchema, exponentRuleSchema, mathPreviewRequestSchema, saveMathPresetSchema } from "../../shared/contracts/math-templates";
import { canonicalPreset, EXPONENT_CATALOG, MathAuthoringError, mathHash, previewMathTemplate } from "../../shared/math/templates/exponents";
import { authenticateSession, type SessionConfig, type SessionRepository } from "../auth/session";
import { MathTemplateConflict, mathTemplateRepository } from "../db/math-template-repository";
import type { GameDatabase } from "../db/database";
import { bodyErrorResponse, readJson } from "../http/json";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const uuid = z.string().uuid();
const integerQuery = (value: string | null, fallback: number, max: number) => value === null ? fallback : z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(max)).parse(value);

export async function handleMathAuthoring(request: Request, url: URL, identity: SessionRepository, sessionConfig: SessionConfig, db: GameDatabase): Promise<Response> {
  const actor = await authenticateSession(request, identity, sessionConfig, "teacher");
  if (!actor) return json({ error: "Authentication required" }, 401);
  const repository = mathTemplateRepository(db);
  const path = url.pathname;
  try {
    if (request.method === "GET" && path === "/api/math/templates/catalog") return json(EXPONENT_CATALOG);
    if (request.method === "POST" && path === "/api/math/templates/preview") {
      const input = mathPreviewRequestSchema.parse(await readJson(request, 16_384));
      return json(await previewMathTemplate(input));
    }
    if (path === "/api/math/templates") {
      if (request.method === "GET") {
        const q = z.string().max(120).parse(url.searchParams.get("q") ?? "");
        const rule = url.searchParams.has("rule") ? exponentRuleSchema.parse(url.searchParams.get("rule")) : undefined;
        const state = url.searchParams.has("state") ? z.enum(["draft", "approved"]).parse(url.searchParams.get("state")) : undefined;
        const offset = integerQuery(url.searchParams.get("offset"), 0, 100_000);
        const items = await repository.list(actor.actorId, { q, rule, state, offset });
        return json({ items, nextOffset: items.length === 50 ? offset + 50 : null });
      }
      if (request.method === "POST") {
        const input = saveMathPresetSchema.parse(await readJson(request, 16_384));
        if (input.expectedRevision !== 0) return json({ error: "A new template must start at revision zero." }, 400);
        const preset = canonicalPreset(input.preset);
        const preview = await previewMathTemplate({ preset, ...input.preview });
        return json(await repository.create(actor.actorId, { ...input, preset, preview, state: "draft", requestHash: await mathHash({ action: "create", ...input, preset }) }), 201);
      }
    }
    const match = path.match(/^\/api\/math\/templates\/([^/]+)(?:\/(revisions|approve))?$/);
    if (!match) return json({ error: "Authoring route not found" }, 404);
    const id = uuid.parse(match[1]);
    const current = await repository.get(actor.actorId, id);
    if (!current) return json({ error: "Template not found" }, 404);
    if (request.method === "GET" && match[2] === "revisions") {
      return json(await repository.history(actor.actorId, id, integerQuery(url.searchParams.get("before"), 2_000_000_001, 2_000_000_001)));
    }
    if (request.method === "GET" && !match[2]) {
      const revision = url.searchParams.has("revision") ? integerQuery(url.searchParams.get("revision"), 0, 2_000_000_000) : undefined;
      const detail = revision === undefined ? current : await repository.get(actor.actorId, id, revision);
      return detail ? json(detail) : json({ error: "Revision not found" }, 404);
    }
    if (request.method === "POST" && match[2] === "revisions") {
      const input = saveMathPresetSchema.parse(await readJson(request, 16_384));
      const preset = canonicalPreset(input.preset);
      const preview = await previewMathTemplate({ preset, ...input.preview });
      return json(await repository.append(actor.actorId, id, input.expectedRevision, { ...input, preset, preview, state: "draft",
        requestHash: await mathHash({ action: "save", ...input, preset }) }), 201);
    }
    if (request.method === "POST" && match[2] === "approve") {
      const input = approveMathPresetSchema.parse(await readJson(request, 16_384));
      const requestHash = await mathHash({ action: "approve", ...input });
      const prior = await repository.replay(actor.actorId, id, input.mutationId, requestHash);
      if (prior) return json(prior, 201);
      if (current.latestRevision !== input.expectedRevision || current.revision.state !== "draft") throw new MathTemplateConflict("Reopen the latest draft before approving.");
      if (!current.supported) throw new MathTemplateConflict("This version is read-only. Create and review a supported preset.");
      const preset = canonicalPreset(current.revision.preset);
      const preview = await previewMathTemplate({ preset, ...input.preview });
      if (preview.contentHash !== input.contentHash || preview.previewHash !== input.previewHash) throw new MathTemplateConflict("The reviewed preview changed. Preview and confirm this draft again.");
      return json(await repository.append(actor.actorId, id, input.expectedRevision, { mutationId: input.mutationId, requestHash, preset, preview, state: "approved" }), 201);
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    const bodyFailure = bodyErrorResponse(error);
    if (bodyFailure) return bodyFailure;
    if (error instanceof MathTemplateConflict) return json({ error: error.message }, 409);
    if (error instanceof MathAuthoringError) return json({ error: error.message }, 400);
    if (error instanceof z.ZodError) return json({ error: "Invalid template settings. Use the supported version, integer ranges -6 to 6, a title, and at most 10 previews." }, 400);
    throw error;
  }
}
