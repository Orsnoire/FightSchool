import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AvatarAppearanceEditor } from '@/components/AvatarAppearanceEditor';
import { StaticAvatar } from '@/components/StaticAvatar';
import { initialAppearance } from '@shared/avatar/appearance';
import type { AASummary, AACustomizationInput } from '@shared/contracts/advancement';
import type { Student } from '@shared/schema';

export function RecustomizationDialog({ open, onOpenChange, student, summary, onSave }: {
  open: boolean; onOpenChange: (open: boolean) => void; student: Student; summary: AASummary;
  onSave: (input: AACustomizationInput, initial: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(summary.characterName);
  const [appearance, setAppearance] = useState(() => initialAppearance(summary.appearance, student.gender === 'B' ? 'human-female-v1' : 'human-male-v1'));
  const [revision, setRevision] = useState(summary.revision);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const request = useRef({ key: '', id: '' });
  const cost = summary.catalog.find(upgrade => upgrade.id === 'recustomization')!.costs[0];
  const initial = !summary.appearance;
  const changed = name.trim() !== summary.characterName || JSON.stringify(appearance) !== JSON.stringify(summary.appearance);
  const submit = async () => {
    const fields = { catalogVersion: 1 as const, revision, characterName: name.trim(), appearance };
    const key = JSON.stringify(fields);
    if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
    setSaving(true); setError('');
    try { await onSave({ ...fields, requestId: request.current.id }, initial); onOpenChange(false); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save. Your draft is retained.'); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? 'Create your initial appearance' : 'Recustomize your character'}</DialogTitle>
        <DialogDescription>{initial ? `Your first appearance is free. Later character changes cost ${cost} AA.` : `Change several attributes together for ${cost} AA. Preview and cancellation are free.`}</DialogDescription>
      </DialogHeader>
      <div className="grid sm:grid-cols-2 gap-5 items-start">
        <StaticAvatar appearance={appearance} job={student.characterClass || 'warrior'} loadout={student} className="h-72 max-w-full aspect-[1200/1950] mx-auto" />
        <div className="space-y-4">
          <label className="block text-sm font-medium">Character name
            <input aria-label="Character name" maxLength={80} value={name} disabled={initial || saving} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" />
          </label>
          <p className="text-xs text-muted-foreground break-words">Login name stays {student.nickname}.{initial ? ' You can rename your character after creating its appearance.' : ''}</p>
          <fieldset disabled={saving}><AvatarAppearanceEditor value={appearance} onChange={setAppearance} /></fieldset>
          {!initial && <p className="text-sm">Available: <strong>{summary.wallet.available} AA</strong> · After saving: {Math.max(0, summary.wallet.available - cost)} AA</p>}
          {error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" disabled={saving} onClick={() => {
            setName(summary.characterName); setAppearance(initialAppearance(summary.appearance, student.gender === 'B' ? 'human-female-v1' : 'human-male-v1')); setRevision(summary.revision); setError(''); request.current = {key:'',id:''};
          }}>Discard draft and reload current character</Button></div>}
          {!initial && summary.wallet.available < cost && <p className="text-sm">You need {cost} available AA to save changes.</p>}
          <div className="flex flex-wrap gap-2"><Button onClick={submit} disabled={saving || !changed || !name.trim() || (!initial && summary.wallet.available < cost)}>
            {saving ? 'Saving…' : initial ? 'Save initial appearance — Free' : `Save changes — ${cost} AA`}</Button>
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button></div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
