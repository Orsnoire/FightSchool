import { useQueryClient } from "@tanstack/react-query";
import { saveStudentLoadout } from "@/lib/studentLoadout";
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { StaticAvatar } from '@/components/StaticAvatar';
import { AvatarAppearanceEditor } from '@/components/AvatarAppearanceEditor';
import { useAvatarAppearance } from '@/hooks/useAvatarAppearance';
import { initialAppearance, JOB_PRESENTATION, STARTER_JOBS, type StarterJob } from '@shared/avatar/appearance';
import { CLASS_STATS } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export default function CharacterSelect() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const studentId = localStorage.getItem('studentId');
  const saved = useAvatarAppearance(studentId);
  const [job, setJob] = useState<StarterJob>('warrior');
  const [appearance, setAppearance] = useState(() => initialAppearance());
  const [saving, setSaving] = useState(false);
  // Only a saved appearance update replaces shared values. Changing job never does.
  useEffect(() => { if (saved.data) setAppearance({ ...saved.data }); }, [saved.data]);
  const client = useQueryClient();
  const handleConfirm = async () => {
    if (!studentId || saved.isLoading || saved.isError || saving) return;
    setSaving(true);
    try {
      const persisted = await saved.save(appearance);
      await saveStudentLoadout(client, studentId!, 'character', {characterClass:job,gender:persisted.modelId === 'human-female-v1' ? 'B' : 'A'});
      navigate('/student/lobby');
    } catch {
      toast({ title: 'Unable to save your character. Please try again.', variant: 'destructive' });
    } finally { setSaving(false); }
  };
  return <main className="min-h-screen bg-background p-4">
    <div className="container mx-auto max-w-5xl">
      <h1 className="text-4xl font-serif font-bold mt-6" data-testid="text-select-title">Create Your Character</h1>
      <p className="text-muted-foreground mt-2 mb-6">Choose your appearance and starting job. Your colors stay with you when you change jobs.</p>
      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardContent className="p-4 flex justify-center">
          <StaticAvatar appearance={appearance} job={job} className="h-[460px] max-w-full aspect-[1200/1950]" />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Your character</CardTitle></CardHeader><CardContent className="space-y-5">
          <label className="block text-sm">Job<select aria-label="Job" value={job} onChange={e => setJob(e.target.value as StarterJob)} className="block w-full rounded border bg-background p-2 mt-1">
            {STARTER_JOBS.map(j => <option key={j} value={j}>{JOB_PRESENTATION[j].name}</option>)}
          </select></label>
          <AvatarAppearanceEditor value={appearance} onChange={setAppearance} modelLocked={!!saved.data} />
          <div className="text-sm space-y-2"><p>{JOB_PRESENTATION[job].clothing}</p><p>{JOB_PRESENTATION[job].head}</p>
            <p>Right hand: {JOB_PRESENTATION[job].right} · Left hand: {JOB_PRESENTATION[job].left}</p>
          </div>
          {saved.isError && <p role="alert">Your saved appearance could not load. <button className="underline" onClick={() => saved.refetch()}>Try again</button></p>}
          <Button size="lg" className="w-full" onClick={handleConfirm} disabled={!studentId || saved.isLoading || saved.isError || saving} data-testid="button-confirm-character">{saving ? 'Saving…' : 'Confirm Selection'}</Button>
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {STARTER_JOBS.map(j => <button key={j} onClick={() => setJob(j)} aria-pressed={job === j} data-testid={`card-class-${j}`} className={`text-left rounded-lg border p-4 ${job === j ? 'ring-2 ring-primary' : ''}`}>
          <span className="font-semibold">{JOB_PRESENTATION[j].name}</span><p className="text-sm text-muted-foreground mt-1">{CLASS_STATS[j].role}</p>
        </button>)}
      </div>
    </div>
  </main>;
}
