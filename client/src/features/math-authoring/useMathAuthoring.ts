import { useEffect, useRef, useState } from "react";
import type { MathGradeResult } from "@shared/contracts/math-answers";
import type { ExponentRule, MathPreset, MathPreview, MathRevisionSummary, MathTemplateDetail, MathTemplateSummary } from "@shared/contracts/math-templates";
import { defaultMathPreset } from "@shared/math/templates/exponents";

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "include", signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to complete this request. Your draft is preserved.");
  return data;
}
const base = "/api/math/templates";

/** Lives above the fight tabs: hiding the panel never discards a template draft. */
export function useMathAuthoring() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MathPreset>(() => defaultMathPreset());
  const [detail, setDetail] = useState<MathTemplateDetail | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editingHistorical, setEditingHistorical] = useState(false);
  const [preview, setPreview] = useState<MathPreview | null>(null);
  const [seed, setSeed] = useState(1);
  const [count, setCount] = useState(5);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<MathRevisionSummary[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, MathGradeResult>>({});
  const [search, setSearch] = useState("");
  const [ruleFilter, setRuleFilter] = useState<"" | ExponentRule>("");
  const [stateFilter, setStateFilter] = useState<"" | "draft" | "approved">("");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<MathTemplateSummary[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [listError, setListError] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const pending = useRef<{ fingerprint: string; mutationId: string }>();
  const readOnly = !!detail && (!detail.supported || detail.revision.revision !== detail.latestRevision && !editingHistorical);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => { setOffset(0); }, [search, ruleFilter, stateFilter]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setListLoading(true);
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ q: search, offset: String(offset) });
      if (ruleFilter) query.set("rule", ruleFilter);
      if (stateFilter) query.set("state", stateFilter);
      request<{ items: MathTemplateSummary[]; nextOffset: number | null }>(`${base}?${query}`, undefined, controller.signal)
        .then(data => { setItems(data.items); setNextOffset(data.nextOffset); setListError(""); })
        .catch(error => { if (!controller.signal.aborted) setListError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, search, ruleFilter, stateFilter, offset, refresh]);

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Request failed. Your draft is preserved."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function update(next: MathPreset) {
    setDraft(next); setDirty(true); setPreview(null); setConfirmed(false); setGrades({}); setAnswers({}); setMessage("");
  }
  function acceptLoaded(next: MathTemplateDetail) {
    setDetail(next);
    setEditingHistorical(false);
    if (next.supported) setDraft(next.revision.preset);
    setPreview(next.revision.preview); setSeed(next.revision.preview.seed); setCount(next.revision.preview.requestedCount);
    setDirty(false); setConfirmed(false); setAnswers({}); setGrades({});
  }
  const canDiscard = () => !dirty || window.confirm("Discard unsaved template changes? Your fixed questions will be kept.");
  function selectRule(rule: ExponentRule) {
    if (busyRef.current || !canDiscard()) return;
    setDetail(null); setEditingHistorical(false); setHistory([]); setError(""); update(defaultMathPreset(rule)); pending.current = undefined;
  }
  function discard() {
    if (!canDiscard()) return;
    if (detail) acceptLoaded(detail);
    else { setDraft(defaultMathPreset()); setDirty(false); setPreview(null); setConfirmed(false); }
    setError(""); setMessage(""); pending.current = undefined;
  }
  function load(id: string, revision?: number) {
    if (!canDiscard()) return;
    return run(async () => {
      const [next, versions] = await Promise.all([
        request<MathTemplateDetail>(`${base}/${id}${revision ? `?revision=${revision}` : ""}`),
        request<MathRevisionSummary[]>(`${base}/${id}/revisions`),
      ]);
      acceptLoaded(next); setHistory(versions); pending.current = undefined;
      setMessage(`Opened revision ${next.revision.revision}.`);
    });
  }
  function moreHistory() {
    if (!detail || !history.length) return;
    return run(async () => {
      const older = await request<MathRevisionSummary[]>(`${base}/${detail.id}/revisions?before=${history.at(-1)!.revision}`);
      setHistory(previous => [...previous, ...older]);
    });
  }
  function editHistorical() {
    if (!detail?.supported) return;
    // Explicitly base a new draft on the viewed revision; optimistic head check
    // still protects any newer changes since this version was opened.
    setEditingHistorical(true);
    setDirty(true); setPreview(null); setConfirmed(false);
  }
  function makePreview(reshuffle = false) {
    if (readOnly) return;
    return run(async () => {
      const nextSeed = reshuffle ? (seed + 1) >>> 0 : seed;
      const result = await request<MathPreview>(`${base}/preview`, { preset: draft, seed: nextSeed, count });
      setPreview(result); setSeed(nextSeed); setConfirmed(false); setGrades({}); setAnswers({});
    });
  }
  function mutation(body: object, path: string) {
    const fingerprint = JSON.stringify({ path, body });
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, mutationId: crypto.randomUUID() };
    return { ...body, mutationId: pending.current.mutationId };
  }
  function save() {
    if (readOnly) return;
    return run(async () => {
      const path = detail ? `${base}/${detail.id}/revisions` : base;
      const body = mutation({ preset: draft, expectedRevision: detail?.latestRevision ?? 0, preview: { seed, count } }, path);
      const saved = await request<MathTemplateDetail>(path, body);
      acceptLoaded(saved); setHistory([]); pending.current = undefined; setRefresh(x => x + 1);
      setMessage(`Saved draft revision ${saved.revision.revision}. Review the preview before approving.`);
    });
  }
  function approve() {
    if (!detail || !preview || !confirmed || dirty || readOnly || detail.revision.state !== "draft") return;
    return run(async () => {
      const path = `${base}/${detail.id}/approve`;
      const body = mutation({ expectedRevision: detail.latestRevision, contentHash: preview.contentHash, previewHash: preview.previewHash,
        preview: { seed: preview.seed, count: preview.requestedCount }, confirmed: true }, path);
      const saved = await request<MathTemplateDetail>(path, body);
      acceptLoaded(saved); setHistory([]); pending.current = undefined; setRefresh(x => x + 1);
      setMessage(`Approved revision ${saved.revision.revision} for authoring reuse.`);
    });
  }
  function tryAnswer(id: string) {
    const variant = preview?.variants.find(v => v.id === id);
    if (!variant) return;
    return run(async () => {
      const result = await request<MathGradeResult>("/api/fights/math/grade-preview", { answerContract: variant.answerContract, submitted: answers[id] ?? "" });
      setGrades(previous => ({ ...previous, [id]: result }));
    });
  }
  function changeAnswer(id: string, value: string) {
    setAnswers(previous => ({ ...previous, [id]: value }));
    setGrades(previous => { const next = { ...previous }; delete next[id]; return next; });
  }
  return { open, setOpen, draft, update, detail, readOnly, dirty, preview, seed, count, setCount: (n: number) => { setCount(n); setPreview(null); setConfirmed(false); },
    confirmed, setConfirmed, busy, error, message, history, answers, changeAnswer, grades, search, setSearch, ruleFilter, setRuleFilter,
    stateFilter, setStateFilter, items, nextOffset, offset, setOffset, listLoading, listError, refreshList: () => setRefresh(x => x + 1),
    selectRule, discard, load, moreHistory, editHistorical, makePreview, save, approve, tryAnswer };
}
