import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { PASCAL_TEMPLATES, pascalVariants, type SelectedTemplate } from "@shared/math/templates/pascal";
import { useState } from "react";

export function PascalQuizPicker({ selected, onChange, fixedCount }: {
  selected: SelectedTemplate[];
  onChange: (templates: SelectedTemplate[]) => void;
  fixedCount: number;
}) {
  const [sample, setSample] = useState(7);
  return <Card>
    <CardHeader><CardTitle>Pascal’s triangle &amp; binomial templates</CardTitle>
      <p className="text-sm text-muted-foreground">Select the skills for this quiz. Each new fight draws fresh questions. Set the target rounds on the Enemies tab.</p>
    </CardHeader>
    <CardContent className="space-y-3">
      {PASCAL_TEMPLATES.map(template => {
        const active = selected.find(item => item.id === template.id);
        const variants = pascalVariants(template.id);
        const example = variants[sample % variants.length];
        return <div key={template.id} className="space-y-2 rounded-md border p-3">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" checked={!!active} disabled={!active && fixedCount + selected.length >= 1000}
              onChange={e => onChange(e.target.checked ? [...selected, { id: template.id, timeLimit: template.timeLimit }]
                : selected.filter(item => item.id !== template.id))} />
            {template.title}
          </label>
          <details className="text-sm"><summary className="cursor-pointer">Example and answer</summary>
            <RichContentRenderer html={example.question} className="mt-2" />
            <p>Answer: {example.correctAnswer}</p>
          </details>
          {active && <label className="flex flex-wrap items-center gap-2 text-sm">
            Question timer
            <select aria-label={template.title + " timer"} className="rounded border bg-background p-1" value={active.timeLimit}
              onChange={e => onChange(selected.map(item => item.id === active.id ? { ...item, timeLimit: Number(e.target.value) } : item))}>
              {[...new Set([15, 30, 45, 60, 90, 120, active.timeLimit])].sort((a, b) => a - b)
                .map(seconds => <option key={seconds} value={seconds}>{seconds} s</option>)}
            </select>
          </label>}
        </div>;
      })}
      <Button type="button" size="sm" variant="outline" onClick={() => setSample(i => i + 1)}>Try other examples</Button>
    </CardContent>
  </Card>;
}
