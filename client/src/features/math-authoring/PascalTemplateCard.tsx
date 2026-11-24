import { useState } from "react";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { Button } from "@/components/ui/button";
import { pascalVariants, type SelectedTemplate } from "@shared/math/templates/pascal";
import type { MathCatalogEntry } from "@shared/math/templates/catalog";

export interface QuizSelectionProps {
  selected: SelectedTemplate[];
  onChange: (templates: SelectedTemplate[]) => void;
  fixedCount: number;
}

export function PascalTemplateCard({ item, selected, onChange, fixedCount }: QuizSelectionProps & {
  item: Extract<MathCatalogEntry, { family: "pascal" }>;
}) {
  const [sample, setSample] = useState(7);
  const variants = pascalVariants(item.rule);
  const example = variants[sample % variants.length];
  const active = selected.find(template => template.id === item.rule);
  return <article className="space-y-2 rounded-md border p-3">
    <h3 className="font-medium">{item.name}</h3>
    <p className="text-sm text-muted-foreground">{item.description}</p>
    <details className="text-sm">
      <summary className="cursor-pointer">Example and answer</summary>
      <RichContentRenderer html={example.question} className="mt-2" />
      <p>Answer: {example.correctAnswer}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => setSample(i => i + 1)}>Another example</Button>
    </details>
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" aria-label={`Use ${item.name} in this fight`} checked={!!active}
        disabled={!active && fixedCount + selected.length >= 1000}
        onChange={e => onChange(e.target.checked ? [...selected, { id: item.rule, timeLimit: item.timeLimit }]
          : selected.filter(template => template.id !== item.rule))} />
      Use in this fight
    </label>
    {active && <label className="flex flex-wrap items-center gap-2 text-sm">Question timer
      <select aria-label={item.name + " timer"} className="rounded border bg-background p-1" value={active.timeLimit}
        onChange={e => onChange(selected.map(template => template.id === item.rule
          ? { ...template, timeLimit: Number(e.target.value) } : template))}>
        {[...new Set([15, 30, 45, 60, 90, 120, active.timeLimit])].sort((a, b) => a - b)
          .map(seconds => <option key={seconds} value={seconds}>{seconds} s</option>)}
      </select>
    </label>}
  </article>;
}
