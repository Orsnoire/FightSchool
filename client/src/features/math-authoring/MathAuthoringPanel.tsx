import { Button } from "@/components/ui/button";
import { Input as FormInput } from "@/components/ui/input";
import type { ComponentProps } from "react";
import { QuestionPreview } from "@/components/QuestionPreview";
import { EXPONENT_CATALOG } from "@shared/math/templates/exponents";
import type { ExponentRule, MathPreset } from "@shared/contracts/math-templates";
import type { MathGradeResult } from "@shared/contracts/math-answers";
import type { useMathAuthoring } from "./useMathAuthoring";

const selectClass = "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm";
// This workspace is embedded in the fight form but saves through its own API.
// Disassociate inputs so native validation/Enter cannot submit or block that form.
const Input = (props: ComponentProps<typeof FormInput>) => <FormInput {...props} form="" />;
const gradeLabel = (grade: MathGradeResult) => grade.status === "correct" ? "Correct" : grade.status === "indeterminate"
  ? `Could not grade: ${grade.reason.replaceAll("_", " ")}. This is not a wrong answer.`
  : grade.reason === "required_form" ? "Equal value, but enter a single integer only." : `Incorrect: ${grade.reason.replaceAll("_", " ")}.`;

export default function MathAuthoringPanel({ editor: e }: { editor: ReturnType<typeof useMathAuthoring> }) {
  const catalog = EXPONENT_CATALOG.filter(item => (!e.ruleFilter || item.rule === e.ruleFilter) &&
    `${item.name} ${item.description} ${item.keywords}`.toLowerCase().includes(e.search.toLowerCase()));
  const setRange = (variable: "m" | "n", bound: "min" | "max", value: string) =>
    e.update({ ...e.draft, [variable]: { ...e.draft[variable], [bound]: value === "" ? NaN : Number(value) } });
  return <section aria-label="Math templates" className="space-y-4 rounded-lg border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-semibold">Math templates</h2><p className="text-sm text-muted-foreground">Missing-exponent practice · teacher authoring preview</p></div>
      <Button type="button" variant="outline" aria-expanded={e.open} onClick={() => e.setOpen(!e.open)} data-testid="button-math-templates">{e.open ? "Hide templates" : "Open templates"}</Button>
    </div>
    {e.open && <div className="space-y-5" data-testid="math-authoring-workspace">
      <p className="text-sm">Save reusable practice settings and review integer answers here. These templates are not added to fights.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Search skills or saved titles<Input maxLength={120} value={e.search} onChange={event => e.setSearch(event.target.value)} placeholder="Try multiplication or negative" /></label>
        <label className="space-y-1 text-sm">Rule filter<select aria-label="Rule filter" form="" className={selectClass} value={e.ruleFilter} onChange={event => e.setRuleFilter(event.target.value as "" | ExponentRule)}><option value="">All rules</option>{EXPONENT_CATALOG.map(item => <option key={item.rule} value={item.rule}>{item.name}</option>)}</select></label>
        <label className="space-y-1 text-sm">Saved status<select aria-label="Saved status" form="" className={selectClass} value={e.stateFilter} onChange={event => e.setStateFilter(event.target.value as "" | "draft" | "approved")}><option value="">All statuses</option><option value="draft">Draft</option><option value="approved">Approved</option></select></label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">{catalog.map(item => <div key={item.rule} className="space-y-2 rounded-md border p-3">
        <h3 className="font-medium">{item.name}</h3><p className="text-sm text-muted-foreground">{item.description}</p>
        <Button type="button" variant="outline" disabled={e.busy} onClick={() => e.selectRule(item.rule)}>Use {item.skill.toLowerCase()}</Button>
      </div>)}</div>
      {catalog.length === 0 && <p className="text-sm">No curated skills match this search.</p>}
      <section aria-label="My math templates" className="space-y-2">
        <h3 className="font-semibold">My templates</h3>
        {e.listLoading && <p role="status">Loading saved templates…</p>}
        {e.listError && <div role="alert">{e.listError} <Button type="button" variant="outline" onClick={e.refreshList}>Retry list</Button></div>}
        {!e.listLoading && !e.listError && e.items.length === 0 && <p className="text-sm text-muted-foreground">No saved templates match. Choose a skill above to begin.</p>}
        {e.items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
          <span className="min-w-0 break-words">{item.title} <span className="text-sm text-muted-foreground">· {item.state} · revision {item.latestRevision}</span></span>
          <Button type="button" variant="outline" disabled={e.busy} onClick={() => e.load(item.id)}>Open {item.title}</Button>
        </div>)}
        <div className="flex gap-2">{e.offset > 0 && <Button type="button" variant="outline" onClick={() => e.setOffset(Math.max(0, e.offset - 50))}>Previous templates</Button>}{e.nextOffset !== null && <Button type="button" variant="outline" onClick={() => e.setOffset(e.nextOffset!)}>More templates</Button>}</div>
      </section>
      <div className="space-y-3 border-t pt-4">
        <h3 className="font-semibold">{e.detail ? `Revision ${e.detail.revision.revision} · ${e.detail.revision.state}` : "New template"}{e.dirty ? " · unsaved changes" : ""}</h3>
        {e.readOnly && <p role="status">This saved revision is read-only.{e.detail?.supported && <Button type="button" variant="outline" onClick={e.editHistorical}>Create draft from this version</Button>}{!e.detail?.supported && " Choose a supported catalog skill to create a new preset."}</p>}
        {e.detail && <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={e.busy} onClick={() => e.load(e.detail!.id)}>Reopen latest</Button>
          {e.detail.latestApprovedRevision !== null && <Button type="button" variant="outline" disabled={e.busy} onClick={() => e.load(e.detail!.id, e.detail!.latestApprovedRevision!)}>View last approved</Button>}
          {e.history.length > 0 && <label className="text-sm">Revision history<select aria-label="Revision history" form="" className={selectClass} value={e.detail.revision.revision} disabled={e.busy} onChange={event => e.load(e.detail!.id, Number(event.target.value))}>
            {!e.history.some(r => r.revision === e.detail!.revision.revision) && <option value={e.detail.revision.revision}>Revision {e.detail.revision.revision}</option>}
            {e.history.map(r => <option key={r.revision} value={r.revision}>Revision {r.revision} · {r.state}</option>)}</select></label>}
          {e.history.length > 0 && e.history.at(-1)!.revision > 1 && <Button type="button" variant="outline" disabled={e.busy} onClick={e.moreHistory}>Older revisions</Button>}
        </div>}
        {(!e.detail || e.detail.supported) && <fieldset disabled={e.busy || e.readOnly} className="min-w-0 space-y-3">
          <label className="block space-y-1 text-sm">Template title<Input value={e.draft.title} maxLength={120} onChange={event => e.update({ ...e.draft, title: event.target.value })} /></label>
          <label className="block space-y-1 text-sm">Teacher note<Input value={e.draft.note} maxLength={1000} onChange={event => e.update({ ...e.draft, note: event.target.value })} /></label>
          <p className="text-sm"><strong>{EXPONENT_CATALOG.find(item => item.rule === e.draft.rule)?.name}</strong> · Enter only integer k · Equality must hold for every positive real x.</p>
          <div className="grid gap-3 sm:grid-cols-2">{(["m", "n"] as const).map(variable => <div key={variable} className="grid grid-cols-2 gap-2">{(["min", "max"] as const).map(bound => <label className="space-y-1 text-sm" key={bound}>{variable} {bound === "min" ? "minimum" : "maximum"}<Input type="number" min={-6} max={6} step={1} value={Number.isFinite(e.draft[variable][bound]) ? e.draft[variable][bound] : ""} onChange={event => setRange(variable, bound, event.target.value)} /></label>)}</div>)}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Answer sign<select aria-label="Answer sign" form="" className={selectClass} value={e.draft.resultSign} onChange={event => e.update({ ...e.draft, resultSign: event.target.value as MathPreset["resultSign"] })}><option value="any">Any sign</option><option value="positive">Positive only</option><option value="negative">Negative only</option></select></label>
            <label className="space-y-1 text-sm">Preview count<Input type="number" min={1} max={10} step={1} value={Number.isFinite(e.count) ? e.count : ""} onChange={event => e.setCount(event.target.value === "" ? NaN : Number(event.target.value))} /></label>
          </div>
          <label className="flex items-start gap-2 text-sm"><input form="" type="checkbox" className="mt-1" checked={e.draft.includeIdentityCases} onChange={event => e.update({ ...e.draft, includeIdentityCases: event.target.checked })} />Include identity cases (0 or 1 input exponents, or a zero answer)</label>
          <p className="text-xs text-muted-foreground">Positive input exponents can produce negative quotient answers. These are intentional when any sign is selected.</p>
          <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => e.makePreview()}>Preview variants</Button><Button type="button" variant="outline" onClick={() => e.makePreview(true)}>New preview batch</Button><Button type="button" variant="outline" onClick={e.save}>Save template draft</Button></div>
        </fieldset>}
        {e.dirty && <Button type="button" variant="outline" disabled={e.busy} onClick={e.discard}>Discard template changes</Button>}
        {e.busy && <p role="status">Working…</p>}{e.error && <p role="alert" className="text-destructive">{e.error}</p>}{e.message && <p role="status">{e.message}</p>}
      </div>
      {e.preview && <section aria-label="Template variants" className="space-y-4">
        <h3 className="font-semibold">Preview: {e.preview.variants.length} of {e.preview.totalAvailable} distinct variants</h3>
        {e.preview.variants.length < e.preview.requestedCount && <p className="text-sm">All available variants are shown; no questions were repeated.</p>}
        {e.preview.variants.map((variant, i) => <article key={variant.id} className="space-y-2 rounded-md border p-3">
          <h4 className="font-medium">Variant {i + 1}</h4><QuestionPreview question={{ type: "short_answer", question: variant.prompt }} />
          <div className="text-sm"><strong>Teacher answer: {variant.answerContract.expected}</strong><p>{variant.explanation}</p><p className="text-muted-foreground">m = {variant.parameters.m}, n = {variant.parameters.n}</p></div>
          <div className="flex flex-wrap items-end gap-2"><label className="text-sm">Try an answer for variant {i + 1}<Input disabled={e.busy} maxLength={5000} value={e.answers[variant.id] ?? ""} onChange={event => e.changeAnswer(variant.id, event.target.value)} /></label><Button type="button" variant="outline" disabled={e.busy || !e.detail?.supported && !!e.detail} onClick={() => e.tryAnswer(variant.id)}>Check variant {i + 1}</Button></div>
          {e.grades[variant.id] && <p role="status">{gradeLabel(e.grades[variant.id])}</p>}
        </article>)}
        <div className="space-y-2 rounded-md bg-muted p-3">
          <label className="flex items-start gap-2 text-sm"><input form="" type="checkbox" className="mt-1" checked={e.confirmed} disabled={e.busy || e.dirty || e.readOnly || e.detail?.revision.state !== "draft"} onChange={event => e.setConfirmed(event.target.checked)} />I reviewed these variants, the intended exponent rule, positive-base assumption, and integer-only answer format.</label>
          <Button type="button" disabled={e.busy || !e.confirmed || e.dirty || e.readOnly || e.detail?.revision.state !== "draft"} onClick={e.approve}>Approve reviewed template</Button>
          <p className="text-xs text-muted-foreground">Save a draft before approving. Approval records this version for authoring reuse; it does not publish a fight.</p>
        </div>
      </section>}
    </div>}
  </section>;
}
